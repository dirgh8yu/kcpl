import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  PORTAL_MOBILE_CUSTOMER_HEADER,
  portalBearerToken,
  portalRequestedCustomer,
} from "../app/portal/portal-mobile-auth.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function routeFiles(dir) {
  const found = [];
  for (const entry of await readdir(repo(dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...await routeFiles(path));
    else if (entry.name === "route.ts") found.push(path);
  }
  return found;
}

const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXJl";

/* ------------------------------------------------------------------ *
 * Credential parsing
 * ------------------------------------------------------------------ */

test("a well-formed bearer header yields its token", () => {
  assert.equal(portalBearerToken(`Bearer ${jwt}`), jwt);
});

test("anything that is not exactly a bearer JWS is no credential at all", () => {
  for (const header of [
    null,
    undefined,
    "",
    jwt,
    `bearer ${jwt}`,
    `Basic ${jwt}`,
    `Bearer ${jwt} extra`,
    `Bearer ${jwt}.four`,
    "Bearer not-a-token",
    `Bearer ${"a".repeat(3000)}.${"b".repeat(3000)}.c`,
  ]) {
    assert.equal(portalBearerToken(header), null, String(header).slice(0, 40));
  }
});

test("the requested customer is trimmed and bounded, and nothing more", () => {
  assert.equal(PORTAL_MOBILE_CUSTOMER_HEADER, "x-kcpl-customer");
  assert.equal(portalRequestedCustomer("  CUST-2 "), "CUST-2");
  assert.equal(portalRequestedCustomer(""), null);
  assert.equal(portalRequestedCustomer(null), null);
  assert.equal(portalRequestedCustomer("x".repeat(200)), null);
});

/* ------------------------------------------------------------------ *
 * Authority: the bearer path is the cookie path with another credential
 * ------------------------------------------------------------------ */

test("the bearer resolver verifies with revocation and authorises through the shared chokepoint", async () => {
  const source = code(await readFile(repo("app/portal/portal-auth.ts"), "utf8"));
  const start = source.indexOf("export async function getPortalAccessFromBearer");
  assert.ok(start > 0);
  const body = source.slice(start, source.indexOf("export function portalSessionCookie", start));

  assert.match(body, /verifyIdToken\(token, true\)/, "revocation must be checked");
  assert.match(body, /authorizePortalIdentity\(/);
  assert.match(body, /emailVerified: decoded\.email_verified === true/);
  // The requested customer is handed to the same scope decision as the cookie.
  assert.match(body, /\}, requestedCustomerId\)/);
  // Nothing on this path reads a customer id and uses it as the scope directly.
  assert.doesNotMatch(body, /customerId: requestedCustomerId/);
  // Verification precedes authorisation.
  assert.ok(body.indexOf("verifyIdToken") < body.indexOf("authorizePortalIdentity("));
});

test("the QA preview on the bearer path is the same fenced preview as the cookie path", async () => {
  const source = code(await readFile(repo("app/portal/portal-auth.ts"), "utf8"));
  const body = source.slice(source.indexOf("export async function getPortalAccessFromBearer"));
  assert.match(body, /^[^]*?if \(portalQaPreviewEnabled\(\)\) return \{ kind: "authorized", session: portalQaPreviewSession\(\) \};/);
});

/** Every route through which the customer app can change anything, and the
 * shared function that decides it. The web portal's door calls the same one. */
const mobileWriters = new Map([
  ["app/api/mobile/v1/push/route.ts", null],
  ["app/api/mobile/v1/requests/route.ts", "createPortalEnquiry(session"],
  ["app/api/mobile/v1/shipments/[reference]/documents/route.ts", "receivePortalDocument(session, reference, request)"],
  ["app/api/mobile/v1/shipments/[reference]/confirm-delivery/route.ts", "confirmPortalDelivery(session, reference"],
  ["app/api/mobile/v1/invoices/[reference]/remittances/route.ts", "receivePortalRemittance(session, reference, request)"],
  ["app/api/mobile/v1/team/route.ts", "changePortalTeam(session"],
  ["app/api/mobile/v1/notifications/route.ts", "savePortalNotificationPreferences(session.email"],
  ["app/api/mobile/v1/invoices/[reference]/pay/route.ts", "createPaymentIntent(session"],
  ["app/api/mobile/v1/shipments/[reference]/tracking-link/route.ts", "createTrackingLink(session"],
  ["app/api/mobile/v1/live-activities/route.ts", "saveLiveActivity("],
  ["app/api/mobile/v1/shipments/[reference]/messages/route.ts", "customerPostsMessage(session"],
  ["app/api/mobile/v1/shipments/[reference]/rating/route.ts", "ratePortalDelivery(session"],
]);

test("every mobile route resolves the session through the one wrapper", async () => {
  const routes = await routeFiles("app/api/mobile/v1");
  assert.ok(routes.length >= 8, `expected the mobile read routes, found ${routes.length}`);
  for (const path of routes) {
    const source = code(await readFile(repo(path), "utf8"));
    assert.match(source, /withMobileSession\(request, async \(session\)/, `${path} must go through withMobileSession`);
    // Only reads, except the writes listed in mobileWriters, each of which is
    // checked below to go through the same shared module as the web portal.
    if (!mobileWriters.has(path)) {
      assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/, `${path} must be read-only`);
    }
    // Data comes from the redacting portal readers, never from Firestore directly.
    assert.doesNotMatch(source, /firebaseAdminDb|collection\(/, `${path} must not query Firestore itself`);
    assert.doesNotMatch(source, /getPortalAccess\(\)/, `${path} must not fall back to the cookie`);
  }
});

test("a quote request from the app keeps the portal's rules: capability, rate limit, checks, suggestion only", async () => {
  const route = code(await readFile(repo("app/api/mobile/v1/requests/route.ts"), "utf8"));
  const order = ["canSubmitRequests", "request.json()", "checkPortalRequestRateLimit(session)", "validatePortalEnquiry(payload)", "createPortalEnquiry(session"];
  let at = -1;
  for (const step of order) {
    const next = route.indexOf(step);
    assert.ok(next > at, `${step} must come after the step before it`);
    at = next;
  }
  // The web route shares the same rules rather than a copy of them.
  const web = code(await readFile(repo("app/api/portal/requests/route.ts"), "utf8"));
  for (const shared of ["checkPortalRequestRateLimit(access.session)", "validatePortalEnquiry(payload)", "createPortalEnquiry(access.session"]) {
    assert.ok(web.includes(shared), `the web route must use ${shared}`);
  }
  // The enquiry never claims commercial authority: no customer link, no price.
  const shared = code(await readFile(repo("app/portal/portal-requests.server.ts"), "utf8"));
  assert.match(shared, /customer_id: null/);
  assert.match(shared, /crm_match_state: "suggested"/);
  assert.match(shared, /quoted_amount: null/);
  assert.match(shared, /status: "new"/);
});

test("the mobile wrapper never runs a handler without an authorised session", async () => {
  const source = code(await readFile(repo("app/portal/portal-mobile-api.server.ts"), "utf8"));
  const calls = [...source.matchAll(/handler\(/g)];
  assert.equal(calls.length, 1);
  assert.match(source, /case "authorized":\s*return handler\(access\.session\);/);
  assert.match(source, /case "signed-out":[^]*?401/);
  assert.match(source, /case "denied":[^]*?403/);
});

test("the session view the app receives leaves out the uid", async () => {
  const source = code(await readFile(repo("app/portal/portal-mobile-api.server.ts"), "utf8"));
  const view = source.slice(source.indexOf("export function mobileSessionView"));
  assert.doesNotMatch(view.slice(0, view.indexOf("}\n")), /uid/);
});

test("the mobile document download keeps the portal route's gates, in order, and logs the download", async () => {
  const source = code(await readFile(repo("app/api/mobile/v1/documents/[reference]/[id]/route.ts"), "utf8"));
  const ownership = source.indexOf("portalOwnsShipment(session");
  const release = source.indexOf("portalDocumentReleased(");
  const bytes = source.indexOf("getShipmentDocumentFile(");
  const logged = source.indexOf("await recordPortalDocumentDownload(");
  const response = source.indexOf("new Response(");
  assert.ok(ownership > 0 && release > ownership, "release is checked after ownership");
  assert.ok(bytes > release, "no bytes are fetched until both gates pass");
  assert.ok(logged > bytes && response > logged, "the download is logged once the bytes are in hand");
  assert.match(source, /customerId: session\.customerId/);
});

test("invoices stay behind the finance capability on the phone as well", async () => {
  for (const path of ["app/api/mobile/v1/invoices/route.ts", "app/api/mobile/v1/invoices/[reference]/route.ts"]) {
    const source = code(await readFile(repo(path), "utf8"));
    assert.match(source, /result\.kind === "forbidden"\) return mobileForbidden\(\)/, path);
  }
});

test("free time reaches the phone without KCPL's internal fields", async () => {
  const { portalMobileFreeTime } = await import("../app/portal/portal-mobile-auth.ts");
  const status = { state: "running", deadline: "2026-10-01", daysRemaining: 3, daysOverdue: 0, projectedCharge: null };
  const view = portalMobileFreeTime({
    freeTime: {
      location: "Kolkata port",
      days: 7,
      started_on: "2026-09-24",
      daily_charge: 45,
      charge_currency: "USD",
      bearer: "kcpl",
      note: "absorb it, we lost the last one",
      updated_at: "2026-09-24T10:00:00.000Z",
      updated_by: "ops@kcpl.example",
      some_future_field: "private",
    },
    status,
  });
  assert.deepEqual(view, {
    freeTime: { location: "Kolkata port", days: 7, started_on: "2026-09-24", daily_charge: 45, charge_currency: "USD" },
    status,
  });
  assert.equal(portalMobileFreeTime(null), null);

  const route = code(await readFile(repo("app/api/mobile/v1/shipments/[reference]/route.ts"), "utf8"));
  assert.match(route, /freeTime: portalMobileFreeTime\(/);
});

test("every write the app can make is the web portal's own, not a copy", async () => {
  const routes = await routeFiles("app/api/mobile/v1");
  const writers = [];
  for (const path of routes) {
    if (/export async function (POST|PUT|PATCH|DELETE)/.test(code(await readFile(repo(path), "utf8")))) writers.push(path);
  }
  assert.deepEqual(writers.sort(), [...mobileWriters.keys()].sort(), "a new write route must be reviewed into mobileWriters");
  const web = {
    "receivePortalDocument(": "app/api/portal/documents/[reference]/route.ts",
    "confirmPortalDelivery(": "app/api/portal/shipments/[reference]/confirm-delivery/route.ts",
    "receivePortalRemittance(": "app/api/portal/invoices/[reference]/remittance/route.ts",
    "changePortalTeam(": "app/api/portal/team/route.ts",
    "savePortalNotificationPreferences(": "app/api/portal/notifications/route.ts",
    "customerPostsMessage(": "app/api/portal/shipments/[reference]/messages/route.ts",
    "ratePortalDelivery(": "app/api/portal/shipments/[reference]/rating/route.ts",
  };
  for (const [path, call] of mobileWriters) {
    if (!call) continue;
    const source = code(await readFile(repo(path), "utf8"));
    assert.ok(source.includes(call), `${path} must decide through ${call}`);
    const fn = call.slice(0, call.indexOf("(") + 1);
    if (web[fn]) assert.ok(code(await readFile(repo(web[fn]), "utf8")).includes(fn), `${web[fn]} must share ${fn}`);
  }
});

test("the app is offered delivery confirmation on the web page's own rule", async () => {
  const source = code(await readFile(repo("app/api/mobile/v1/shipments/[reference]/route.ts"), "utf8"));
  assert.match(source, /canConfirmDelivery: session\.capabilities\.canSubmitRequests && portalConfirmableDeliveryStatus\(detail\.shipment\.status\)/);
});
