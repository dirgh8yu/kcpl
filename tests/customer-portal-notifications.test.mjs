import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  portalDocumentReleaseMessage,
  portalDocumentReleaseTime,
  portalMilestoneMessage,
  portalNotifiableDocumentRelease,
  portalNotifiableStatusChange,
  portalNotificationKey,
  portalNotificationPreferences,
  portalNotificationTopics,
} from "../app/portal/portal-notifications.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ------------------------------------------------------------------ *
 * When a customer hears from KCPL
 * ------------------------------------------------------------------ */

test("a shipment first seen by the sweep is not news", () => {
  // Otherwise switching notifications on would mail a customer about every
  // shipment already on their account.
  for (const status of ["booking_confirmed", "in_transit", "delivered", "exception"]) {
    assert.equal(portalNotifiableStatusChange(null, status), false, status);
  }
});

test("only a real change is notified", () => {
  assert.equal(portalNotifiableStatusChange("in_transit", "in_transit"), false);
  assert.equal(portalNotifiableStatusChange("in_transit", "customs_clearance"), true);
  assert.equal(portalNotifiableStatusChange("customs_clearance", "delivered"), true);
  assert.equal(portalNotifiableStatusChange("in_transit", "exception"), true);
});

test("internal readiness steps do not reach the customer", () => {
  // `preparing` changes nothing a customer can act on, and notifications that
  // teach people to ignore notifications are worse than none.
  assert.equal(portalNotifiableStatusChange("booking_confirmed", "preparing"), false);
  assert.equal(portalNotifiableStatusChange("preparing", "in_transit"), true);
});

test("an unknown status is never mailed", () => {
  assert.equal(portalNotifiableStatusChange("in_transit", "some_new_internal_state"), false);
});

/* ------------------------------------------------------------------ *
 * Preferences
 * ------------------------------------------------------------------ */

test("a provisioned customer is subscribed until they say otherwise", () => {
  const defaults = portalNotificationPreferences(null);
  for (const topic of portalNotificationTopics) {
    assert.equal(defaults[topic], true, `${topic} defaults on`);
  }
  assert.deepEqual(portalNotificationPreferences({}), defaults);
});

test("an explicit opt-out is honoured and nothing else is inferred", () => {
  const preferences = portalNotificationPreferences({ notification_preferences: { shipment_updates: false } });
  assert.equal(preferences.shipment_updates, false);
  assert.equal(preferences.documents, true, "one topic off does not silence the rest");
});

/* ------------------------------------------------------------------ *
 * Exactly once
 * ------------------------------------------------------------------ */

test("the delivery key is stable for the same fact and distinct for every other", () => {
  const base = { topic: "shipment_updates", reference: "KCPL-S-1", fact: "in_transit", recipient: "a@customer.com" };
  assert.equal(portalNotificationKey(base), portalNotificationKey({ ...base }));
  // Case and padding in an address must not mint a second delivery.
  assert.equal(portalNotificationKey(base), portalNotificationKey({ ...base, recipient: " A@Customer.com " }));
  assert.notEqual(portalNotificationKey(base), portalNotificationKey({ ...base, fact: "delivered" }));
  assert.notEqual(portalNotificationKey(base), portalNotificationKey({ ...base, reference: "KCPL-S-2" }));
  assert.notEqual(portalNotificationKey(base), portalNotificationKey({ ...base, recipient: "b@customer.com" }));
});

/* ------------------------------------------------------------------ *
 * What the email may say
 * ------------------------------------------------------------------ */

const facts = {
  reference: "KCPL-S-20260919-ABC",
  status: "in_transit",
  mode: "sea",
  origin: "Kolkata",
  destination: "Birgunj",
  eta: "2026-10-02",
  currentLocation: "Kolkata port",
  customerName: "Himalayan Traders",
  portalUrl: "https://kcpl.example/portal/shipments/KCPL-S-20260919-ABC",
};

test("the milestone email carries the shipment, not the commercials", () => {
  const message = portalMilestoneMessage(facts);
  const body = `${message.subject} ${message.text} ${message.html}`;
  assert.match(message.subject, /KCPL-S-20260919-ABC/);
  assert.match(message.subject, /In transit/);
  assert.match(body, /Kolkata/);
  assert.match(body, /Birgunj/);
  assert.match(body, /2026-10-02/);
  assert.match(body, /portal\/shipments/);
  // The builder's input type is the contract: there is no parameter through
  // which a rate, a cost or a supplier could reach the inbox. Checked against
  // the text part, because the HTML carries inline CSS whose own vocabulary
  // ("margin") overlaps the commercial one.
  for (const leak of ["procurement", "margin", "buy rate", "internal", "supplier", "cost", "npr ", "usd "]) {
    assert.equal(message.text.toLowerCase().includes(leak), false, `${leak} must not appear`);
  }
  // And nothing numeric beyond the reference, the date and the lane.
  assert.equal(/\b\d{1,3}(,\d{3})+(\.\d+)?\b/.test(message.text), false, "no money-shaped figures");
});

test("each notified status gets copy written for it", () => {
  const seen = new Set();
  for (const status of ["booking_confirmed", "in_transit", "customs_clearance", "out_for_delivery", "delivered", "exception"]) {
    const message = portalMilestoneMessage({ ...facts, status });
    assert.ok(message.text.length > 40, status);
    seen.add(message.text.split("\n")[0]);
  }
  assert.equal(seen.size, 6, "every status says something different");
});

test("customer-supplied text cannot inject markup into the email", () => {
  const message = portalMilestoneMessage({
    ...facts,
    origin: '<script>alert("x")</script>',
    customerName: '"><img src=x onerror=alert(1)>',
  });
  // What matters is that no tag is formed: the escaped text may still contain
  // the characters of an attack, but not as markup a mail client would run.
  assert.equal(/<script|<img|<iframe|<svg/i.test(message.html), false, "no injected element");
  assert.match(message.html, /&lt;script&gt;/, "the attempt survives as visible text");
  assert.match(message.html, /&quot;&gt;&lt;img/, "quotes are escaped, so no attribute can be broken out of");
});

/* ------------------------------------------------------------------ *
 * Released documents
 * ------------------------------------------------------------------ */

const released = { customer_safe: true, review_status: "verified", reviewed_at: "2026-09-19T10:00:00.000Z" };
const baseline = "2026-09-19T09:00:00.000Z";

test("a document released after the baseline is news", () => {
  assert.equal(portalNotifiableDocumentRelease({ document: released, baseline }), true);
});

test("the back catalogue is never mailed when the topic is switched on", () => {
  // Released an hour before this shipment came under notification: already
  // visible in the portal, so mailing it would be noise on day one.
  assert.equal(portalNotifiableDocumentRelease({ document: released, baseline: "2026-09-19T11:00:00.000Z" }), false);
  // No baseline at all means the shipment has never been swept before.
  assert.equal(portalNotifiableDocumentRelease({ document: released, baseline: null }), false);
});

test("an unreleased document is never announced", () => {
  // The release rules are the same ones the portal itself uses, so an email
  // can never point at a document the recipient is not allowed to download.
  assert.equal(portalNotifiableDocumentRelease({ document: { ...released, customer_safe: false }, baseline }), false);
  assert.equal(portalNotifiableDocumentRelease({ document: { ...released, review_status: "rejected" }, baseline }), false);
  assert.equal(portalNotifiableDocumentRelease({ document: { ...released, deleted_at: "2026-09-19T10:30:00.000Z" }, baseline }), false);
  assert.equal(portalNotifiableDocumentRelease({
    document: { ...released, expires_on: "2026-09-18" },
    baseline,
    now: new Date("2026-09-19T12:00:00.000Z"),
  }), false, "an expired document is not a download");
});

test("a customer is not emailed about the document they sent", () => {
  const own = { ...released, uploaded_by_source: "customer_portal" };
  assert.equal(portalNotifiableDocumentRelease({ document: own, baseline }), false);
});

test("release time falls back to upload time when nothing was reviewed", () => {
  assert.equal(portalDocumentReleaseTime(released), "2026-09-19T10:00:00.000Z");
  assert.equal(portalDocumentReleaseTime({ uploaded_at: "2026-09-18T08:00:00.000Z" }), "2026-09-18T08:00:00.000Z");
  assert.equal(portalDocumentReleaseTime({}), null);
});

test("the release email points at the document without describing its contents", () => {
  const message = portalDocumentReleaseMessage({
    reference: "KCPL-S-20260919-ABC",
    documentType: "bill_of_lading",
    filename: "BL-draft-final-v3.pdf",
    origin: "Kolkata",
    destination: "Birgunj",
    customerName: "Himalayan Traders",
    portalUrl: "https://kcpl.example/portal/shipments/KCPL-S-20260919-ABC#documents",
  });
  assert.match(message.subject, /KCPL-S-20260919-ABC/);
  assert.match(message.subject, /Bill of lading/i);
  assert.match(message.html, /portal\/shipments/);
  // The document itself is never attached or quoted -- the portal is the only
  // place it can be read, behind the session.
  assert.equal(message.text.includes("BL-draft-final-v3.pdf"), false, "no filename guessing in the inbox");
  for (const leak of ["procurement", "buy rate", "internal", "supplier"]) {
    assert.equal(message.text.toLowerCase().includes(leak), false, leak);
  }
});

test("a hostile document label cannot inject markup", () => {
  const message = portalDocumentReleaseMessage({
    reference: "KCPL-S-1",
    documentType: "other",
    filename: "x.pdf",
    origin: '<img src=x onerror=alert(1)>',
    destination: "Birgunj",
    customerName: "</div><script>alert(1)</script>",
    portalUrl: "https://kcpl.example/portal",
  });
  assert.equal(/<script|<img|<iframe/i.test(message.html), false);
});

/* ------------------------------------------------------------------ *
 * Dispatcher wiring
 * ------------------------------------------------------------------ */

test("notifications are a scheduled sweep, not a hook in the authority chain", async () => {
  const source = await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8");
  // Reading status on a schedule is what keeps this outside the audited
  // booking, delivery and settlement writers.
  assert.doesNotMatch(code(source), /runTransaction|collection\("shipments"\)\.doc\([^)]*\)\.(update|set)\(/);
  assert.match(source, /where\("customer_id", "==", customerId\)/);
});

test("the sweep only mails a bound, active, subscribed account", async () => {
  const source = await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8");
  assert.match(source, /where\("active", "==", true\)/);
  assert.match(source, /!data\.uid/, "an unbound account has never proved control of the address");
  assert.match(source, /preferences\.shipment_updates/);
});

test("a delivery is recorded before the provider call, not after", async () => {
  const source = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  const reserve = source.indexOf('status: "pending"');
  const send = source.indexOf("sendTransactionalEmail(");
  const confirm = source.indexOf('status: "sent"');
  assert.ok(reserve > 0 && reserve < send, "the delivery row is claimed first");
  assert.ok(confirm > send, "and confirmed after the provider accepts it");
});

test("the document pass is gated on the shipment having changed", async () => {
  const source = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  // Documents live in a subcollection, so an ungated pass would cost a read per
  // shipment per sweep. Releasing a document touches the shipment's updated_at.
  assert.match(source, /lastSeenUpdatedAt !== shipment\.updated_at/);
  const gate = source.indexOf("worthChecking");
  const read = source.indexOf("listShipmentDocuments(shipment.reference)");
  assert.ok(gate > 0 && gate < read, "the gate is evaluated before the read");
  assert.match(source, /documents_baseline_at/);
});

test("a document email is keyed by document, so a re-review never mails twice", async () => {
  const source = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  assert.match(source, /topic: "documents"/);
  assert.match(source, /fact: `document-\$\{String\(entry\.id \?\? ""\)\}`/);
});

test("a customer cannot change another account's notification settings", async () => {
  const route = await readFile(repo("app/api/portal/notifications/route.ts"), "utf8");
  assert.match(route, /access\.session\.email/, "the account comes from the session");
  assert.doesNotMatch(code(route), /body\.email|body\["email"\]/);
  assert.match(route, /isTrustedSameOriginRequest/);
});

test("an upload notification cannot fail the upload", async () => {
  const source = await readFile(repo("app/portal/portal-document-intake.server.ts"), "utf8");
  const notify = source.indexOf("async function notifyAssignedOperator");
  assert.ok(notify > 0);
  const body = source.slice(notify);
  assert.match(body, /try \{/);
  assert.match(body, /catch \(error\) \{/);
  assert.doesNotMatch(body, /throw/);
});
