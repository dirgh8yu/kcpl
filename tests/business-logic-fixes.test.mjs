import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paymentDocumentId } from "../app/admin/financial-settlement/settlement-policy.ts";
import { billNetCost, combinedMargin, convertMoney, invoiceNetRevenue, jobCostCounts, sumInCurrency } from "../app/admin/finance/money-basis.ts";
import { invoiceDatesOnIssue } from "../app/invoice-effective-status.ts";
import { shipmentBillingCounts } from "../app/admin/finance/finance-data.ts";
import { customerTradingBlock } from "../app/admin/crm/crm-policy.ts";
import { staffCapabilitiesForRole } from "../app/admin/staff-permissions.ts";
import { allowedTransitions, workflowBlockerFix } from "../app/admin/workflow-guard.ts";
import { portalQuoteVisible, portalRequestOpen } from "../app/portal/portal-access-policy.ts";
import { freeTimeClockStopped, freeTimeStatus, shipmentFreeTimeFromRecord } from "../app/shipment-free-time.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// 1. Payments
test("two real payments of the same amount on the same day are two payments", () => {
  assert.notEqual(paymentDocumentId("KCPL-I-1", ""), paymentDocumentId("KCPL-I-1", ""));
  // A retry of one submission carries the same key and is recognised.
  assert.equal(paymentDocumentId("KCPL-I-1", "staff-abc"), paymentDocumentId("KCPL-I-1", "staff-abc"));
});

test("the staff payment forms send a key per payment and take a new one after it goes through", () => {
  for (const path of ["app/admin/finance/invoices/[reference]/invoice-workspace.tsx", "app/admin/payables/bills/[reference]/payable-workspace.tsx"]) {
    const source = read(path);
    assert.match(source, /"idempotency-key": paymentKey/);
    assert.match(source, /setPaymentKey\(newPaymentKey\(\)\)/);
  }
});

// 2-4. Profit, cost and currency
test("revenue is before VAT", () => {
  assert.equal(invoiceNetRevenue({ subtotal: 100_000, tax_total: 13_000, total: 113_000 }), 100_000);
  assert.equal(invoiceNetRevenue({ total: 50_000 }), 50_000);
  assert.equal(billNetCost({ total: 90_400, tax_total: 10_400 }), 80_000);
});

test("a hand-typed cost replaced by its supplier bill stops counting", () => {
  assert.equal(jobCostCounts({ amount: 50_000 }), true);
  assert.equal(jobCostCounts({ amount: 50_000, superseded_by_payable: "KCPL-P-1" }), false);
});

test("a USD invoice against NPR costs is one margin in NPR, not a 100% margin", () => {
  const table = { rates: { NPR: 1, USD: 133 }, date: "2026-10-08" };
  const margin = combinedMargin({ USD: 1_000 }, { NPR: 100_000 }, table);
  assert.equal(margin?.kind, "converted");
  assert.equal(margin.revenue, 133_000);
  assert.equal(margin.cost, 100_000);
  assert.equal(margin.profit, 33_000);
  assert.equal(Math.round(margin.margin_percent), 25);
  assert.equal(combinedMargin({ NPR: 10 }, { NPR: 5 }, table), null);
  assert.deepEqual(combinedMargin({ USD: 1 }, { NPR: 1 }, null), { kind: "unconverted", missing: ["USD"] });
});

test("amounts in other currencies are converted, and missing rates are named rather than dropped", () => {
  assert.equal(convertMoney(100, "INR", "NPR", { INR: 1.6 }), 160);
  assert.equal(convertMoney(133, "NPR", "USD", { USD: 133 }), 1);
  const sum = sumInCurrency({ NPR: 1_000, USD: 10, AED: 5 }, "NPR", { USD: 133 });
  assert.equal(sum.amount, 2_330);
  assert.deepEqual(sum.missing, ["AED"]);
});

test("the credit limit counts every currency the customer owes in", () => {
  const finance = read("app/admin/finance/finance.server.ts");
  assert.match(finance, /outstanding_by_currency/);
  assert.doesNotMatch(finance, /if \(currencyValue\(invoice\.get\("currency"\)\) !== currency\) continue;/);
});

// 5-7. Invoices
test("an invoice issued after it was drafted is dated the day it is issued and keeps its terms", () => {
  assert.deepEqual(invoiceDatesOnIssue("2026-09-01", "2026-09-16", "2026-09-20"), { issueDate: "2026-09-20", dueDate: "2026-10-05", moved: true });
  assert.deepEqual(invoiceDatesOnIssue("2026-09-20", "2026-10-05", "2026-09-20"), { issueDate: "2026-09-20", dueDate: "2026-10-05", moved: false });
});

test("the shipment invoice form starts from the agreed price and makes tax a choice", () => {
  const form = read("app/admin/finance/new/[shipmentReference]/shipment-invoice-form.tsx");
  assert.match(form, /agreedPrice/);
  // Each line says how it is charged, and nothing is chosen until someone chooses.
  assert.match(form, /InvoiceLinesEditor/);
  assert.match(read("app/admin/finance/invoice-lines-editor.tsx"), /quantity: "1", unitPrice: "", type: "", rate: ""/);
  assert.doesNotMatch(form, /taxRate: "0"/);
  for (const path of ["app/admin/finance/finance-workspace.tsx", "app/admin/finance/new/new-receivable-workspace.tsx", "app/admin/payables/payables-workspace.tsx"]) {
    assert.doesNotMatch(read(path), /taxRate: "0"/, path);
  }
});

test("a job can't close without an issued invoice, and Finance lists delivered work not yet invoiced", () => {
  assert.match(read("app/admin/workflow-guard.server.ts"), /if \(issuedInvoiceCount === 0\) closeBlockers\.push/);
  assert.deepEqual(workflowBlockerFix("Raise and issue the invoice."), { step: "invoice", label: "Open invoice" });
  assert.deepEqual(shipmentBillingCounts(["draft", "void", "issued", "paid"]), { issued: 2, draft: 1 });
  assert.match(read("app/admin/finance/finance-workspace.tsx"), /delivered, not invoiced/);
});

// 8-10, 17. Customers and quotes
test("on hold and blacklisted customers can't be booked", () => {
  assert.equal(customerTradingBlock("on_hold"), "on_hold");
  assert.equal(customerTradingBlock("blacklisted"), "blacklisted");
  assert.equal(customerTradingBlock("active"), null);
  for (const path of [
    "app/shipment-data.server.ts",
    "app/admin/tenders/tms-tendering.server.ts",
    "app/admin/commercial-authority/customer-sell-authority.server.ts",
    "app/admin/consolidation/tms-consolidation.server.ts",
    "app/admin/consolidation/tms-consolidation-allocation-booking.server.ts",
    "app/admin/consolidation/tms-consolidation-lineage.server.ts",
  ]) assert.match(read(path), /customerTradingBlock\(/, path);
  assert.match(read("app/api/admin/quotes/[reference]/route.ts"), /quoteCustomerTradingBlock\(reference\)/);
});

test("a won quote keeps the price the customer accepted", () => {
  assert.match(read("app/admin/admin-data.server.ts"), /quoteStatus\(snapshot\.get\("status"\)\) === "won"\) return \{ kind: "won-locked"/);
});

test("Accounts see prices but don't set them", () => {
  assert.equal(staffCapabilitiesForRole("accounts").canSetPrices, false);
  assert.equal(staffCapabilitiesForRole("commercial").canSetPrices, true);
  assert.equal(staffCapabilitiesForRole("management").canSetPrices, true);
  assert.equal(staffCapabilitiesForRole("accounts").canViewCommercial, true);
});

// 11-13. Portal
test("the portal shows a quote only once it has been sent, and drops finished requests", () => {
  assert.equal(portalQuoteVisible({ status: "reviewing", quoted_amount: 1000 }), false);
  assert.equal(portalQuoteVisible({ status: "quoted", quoted_amount: 1000 }), true);
  assert.equal(portalQuoteVisible({ status: "quoted", quoted_amount: null }), false);
  assert.equal(portalRequestOpen({ status: "reviewing", quoted_amount: 1000 }), true);
  assert.equal(portalRequestOpen({ status: "lost" }), false);
  assert.equal(portalRequestOpen({ status: "cancelled" }), false);
});

test("the free-time clock stops on the day the cargo leaves for delivery", () => {
  assert.equal(freeTimeClockStopped("out_for_delivery"), true);
  assert.equal(freeTimeClockStopped("in_transit"), false);
  const freeTime = shipmentFreeTimeFromRecord({ free_time_days: 3, free_time_started_on: "2026-09-01", free_time_daily_charge: 100, free_time_ended_on: "2026-09-06" });
  const status = freeTimeStatus(freeTime, "2026-09-20");
  assert.equal(status.daysOverdue, 3);
  assert.equal(status.projectedCharge, 300);
});

test("the portal reads all of a customer's invoices", () => {
  assert.doesNotMatch(read("app/portal/portal-data.server.ts"), /INVOICE_SCAN_LIMIT/);
  assert.match(read("app/portal/portal-data.server.ts"), /readAllDocuments\(firebaseAdminDb\(\)\.collection\("invoices"\)/);
});

// 14-15. Smaller contradictions
test("Delivered is final in the status rules", () => {
  assert.deepEqual(allowedTransitions.delivered, []);
});

test("Payables counts opening balances and payments the way Receivables does", () => {
  const payables = read("app/admin/payables/payables.server.ts");
  assert.match(payables, /summary\.opening_balance \+= bill\.total;/);
  assert.doesNotMatch(payables, /summary\.opening_balance \+= bill\.balance_due;/);
});

test("Accounts see transport orders but don't place, tender, book or consolidate them", () => {
  assert.equal(staffCapabilitiesForRole("accounts").canManageTransportOrders, false);
  assert.equal(staffCapabilitiesForRole("commercial").canManageTransportOrders, true);
  assert.equal(staffCapabilitiesForRole("management").canManageTransportOrders, true);
  assert.equal(staffCapabilitiesForRole("operations").canManageTransportOrders, false);
  assert.match(read("app/admin/rating/tms-rating.server.ts"), /export async function createTmsOrder[\s\S]{0,200}canManageTransportOrders/);
  for (const path of ["app/admin/tenders/tms-tendering.server.ts", "app/admin/consolidation/tms-consolidation.server.ts", "app/api/admin/edi/route.ts"]) {
    assert.doesNotMatch(read(path), /permissions\.canEditCommercial/, path);
  }
  // New shipment isn't offered where it would be refused.
  assert.match(read("app/admin/shipments/page.tsx"), /canStartShipment=\{staff\.permissions\.canManageTransportOrders\}/);
  assert.match(read("app/admin/operations-command-palette.tsx"), /allowedIds\.has\("rating"\) && canStartShipment/);
});

test("before the navigation API answers, New shipment follows the same roles", async () => {
  const { canStartShipment } = await import("../app/admin/workflow-navigation.ts");
  const base = { canManageJobFile: true, canManageStaff: false };
  assert.equal(canStartShipment({ ...base, canViewCommercial: true, canManageFinance: true, isManagement: false }), false, "Accounts");
  assert.equal(canStartShipment({ ...base, canViewCommercial: true, canManageFinance: false, isManagement: false }), true, "Commercial");
  assert.equal(canStartShipment({ ...base, canViewCommercial: true, canManageFinance: true, isManagement: true }), true, "Management");
  assert.equal(canStartShipment({ ...base, canViewCommercial: false, canManageFinance: false, isManagement: false }), false, "Operations");
});
