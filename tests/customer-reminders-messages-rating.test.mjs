import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  portalInvoiceMessage,
  portalInvoiceReminder,
  portalNotificationPreferences,
  portalNotificationTopicsFor,
} from "../app/portal/portal-notifications.ts";
import { customerPushTarget } from "../app/mobile-push-policy.ts";
import {
  SHIPMENT_MESSAGE_MAX,
  shipmentMessageBody,
  shipmentMessagePreview,
  shipmentMessageView,
  staffFirstName,
} from "../app/shipment-messages.ts";
import {
  deliveryRatable,
  deliveryRatingFromBody,
  deliveryRatingIsComplaint,
  deliveryReviewUrl,
} from "../app/portal/portal-delivery-rating.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// Invoice reminders ------------------------------------------------------------

const invoice = { status: "issued", balance_due: 210180, currency: "NPR", due_date: "2026-09-28" };

test("an invoice is reminded three days before it is due, and once it is overdue", () => {
  assert.deepEqual(portalInvoiceReminder(invoice, "2026-09-25"), { fact: "due", dueDate: "2026-09-28", daysUntilDue: 3 });
  assert.equal(portalInvoiceReminder(invoice, "2026-09-24"), null, "four days out is not yet a reminder");
  assert.equal(portalInvoiceReminder(invoice, "2026-09-28")?.fact, "due", "the due day itself");
  assert.equal(portalInvoiceReminder(invoice, "2026-09-29")?.fact, "overdue");
  assert.equal(portalInvoiceReminder(invoice, "2026-10-12")?.fact, "overdue");
  assert.equal(portalInvoiceReminder(invoice, "2026-10-13"), null, "a long-overdue invoice is not news");
});

test("only an open invoice with something owed is reminded", () => {
  const today = "2026-09-26";
  assert.equal(portalInvoiceReminder({ ...invoice, status: "paid" }, today), null);
  assert.equal(portalInvoiceReminder({ ...invoice, status: "draft" }, today), null);
  assert.equal(portalInvoiceReminder({ ...invoice, balance_due: 0 }, today), null);
  assert.equal(portalInvoiceReminder({ ...invoice, record_type: "credit_note" }, today), null);
  assert.equal(portalInvoiceReminder({ ...invoice, due_date: "" }, today), null);
  assert.equal(portalInvoiceReminder({ ...invoice, status: "partially_paid" }, today)?.fact, "due");
});

test("the reminder says what is owed and when, in the reader's language", () => {
  const facts = { reference: "KCPL-I-1", reminder: portalInvoiceReminder(invoice, "2026-09-25"), balance: 210180, currency: "NPR", customerName: "Annapurna", portalUrl: "https://kcpl.example/portal/invoices/KCPL-I-1" };
  const en = portalInvoiceMessage(facts, "en");
  assert.equal(en.subject, "KCPL-I-1 is due on 2026-09-28");
  assert.match(en.text, /NPR 210,180\.00/);
  assert.match(en.text, /https:\/\/kcpl\.example\/portal\/invoices\/KCPL-I-1/);
  assert.match(portalInvoiceMessage(facts, "ne").text, /[ऀ-ॿ]/);
  const overdue = portalInvoiceMessage({ ...facts, reminder: portalInvoiceReminder(invoice, "2026-10-01") }, "en");
  assert.equal(overdue.subject, "KCPL-I-1 is overdue");
});

test("invoice reminders are a topic of their own, offered only with finance access", () => {
  assert.equal(portalNotificationPreferences({}).invoices, true, "absent means subscribed, as for every topic");
  assert.equal(portalNotificationPreferences({ notification_preferences: { invoices: false } }).invoices, false);
  assert.ok(portalNotificationTopicsFor(true).includes("invoices"));
  assert.ok(!portalNotificationTopicsFor(false).includes("invoices"));
});

test("an invoice reminder opens the invoice in the app, where it can be paid", () => {
  assert.deepEqual(customerPushTarget("https://kcpl.example/portal/invoices/KCPL-I-1"), { kind: "invoice", reference: "KCPL-I-1" });
  assert.deepEqual(customerPushTarget("/portal/shipments/KCPL-S-1"), { kind: "shipment", reference: "KCPL-S-1" });
});

test("the sweep reminds owners only, keyed by invoice and due date", async () => {
  const sweep = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  assert.match(sweep, /account\.owner && account\.preferences\.invoices/);
  assert.match(sweep, /fact: `invoice-\$\{reminder\.fact\}-\$\{reminder\.dueDate\}`/);
});

// Messages ---------------------------------------------------------------------

test("a message is trimmed, capped, and never empty", () => {
  assert.equal(shipmentMessageBody("  Where is it now?  "), "Where is it now?");
  assert.equal(shipmentMessageBody("a\r\n\r\n\r\n\r\nb"), "a\n\nb");
  assert.equal(shipmentMessageBody("   \n "), null);
  assert.equal(shipmentMessageBody(42), null);
  assert.equal(shipmentMessageBody("x".repeat(5000)).length, SHIPMENT_MESSAGE_MAX);
});

test("a customer sees KCPL staff by first name and never an email", () => {
  const staff = { body: "On its way", author_side: "kcpl", author_name: "Anil Karki", author_email: "anil@kcpl.example", created_at: "2026-09-25T10:00:00Z" };
  assert.deepEqual(shipmentMessageView("m1", staff, "customer"), { id: "m1", from: "kcpl", author: "KCPL · Anil", body: "On its way", created_at: "2026-09-25T10:00:00Z" });
  assert.equal(shipmentMessageView("m1", staff, "kcpl").author, "Anil Karki", "staff see their colleague in full");
  const customer = { body: "Thanks", author_side: "customer", author_name: "Ram Thapa", author_email: "ram@customer.example" };
  assert.ok(!JSON.stringify(shipmentMessageView("m2", customer, "kcpl")).includes("@"));
  assert.equal(staffFirstName("  "), "KCPL");
  assert.equal(shipmentMessagePreview("\nFirst line\nsecond"), "First line");
});

test("a customer's message is on their own shipment, limited per hour, and tells the job owner", async () => {
  const shared = code(await readFile(repo("app/shipment-messages.server.ts"), "utf8"));
  const post = shared.slice(shared.indexOf("export async function customerPostsMessage"), shared.indexOf("async function tellJobOwner"));
  const order = ["shipmentMessageBody(", "portalOwnsShipment(session", "SHIPMENT_MESSAGE_HOURLY_LIMIT", "await write(", "tellJobOwner("];
  let at = -1;
  for (const step of order) {
    const next = post.indexOf(step);
    assert.ok(next > at, `${step} must come after the step before it`);
    at = next;
  }
  const read = shared.slice(shared.indexOf("export async function customerReadsMessages"));
  assert.ok(read.indexOf("portalOwnsShipment(session") < read.indexOf("await read("), "ownership before any read");
});

// Delivery rating ----------------------------------------------------------------

test("a rating is one to five, asked after delivery, and a low one is a complaint", () => {
  assert.deepEqual(deliveryRatingFromBody({ score: 4, comment: "  Quick  " }), { score: 4, comment: "Quick" });
  assert.equal(deliveryRatingFromBody({ score: 0 }), null);
  assert.equal(deliveryRatingFromBody({ score: 6 }), null);
  assert.equal(deliveryRatingFromBody({ score: 3.5 }), null);
  assert.equal(deliveryRatingIsComplaint(3), true);
  assert.equal(deliveryRatingIsComplaint(4), false);
  assert.equal(deliveryRatable("delivered"), true);
  assert.equal(deliveryRatable("out_for_delivery"), false);
});

test("only a happy customer is offered a review link, and only a real one", async () => {
  assert.equal(deliveryReviewUrl({ KCPL_REVIEW_URL: "https://g.page/r/kcpl/review" }), "https://g.page/r/kcpl/review");
  assert.equal(deliveryReviewUrl({ KCPL_REVIEW_URL: "javascript:alert(1)" }), null);
  assert.equal(deliveryReviewUrl({}), null);
  const shared = code(await readFile(repo("app/portal/portal-delivery-rating.server.ts"), "utf8"));
  assert.match(shared, /reviewUrl: complaint \? null : deliveryReviewUrl\(\)/);
  assert.match(shared, /\.create\(\{/, "once per login: a second rating is refused, not overwritten");
  assert.doesNotMatch(shared, /collection\("shipments"\)\.doc\([^)]*\)\.(update|set)\(/, "a rating never writes the shipment");
});
