import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { effectiveInvoiceStatus, nepalOperationalDate } from "../app/invoice-effective-status.ts";
import {
  portalDocumentReleased,
  portalDocumentVisibleToSender,
  portalInvoiceView,
  portalQuoteAmount,
  portalQuoteView,
  portalQuoteVisible,
} from "../app/portal/portal-access-policy.ts";

/*
 * What staff do in the admin is what the customer sees, and the two read the
 * same record the same way. Each test here is a place they used to disagree.
 */

const repo = (path) => new URL(`../${path}`, import.meta.url);
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a quote priced on the admin desk reaches the customer with its price", () => {
  // The quote desk and TMS pricing store the price as the decimal string staff
  // typed. The portal used to accept only numbers, so every quote priced in
  // the admin stayed invisible to the customer.
  const quote = { reference: "KCPL-Q-1", status: "quoted", quoted_amount: "168500.50", quote_currency: "NPR", internal_cost: "150000" };
  assert.equal(portalQuoteVisible(quote), true);
  const view = portalQuoteView(quote);
  assert.equal(view.quoted_amount, 168500.5);
  assert.equal("internal_cost" in view, false);
  assert.equal(portalQuoteAmount(1200), 1200, "numbers still work");
  for (const unpriced of [null, "", "0", "0.00", "-5", "12,000", "abc", Number.NaN, 0]) {
    assert.equal(portalQuoteAmount(unpriced), null, `${String(unpriced)} is not a price`);
  }
  assert.equal(portalQuoteVisible({ status: "quoted", quoted_amount: "" }), false);
});

test("the admin quote route and pricing store prices in the shape the portal reads", async () => {
  const route = await readFile(repo("app/api/admin/quotes/[reference]/route.ts"), "utf8");
  const pattern = /const moneyPattern = (\/.+\/);/.exec(route)?.[1];
  assert.ok(pattern, "the admin route validates prices");
  const policy = await readFile(repo("app/portal/portal-access-policy.ts"), "utf8");
  assert.ok(policy.includes(pattern), "the portal accepts exactly what the admin accepts");
  const pricing = await readFile(repo("app/admin/pricing/tms-pricing.server.ts"), "utf8");
  assert.match(pricing, /quoted_amount: pricing\.sell_amount\.toFixed\(decimals\)/);
  assert.equal(portalQuoteAmount((4200.5).toFixed(2)), 4200.5);
});

test("a sealed POD manifest never reaches the customer", async () => {
  // The manifest records the recipient's phone, GPS and the driver. It used to
  // take the evidence's customer-safe flag and appear in the documents list.
  const manifest = { customer_safe: true, review_status: "verified", document_type: "proof_of_delivery", pod_manifest: true, deleted_at: null };
  assert.equal(portalDocumentReleased(manifest), false, "older records marked customer-safe stay hidden");
  assert.equal(portalDocumentVisibleToSender(manifest), false);
  assert.equal(portalDocumentReleased({ ...manifest, pod_manifest: undefined }), true, "other released documents are unaffected");

  const writer = code(await readFile(repo("app/admin/delivery/delivery-control.server.ts"), "utf8"));
  const record = writer.slice(writer.indexOf('document_type: "proof_of_delivery"'), writer.indexOf("pod_manifest: true"));
  assert.match(record, /customer_safe: false,/);
  assert.doesNotMatch(record, /customer_safe: customerSafe/);
});

test("an invoice past its due date reads overdue in both the admin and the portal", async () => {
  const today = "2026-09-29";
  assert.equal(effectiveInvoiceStatus("issued", "2026-09-28", 500, today), "overdue");
  assert.equal(effectiveInvoiceStatus("partially_paid", "2026-09-28", 500, today), "overdue");
  assert.equal(effectiveInvoiceStatus("issued", "2026-09-29", 500, today), "issued", "due today is not yet overdue");
  assert.equal(effectiveInvoiceStatus("overdue", "2026-10-10", 500, today), "issued", "a moved due date clears overdue");
  assert.equal(effectiveInvoiceStatus("issued", "2026-09-01", 0, today), "paid");
  for (const kept of ["draft", "void", "paid"]) assert.equal(effectiveInvoiceStatus(kept, "2026-01-01", 500, today), kept);

  const invoice = { reference: "KCPL-I-1", status: "issued", due_date: "2026-09-28", total: 1000, amount_paid: 400, balance_due: 600 };
  assert.equal(portalInvoiceView(invoice, today).status, "overdue");
  assert.equal(portalInvoiceView({ ...invoice, balance_due: 0 }, today).status, "paid");

  const finance = code(await readFile(repo("app/admin/finance/finance.server.ts"), "utf8"));
  assert.match(finance, /effectiveInvoiceStatus\(status, dueDate, balanceDue, operationalDate\(\)\)/);
  assert.match(finance, /const operationalDate = nepalOperationalDate;/);
});

test("the portal counts days on Nepal's calendar, as the admin does", async () => {
  // 19:00 UTC on the 28th is already the 29th in Kathmandu.
  assert.equal(nepalOperationalDate(new Date("2026-09-28T19:00:00Z")), "2026-09-29");
  assert.equal(nepalOperationalDate(new Date("2026-09-28T18:14:00Z")), "2026-09-28");
  for (const path of [
    "app/portal/portal-data.server.ts",
    "app/portal/portal-statement.server.ts",
    "app/portal/portal-notifications.server.ts",
    "app/shipment-free-time.server.ts",
  ]) {
    const source = code(await readFile(repo(path), "utf8"));
    assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/, `${path}: the UTC date is not KCPL's day`);
    assert.match(source, /nepalOperationalDate\(/, path);
  }
  const data = code(await readFile(repo("app/portal/portal-data.server.ts"), "utf8"));
  assert.doesNotMatch(data, /\.map\(portalInvoiceView\)/, "the view needs today's date, not the array index");
  const statement = code(await readFile(repo("app/portal/portal-statement.server.ts"), "utf8"));
  assert.doesNotMatch(statement, /\.map\(portalInvoiceView\)/);
});

test("a payment receipt the customer sends shows on the admin invoice, and its acknowledgement shows back", async () => {
  // Receipts used to be stored where no admin screen read them, and nothing
  // could set the "Acknowledged" state the customer's portal and app display.
  const page = code(await readFile(repo("app/admin/finance/invoices/[reference]/page.tsx"), "utf8"));
  assert.match(page, /listInvoiceRemittancesForStaff\(result\.invoice\.reference\)/);
  assert.ok(page.indexOf("listInvoiceRemittancesForStaff(") > page.indexOf("getFinanceInvoice("), "after finance and branch checks");
  const workspace = code(await readFile(repo("app/admin/finance/invoices/[reference]/invoice-workspace.tsx"), "utf8"));
  assert.match(workspace, /remittances\/\$\{encodeURIComponent\(remittance\.id\)\}`, \{ method: "PATCH" \}/);

  const route = code(await readFile(repo("app/api/admin/finance/invoices/[reference]/remittances/[id]/route.ts"), "utf8"));
  assert.match(route, /canManageFinance/);
  assert.match(route, /getFinanceInvoice\(reference, staff\)/, "branch scope as on the invoice page");
  const patch = route.slice(route.indexOf("export async function PATCH"));
  assert.ok(patch.indexOf("isTrustedSameOriginRequest") < patch.indexOf("acknowledgeInvoiceRemittance("));
  assert.match(route, /"content-security-policy": "sandbox; default-src 'none'"/);

  const store = code(await readFile(repo("app/portal/portal-remittance.server.ts"), "utf8"));
  const ack = store.slice(store.indexOf("export async function acknowledgeInvoiceRemittance"), store.indexOf("export async function invoiceRemittanceFile"));
  assert.match(ack, /review_state: "acknowledged"/);
  assert.doesNotMatch(ack, /amount_paid|balance_due|collection\("payments"\)/, "an acknowledgement is not a ledger entry");
  const panel = await readFile(repo("app/portal/invoices/[reference]/portal-remittance-panel.tsx"), "utf8");
  assert.match(panel, /review_state === "acknowledged"/);
});

test("a delivery rating reaches the Job File, not only the assignee's inbox", async () => {
  const writer = code(await readFile(repo("app/portal/portal-delivery-rating.server.ts"), "utf8"));
  assert.match(writer, /collection\("job_activity"\)\.doc\(`customer-rating-\$\{ref\.id\}`\)/);
  assert.match(writer, /type: "customer_rated_delivery"/);
  assert.ok(writer.indexOf('collection("job_activity")') < writer.indexOf("batch.commit()"), "written with the rating, atomically");
  const activity = code(await readFile(repo("app/admin/shipment-activity.server.ts"), "utf8"));
  assert.match(activity, /collection\("job_activity"\)/);
});
