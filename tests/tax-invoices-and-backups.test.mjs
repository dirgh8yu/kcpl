import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adToBs, bsDateLabel, bsDateNumeric, nepalFiscalYear } from "../app/nepali-calendar.ts";
import { creditNoteSplit, invoiceStatusLabel, invoiceTotals, taxDocumentNumber, INVOICE_MAX_LINES } from "../app/admin/finance/finance-data.ts";
import { invoiceNetRevenue } from "../app/admin/finance/money-basis.ts";
import { portalInvoiceNumber, portalInvoiceView } from "../app/portal/portal-access-policy.ts";
import { buildStatement } from "../app/portal/portal-statement.ts";
import { backupDestination, backupExportPrefix, companyPanValid, opsAlertDue, opsAlertKey, opsAlertRecipients, requestErrorReportable } from "../app/ops-monitoring.ts";
import { productionRuntimeReadiness } from "../app/production-readiness.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Nepali calendar
test("AD dates convert to Bikram Sambat on known New Year and Shrawan days", () => {
  assert.deepEqual(adToBs("2024-04-13"), { year: 2081, month: 1, day: 1 });
  assert.deepEqual(adToBs("2024-07-16"), { year: 2081, month: 4, day: 1 });
  assert.deepEqual(adToBs("2025-07-17"), { year: 2082, month: 4, day: 1 });
  assert.equal(bsDateLabel("2024-04-13"), "1 Baisakh 2081 BS");
  assert.equal(bsDateNumeric("2024-07-16"), "2081/04/01");
  assert.equal(adToBs("not-a-date"), null);
  assert.equal(bsDateLabel("1990-01-01"), "");
});

test("the fiscal year turns on 1 Shrawan", () => {
  assert.equal(nepalFiscalYear("2024-07-15"), "2080-81");
  assert.equal(nepalFiscalYear("2024-07-16"), "2081-82");
  assert.equal(nepalFiscalYear("2025-07-16"), "2081-82");
  assert.equal(nepalFiscalYear("2025-07-17"), "2082-83");
});

// Invoice lines
test("several lines total the way the server stores them, and at-cost lines carry no VAT", () => {
  const result = invoiceTotals([
    { kind: "service", description: "Freight Kolkata to Kathmandu", quantity: 1, unitPrice: 100_000, taxRate: 13 },
    { kind: "service", description: "Handling", quantity: 2, unitPrice: 2_500, taxRate: 13 },
    { kind: "disbursement", description: "Customs duty", quantity: 1, unitPrice: 18_500, taxRate: 13 },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.subtotal, 123_500);
  assert.equal(result.tax_total, 13_650);
  assert.equal(result.disbursement_total, 18_500);
  assert.equal(result.total, 137_150);
  assert.equal(result.lines[2].tax_rate, 0, "a disbursement never carries VAT");
  assert.equal(result.lines[2].kind, "disbursement");
});

test("lines round to the paisa and bad lines are refused with a reason", () => {
  const rounded = invoiceTotals([{ kind: "service", description: "", quantity: 3, unitPrice: 33.333, taxRate: 13 }]);
  assert.equal(rounded.lines[0].subtotal, 100);
  assert.equal(rounded.lines[0].tax_amount, 13);
  assert.equal(rounded.lines[0].description, "Freight and logistics services");
  assert.deepEqual(invoiceTotals([]), { ok: false, reason: "no_lines" });
  assert.equal(invoiceTotals(Array.from({ length: INVOICE_MAX_LINES + 1 }, () => ({ kind: "service", description: "x", quantity: 1, unitPrice: 1, taxRate: 0 }))).reason, "too_many_lines");
  assert.equal(invoiceTotals([{ kind: "service", description: "x", quantity: 0, unitPrice: 1, taxRate: 0 }]).reason, "invalid_amount");
  assert.equal(invoiceTotals([{ kind: "service", description: "x", quantity: 1, unitPrice: 1, taxRate: 120 }]).reason, "invalid_tax");
  assert.equal(invoiceTotals([{ kind: "service", description: "x", quantity: 1, unitPrice: 0, taxRate: 13 }]).reason, "invalid_amount");
});

// Numbers
test("tax invoices and credit notes are numbered per fiscal year", () => {
  assert.equal(taxDocumentNumber("invoice", "2083-84", 12), "KCPL/2083-84/00012");
  assert.equal(taxDocumentNumber("credit_note", "2083-84", 3), "KCPL/CN/2083-84/00003");
});

test("a number is given only when the invoice is issued, inside the same transaction", () => {
  const finance = read("app/admin/finance/finance.server.ts");
  assert.match(finance, /export async function issueFinanceInvoice[\s\S]{0,2500}runTransaction[\s\S]{0,2500}nextTaxDocumentNumber\(transaction, "invoice"/);
  assert.match(finance, /tax_document_series/);
  // A draft has no number, so drafts that are never issued leave no gap.
  assert.match(finance, /tax_invoice_number: null,/);
});

// Credit notes
test("a credit note takes VAT and at-cost back in proportion and never more than is owed", () => {
  const invoice = { total: 131_500, tax_total: 13_000, disbursement_total: 18_500, balance_due: 131_500 };
  const split = creditNoteSplit(invoice, 13_150);
  assert.deepEqual(split, { ok: true, amount: 13_150, tax_amount: 1_300, disbursement_amount: 1_850 });
  assert.deepEqual(creditNoteSplit(invoice, 0), { ok: false, reason: "invalid_amount" });
  assert.deepEqual(creditNoteSplit({ ...invoice, balance_due: 10_000 }, 10_000.01), { ok: false, reason: "exceeds_balance" });
  // After the first credit, the second splits on what is left.
  const after = { total: 118_350, tax_total: 13_000, disbursement_total: 18_500, balance_due: 118_350, credit_tax_total: 1_300, credit_disbursement_total: 1_850 };
  assert.deepEqual(creditNoteSplit(after, 13_150), { ok: true, amount: 13_150, tax_amount: 1_300, disbursement_amount: 1_850 });
});

test("an invoice cleared by credit notes reads Credited, and one with credits can't be voided", () => {
  assert.equal(invoiceStatusLabel({ status: "paid", amount_paid: 0, credit_total: 500 }), "Credited");
  assert.equal(invoiceStatusLabel({ status: "paid", amount_paid: 500, credit_total: 500 }), "Paid");
  assert.match(read("app/admin/finance/finance.server.ts"), /has_credit_notes/);
  assert.match(read("app/admin/finance/invoices/[reference]/invoice-workspace.tsx"), /invoice\.credit_total === 0 \? <OpsButton variant="danger"/);
});

test("revenue leaves out VAT, money paid at cost and what credit notes took back", () => {
  // 100,000 charge + 13,000 VAT + 18,500 duty at cost.
  assert.equal(invoiceNetRevenue({ subtotal: 118_500, tax_total: 13_000, disbursement_total: 18_500, total: 131_500 }), 100_000);
  // Then 13,150 credited: 10,000 charge, 1,300 VAT, 1,850 duty.
  assert.equal(invoiceNetRevenue({ subtotal: 118_500, tax_total: 13_000, disbursement_total: 18_500, total: 118_350, credit_tax_total: 1_300, credit_disbursement_total: 1_850 }), 90_000);
});

// Portal
test("the customer sees the tax invoice number, at-cost lines and credits", () => {
  const view = portalInvoiceView({
    reference: "KCPL-I-1",
    status: "partially_paid",
    tax_invoice_number: "KCPL/2083-84/00012",
    external_invoice_number: "OLD-7",
    seller_pan: "123456789",
    disbursement_total: 18_500,
    credit_total: 13_150,
    total: 118_350,
    balance_due: 50_000,
    due_date: "2099-01-01",
    line_items: [{ id: "a", description: "Customs duty", kind: "disbursement", quantity: 1, unit_price: 18_500, total: 18_500 }],
    credit_notes: [{ number: "KCPL/CN/2083-84/00001", credit_date: "2026-10-08", amount: 13_150, reason: "Agreed discount" }],
  }, "2026-10-08");
  assert.equal(portalInvoiceNumber(view), "KCPL/2083-84/00012");
  assert.equal(view.line_items[0].kind, "disbursement");
  assert.equal(view.credit_total, 13_150);
  assert.equal(view.credit_notes[0].number, "KCPL/CN/2083-84/00001");
  assert.equal(portalInvoiceNumber({ tax_invoice_number: null, external_invoice_number: "OLD-7", reference: "KCPL-I-1" }), "OLD-7");
  assert.equal(portalInvoiceNumber({ tax_invoice_number: null, external_invoice_number: null, reference: "KCPL-I-1" }), "KCPL-I-1");
});

test("the statement lists open invoices under their tax invoice number", () => {
  const invoice = portalInvoiceView({ reference: "KCPL-I-1", status: "issued", record_type: "invoice", tax_invoice_number: "KCPL/2083-84/00012", issue_date: "2026-10-01", due_date: "2026-10-30", total: 1_000, balance_due: 1_000 }, "2026-10-08");
  const statement = buildStatement({ invoices: [invoice], payments: [], asOf: "2026-10-08" });
  assert.equal(statement.currencies[0].open[0].invoice, "KCPL/2083-84/00012");
});

// Backups and alerts
test("the backup bucket is read as gs://bucket or gs://bucket/folder", () => {
  assert.deepEqual(backupDestination("gs://kcpl-backups"), { bucket: "kcpl-backups", folder: "", uri: "gs://kcpl-backups" });
  assert.deepEqual(backupDestination("kcpl-backups/firestore-archive/"), { bucket: "kcpl-backups", folder: "firestore-archive", uri: "gs://kcpl-backups/firestore-archive" });
  assert.equal(backupDestination(""), null);
  assert.equal(backupDestination("gs://Not A Bucket"), null);
  assert.equal(backupExportPrefix({ uri: "gs://kcpl-backups" }, new Date("2026-10-08T20:30:00.123Z")), "gs://kcpl-backups/firestore/2026-10-08T20-30-00Z");
});

test("one fault is one email: the same alert stays quiet for six hours", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(opsAlertDue(null, now), true);
  assert.equal(opsAlertDue("2026-10-08T07:00:00Z", now), false);
  assert.equal(opsAlertDue("2026-10-08T06:00:00Z", now), true);
  assert.equal(opsAlertDue("garbage", now), true);
  assert.equal(opsAlertKey("request-error:/admin/finance/invoices/[reference]"), "request-error_admin_finance_invoices_reference");
  assert.deepEqual(opsAlertRecipients("ops@example.com, not-an-email ,boss@example.com"), ["ops@example.com", "boss@example.com"]);
});

test("redirects and not-found pages aren't reported as errors", () => {
  assert.equal(requestErrorReportable(new Error("boom")), true);
  assert.equal(requestErrorReportable(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/admin;307;" })), false);
  assert.equal(requestErrorReportable(Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" })), false);
});

test("an error report never carries headers, cookies or the query string", () => {
  const server = read("app/ops-monitoring.server.ts");
  const report = server.slice(server.indexOf("export async function reportRequestError"), server.indexOf("type ExportOperation"));
  assert.doesNotMatch(report, /headers|cookie/i);
  assert.match(report, /request\.path\.split\("\?"\)\[0\]/);
  assert.match(read("instrumentation.ts"), /process\.env\.NEXT_RUNTIME !== "nodejs"/);
  // Local runs and the QA preview never email.
  assert.match(server, /process\.env\.NODE_ENV === "production" && process\.env\.KCPL_QA_MOCK_DATA !== "true"/);
});

test("the backup route takes the scheduler's secret and no other caller", () => {
  const route = read("app/api/internal/backup/route.ts");
  assert.match(route, /automationMachineAuthorized\(request\)/);
  assert.match(route, /if \(!auth\.ok\) return json/);
  assert.match(read("app/firebase-admin.server.ts"), /adminApp\(\)\.options\.credential/);
});

test("readiness warns about a missing PAN, backup bucket or alert address", () => {
  const ids = (env) => new Map(productionRuntimeReadiness(env).checks.map((item) => [item.id, item.status]));
  const empty = ids({ NODE_ENV: "production" });
  assert.equal(empty.get("company-pan"), "warning");
  assert.equal(empty.get("backup-bucket"), "warning");
  assert.equal(empty.get("ops-alerts"), "warning");
  const set = ids({ NODE_ENV: "production", KCPL_COMPANY_PAN: "123456789", KCPL_BACKUP_BUCKET: "gs://kcpl-backups", KCPL_ALERT_EMAIL: "ops@example.com", SENDGRID_API_KEY: "key", KCPL_EMAIL_FROM: "ops@example.com" });
  assert.equal(set.get("company-pan"), "ready");
  assert.equal(set.get("backup-bucket"), "ready");
  assert.equal(set.get("ops-alerts"), "ready");
  assert.equal(companyPanValid("12345678"), false);
  assert.equal(companyPanValid(" 123456789 "), true);
});
