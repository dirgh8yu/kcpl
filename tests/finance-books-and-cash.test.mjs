import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adToBs, bsMonthRange, bsToAd, nextBsMonth } from "../app/nepali-calendar.ts";
import { settlementWithTds, tdsDepositDue, tdsRateOf, withheldTaxInitialStatus, withheldTaxPeriod } from "../app/admin/finance/withheld-tax-policy.ts";
import { purchaseBookCsv, purchaseBookRow, salesBookCreditRow, salesBookCsv, salesBookInvoiceRow, vatSummary } from "../app/admin/finance/tax-books.ts";
import { defaultTallyLedgers, moneyLedger, tallyLedgers, tallyMastersXml, tallyVouchersXml, voucherBalances } from "../app/admin/finance/tally-export.ts";
import { bankAccountKey, parseAmount, parseStatement, parseStatementDate, suggestMatches } from "../app/admin/finance/bank-statement.ts";
import { staffCashDaysOpen, staffCashSettlement, staffCashSpent, validStaffExpense } from "../app/admin/finance/staff-cash-policy.ts";
import { cashFlowByCurrency, cashFlowWeeks } from "../app/admin/finance/cash-flow.ts";
import { taxDocumentNumber } from "../app/admin/finance/finance-data.ts";
import { invoiceLedgerKind } from "../app/admin/finance/refund-policy.ts";
import { activeWorkspace, workflowWorkspaces } from "../app/admin/workflow-navigation.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Nepali months
test("Nepali dates convert both ways and a month has its AD range", () => {
  assert.equal(bsToAd(2083, 4, 1), "2026-07-17");
  assert.deepEqual(adToBs("2026-07-17"), { year: 2083, month: 4, day: 1 });
  assert.deepEqual(bsMonthRange(2083, 6), { start: "2026-09-17", end: "2026-10-17", label: "Asoj 2083" });
  assert.equal(bsMonthRange(2083, 13), null);
  assert.deepEqual(nextBsMonth(2082, 12), { year: 2083, month: 1 });
  // Every day of a month maps back to that month.
  const range = bsMonthRange(2082, 12);
  assert.deepEqual(adToBs(range.start), { year: 2082, month: 12, day: 1 });
  assert.equal(adToBs(range.end).month, 12);
});

// TDS
test("TDS withheld by the customer settles the invoice with the cash", () => {
  // 113,000 owed; the customer pays 111,500 and withholds 1,500.
  assert.deepEqual(settlementWithTds(113_000, 111_500, 1_500), { ok: true, cash: 111_500, tds: 1_500, applied: 113_000, excess: 0 });
  // TDS alone (the cash came earlier).
  assert.deepEqual(settlementWithTds(1_500, 0, 1_500), { ok: true, cash: 0, tds: 1_500, applied: 1_500, excess: 0 });
  // More than is owed, between them.
  assert.deepEqual(settlementWithTds(113_000, 112_000, 1_500), { ok: false, reason: "overpayment" });
  assert.deepEqual(settlementWithTds(113_000, 112_000, 1_500, true), { ok: true, cash: 112_000, tds: 1_500, applied: 113_000, excess: 500 });
  // TDS can never be more than what is owed, credit or not.
  assert.deepEqual(settlementWithTds(1_000, 0, 1_500, true), { ok: false, reason: "overpayment" });
  assert.deepEqual(settlementWithTds(1_000, 0, 0), { ok: false, reason: "invalid_amount" });
  assert.deepEqual(settlementWithTds(1_000, -5, 10), { ok: false, reason: "invalid_amount" });
});

test("TDS is filed in its Nepali month and deposited by the 25th of the next", () => {
  // 9 Oct 2026 is 23 Asoj 2083: due 25 Kartik 2083.
  assert.equal(tdsDepositDue("2026-10-09"), bsToAd(2083, 7, 25));
  assert.deepEqual(withheldTaxPeriod("2026-10-09"), { fiscal_year: "2083-84", bs_year: 2083, bs_month: 6 });
  // Asar is the last month of the fiscal year: due in Shrawan, filed in the year before.
  assert.deepEqual(withheldTaxPeriod("2026-07-10"), { fiscal_year: "2082-83", bs_year: 2083, bs_month: 3 });
  assert.equal(tdsDepositDue("2026-07-10"), bsToAd(2083, 4, 25));
  assert.equal(withheldTaxInitialStatus("by_kcpl", ""), "to_deposit");
  assert.equal(withheldTaxInitialStatus("by_customer", ""), "certificate_pending");
  assert.equal(withheldTaxInitialStatus("by_customer", " TDS-778 "), "certificate_received");
  assert.equal(tdsRateOf(1_500, 100_000), 1.5);
  assert.equal(tdsRateOf(1_500, 0), null);
  assert.equal(invoiceLedgerKind("tds_withheld"), "tds_withheld");
});

test("TDS rows are written in the same transaction as the payment, with a register entry", () => {
  const receivables = read("app/admin/financial-settlement/receivables-settlement.server.ts");
  assert.match(receivables, /settlementWithTds\(/);
  assert.match(receivables, /kind: "tds_withheld"/);
  assert.match(receivables, /writeWithheldTax\(transaction, \{[\s\S]{0,400}direction: "by_customer"/);
  const payables = read("app/admin/financial-settlement/payables-settlement.server.ts");
  assert.match(payables, /writeWithheldTax\(transaction, \{[\s\S]{0,400}direction: "by_kcpl"/);
  // A deposit needs the voucher reference.
  assert.match(read("app/admin/finance/tax-books.server.ts"), /deposit_reference_required/);
});

// Advances
test("advances get their own receipt series and are used when the invoice is issued", () => {
  assert.equal(taxDocumentNumber("advance", "2083-84", 7), "KCPL/AR/2083-84/00007");
  assert.equal(taxDocumentNumber("staff_advance", "2083-84", 12), "KCPL/SA/2083-84/00012");
  const finance = read("app/admin/finance/finance.server.ts");
  // Read and applied inside the issuing transaction, so an advance is never used twice.
  assert.match(finance, /issueFinanceInvoice[\s\S]{0,6000}runTransaction[\s\S]{0,4000}linked_invoice_reference", "==", [^)]+\)[\s\S]{0,2000}applyCreditToInvoice/);
  assert.match(finance, /kind: "credit_applied"/);
  const credits = read("app/admin/finance/customer-credits.server.ts");
  assert.match(credits, /invoice_not_draft/);
  assert.match(credits, /nextTaxDocumentNumber\(transaction, "advance"/);
});

// VAT books
test("the sales book lists each tax invoice, a void one at nothing, and credit notes as returns", () => {
  const invoice = {
    tax_invoice_number: "KCPL/2083-84/00012", issue_date: "2026-10-01", status: "issued", customer_name: "Himal Traders", customer_tax_id: "301234567", currency: "NPR",
    line_items: [{ kind: "service", subtotal: 100_000, tax_rate: 13 }, { kind: "service", subtotal: 20_000, tax_rate: 0 }, { kind: "disbursement", subtotal: 50_000, tax_rate: 0 }],
    tax_total: 13_000, disbursement_total: 50_000,
  };
  const row = salesBookInvoiceRow("KCPL-I-1", invoice);
  assert.equal(row.taxable, 100_000);
  assert.equal(row.non_taxable, 20_000);
  assert.equal(row.total_sales, 120_000);
  assert.equal(row.vat, 13_000);
  assert.equal(row.paid_on_behalf, 50_000);
  assert.equal(row.date_bs, "2083/06/15");
  const voided = salesBookInvoiceRow("KCPL-I-2", { ...invoice, status: "void" });
  assert.equal(voided.kind, "void");
  assert.equal(voided.total_sales + voided.vat + voided.paid_on_behalf, 0);
  assert.equal(salesBookInvoiceRow("KCPL-I-3", { ...invoice, tax_invoice_number: "" }), null);
  // A 12,000 + 1,300 VAT credit: the charge splits 100:20 between taxable and not.
  const credit = salesBookCreditRow("KCPL-I-1", invoice, { number: "CN/2083-84/00001", credit_date: "2026-10-05", amount: 13_300, tax_amount: 1_300, disbursement_amount: 0 });
  assert.equal(credit.taxable, -10_000);
  assert.equal(credit.non_taxable, -2_000);
  assert.equal(credit.vat, -1_300);
  assert.equal(credit.against, "KCPL/2083-84/00012");
  const summary = vatSummary([row, credit], [purchaseBookRow("P-1", { status: "approved", bill_date: "2026-10-02", subtotal: 40_000, tax_total: 5_200, currency: "NPR", supplier_name: "Birgunj Transport" }, "600111222")]);
  assert.equal(summary.output_vat, 11_700);
  assert.equal(summary.input_vat, 5_200);
  assert.equal(summary.net_vat, 6_500);
});

test("the purchase book leaves out drafts, voids and opening balances, and foreign bills aren't in the VAT", () => {
  assert.equal(purchaseBookRow("P-1", { status: "draft", bill_date: "2026-10-02", subtotal: 1 }, null), null);
  assert.equal(purchaseBookRow("P-1", { status: "approved", record_type: "opening_balance", bill_date: "2026-10-02", subtotal: 1 }, null), null);
  const usd = purchaseBookRow("P-2", { status: "paid", bill_date: "2026-10-02", subtotal: 1_000, tax_total: 130, currency: "USD" }, null);
  assert.equal(vatSummary([], [usd]).input_vat, 0);
  assert.equal(vatSummary([], [usd]).foreign_purchases, 1);
  const csv = purchaseBookCsv([usd]);
  assert.match(csv.split("\n")[0], /Supplier PAN/);
  assert.match(salesBookCsv([]).split("\n")[0], /Customer PAN/);
});

// Tally
test("Tally vouchers balance or are left out, and names are escaped", () => {
  const settings = tallyLedgers({ sales: "  Freight Income ", bank: "", company: "KCPL" });
  assert.equal(settings.sales, "Freight Income");
  assert.equal(settings.bank, defaultTallyLedgers.bank);
  assert.equal(moneyLedger("cash", settings), settings.cash);
  assert.equal(moneyLedger("bank_transfer", settings), settings.bank);
  const good = { type: "Sales", date: "2026-10-01", number: "KCPL/2083-84/00012", narration: "A & B <test>", party: "Himal \"Traders\"", entries: [{ ledger: "Himal \"Traders\"", amount: 113_000 }, { ledger: settings.sales, amount: -100_000 }, { ledger: settings.vat_output, amount: -13_000 }] };
  const bad = { ...good, number: "X", entries: [{ ledger: "A", amount: 10 }, { ledger: "B", amount: -9 }] };
  assert.equal(voucherBalances(good), true);
  assert.equal(voucherBalances(bad), false);
  const { file, exported, skipped } = tallyVouchersXml([good, bad], settings);
  assert.equal(exported, 1);
  assert.deepEqual(skipped.map((voucher) => voucher.number), ["X"]);
  assert.match(file, /<DATE>20261001<\/DATE>/);
  assert.match(file, /A &amp; B &lt;test&gt;/);
  assert.match(file, /Himal &quot;Traders&quot;/);
  // A debit is "deemed positive" with a negative amount in Tally's format.
  assert.match(file, /<ISDEEMEDPOSITIVE>Yes<\/ISDEEMEDPOSITIVE>\s*<AMOUNT>-113000.00<\/AMOUNT>/);
  assert.match(file, /<ISDEEMEDPOSITIVE>No<\/ISDEEMEDPOSITIVE>\s*<AMOUNT>100000.00<\/AMOUNT>/);
  assert.doesNotMatch(file, /<VOUCHERNUMBER>X</);
  const masters = tallyMastersXml([{ name: "Himal Traders", group: "debtors" }, { name: "Himal Traders", group: "debtors" }, { name: "Birgunj Transport", group: "creditors" }], settings);
  assert.equal(masters.count, 2);
  assert.match(masters.file, /<PARENT>Sundry Creditors<\/PARENT>/);
});

test("staff cash vouchers leave the staff advances ledger at nothing once settled", () => {
  const server = read("app/admin/finance/tax-books.server.ts");
  assert.match(server, /STAFF_ADVANCES\)\.where\("given_on"/);
  assert.match(server, /STAFF_ADVANCES\)\.where\("settled_on"/);
  // Given 10,000, receipts 8,500, 1,500 back: +10,000 −8,500 −1,500.
  const settlement = staffCashSettlement(10_000, 8_500);
  assert.deepEqual(settlement, { kind: "return", amount: 1_500 });
  assert.equal(10_000 - 8_500 - settlement.amount, 0);
  // Given 5,000, receipts 6,200: KCPL pays 1,200: +5,000 −6,200 +1,200.
  const over = staffCashSettlement(5_000, 6_200);
  assert.deepEqual(over, { kind: "reimburse", amount: 1_200 });
  assert.equal(5_000 - 6_200 + over.amount, 0);
});

// Bank statements
test("bank statements read the way Nepali banks export them", () => {
  assert.equal(parseStatementDate("03/10/2026"), "2026-10-03");
  assert.equal(parseStatementDate("2026-10-03 14:22:00"), "2026-10-03");
  assert.equal(parseStatementDate("03-Oct-2026"), "2026-10-03");
  assert.equal(parseStatementDate("Oct 03, 2026"), "2026-10-03");
  assert.equal(parseStatementDate("31/02/2026"), null);
  assert.equal(parseAmount("1,13,000.00"), 113_000);
  assert.equal(parseAmount("(500.00)"), -500);
  assert.equal(parseAmount("2,500.00 Dr"), -2_500);
  assert.equal(parseAmount("NPR 75.5"), 75.5);
  assert.equal(parseAmount(""), 0);
  assert.equal(parseAmount("abc"), null);
  const csv = "﻿Nabil Bank Ltd,,,,\nAccount: 0101,,,,\nTxn Date,Description,Cheque No,Debit,Credit,Balance\nOpening Balance,,,,,5,00,000.00\n01/10/2026,FT FROM HIMAL TRADERS KCPL/2083-84/00012,,,\"1,13,000.00\",\"6,13,000.00\"\n02/10/2026,SERVICE CHARGE,,250.00,,\"6,12,750.00\"\n02/10/2026,SERVICE CHARGE,,250.00,,\"6,12,500.00\"\n99/99/2026,BROKEN,,1.00,,\nClosing Balance,,,,,\"6,12,500.00\"\n";
  const parsed = parseStatement(csv);
  assert.equal(parsed.lines.length, 3);
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0], /couldn't be read/);
  assert.equal(parsed.lines[0].credit, 113_000);
  assert.equal(parsed.lines[0].balance, 613_000);
  assert.equal(parsed.lines[1].debit, 250);
  // Two identical charges on one day are two lines, with their own ids, the same on every upload.
  assert.notEqual(parsed.lines[1].id, parsed.lines[2].id);
  assert.deepEqual(parseStatement(csv).lines.map((line) => line.id), parsed.lines.map((line) => line.id));
  assert.equal(bankAccountKey("Nabil  Current A/C"), "nabil-current-a-c");
});

test("a receipt is matched to the invoice it most likely pays", () => {
  const candidates = [
    { reference: "KCPL-I-1", number: "KCPL/2083-84/00012", customer_id: "C1", customer_name: "Himal Traders Pvt Ltd", currency: "NPR", balance_due: 113_000, total: 113_000 },
    { reference: "KCPL-I-2", number: "KCPL/2083-84/00013", customer_id: "C2", customer_name: "Everest Imports", currency: "NPR", balance_due: 113_000, total: 113_000 },
    { reference: "KCPL-I-3", number: "KCPL/2083-84/00014", customer_id: "C3", customer_name: "Lumbini Foods", currency: "USD", balance_due: 113_000, total: 113_000 },
  ];
  const [best, second] = suggestMatches({ credit: 113_000, description: "FT FROM HIMAL TRADERS KCPL/2083-84/00012", reference: null }, candidates);
  assert.equal(best.reference, "KCPL-I-1");
  assert.ok(best.reasons.includes("Invoice number in the narration"));
  assert.equal(second.reference, "KCPL-I-2");
  // Another currency is never offered.
  assert.ok(suggestMatches({ credit: 113_000, description: "Lumbini Foods", reference: null }, candidates).every((item) => item.currency === "NPR"));
  // A cut-short number with the year still counts.
  assert.equal(suggestMatches({ credit: 50_000, description: "HIMAL 208384 00012", reference: null }, candidates)[0].reference, "KCPL-I-1");
  assert.deepEqual(suggestMatches({ credit: 0, description: "x", reference: null }, candidates), []);
});

test("a bank line is matched once, through the payment's own idempotency key", () => {
  const server = read("app/admin/finance/bank-statement.server.ts");
  assert.match(server, /idempotencyKey: `bank-\$\{/);
  assert.match(server, /status: "working"/);
  assert.match(server, /position: newestFirst/);
});

// Staff cash
test("staff cash settles to what comes back or what KCPL pays", () => {
  assert.deepEqual(staffCashSettlement(1_000, 1_000), { kind: "even", amount: 0 });
  assert.equal(staffCashSpent([{ amount: 100.1 }, { amount: 200.2 }]), 300.3);
  assert.deepEqual(validStaffExpense({ amount: "150.50", date: "2026-10-01", description: "Port fee" }, "2026-10-09"), { ok: true, amount: 150.5 });
  assert.deepEqual(validStaffExpense({ amount: 10, date: "2026-10-10", description: "Port fee" }, "2026-10-09"), { ok: false, reason: "invalid_date" });
  assert.deepEqual(validStaffExpense({ amount: 10, date: "2026-10-01", description: "x" }, "2026-10-09"), { ok: false, reason: "description_required" });
  assert.deepEqual(validStaffExpense({ amount: 0, date: "2026-10-01", description: "Port fee" }, "2026-10-09"), { ok: false, reason: "invalid_amount" });
  assert.equal(staffCashDaysOpen("2026-09-25", "2026-10-09"), 14);
});

test("settling staff cash writes locked Job File costs in the same transaction", () => {
  const server = read("app/admin/finance/staff-cash.server.ts");
  assert.match(server, /settleStaffAdvance[\s\S]{0,1500}runTransaction[\s\S]{0,2500}collection\("job_costs"\)\.doc\(`staff-cash-\$\{expense\.id\}`\)/);
  assert.match(server, /locked: true/);
  assert.match(server, /if \(advance\.get\("status"\) !== "open"\) return \{ kind: "already_settled"/);
  assert.match(server, /nextTaxDocumentNumber\(transaction, "staff_advance"/);
  // A cost from staff cash can't be turned into a supplier bill.
  assert.match(read("app/admin/jobs/[reference]/job-file-workspace.tsx"), /!item\.locked/);
});

// Cash flow
test("cash flow weeks run Sunday to Saturday from this week", () => {
  const weeks = cashFlowWeeks("2026-10-09");
  assert.equal(weeks.length, 13);
  assert.deepEqual(weeks[0], { start: "2026-10-04", end: "2026-10-10" });
  assert.deepEqual(weeks[1], { start: "2026-10-11", end: "2026-10-17" });
  assert.equal(new Date(`${weeks[12].start}T00:00:00Z`).getUTCDay(), 0);
});

test("cash flow counts overdue bills now, lists overdue receipts without counting them, and finds the low point", () => {
  const entry = (direction, amount, date, currency = "NPR") => ({ kind: direction === "in" ? "invoice" : "bill", direction, amount, date, currency, label: "x", link: null });
  const [npr, usd] = cashFlowByCurrency([
    entry("in", 40_000, "2026-09-01"), // overdue receipt: listed, not counted
    entry("out", 10_000, "2026-09-15"), // overdue bill: counted now
    entry("out", 100_000, "2026-10-14"), // week 2
    entry("in", 30_000, "2026-10-20"), // week 3
    entry("out", 5_000, null), // an approved refund: due now
    entry("in", 9_999, "2027-06-01"), // after 13 weeks
    entry("in", 500, "2026-10-12", "USD"),
  ], "2026-10-09", [{ currency: "NPR", balance: 80_000 }, { currency: "NPR", balance: 20_000 }]);
  assert.equal(npr.currency, "NPR");
  assert.equal(npr.opening, 100_000);
  assert.equal(npr.overdue.in_overdue, 40_000);
  assert.equal(npr.overdue.in, 0);
  assert.equal(npr.overdue.balance, 90_000);
  assert.equal(npr.weeks[0].out, 5_000);
  assert.equal(npr.weeks[0].balance, 85_000);
  assert.equal(npr.weeks[1].balance, -15_000);
  assert.equal(npr.short_from, "2026-10-11");
  assert.equal(npr.lowest, -15_000);
  assert.equal(npr.weeks[2].balance, 15_000);
  assert.equal(npr.later.in, 9_999);
  assert.equal(npr.later.balance, 24_999);
  // No bank balance in dollars: the weeks still add up, with no balance.
  assert.equal(usd.opening, null);
  assert.equal(usd.weeks[1].in, 500);
  assert.equal(usd.weeks[1].balance, null);
  assert.equal(usd.lowest, null);
});

// Routes and navigation
test("the new finance routes are finance-only, same-origin writes", () => {
  for (const path of [
    "app/api/admin/finance/advances/route.ts",
    "app/api/admin/finance/bank/import/route.ts",
    "app/api/admin/finance/bank/lines/[id]/route.ts",
    "app/api/admin/finance/staff-cash/route.ts",
    "app/api/admin/finance/staff-cash/[id]/expenses/route.ts",
    "app/api/admin/finance/staff-cash/[id]/settle/route.ts",
    "app/api/admin/finance/tax/tally-settings/route.ts",
    "app/api/admin/finance/withheld-tax/[id]/route.ts",
    "app/api/admin/finance/withheld-tax/deposit/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /financeWriteRequest\(request\)/, path);
    assert.match(source, /if \(!auth\.ok\) return auth\.response;/, path);
  }
  const exportRoute = read("app/api/admin/finance/tax/export/route.ts");
  assert.match(exportRoute, /canManageFinance/);
});

test("Bank, Cash flow, Tax & books and Staff cash are Finance tabs for finance staff", () => {
  const finance = { canViewCommercial: true, canManageJobFile: true, canManageFinance: true, isManagement: false, canManageStaff: false };
  const operations = { ...finance, canManageFinance: false };
  for (const [path, id] of [["/admin/finance/bank", "bank"], ["/admin/finance/cash-flow", "cash-flow"], ["/admin/finance/tax", "tax-books"], ["/admin/finance/staff-cash/advance-1", "staff-cash"]]) {
    assert.equal(activeWorkspace(path, finance)?.id, id);
    assert.notEqual(activeWorkspace(path, operations)?.id, id);
  }
  assert.ok(workflowWorkspaces.filter((workspace) => ["bank", "cash-flow", "tax-books", "staff-cash"].includes(workspace.id)).every((workspace) => workspace.hub === "finance" && workspace.permission === "finance"));
});
