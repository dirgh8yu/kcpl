import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  payableBookDate,
  vatBooksChangedSinceFiling,
  vatFilingFromInput,
  vatPeriodFileable,
  vatPeriodLockedMessage,
  vatPeriodOfDate,
  vatPeriodsOfDates,
  vatReopenReasonValid,
} from "../app/admin/finance/vat-period-lock.ts";
import { purchaseBookRow } from "../app/admin/finance/tax-books.ts";
import {
  depositFromInput,
  depositFromRecord,
  depositRefundDue,
  depositRefundFromInput,
  depositStage,
  depositStageBadge,
  depositsOutstanding,
  expectedDepositDeduction,
} from "../app/container-deposits.ts";
import { containerFromRecord, containerMovementUpdate } from "../app/shipment-containers.ts";
import { partnerBillCategory, partnerBillFromInput, partnerBillReadingCheck, partnerBillStatusLabel, partnerBillTotal } from "../app/partner/partner-bills.ts";
import {
  claimBadge,
  claimFilingFromInput,
  claimFromRecord,
  claimNoticeDays,
  claimNoticeDaysLeft,
  claimNoticeDue,
  claimReportFromInput,
  claimSettlementFromInput,
  portalClaimView,
} from "../app/cargo-claims.ts";
import { portalDocumentReleased } from "../app/portal/portal-access-policy.ts";
import { activeWorkspace, workflowWorkspaces } from "../app/admin/workflow-navigation.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Filed VAT months
test("a VAT month is the Nepali month a date falls in, and can be filed only once it is over", () => {
  assert.deepEqual(vatPeriodOfDate("2026-09-20"), { year: 2083, month: 6, id: "2083-06", label: "Asoj 2083" });
  assert.deepEqual(vatPeriodsOfDates(["2026-09-17", "2026-10-17", null, "2026-09-16"]).map((period) => period.id), ["2083-06", "2083-05"]);
  // Asoj 2083 runs to 17 October 2026.
  assert.equal(vatPeriodFileable(2083, 6, "2026-10-10"), false);
  assert.equal(vatPeriodFileable(2083, 6, "2026-10-18"), true);
  assert.equal(vatPeriodFileable(2083, 5, "2026-10-10"), true);
});

test("filing records the day it was filed: after the month, not in the future", () => {
  assert.deepEqual(vatFilingFromInput(2083, 6, {}, "2026-10-10"), { ok: false, error: "not_ended" });
  assert.deepEqual(vatFilingFromInput(2083, 5, { filedOn: "2026-09-10" }, "2026-10-10"), { ok: false, error: "invalid_date" });
  assert.deepEqual(vatFilingFromInput(2083, 5, { filedOn: "2026-10-11" }, "2026-10-10"), { ok: false, error: "invalid_date" });
  assert.deepEqual(vatFilingFromInput(2083, 5, { filedOn: "2026-10-05", reference: "  IRD-998 " }, "2026-10-10"), { ok: true, filedOn: "2026-10-05", reference: "IRD-998" });
  assert.deepEqual(vatFilingFromInput(2083, 5, {}, "2026-10-10"), { ok: true, filedOn: "2026-10-10", reference: null });
  assert.equal(vatReopenReasonValid("typo"), false);
  assert.equal(vatReopenReasonValid("Amended return agreed with the tax office"), true);
  assert.match(vatPeriodLockedMessage("Bhadra 2083"), /Bhadra 2083 is filed .* ask Management to reopen Bhadra 2083/);
});

test("a supplier bill that came in after its month was filed counts in the month it was approved", () => {
  assert.equal(payableBookDate({ bill_date: "2026-09-02" }), "2026-09-02");
  assert.equal(payableBookDate({ bill_date: "2026-09-02", vat_booked_on: "2026-10-04" }), "2026-10-04");
  const late = purchaseBookRow("KCPL-B-1", { status: "approved", bill_date: "2026-09-02", vat_booked_on: "2026-10-04", subtotal: 1000, tax_total: 130, currency: "NPR" }, null);
  assert.equal(late.booked_late, true);
  assert.equal(late.date, "2026-09-02", "the supplier's own date stays on the row");
  assert.equal(purchaseBookRow("KCPL-B-2", { status: "approved", bill_date: "2026-09-02", subtotal: 1000, currency: "NPR" }, null).booked_late, false);
});

test("a change to a filed month's figures is noticed; rounding is not", () => {
  const filed = { output_vat: 1300, input_vat: 520, net_vat: 780, sales: 4, purchases: 2 };
  assert.equal(vatBooksChangedSinceFiling(null, filed), false);
  assert.equal(vatBooksChangedSinceFiling(filed, { ...filed, output_vat: 1300.004 }), false);
  assert.equal(vatBooksChangedSinceFiling(filed, { ...filed, input_vat: 650 }), true);
  assert.equal(vatBooksChangedSinceFiling(filed, { ...filed, sales: 5 }), true);
});

test("every writer of a dated finance record asks whether its month is filed", () => {
  const guarded = [
    ["app/admin/financial-settlement/receivables-settlement.server.ts", "lockedVatPeriod([paymentDate], transaction)"],
    ["app/admin/financial-settlement/payables-settlement.server.ts", "lockedVatPeriod([paymentDate], transaction)"],
    ["app/admin/finance/customer-credits.server.ts", "lockedVatPeriod([paidOn], transaction)"],
    ["app/admin/finance/customer-credits.server.ts", "lockedVatPeriod([receivedOn], transaction)"],
    ["app/admin/finance/staff-cash.server.ts", "lockedVatPeriod([givenOn], transaction)"],
    ["app/admin/finance/staff-cash.server.ts", "lockedVatPeriod([settledOn], transaction)"],
    ["app/admin/finance/finance.server.ts", "lockedVatPeriod([loaded.invoice.issue_date])"],
    ["app/admin/payables/payables.server.ts", "lockedVatPeriod([payableBookDate(loaded.bill)])"],
    ["app/admin/payables/payables.server.ts", "lockedVatPeriod([loaded.bill.bill_date])"],
  ];
  for (const [file, call] of guarded) assert.ok(read(file).includes(call), `${file} should call ${call}`);
  // Reopening is Management's; marking filed needs every branch in view.
  const server = read("app/admin/finance/vat-period-lock.server.ts");
  assert.match(server, /can_reopen: finance && context\.permissions\.role === "management"/);
  assert.match(server, /context\.permissions\.canManageFinance && context\.can_access_all_branches/);
});

// Container deposits
const containers = [
  containerFromRecord("MSKU9070323", { number: "MSKU9070323", gated_out_on: "2026-09-20", empty_returned_on: "2026-10-08", detention_free_days: 14, detention_daily_rate: 2000, detention_currency: "NPR" }),
  containerFromRecord("TGHU1234567", { number: "TGHU1234567", gated_out_on: "2026-09-20", detention_free_days: 14, detention_daily_rate: 25, detention_currency: "USD" }),
];

test("a deposit covers chosen boxes; all of them is stored as none, so boxes added later are covered", () => {
  const today = "2026-10-10";
  assert.deepEqual(depositFromInput({ shippingLine: "A", amount: 5 }, ["MSKU9070323"], today), { ok: false, error: "line" });
  assert.deepEqual(depositFromInput({ shippingLine: "CMA CGM", amount: 0 }, [], today), { ok: false, error: "amount" });
  assert.deepEqual(depositFromInput({ shippingLine: "CMA CGM", amount: 100, paidOn: "2026-10-11" }, [], today), { ok: false, error: "date" });
  assert.deepEqual(depositFromInput({ shippingLine: "CMA CGM", amount: 100, containerNumbers: ["ABCU0000000"] }, ["MSKU9070323"], today), { ok: false, error: "containers" });
  const all = depositFromInput({ shippingLine: "CMA CGM", amount: "100000", containerNumbers: ["MSKU9070323", "TGHU1234567"] }, ["MSKU9070323", "TGHU1234567"], today);
  assert.equal(all.ok, true);
  assert.deepEqual(all.value.container_numbers, []);
  assert.equal(all.value.paid_on, today);
  assert.equal(all.value.currency, "NPR");
  const one = depositFromInput({ shippingLine: "CMA CGM", amount: 50000, containerNumbers: ["msku9070323"] }, ["MSKU9070323", "TGHU1234567"], today);
  assert.deepEqual(one.value.container_numbers, ["MSKU9070323"]);
});

test("a deposit is claimable once its boxes are back, overdue a month after the claim, and expects detention off", () => {
  const today = "2026-10-20";
  const one = depositFromRecord("d1", { shipment_reference: "KCPL-S-1", shipping_line: "CMA CGM", amount: 100000, currency: "NPR", paid_on: "2026-09-18", status: "held", container_numbers: ["MSKU9070323"] });
  const both = depositFromRecord("d2", { ...one, container_numbers: [] });
  assert.deepEqual(depositStage(one, containers, today), { stage: "to_claim", since: "2026-10-08", days: 12, late: true });
  assert.deepEqual(depositStage(both, containers, today), { stage: "boxes_out", out: 1, total: 2 });
  assert.equal(depositStageBadge(depositStage(one, containers, today)).label, "Unclaimed 12 days");
  const claimed = depositFromRecord("d3", { ...one, status: "claimed", claimed_on: "2026-09-10" });
  assert.deepEqual(depositStage(claimed, containers, "2026-10-20"), { stage: "claimed", days: 40, overdue: true });
  // 14 free days from 20 September (the last is 3 October); returned 8 October: 5 days at 2,000.
  const expected = expectedDepositDeduction(both, containers, "2026-10-08");
  assert.equal(expected.deduction, 10000);
  assert.equal(expected.expected_back, 90000);
  assert.deepEqual(expected.other, [{ currency: "USD", amount: 125 }], "detention in dollars is listed, never converted");
  assert.deepEqual(depositsOutstanding([one, claimed, depositFromRecord("d4", { ...one, status: "refunded" })]), [{ currency: "NPR", amount: 200000 }]);
});

test("a refund is never more than the deposit, and anything kept back needs a reason", () => {
  const deposit = { amount: 100000, paid_on: "2026-09-18", claimed_on: "2026-10-09" };
  assert.deepEqual(depositRefundFromInput(deposit, { amountReceived: 100001 }, "2026-10-20"), { ok: false, error: "amount" });
  assert.deepEqual(depositRefundFromInput(deposit, { amountReceived: "" }, "2026-10-20"), { ok: false, error: "amount" });
  assert.deepEqual(depositRefundFromInput(deposit, { amountReceived: 92000 }, "2026-10-20"), { ok: false, error: "reason" });
  assert.deepEqual(depositRefundFromInput(deposit, { amountReceived: 92000, deductionReason: "other" }, "2026-10-20"), { ok: false, error: "reason" });
  assert.deepEqual(depositRefundFromInput(deposit, { amountReceived: 92000, deductionReason: "detention", receivedOn: "2026-10-19" }, "2026-10-20"), { ok: true, value: { refunded_on: "2026-10-19", amount_refunded: 92000, deduction: 8000, deduction_reason: "detention", closed_note: null } });
  assert.deepEqual(depositRefundFromInput(deposit, { amountReceived: 100000, deductionReason: "damage" }, "2026-10-20").value.deduction_reason, null);
  assert.deepEqual(depositRefundFromInput(deposit, { amountReceived: 1, receivedOn: "2026-09-01", deductionReason: "damage" }, "2026-10-20"), { ok: false, error: "date" });
});

// Partner bills
test("a partner's invoice is checked, falls under their role's cost, and reads as a status they understand", () => {
  const today = "2026-10-10";
  assert.deepEqual(partnerBillFromInput({ invoiceNumber: "", invoiceDate: today, currency: "USD", amount: 10, vatRate: 0 }, today), { ok: false, error: "number" });
  assert.deepEqual(partnerBillFromInput({ invoiceNumber: "INV-9", invoiceDate: "2026-10-11", currency: "USD", amount: 10 }, today), { ok: false, error: "date" });
  assert.deepEqual(partnerBillFromInput({ invoiceNumber: "INV-9", invoiceDate: today, currency: "XYZ", amount: 10 }, today), { ok: false, error: "currency" });
  assert.deepEqual(partnerBillFromInput({ invoiceNumber: "INV-9", invoiceDate: today, currency: "USD", amount: 10, vatRate: 18 }, today), { ok: false, error: "vat" });
  const bill = partnerBillFromInput({ invoiceNumber: "INV-9", invoiceDate: today, currency: "NPR", amount: "20000", vatRate: "13" }, today);
  assert.equal(bill.ok, true);
  assert.deepEqual(partnerBillTotal(bill.value), { vat: 2600, total: 22600 });
  assert.equal(partnerBillCategory("trucker"), "transport");
  assert.equal(partnerBillCategory("origin_agent"), "agent");
  assert.equal(partnerBillCategory(null), "other");
  assert.equal(partnerBillStatusLabel("draft"), "Received, being checked");
  assert.equal(partnerBillStatusLabel("void"), "Not accepted");
});

test("what the reader finds on the partner's invoice is compared with what they typed", () => {
  const entered = { invoiceNumber: "INV-0091", currency: "USD", total: 1250, amount: 1250 };
  assert.deepEqual(partnerBillReadingCheck(entered, { document_number: "inv 0091", currency: "usd", invoice_total: 1250 }), { matches: true, issues: [] });
  const off = partnerBillReadingCheck(entered, { document_number: "INV-0092", currency: "EUR", invoice_total: 1350 });
  assert.equal(off.matches, false);
  assert.equal(off.issues.length, 3);
  assert.equal(partnerBillReadingCheck(entered, { document_number: null, currency: null, invoice_total: null }).matches, true, "nothing read is not a mismatch");
});

test("a partner's invoice file is KCPL's paper: never released to the customer", () => {
  assert.equal(portalDocumentReleased({ customer_safe: true, review_status: "verified" }), true);
  assert.equal(portalDocumentReleased({ customer_safe: true, review_status: "verified", kcpl_only: true }), false);
  const server = read("app/partner/partner-bills.server.ts");
  assert.match(server, /kcplOnly: true/);
  assert.match(server, /createPayableWithSettlementIntegrity\(/, "the bill goes through the same path Accounts use");
  assert.doesNotMatch(server, /status: "approved"/, "nothing is approved without Accounts");
  assert.match(read("app/shipment-documents.server.ts"), /customer_safe: snapshot\.get\("kcpl_only"\) === true \? false/);
});

// Cargo claims
test("a claim's notice limit follows the mode and the kind, and counts down while unfiled", () => {
  assert.equal(claimNoticeDays("sea", "damage"), 3);
  assert.equal(claimNoticeDays("air", "damage"), 14);
  assert.equal(claimNoticeDays("air", "delay"), 21);
  assert.equal(claimNoticeDays("air", "loss"), 120);
  assert.equal(claimNoticeDays("road", "shortage"), 7);
  assert.equal(claimNoticeDue("sea", "damage", "2026-10-08"), "2026-10-11");
  const claim = claimFromRecord("c1", { number: "CLM-202610-AB12", status: "reported", notice_due: "2026-10-11", noticed_on: "2026-10-08", kind: "damage" });
  assert.equal(claimNoticeDaysLeft(claim, "2026-10-10"), 1);
  assert.deepEqual(claimBadge(claim, "2026-10-10"), { tone: "warning", label: "Notice in 1 day" });
  assert.deepEqual(claimBadge(claim, "2026-10-13"), { tone: "danger", label: "Notice 2 days late" });
  assert.equal(claimNoticeDaysLeft({ ...claim, status: "filed" }, "2026-10-13"), null);
});

test("a claim report, a filing and a settlement are each checked", () => {
  const today = "2026-10-10";
  assert.deepEqual(claimReportFromInput({ kind: "theft", description: "Ten cartons gone missing" }, today), { ok: false, error: "kind" });
  assert.deepEqual(claimReportFromInput({ kind: "damage", description: "Wet" }, today), { ok: false, error: "description" });
  assert.deepEqual(claimReportFromInput({ kind: "damage", description: "Two cartons crushed", noticedOn: "2026-10-11" }, today), { ok: false, error: "date" });
  assert.deepEqual(claimReportFromInput({ kind: "damage", description: "Two cartons crushed", claimedAmount: "-5" }, today), { ok: false, error: "amount" });
  assert.deepEqual(claimReportFromInput({ kind: "shortage", description: "Two of twelve cartons missing", claimedAmount: "" }, today), { ok: true, value: { kind: "shortage", description: "Two of twelve cartons missing", noticed_on: today, claimed_amount: null, currency: "NPR" } });
  assert.deepEqual(claimFilingFromInput({ against: "someone" }, { noticed_on: "2026-10-08" }, today), { ok: false, error: "party" });
  assert.deepEqual(claimFilingFromInput({ against: "carrier", filedOn: "2026-10-01" }, { noticed_on: "2026-10-08" }, today), { ok: false, error: "date" });
  assert.equal(claimFilingFromInput({ against: "insurer", againstName: "Shikhar Insurance" }, { noticed_on: "2026-10-08" }, today).ok, true);
  assert.deepEqual(claimSettlementFromInput({ compensationMethod: "credit_note", compensationAmount: 0 }), { ok: false, error: "amount" });
  assert.deepEqual(claimSettlementFromInput({ compensationMethod: "none", compensationAmount: 500 }), { ok: false, error: "method" });
  assert.deepEqual(claimSettlementFromInput({ compensationMethod: "credit_note", compensationAmount: 4500, recoveredAmount: 4000 }), { ok: true, value: { recovered_amount: 4000, compensation_amount: 4500, compensation_method: "credit_note", outcome_note: null } });
});

test("the customer sees where a claim stands, and what was settled only once it is", () => {
  const claim = claimFromRecord("c1", { number: "CLM-1", status: "filed", compensation_amount: 4500, compensation_method: "credit_note", outcome_note: "Carrier pays 4,000; KCPL tops up", against_name: "CMA CGM" });
  const view = portalClaimView(claim);
  assert.equal(view.compensation_amount, null);
  assert.equal(view.can_withdraw, false);
  assert.equal("outcome_note" in view, false, "KCPL's note on who pays what is never the customer's");
  assert.equal("against_name" in view, false);
  assert.equal(portalClaimView({ ...claim, status: "settled" }).compensation_amount, 4500);
  assert.equal(portalClaimView({ ...claim, status: "reported" }).can_withdraw, true);
});

test("claims and deposits are reached from the shipments menu, by anyone on a Job File", () => {
  for (const [id, path] of [["claims", "/admin/claims"], ["deposits", "/admin/deposits"]]) {
    const workspace = workflowWorkspaces.find((item) => item.id === id);
    assert.ok(workspace, id);
    assert.equal(workspace.hub, "shipments");
    assert.equal(workspace.permission, "job_file");
    const operations = { isManagement: false, canManageFinance: false, canManageStaff: false, canViewCommercial: false, canManageJobFile: true };
    assert.equal(activeWorkspace(path, operations)?.id, id);
  }
  // Settling a claim or recording a refund decides money.
  assert.match(read("app/cargo-claims.server.ts"), /if \(!context\.permissions\.canManageFinance\) return \{ kind: "finance_only" as const \};/);
  assert.match(read("app/container-deposits.server.ts"), /if \(!context\.permissions\.canManageFinance\) return \{ kind: "finance_only" as const \};/);
});

// Container dates from the Ops app
test("a date from the field moves only that date, never into the future or out of order", () => {
  const today = "2026-10-10";
  const out = { gated_out_on: "2026-10-01", delivered_on: null, empty_returned_on: null };
  assert.deepEqual(containerMovementUpdate(out, "empty_returned", "2026-10-09", today), { ok: true, field: "empty_returned_on", value: "2026-10-09" });
  assert.deepEqual(containerMovementUpdate(out, "empty_returned", "", today), { ok: true, field: "empty_returned_on", value: today });
  assert.deepEqual(containerMovementUpdate(out, "empty_returned", "2026-09-30", today), { ok: false, error: "order" });
  assert.deepEqual(containerMovementUpdate(out, "delivered", "2026-10-11", today), { ok: false, error: "date" });
  assert.deepEqual(containerMovementUpdate(out, "teleported", today, today), { ok: false, error: "movement" });
  assert.deepEqual(containerMovementUpdate({ gated_out_on: null, delivered_on: null, empty_returned_on: null }, "empty_returned", today, today), { ok: false, error: "order" }, "an empty can't come back before it left");
  const server = read("app/admin/ops-containers.server.ts");
  assert.match(server, /checkShipmentBranchAccess\(normalized, staff\)/);
  assert.match(read("app/api/mobile/ops/v1/jobs/[reference]/containers/[number]/route.ts"), /withStaffSession\(/);
});

// Review of the round
test("a deposit KCPL paid and claimed is money due in a month after the claim, less the detention", () => {
  const today = "2026-10-20";
  const claimed = depositFromRecord("d5", { shipment_reference: "KCPL-S-1", shipping_line: "CMA CGM", amount: 100000, currency: "NPR", paid_on: "2026-09-18", status: "claimed", claimed_on: "2026-10-09", paid_by: "kcpl", container_numbers: [] });
  const due = depositRefundDue(claimed, containers, today);
  assert.equal(due?.date, "2026-11-08");
  assert.equal(due?.amount, expectedDepositDeduction(claimed, containers, today).expected_back);
  assert.equal(depositRefundDue({ ...claimed, paid_by: "customer" }, containers, today), null, "the customer's deposit goes back to them");
  assert.equal(depositRefundDue({ ...claimed, status: "held" }, containers, today), null, "a deposit still out has no date");
  const server = read("app/admin/finance/cash-flow.server.ts");
  assert.match(server, /collection\(CONTAINER_DEPOSITS\)\.where\("status", "==", "claimed"\)/);
  assert.match(server, /deposit\.paid_by === "kcpl" && seen\(deposit\.branch\)/);
  assert.match(read("app/admin/deposits/deposits-workspace.tsx"), /row\.deposit\.paid_by === "kcpl"/, "the register's total is KCPL's money only");
});

test("a refused container date stores no gate-receipt photo", () => {
  const server = read("app/admin/ops-containers.server.ts");
  assert.ok(server.indexOf("checkContainerMovement(normalized") > 0);
  assert.ok(server.indexOf("checkContainerMovement(normalized") < server.indexOf("uploadShipmentDocument("), "the date is checked before the photo is stored");
});

test("a partner's files are what they say they are, bounded per login, and checked before anything is stored", () => {
  const bills = read("app/partner/partner-bills.server.ts");
  for (const check of ["partnerFileMatchesType(file.type, data)", "partnerWriteAllowed(session)"]) {
    assert.ok(bills.indexOf(check) > 0 && bills.indexOf(check) < bills.indexOf("createPayableWithSettlementIntegrity("), `${check} runs before the bill is drafted`);
  }
  assert.match(bills, /where\("supplier_id", "==", session\.partnerId\)\.where\("shipment_reference", "==", normalized\)/);
  assert.match(bills, /upload\.kind === "duplicate"[\s\S]*kcpl_only: true, customer_safe: false/, "a file sent before as a document is linked and kept from the customer");
  const documents = read("app/partner/partner-data.server.ts");
  for (const check of ["partnerFileMatchesType(file.type, data)", "partnerWriteAllowed(session)"]) {
    assert.ok(documents.indexOf(check) > 0 && documents.indexOf(check) < documents.lastIndexOf("uploadShipmentDocument("), `${check} runs before the document is stored`);
  }
  assert.match(documents, /validateShipmentDocumentBytes\(ext/);
  for (const route of ["app/api/partner/shipments/[reference]/bills/route.ts", "app/api/partner/shipments/[reference]/documents/route.ts"]) {
    assert.match(read(route), /result\.kind === "rate_limited"\) return partnerJson\([^)]*\}, 429\)/);
  }
});
