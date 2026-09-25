import assert from "node:assert/strict";
import { createHmac, createVerify, generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  configuredGateways,
  connectipsDate,
  connectipsSign,
  connectipsTokenMessage,
  connectipsValidationMessage,
  esewaAmount,
  esewaResponse,
  esewaSignature,
  gatewayEndpoints,
  invoiceOwes,
  invoicePayableOnline,
  MIN_ONLINE_PAYMENT_NPR,
  newPaymentIntentId,
  onlinePaymentAmount,
  paymentIdempotencyKey,
  paymentIntentIdValid,
  toPaisa,
} from "../app/payments/payment-gateways.ts";
import {
  newTrackingToken,
  publicTrackingView,
  trackingLinkLive,
  trackingTokenHash,
  trackingTokenShapeValid,
} from "../app/tracking/public-tracking.ts";
import { androidLiveData, liveActivityEnds, liveActivityState } from "../app/mobile-push-policy.ts";
import { portalPreferencesFromBody } from "../app/portal/portal-notifications.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// Payments -----------------------------------------------------------------

test("a gateway is offered only with its credentials and an explicit live or test mode", () => {
  const khalti = { KHALTI_SECRET_KEY: "k" };
  const esewa = { ESEWA_PRODUCT_CODE: "EPAYTEST", ESEWA_SECRET_KEY: "s" };
  const connectips = { CONNECTIPS_MERCHANT_ID: "1", CONNECTIPS_APP_ID: "a", CONNECTIPS_APP_NAME: "n", CONNECTIPS_PASSWORD: "p", CONNECTIPS_PRIVATE_KEY: "pem" };
  assert.deepEqual(configuredGateways({ ...khalti, ...esewa, ...connectips }), [], "no mode, nothing offered");
  assert.deepEqual(configuredGateways({ KCPL_PAYMENTS_ENV: "staging", ...khalti }), [], "an unknown mode is not guessed");
  assert.deepEqual(configuredGateways({ KCPL_PAYMENTS_ENV: "test", ...khalti }), ["khalti"]);
  assert.deepEqual(configuredGateways({ KCPL_PAYMENTS_ENV: "live", ESEWA_PRODUCT_CODE: "X" }), [], "half an eSewa setup is not offered");
  assert.deepEqual(configuredGateways({ KCPL_PAYMENTS_ENV: "LIVE", ...khalti, ...esewa, ...connectips }), ["khalti", "esewa", "connectips"]);
  assert.deepEqual(configuredGateways({ KCPL_PAYMENTS_ENV: "live", ...connectips, CONNECTIPS_PASSWORD: "  " }), []);
});

test("test mode never talks to a live gateway", () => {
  const test = gatewayEndpoints("test");
  const live = gatewayEndpoints("live");
  for (const url of Object.values(test)) assert.match(url, /dev\.khalti|rc-epay|rc\.esewa|uat\.connectips/);
  for (const url of Object.values(live)) assert.doesNotMatch(url, /dev\.khalti|rc-epay|rc\.esewa|uat\.connectips/);
});

test("amounts are exact in paisa, and eSewa's amount text matches what is signed", () => {
  assert.equal(toPaisa(1040.5), 104050);
  assert.equal(toPaisa(0.1 + 0.2), 30);
  assert.equal(esewaAmount(104000), "1040");
  assert.equal(esewaAmount(104050), "1040.50");
});

test("payment intent ids are unguessable and fit connectIPS's transaction id", () => {
  const ids = new Set(Array.from({ length: 50 }, newPaymentIntentId));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.ok(paymentIntentIdValid(id));
  assert.equal(paymentIntentIdValid("../../admin"), false);
  assert.equal(paymentIntentIdValid("ABCDEF0123456789ABCD"), false);
});

test("eSewa: the signature is HMAC-SHA256 over the signed fields, and a tampered reply is refused", () => {
  const secret = "8gBm/:&EnhH.1/q";
  const fields = { total_amount: "100", transaction_uuid: "11-201-13", product_code: "EPAYTEST" };
  const names = "total_amount,transaction_uuid,product_code";
  const expected = createHmac("sha256", secret).update("total_amount=100,transaction_uuid=11-201-13,product_code=EPAYTEST").digest("base64");
  assert.equal(esewaSignature(secret, fields, names), expected);

  const reply = { transaction_code: "000AWEO", status: "COMPLETE", total_amount: "100", transaction_uuid: "11-201-13", product_code: "EPAYTEST", signed_field_names: "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names" };
  const signed = { ...reply, signature: esewaSignature(secret, reply, reply.signed_field_names) };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64");
  assert.equal(esewaResponse(encode(signed), secret)?.transaction_code, "000AWEO");
  assert.equal(esewaResponse(encode({ ...signed, total_amount: "1" }), secret), null, "changing the amount breaks the signature");
  assert.equal(esewaResponse(encode(signed), "another secret"), null);
  assert.equal(esewaResponse("not base64 json", secret), null);
  assert.equal(esewaResponse(null, secret), null);
});

test("connectIPS: the token message is in NCHL's order and signed RSA-SHA256", () => {
  const txn = { merchantId: "257", appId: "MER-257-APP-1", appName: "KCPL", txnId: "abc", txnDate: "25-09-2026", txnAmount: 104050, referenceId: "INV-1", remarks: "Invoice INV-1", particulars: "KCPL" };
  assert.equal(
    connectipsTokenMessage(txn),
    "MERCHANTID=257,APPID=MER-257-APP-1,APPNAME=KCPL,TXNID=abc,TXNDATE=25-09-2026,TXNCRNCY=NPR,TXNAMT=104050,REFERENCEID=INV-1,REMARKS=Invoice INV-1,PARTICULARS=KCPL,TOKEN=TOKEN",
  );
  assert.equal(connectipsValidationMessage(txn), "MERCHANTID=257,APPID=MER-257-APP-1,REFERENCEID=INV-1,TXNAMT=104050");

  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const message = connectipsTokenMessage(txn);
  // Secrets often arrive with their newlines escaped; both forms sign the same.
  for (const key of [pem, pem.replace(/\n/g, "\\n")]) {
    const signature = connectipsSign(message, key);
    assert.ok(createVerify("RSA-SHA256").update(message).verify(publicKey, signature, "base64"));
  }
  assert.equal(connectipsDate(new Date("2026-09-24T20:00:00Z")), "25-09-2026", "the date is Nepal's, not UTC's");
});

test("only an NPR invoice with a balance, issued and unpaid, can be paid online", () => {
  const invoice = { currency: "NPR", balance_due: 1040.5, status: "issued" };
  assert.equal(invoicePayableOnline(invoice), true);
  assert.equal(invoicePayableOnline({ ...invoice, status: "overdue" }), true);
  assert.equal(invoicePayableOnline({ ...invoice, status: "partially_paid" }), true);
  assert.equal(invoicePayableOnline({ ...invoice, currency: "USD" }), false);
  assert.equal(invoicePayableOnline({ ...invoice, balance_due: 0 }), false);
  assert.equal(invoicePayableOnline({ ...invoice, status: "paid" }), false);
  assert.equal(invoicePayableOnline({ ...invoice, status: "draft" }), false);
  assert.equal(invoicePayableOnline({ ...invoice, status: "void" }), false);
  assert.equal(invoicePayableOnline({ ...invoice, record_type: "credit_note" }), false);
});

test("part of a balance can be paid, never more than is owed or less than the gateways take", () => {
  const invoice = { currency: "NPR", balance_due: 1040.5, status: "issued" };
  assert.deepEqual(onlinePaymentAmount(invoice, undefined, 1), { ok: true, invoiceAmount: 1040.5, nprPaisa: 104050, whole: true });
  assert.deepEqual(onlinePaymentAmount(invoice, 500, 1), { ok: true, invoiceAmount: 500, nprPaisa: 50000, whole: false });
  assert.deepEqual(onlinePaymentAmount(invoice, "250.456", 1), { ok: true, invoiceAmount: 250.46, nprPaisa: 25046, whole: false });
  assert.equal(onlinePaymentAmount(invoice, 1040.51, 1).ok, false, "never more than the balance");
  assert.equal(onlinePaymentAmount(invoice, 0, 1).ok, false);
  assert.equal(onlinePaymentAmount(invoice, -5, 1).ok, false);
  assert.equal(onlinePaymentAmount(invoice, "abc", 1).ok, false);
  assert.equal(onlinePaymentAmount(invoice, MIN_ONLINE_PAYMENT_NPR - 1, 1).ok, false, "Khalti's floor");
  assert.equal(onlinePaymentAmount({ ...invoice, status: "paid" }, 100, 1).ok, false);
});

test("a foreign-currency invoice is paid in rupees at the NRB selling rate", () => {
  const invoice = { currency: "USD", balance_due: 1200, status: "overdue" };
  assert.equal(invoicePayableOnline(invoice), false, "not applied at once");
  assert.equal(invoiceOwes(invoice), true, "but money is owed on it");
  assert.deepEqual(onlinePaymentAmount(invoice, 100, 133.25), { ok: true, invoiceAmount: 100, nprPaisa: 1332500, whole: false });
  assert.equal(onlinePaymentAmount(invoice, undefined, 133.25).nprPaisa, 15990000);
  assert.equal(onlinePaymentAmount(invoice, 100, 0).ok, false, "no rate, no payment");
  assert.equal(onlinePaymentAmount(invoice, 100, Number.NaN).ok, false);
});

test("the amount and rate are worked out on the server, and a foreign payment goes to accounts", async () => {
  const server = code(await readFile(repo("app/payments/payments.server.ts"), "utf8"));
  // The phone sends an amount in the invoice's currency; the rupees, and the
  // rate, are computed and fixed here.
  assert.match(server, /onlinePaymentAmount\(data, amount, rate\.rate\)/);
  assert.match(server, /amount_paisa: priced\.nprPaisa/);
  assert.match(server, /getNrbForexSnapshot\(\)/);
  assert.match(server, /sell_per_unit/);
  // Rupees against another currency are never settled automatically.
  assert.match(server, /if \(foreign\(intent\)\)[\s\S]{0,400}needs_review[\s\S]{0,300}return;/);
  const route = code(await readFile(repo("app/api/mobile/v1/invoices/[reference]/pay/route.ts"), "utf8"));
  assert.match(route, /createPaymentIntent\(session, reference, String\(body\?\.gateway \?\? ""\), new URL\(request\.url\)\.origin, body\?\.amount\)/);
});

test("a verified payment settles through accounts' own function, once per gateway transaction", async () => {
  assert.equal(paymentIdempotencyKey("khalti", "GFq9PFS7b2iYvL8Lir9oXe"), "khalti:GFq9PFS7b2iYvL8Lir9oXe");
  assert.notEqual(paymentIdempotencyKey("esewa", "1"), paymentIdempotencyKey("connectips", "1"));

  const server = code(await readFile(repo("app/payments/payments.server.ts"), "utf8"));
  assert.match(server, /recordReceivablePaymentWithSettlementIntegrity\(/);
  assert.match(server, /idempotencyKey: paymentIdempotencyKey\(intent\.gateway, transactionId\)/);
  // The ledger is read here, never written directly.
  assert.doesNotMatch(server, /collection\("(invoices|receivables|payments)"\)\.doc\([^)]*\)\.(update|set|create|delete)\(/);
  assert.doesNotMatch(server, /transaction\.(update|set|create)\(/);
  // A different amount is never applied: it goes to accounts.
  assert.match(server, /if \(paidPaisa !== intent\.amount_paisa\)[\s\S]{0,200}needs_review/);
  // Each gateway is looked up server to server before settling.
  for (const lookup of ["epayment/lookup/", "esewaStatus", "connectipsValidate"]) assert.ok(server.includes(lookup), `${lookup} must be consulted`);
});

// Tracking links -------------------------------------------------------------

test("a tracking link is long, random and stored only as its hash", () => {
  const token = newTrackingToken();
  assert.ok(trackingTokenShapeValid(token));
  assert.notEqual(newTrackingToken(), token);
  assert.match(trackingTokenHash(token), /^[0-9a-f]{64}$/);
  assert.notEqual(trackingTokenHash(token), token);
  for (const bad of ["", "short", `${token}x`, "../../../../etc/passwd/aaaaaaaaaa", 42, null]) assert.equal(trackingTokenShapeValid(bad), false);
});

test("a tracking link works until it expires or is withdrawn", () => {
  const now = new Date("2026-09-25T00:00:00Z");
  assert.equal(trackingLinkLive({ expires_at: "2026-10-25T00:00:00Z", revoked_at: null }, now), true);
  assert.equal(trackingLinkLive({ expires_at: "2026-09-24T00:00:00Z", revoked_at: null }, now), false);
  assert.equal(trackingLinkLive({ expires_at: "2026-10-25T00:00:00Z", revoked_at: "2026-09-24T00:00:00Z" }, now), false);
  assert.equal(trackingLinkLive({ revoked_at: null }, now), false);
  assert.equal(trackingLinkLive(null, now), false);
});

test("the public page shows places and milestones, never the customer's business", () => {
  const view = publicTrackingView("KCPL-1001", {
    status: "in_transit",
    mode: "sea",
    origin: "Kolkata, West Bengal, India",
    destination: "Kathmandu, Nepal",
    eta: "2026-10-02",
    current_location: "Birgunj ICD",
    updated_at: "2026-09-25T06:00:00Z",
    customer_name: "Himalayan Traders",
    customer_email: "buyer@example.com",
    carrier_reference: "MSKU1234567",
    internal_notes: "Call before delivery",
    freight_amount: 120000,
    documents: [{ name: "invoice.pdf" }],
  }, Array.from({ length: 25 }, (_, index) => ({ title: `Update ${index}`, location: "Birgunj", event_time: "2026-09-25", detail: "Private detail", created_by: "ops@kcpl" })));
  assert.equal(view.origin, "Kolkata");
  assert.equal(view.destination, "Kathmandu");
  assert.equal(view.progress, 0.4);
  assert.equal(view.milestones.length, 20);
  assert.deepEqual(Object.keys(view.milestones[0]).sort(), ["at", "location", "title"]);
  const shown = JSON.stringify(view);
  for (const secret of ["Himalayan", "buyer@example.com", "MSKU", "Call before", "120000", "invoice.pdf", "Private detail", "ops@kcpl"]) {
    assert.ok(!shown.includes(secret), `the public page must not show ${secret}`);
  }
  assert.equal(publicTrackingView("R", { status: "delivered", current_location: "Gate 4" }, []).current_location, null);
});

test("links are made only by someone who may act, for their own shipment, and pages are never indexed", async () => {
  const server = code(await readFile(repo("app/tracking/public-tracking.server.ts"), "utf8"));
  const order = ["canSubmitRequests", "portalOwnsShipment(session", "checkPortalRequestRateLimit(session)", "trackingTokenHash(token)"];
  let at = -1;
  for (const step of order) {
    const next = server.indexOf(step);
    assert.ok(next > at, `${step} must come after the step before it`);
    at = next;
  }
  assert.doesNotMatch(server, /token: token|\btoken,\n/, "the token itself is never stored");
  const layout = code(await readFile(repo("app/t/layout.tsx"), "utf8"));
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: false/);
});

// Notification settings and Live Activities -----------------------------------

test("notification settings from the app or the web are the same switches, and only those", () => {
  assert.deepEqual(portalPreferencesFromBody({ shipment_updates: true, documents: false, free_time: "yes", email: "other@example.com", admin: true }), {
    shipment_updates: true,
    documents: false,
    free_time: false,
    invoices: false,
  });
  assert.deepEqual(portalPreferencesFromBody({}), { shipment_updates: false, documents: false, free_time: false, invoices: false });
});

test("a Live Activity shows the portal's label, where the cargo is, and ends at delivery", () => {
  const label = (status) => `label:${status}`;
  const expected = (date) => `Expected ${date}`;
  assert.deepEqual(liveActivityState({ status: "in_transit", current_location: " Birgunj ICD ", eta: "2026-10-02" }, label, expected), {
    status: "label:in_transit",
    detail: "Birgunj ICD",
    progress: 0.4,
    attention: false,
  });
  assert.equal(liveActivityState({ status: "preparing", eta: "2026-10-02" }, label, expected).detail, "Expected 2026-10-02");
  assert.deepEqual(liveActivityState({ status: "delivered", current_location: "Gate" }, label, expected), { status: "label:delivered", detail: "", progress: 1, attention: false });
  assert.equal(liveActivityState({ status: "exception" }, label, expected).attention, true);
  // Android is moved by a data message the app handles itself: strings only.
  const data = androidLiveData("KCPL-S-1", { status: "In transit", detail: "Birgunj ICD", progress: 0.6000001, attention: false }, false);
  assert.deepEqual(data, { kind: "live", reference: "KCPL-S-1", event: "update", status: "In transit", detail: "Birgunj ICD", progress: "0.6", attention: "0" });
  assert.equal(androidLiveData("KCPL-S-1", { status: "Delivered", detail: "", progress: 1, attention: false }, true).event, "end");
  for (const value of Object.values(data)) assert.equal(typeof value, "string");
  assert.equal(liveActivityEnds({ status: "delivered" }), true);
  assert.equal(liveActivityEnds({ status: "out_for_delivery" }), false);
});

test("accepting a quote is the portal's own booking request from either door", async () => {
  const web = code(await readFile(repo("app/api/portal/requests/route.ts"), "utf8"));
  const app = code(await readFile(repo("app/api/mobile/v1/requests/route.ts"), "utf8"));
  assert.match(web, /requestPortalBooking\(access\.session, payload\)/);
  assert.match(app, /requestPortalBooking\(session, payload, "customer_app"\)/);
  // The app's booking still passes the capability and the shared rate limit first.
  assert.ok(app.indexOf("canSubmitRequests") < app.indexOf("requestPortalBooking("));
  assert.ok(app.indexOf("checkPortalRequestRateLimit(session)") < app.indexOf("requestPortalBooking("));
});

test("an Android follow is moved by a data message; an iPhone one by its Live Activity token", async () => {
  const server = code(await readFile(repo("app/mobile-push.server.ts"), "utf8"));
  assert.match(server, /activity\.get\("platform"\) === "android"[\s\S]{0,400}data: androidLiveData\(shipmentReference, state\(data\), ends\)/);
  assert.match(server, /priority: "high"/);
  assert.match(server, /liveActivityToken: String\(activity\.get\("activity_token"\)\)/);
  const route = code(await readFile(repo("app/api/mobile/v1/live-activities/route.ts"), "utf8"));
  // Android names its follow itself; the id is checked before it is stored,
  // and the shipment is still checked as the customer's own.
  assert.match(route, /\^android:\[A-Za-z0-9_-\]\{8,64\}\$/);
  assert.match(route, /portalOwnsShipment\(session, reference\)/);
});
