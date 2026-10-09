import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyCreditToInvoice,
  creditNoteAllocation,
  creditUsableOn,
  customerCreditConsistent,
  customerCreditOpen,
  invoiceLedgerKind,
  paymentAllocation,
  refundInitialStatus,
  refundTransition,
  releaseRefund,
  reserveForRefund,
  settleRefund,
} from "../app/admin/finance/refund-policy.ts";
import { taxDocumentNumber } from "../app/admin/finance/finance-data.ts";
import { portalInvoiceView } from "../app/portal/portal-access-policy.ts";
import { buildStatement } from "../app/portal/portal-statement.ts";
import { workflowWorkspaces, activeWorkspace } from "../app/admin/workflow-navigation.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const credit = (values = {}) => ({ amount: 10_000, available: 10_000, reserved: 0, refunded: 0, applied: 0, ...values });
const accounts = { role: "accounts", email: "accounts@kcpl.com.np", canManageFinance: true };
const manager = { role: "management", email: "owner@kcpl.com.np", canManageFinance: true };

// Where customer credit comes from
test("a credit note comes off what is owed first; what was already paid becomes credit", () => {
  // 113,000 invoice, 100,000 paid: 13,000 owed.
  assert.deepEqual(creditNoteAllocation({ total: 113_000, balance_due: 13_000 }, 5_000), { ok: true, amount: 5_000, fromBalance: 5_000, toCustomerCredit: 0 });
  assert.deepEqual(creditNoteAllocation({ total: 113_000, balance_due: 13_000 }, 20_000), { ok: true, amount: 20_000, fromBalance: 13_000, toCustomerCredit: 7_000 });
  // A paid invoice credited in full: all of it is the customer's credit.
  assert.deepEqual(creditNoteAllocation({ total: 113_000, balance_due: 0 }, 113_000), { ok: true, amount: 113_000, fromBalance: 0, toCustomerCredit: 113_000 });
  assert.deepEqual(creditNoteAllocation({ total: 113_000, balance_due: 0 }, 113_000.01), { ok: false, reason: "exceeds_total" });
  assert.deepEqual(creditNoteAllocation({ total: 113_000, balance_due: 0 }, 0), { ok: false, reason: "invalid_amount" });
});

test("more than is owed is refused unless accounts keep the extra as credit", () => {
  assert.deepEqual(paymentAllocation(113_000, 120_000, false), { ok: false, reason: "overpayment" });
  assert.deepEqual(paymentAllocation(113_000, 120_000, true), { ok: true, amount: 120_000, applied: 113_000, excess: 7_000 });
  assert.deepEqual(paymentAllocation(113_000, 50_000, true), { ok: true, amount: 50_000, applied: 50_000, excess: 0 });
  // Paid twice: nothing owed, all of it credit.
  assert.deepEqual(paymentAllocation(0, 113_000, true), { ok: true, amount: 113_000, applied: 0, excess: 113_000 });
  assert.deepEqual(paymentAllocation(100, "abc", true), { ok: false, reason: "invalid_amount" });
  assert.deepEqual(paymentAllocation(100, -5, true), { ok: false, reason: "invalid_amount" });
});

// What a credit can do
test("a credit always adds up: free, held for refunds, refunded and used", () => {
  const held = reserveForRefund(credit(), 4_000);
  assert.equal(held.ok, true);
  assert.deepEqual(held.next, credit({ available: 6_000, reserved: 4_000 }));
  assert.equal(reserveForRefund(held.next, 6_000.01).reason, "exceeds_available");
  const paid = settleRefund(held.next, 4_000);
  assert.deepEqual(paid.next, credit({ available: 6_000, refunded: 4_000 }));
  const back = releaseRefund(held.next, 4_000);
  assert.deepEqual(back.next, credit());
  assert.equal(customerCreditConsistent(paid.next), true);
  assert.equal(customerCreditConsistent(credit({ available: 9_000 })), false);
  assert.equal(reserveForRefund(credit({ available: 9_000 }), 10).reason, "inconsistent_credit");
  assert.equal(customerCreditOpen(credit({ available: 0, applied: 10_000 })), false);
  assert.equal(customerCreditOpen(credit({ available: 0, reserved: 10_000 })), true, "a refund still waiting keeps the credit open");
});

test("credit used on an invoice never exceeds what it owes, and only the same customer and currency", () => {
  assert.equal(applyCreditToInvoice(credit(), 6_000, 5_000).reason, "exceeds_available");
  assert.deepEqual(applyCreditToInvoice(credit(), 5_000, 5_000).next, credit({ available: 5_000, applied: 5_000 }));
  const invoice = { customer_id: "C1", currency: "NPR", status: "issued", balance_due: 5_000 };
  assert.deepEqual(creditUsableOn({ customer_id: "C1", currency: "NPR" }, invoice), { ok: true });
  assert.equal(creditUsableOn({ customer_id: "C2", currency: "NPR" }, invoice).reason, "other_customer");
  assert.equal(creditUsableOn({ customer_id: "C1", currency: "USD" }, invoice).reason, "currency_mismatch");
  assert.equal(creditUsableOn({ customer_id: "C1", currency: "NPR" }, { ...invoice, status: "paid", balance_due: 0 }).reason, "nothing_owed");
  assert.equal(creditUsableOn({ customer_id: "C1", currency: "NPR" }, { ...invoice, status: "draft" }).reason, "nothing_owed");
});

// Who moves a refund on
test("Management approve refunds, never their own; Accounts pay them once approved", () => {
  const asked = { status: "requested", requested_by_email: accounts.email };
  assert.equal(refundTransition(asked, "approve", accounts).reason, "management_only");
  assert.deepEqual(refundTransition(asked, "approve", manager), { ok: true, next: "approved", releasesCredit: false, settlesCredit: false });
  assert.equal(refundTransition({ ...asked, requested_by_email: manager.email }, "approve", manager).reason, "own_request");
  assert.equal(refundTransition(asked, "pay", accounts).reason, "invalid_status", "not paid before it is approved");
  assert.deepEqual(refundTransition({ ...asked, status: "approved" }, "pay", accounts), { ok: true, next: "paid", releasesCredit: false, settlesCredit: true });
  assert.equal(refundTransition(asked, "reject", accounts).reason, "management_only");
  assert.equal(refundTransition(asked, "reject", manager).next, "rejected");
  assert.equal(refundTransition(asked, "cancel", accounts).next, "cancelled", "the person who asked can withdraw it");
  assert.equal(refundTransition(asked, "cancel", { ...accounts, email: "other@kcpl.com.np" }).reason, "management_only");
  assert.equal(refundTransition({ ...asked, status: "paid" }, "cancel", manager).reason, "invalid_status");
  assert.equal(refundTransition(asked, "approve", { ...manager, canManageFinance: false }).reason, "forbidden");
  assert.equal(refundInitialStatus("management"), "approved");
  assert.equal(refundInitialStatus("accounts"), "requested");
});

test("refunds paid are numbered per fiscal year", () => {
  assert.equal(taxDocumentNumber("refund", "2083-84", 1), "KCPL/RF/2083-84/00001");
});

// The ledger and what readers make of it
test("an invoice's payments say what each row is", () => {
  assert.equal(invoiceLedgerKind(undefined), "payment");
  assert.equal(invoiceLedgerKind("moved_to_credit"), "moved_to_credit");
  assert.equal(invoiceLedgerKind("credit_applied"), "credit_applied");
  assert.equal(invoiceLedgerKind("anything"), "payment");
  const ledger = read("app/admin/finance/customer-credit-ledger.server.ts");
  assert.match(ledger, /amount: -input\.amount/, "money moved to credit is negative, so the rows add up to amount_paid");
});

test("the statement counts only money received, lists refunds and says what is held", () => {
  const invoice = portalInvoiceView({ reference: "KCPL-I-1", status: "paid", record_type: "invoice", issue_date: "2026-10-01", due_date: "2026-10-30", total: 103_000, amount_paid: 103_000, moved_to_credit_total: 10_000, balance_due: 0 }, "2026-10-08");
  assert.equal(invoice.moved_to_credit_total, 10_000);
  const statement = buildStatement({
    invoices: [invoice],
    payments: [{ invoice: "KCPL-I-1", date: "2026-10-02", amount: 113_000, currency: "NPR", method: "bank_transfer", reference: "TXN-1" }],
    refunds: [{ number: "KCPL/RF/2083-84/00001", date: "2026-10-07", amount: 4_000, currency: "NPR", method: "bank_transfer", reference: "TXN-9" }],
    credits: [{ currency: "NPR", amount: 6_000 }],
    asOf: "2026-10-08",
  });
  const npr = statement.currencies[0];
  assert.equal(npr.received, 113_000);
  assert.equal(npr.refunded, 4_000);
  assert.equal(npr.creditHeld, 6_000);
  assert.equal(npr.refunds[0].number, "KCPL/RF/2083-84/00001");
  // Cash and TDS the customer withheld settle the invoice; credit moving in or out of it isn't money received.
  assert.match(read("app/portal/portal-statement.server.ts"), /\["payment", "tds_withheld"\]\.includes\(invoiceLedgerKind\(row\.get\("kind"\)\)\)/);
});

// Wiring
test("every refund route is finance-only and same-origin", () => {
  const auth = read("app/api/admin/finance/credit-route-auth.ts");
  assert.match(auth, /getAdminAccess\(\)/);
  assert.match(auth, /canManageFinance/);
  assert.match(auth, /isTrustedSameOriginRequest\(request\)/);
  for (const path of ["app/api/admin/finance/credits/[id]/refunds/route.ts", "app/api/admin/finance/credits/[id]/apply/route.ts", "app/api/admin/finance/refunds/[id]/route.ts"]) {
    assert.match(read(path), /await financeWriteRequest\(request\)/, path);
  }
  const server = read("app/admin/finance/customer-credits.server.ts");
  // Each money move happens inside one transaction with the credit it changes.
  for (const name of ["requestRefund", "moveRefund", "applyCustomerCredit"]) {
    assert.match(server, new RegExp(`export async function ${name}[\\s\\S]{0,1600}runTransaction`), name);
  }
  assert.match(server, /refundTransition\(refund, action, \{ role: context\.profile\.role, email: actor\.email/);
});

test("credit notes on paid invoices and kept overpayments create the credit in the same transaction", () => {
  const finance = read("app/admin/finance/finance.server.ts");
  assert.match(finance, /export async function createCreditNote[\s\S]{0,3500}writeNewCustomerCredit\(transaction/);
  const settlement = read("app/admin/financial-settlement/receivables-settlement.server.ts");
  assert.match(settlement, /settlementWithTds\(settled \? 0 : outstanding, input\.amount, tdsRequested, keepExcess\)/);
  assert.match(settlement, /writeNewCustomerCredit\(transaction/);
  // Online payments are never kept as credit automatically: accounts review them.
  assert.doesNotMatch(read("app/payments/payments.server.ts"), /keepExcessAsCredit/);
});

test("Credits & refunds is a Finance tab", () => {
  const tab = workflowWorkspaces.find((item) => item.id === "credits");
  assert.equal(tab?.hub, "finance");
  assert.equal(tab?.permission, "finance");
  const finance = { canManageJobFile: true, canManageStaff: false, canViewCommercial: true, canManageFinance: true, isManagement: false };
  assert.equal(activeWorkspace("/admin/finance/credits/credit-1", finance)?.id, "credits");
  assert.equal(activeWorkspace("/admin/finance/invoices/X", finance)?.id, "receivables");
});
