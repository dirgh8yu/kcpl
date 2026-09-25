import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { portalPodContentType, portalPodEvidenceVisible, portalProofOfDeliveryView } from "../app/portal/portal-proof-of-delivery.ts";
import { bookingPickupFromBody, bookingPickupSummary, bookingPickupWindowTimes, storedBookingPickup } from "../app/portal/portal-booking-pickup.ts";
import { buildStatement, statementSince } from "../app/portal/portal-statement.ts";
import { renderStatementPdf } from "../app/portal/portal-statement-pdf.ts";
import { storedTextNotice, textNoticePhone, textNoticeSettingsFromBody, textNoticeSms } from "../app/portal/portal-text-notices.ts";
import { portalDocumentRequestFact, portalDocumentRequestMessage } from "../app/portal/portal-notifications.ts";
import { customerPushTarget } from "../app/mobile-push-policy.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* Proof of delivery ------------------------------------------------------- */

const verifiedShipment = { delivery_pod_status: "verified", delivery_pod_verified_at: "2026-09-20T10:00:00Z" };
const attempt = {
  id: "A1",
  status: "delivered",
  event_time: "2026-09-20T08:30:00Z",
  recipient_name: "Sita Rai",
  recipient_relation: "Store manager",
  recipient_phone: "9800000000",
  driver_name: "Ram",
  latitude: 27.7,
};
const evidence = (id, extra) => ({ id, attempt_id: "A1", review_status: "verified", customer_safe: true, content_type: "image/jpeg", captured_at: "2026-09-20T08:31:00Z", ...extra });

test("proof of delivery shows only what KCPL verified and chose to share", () => {
  assert.equal(portalPodEvidenceVisible(evidence("E1", {})), true);
  assert.equal(portalPodEvidenceVisible(evidence("E1", { review_status: "received" })), false);
  assert.equal(portalPodEvidenceVisible(evidence("E1", { review_status: "rejected" })), false);
  assert.equal(portalPodEvidenceVisible(evidence("E1", { customer_safe: false })), false);
  assert.equal(portalPodEvidenceVisible(evidence("E1", { customer_safe: "yes" })), false);
  assert.equal(portalPodEvidenceVisible(evidence("E1", { deleted_at: "2026-09-21T00:00:00Z" })), false);
});

test("an unverified delivery has no customer proof at all", () => {
  for (const status of [undefined, "received", "pending", "rejected"]) {
    assert.equal(portalProofOfDeliveryView({ shipment: { delivery_pod_status: status }, evidence: [evidence("E1", {})], attempts: [attempt] }), null);
  }
});

test("the view names the recipient, never their phone, the driver or the place", () => {
  const view = portalProofOfDeliveryView({
    shipment: verifiedShipment,
    evidence: [
      evidence("P1", { kind: "photo", captured_at: "2026-09-20T08:32:00Z" }),
      evidence("S1", { kind: "signature", content_type: "image/png" }),
      evidence("X1", { kind: "photo", customer_safe: false }),
      evidence("H1", { kind: "photo", content_type: "text/html" }),
    ],
    attempts: [attempt, { id: "A0", status: "failed", event_time: "2026-09-19T08:00:00Z", recipient_name: "Nobody" }],
  });
  assert.equal(view.recipient_name, "Sita Rai");
  assert.equal(view.recipient_relation, "Store manager");
  assert.equal(view.delivered_at, "2026-09-20T08:30:00Z");
  assert.equal(view.verified_at, "2026-09-20T10:00:00Z");
  // Signature first, then photos in the order they were taken.
  assert.deepEqual(view.items.map((item) => item.id), ["S1", "H1", "P1"]);
  assert.equal(view.items[1].content_type, "application/octet-stream");
  assert.equal(view.items[0].kind, "signature");
  const serialized = JSON.stringify(view);
  for (const secret of ["9800000000", "Ram", "27.7", "X1", "Nobody"]) assert.ok(!serialized.includes(secret), `${secret} must not reach the customer`);
});

test("proof files are pictures or PDFs; anything else is a download", () => {
  assert.equal(portalPodContentType("image/jpeg"), "image/jpeg");
  assert.equal(portalPodContentType("IMAGE/PNG; charset=binary"), "image/png");
  assert.equal(portalPodContentType("application/pdf"), "application/pdf");
  for (const hostile of ["text/html", "image/svg+xml", "application/javascript", "", null, 3]) {
    assert.equal(portalPodContentType(hostile), "application/octet-stream");
  }
});

test("proof routes read through the ownership gates and never render foreign types", async () => {
  const server = code(await readFile(repo("app/portal/portal-proof-of-delivery.server.ts"), "utf8"));
  const file = server.slice(server.indexOf("export async function portalProofOfDeliveryFile"));
  const order = ["/^[A-Za-z0-9_-]{1,80}$/", "portalOwnsShipment(session", "delivery_pod_status", "portalPodEvidenceVisible(data)", ".download()"];
  let at = -1;
  for (const step of order) {
    const next = file.indexOf(step);
    assert.ok(next > at, `${step} must come after the step before it`);
    at = next;
  }
  assert.doesNotMatch(server, /\.(set|update|create|delete)\(/, "proof of delivery is read-only for customers");
  const web = code(await readFile(repo("app/api/portal/shipments/[reference]/pod/[id]/route.ts"), "utf8"));
  assert.match(web, /content-security-policy/);
  assert.match(web, /sandbox/);
  const mobile = code(await readFile(repo("app/api/mobile/v1/shipments/[reference]/pod/[id]/route.ts"), "utf8"));
  assert.match(mobile, /withMobileSession\(request, async \(session\)/);
  assert.match(mobile, /portalProofOfDeliveryFile\(session, reference, id\)/);
});

/* Pickup with a booking --------------------------------------------------- */

const today = "2026-09-25";
const pickup = (extra) => ({ pickup: { date: "2026-09-27", window: "morning", address: "Balaju Industrial Area, Kathmandu", contact_name: "Hari", contact_phone: "+977 9812345678", ...extra } });

test("a booking may come with no pickup at all", () => {
  assert.deepEqual(bookingPickupFromBody({}, today), { ok: true, pickup: null });
  assert.deepEqual(bookingPickupFromBody({ pickup: null }, today), { ok: true, pickup: null });
});

test("a pickup needs a date from today to 90 days out, an address and a sane phone", () => {
  const ok = bookingPickupFromBody(pickup({}), today);
  assert.equal(ok.ok, true);
  assert.equal(ok.pickup.window, "morning");
  assert.equal(bookingPickupFromBody(pickup({ date: today }), today).ok, true);
  assert.equal(bookingPickupFromBody(pickup({ date: "2026-12-24" }), today).ok, true);
  assert.equal(bookingPickupFromBody(pickup({ date: "2026-12-25" }), today).ok, false);
  assert.equal(bookingPickupFromBody(pickup({ date: "2026-09-24" }), today).ok, false);
  assert.equal(bookingPickupFromBody(pickup({ date: "27/09/2026" }), today).ok, false);
  assert.equal(bookingPickupFromBody(pickup({ address: "Ktm" }), today).ok, false);
  assert.equal(bookingPickupFromBody(pickup({ contact_phone: "call me" }), today).ok, false);
  assert.equal(bookingPickupFromBody({ pickup: "tomorrow" }, today).ok, false);
  assert.equal(bookingPickupFromBody(pickup({ window: "midnight" }), today).pickup.window, "any");
});

test("the pickup window is Nepal time and reads as one line for the desk", () => {
  const request = bookingPickupFromBody(pickup({}), today).pickup;
  assert.deepEqual(bookingPickupWindowTimes(request), { start: "2026-09-27T03:15:00.000Z", end: "2026-09-27T06:15:00.000Z" });
  assert.deepEqual(bookingPickupWindowTimes({ ...request, window: "afternoon" }), { start: "2026-09-27T06:15:00.000Z", end: "2026-09-27T11:15:00.000Z" });
  assert.match(bookingPickupSummary(request), /^Pickup asked for 2026-09-27, morning \(9-12\), at Balaju Industrial Area, Kathmandu; contact Hari, \+977 9812345678\.$/);
});

test("a stored pickup reads back after its date has passed", () => {
  const stored = storedBookingPickup({ date: "2026-01-02", window: "afternoon", address: "Birgunj dry port" });
  assert.equal(stored.date, "2026-01-02");
  assert.equal(storedBookingPickup({ date: "2026-01-02" }), null);
  assert.equal(storedBookingPickup("2026-01-02"), null);
});

test("the pickup only fills in the pickup desk's form; operations still schedule", async () => {
  const booking = code(await readFile(repo("app/portal/portal-requests.server.ts"), "utf8"));
  assert.match(booking, /bookingPickupFromBody\(/);
  assert.doesNotMatch(booking, /pickup_appointments/, "a customer request never creates an appointment");
  const desk = code(await readFile(repo("app/admin/pickups/pickup-appointments.server.ts"), "utf8"));
  assert.match(desk, /storedBookingPickup\(/);
});

/* Statement --------------------------------------------------------------- */

const invoice = (reference, extra) => ({
  reference,
  record_type: "invoice",
  status: "issued",
  issue_date: "2026-08-01",
  due_date: "2026-09-01",
  currency: "NPR",
  subtotal: 0,
  tax_total: 0,
  total: 1000,
  amount_paid: 0,
  balance_due: 1000,
  shipment_reference: null,
  external_invoice_number: null,
  line_items: [],
  ...extra,
});

test("the statement ages what is owed from each due date", () => {
  const statement = buildStatement({
    asOf: "2026-09-25",
    invoices: [
      invoice("NOTDUE", { due_date: "2026-10-01" }),
      invoice("D10", { due_date: "2026-09-15" }),
      invoice("D45", { due_date: "2026-08-11", balance_due: 500 }),
      invoice("D75", { due_date: "2026-07-12", balance_due: 250 }),
      invoice("D120", { issue_date: "2026-04-01", due_date: "2026-05-28", balance_due: 125 }),
      invoice("PAID", { balance_due: 0, amount_paid: 1000 }),
      invoice("CN", { record_type: "credit_note", balance_due: 999 }),
      invoice("DRAFT", { status: "draft" }),
      invoice("VOID", { status: "void" }),
    ],
    payments: [],
  });
  assert.equal(statement.currencies.length, 1);
  const npr = statement.currencies[0];
  assert.deepEqual(npr.ageing, { current: 1000, days1to30: 1000, days31to60: 500, days61to90: 250, over90: 125 });
  assert.equal(npr.outstanding, 2875);
  assert.equal(npr.overdue, 1875);
  assert.deepEqual(npr.open.map((row) => row.invoice), ["D120", "D75", "D45", "D10", "NOTDUE"]);
});

test("the statement period counts invoices and payments inside it, per currency", () => {
  assert.equal(statementSince("2026-09-25"), "2025-09-25");
  const statement = buildStatement({
    asOf: "2026-09-25",
    invoices: [
      invoice("OLD", { issue_date: "2025-01-01", balance_due: 0 }),
      invoice("NEW", { issue_date: "2026-09-01", total: 2000, balance_due: 0 }),
      invoice("USD1", { currency: "USD", total: 300, balance_due: 300, due_date: "2026-12-01" }),
    ],
    payments: [
      { invoice: "NEW", date: "2026-09-10", amount: 2000, currency: "NPR", method: "bank_transfer", reference: "TX1" },
      { invoice: "OLD", date: "2025-02-01", amount: 1000, currency: "NPR", method: "cash", reference: null },
      { invoice: "LATER", date: "2026-09-30", amount: 50, currency: "NPR", method: "cash", reference: null },
    ],
  });
  assert.deepEqual(statement.currencies.map((row) => row.currency), ["NPR", "USD"]);
  const [npr, usd] = statement.currencies;
  assert.equal(npr.invoiced, 2000);
  assert.equal(npr.received, 2000);
  assert.deepEqual(npr.payments.map((row) => row.reference), ["TX1"]);
  assert.equal(usd.outstanding, 300);
  assert.equal(usd.overdue, 0);
});

test("the statement PDF is a PDF, plain ASCII, and names the customer", () => {
  const statement = buildStatement({
    asOf: "2026-09-25",
    invoices: [invoice("INV-1", { external_invoice_number: "KCPL/82/0042" })],
    payments: [{ invoice: "INV-0", date: "2026-09-10", amount: 20, currency: "NPR", method: "bank_transfer", reference: "TX·1" }],
  });
  const pdf = renderStatementPdf(statement, "Everest Traders · Pvt. Ltd.", "25 Sep 2026");
  const text = pdf.toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  assert.match(text, /Everest Traders \? Pvt\. Ltd\./);
  assert.match(text, /KCPL\/82\/0042/);
  assert.match(text, /bank transfer - TX\?1/);
  assert.ok(![...text].some((char) => char.charCodeAt(0) > 0x7e && char !== "\n"), "the page streams stay ASCII");
  const empty = renderStatementPdf(buildStatement({ asOf: "2026-09-25", invoices: [], payments: [] }), "Nobody", "now").toString("latin1");
  assert.match(empty, /Nothing is owed/);
});

test("statements: customers with finance access fetch their own; accounts view and send", async () => {
  const server = code(await readFile(repo("app/portal/portal-statement.server.ts"), "utf8"));
  const portal = server.slice(server.indexOf("export async function portalStatementPdf"));
  assert.ok(portal.indexOf("canViewFinance") < portal.indexOf("statementFor("), "finance access before any read");
  assert.doesNotMatch(server.replace(/statement_sends[\s\S]*?\.add\(/, ""), /\.(set|update|create)\(/, "the ledger is only read");
  const admin = code(await readFile(repo("app/api/admin/crm/customers/[id]/statement/route.ts"), "utf8"));
  const post = admin.slice(admin.indexOf("export async function POST"));
  const order = ["protectCrmWrite(request)", "authorizeCrm()", "\"canManageFinance\"", "requireCrmCustomerAccess(id", "sendStatement(id"];
  let at = -1;
  for (const step of order) {
    const next = post.indexOf(step);
    assert.ok(next > at, `${step} must come after the step before it`);
    at = next;
  }
  assert.match(admin.slice(0, admin.indexOf("export async function POST")), /"canManageFinance"[\s\S]*requireCrmCustomerAccess/);
  const mobile = code(await readFile(repo("app/api/mobile/v1/statement/route.ts"), "utf8"));
  assert.match(mobile, /portalStatementPdf\(session\)/);
});

/* SMS and WhatsApp -------------------------------------------------------- */

test("SMS goes to Nepali mobiles; WhatsApp to any international mobile", () => {
  assert.equal(textNoticePhone("9812345678", "sms"), "+9779812345678");
  assert.equal(textNoticePhone("+977 981-234-5678", "sms"), "+9779812345678");
  assert.equal(textNoticePhone("977 9712345678", "whatsapp"), "+9779712345678");
  assert.equal(textNoticePhone("014412345", "sms"), null, "a landline cannot take a text");
  assert.equal(textNoticePhone("+91 98765 43210", "sms"), null);
  assert.equal(textNoticePhone("+91 98765 43210", "whatsapp"), "+919876543210");
  assert.equal(textNoticePhone("98765", "whatsapp"), null);
});

test("text notices need the customer's explicit consent", () => {
  assert.deepEqual(textNoticeSettingsFromBody({ channel: "none" }), { ok: true, settings: { channel: "none", phone: null } });
  assert.equal(textNoticeSettingsFromBody({ channel: "sms", phone: "9812345678" }).ok, false);
  assert.equal(textNoticeSettingsFromBody({ channel: "sms", phone: "9812345678", consent: "true" }).ok, false);
  assert.deepEqual(textNoticeSettingsFromBody({ channel: "sms", phone: "9812345678", consent: true }), { ok: true, settings: { channel: "sms", phone: "+9779812345678" } });
  assert.equal(textNoticeSettingsFromBody({ channel: "telegram", phone: "9812345678", consent: true }).ok, false);
  assert.deepEqual(storedTextNotice({ text_notices: { channel: "whatsapp", phone: "+919876543210" } }), { channel: "whatsapp", phone: "+919876543210" });
  assert.deepEqual(storedTextNotice({ text_notices: { channel: "sms", phone: "+919876543210" } }), { channel: "none", phone: null });
  assert.deepEqual(storedTextNotice(undefined), { channel: "none", phone: null });
});

test("an SMS is one plain ASCII message of at most 160 characters", () => {
  const short = textNoticeSms("KCPL-2026-0042 · Arrived at Birgunj", "Your cargo is at the dry port.");
  assert.equal(short, "KCPL: KCPL-2026-0042 - Arrived at Birgunj. Your cargo is at the dry port.");
  const long = textNoticeSms("KCPL-2026-0042 · कागजात चाहियो", "x".repeat(400));
  assert.ok(long.length <= 160);
  assert.ok(long.endsWith("..."));
  assert.match(long, /^[\x20-\x7E]+$/);
});

test("text notices send once per fact and channel, only when configured and chosen", async () => {
  const sweep = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  const body = sweep.slice(sweep.indexOf("async function textOnce"));
  const order = ['notice.channel === "none"', "smsConfigured()", "portal_text_deliveries", ".create(", "sendSms(", 'status: "accepted"'];
  let at = -1;
  for (const step of order) {
    const next = body.indexOf(step);
    assert.ok(next > at, `${step} must come after the step before it`);
    at = next;
  }
  const readiness = code(await readFile(repo("app/production-readiness.ts"), "utf8"));
  assert.match(readiness, /"sms-notices"/);
  assert.match(readiness, /"whatsapp-notices"/);
});

/* "KCPL needs a document from you" --------------------------------------- */

test("a document request is news once: when asked for, and each time one is sent back", () => {
  const baseline = "2026-09-01T00:00:00Z";
  assert.equal(portalDocumentRequestFact({ documentType: "packing_list", state: "needed", requirement: { created_at: "2026-09-20T00:00:00Z" }, documents: [], baseline }), "docreq-packing_list-needed");
  assert.equal(portalDocumentRequestFact({ documentType: "packing_list", state: "needed", requirement: { created_at: "2026-08-20T00:00:00Z" }, documents: [], baseline }), null, "old asks are not news");
  assert.equal(portalDocumentRequestFact({ documentType: "packing_list", state: "needed", requirement: undefined, documents: [], baseline }), null);
  const rejected = [
    { document_type: "packing_list", review_status: "rejected", reviewed_at: "2026-09-10T00:00:00Z" },
    { document_type: "packing_list", review_status: "rejected", reviewed_at: "2026-09-21T00:00:00Z" },
    { document_type: "invoice", review_status: "rejected", reviewed_at: "2026-09-22T00:00:00Z" },
  ];
  assert.equal(
    portalDocumentRequestFact({ documentType: "packing_list", state: "resend", requirement: undefined, documents: rejected, baseline }),
    "docreq-packing_list-resend-2026-09-21T00:00:00Z",
  );
  assert.equal(portalDocumentRequestFact({ documentType: "packing_list", state: "received", requirement: undefined, documents: rejected, baseline }), null);
});

test("the request speaks the recipient's language and opens the send sheet", () => {
  const facts = { reference: "KCPL-1", origin: "Kolkata", destination: "Kathmandu", documentType: "packing_list", resend: false, customerName: "Everest Traders", portalUrl: "https://kcpl.example.com/portal/shipments/KCPL-1?send=packing_list#documents" };
  const en = portalDocumentRequestMessage(facts, "en");
  const ne = portalDocumentRequestMessage(facts, "ne");
  assert.ok(en.subject && ne.subject && en.subject !== ne.subject);
  assert.notEqual(portalDocumentRequestMessage({ ...facts, resend: true }, "en").subject, en.subject);
  assert.ok(en.text.includes(facts.portalUrl));
  assert.deepEqual(customerPushTarget("https://kcpl.example.com/portal/shipments/KCPL-1?send=packing_list#documents"), {
    kind: "document_request",
    reference: "KCPL-1",
    documentType: "packing_list",
  });
  assert.deepEqual(customerPushTarget("/portal/shipments/KCPL-1#documents"), { kind: "shipment", reference: "KCPL-1" });
  assert.equal(customerPushTarget("/portal/shipments/KCPL-1?send=<script>").kind, "shipment");
});
