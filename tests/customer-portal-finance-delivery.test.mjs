import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { portalConfirmableDeliveryStatus } from "../app/portal/portal-access-policy.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ------------------------------------------------------------------ *
 * Delivery confirmation is evidence, not authority
 * ------------------------------------------------------------------ */

test("a customer can only confirm cargo that has reached delivery", () => {
  assert.equal(portalConfirmableDeliveryStatus("out_for_delivery"), true);
  assert.equal(portalConfirmableDeliveryStatus("delivered"), true);
  // Confirming a shipment still in transit would put a meaningless record on
  // the Job File; confirming one in exception would paper over the problem.
  for (const status of ["booking_confirmed", "preparing", "in_transit", "customs_clearance", "exception", ""]) {
    assert.equal(portalConfirmableDeliveryStatus(status), false, status);
  }
});

test("the confirmation route never touches the delivery authority", async () => {
  const source = code(await readFile(repo("app/portal/portal-delivery-confirmation.server.ts"), "utf8"));
  // Canonical Delivered is written from verified POD by the delivery authority.
  // A customer saying "it arrived" must not be able to reach any of that.
  for (const forbidden of ["pod_evidence", "delivery_attempts", "delivery_state", "pod_verified"]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must not appear`);
  }
  assert.doesNotMatch(source, /status:\s*"delivered"/);
  assert.match(source, /customer_confirmations/);
  assert.match(source, /job_activity/);
});

test("the confirmation is scoped to the session and idempotent", async () => {
  const source = code(await readFile(repo("app/portal/portal-delivery-confirmation.server.ts"), "utf8"));
  assert.match(source, /!== session\.customerId/, "ownership comes from the session");
  assert.match(source, /alreadyConfirmed/, "a double submit does not stack duplicates");
  assert.match(source, /capabilities\.canSubmitRequests/, "only logins that may send things to KCPL confirm");
  const web = code(await readFile(repo("app/api/portal/shipments/[reference]/confirm-delivery/route.ts"), "utf8"));
  assert.match(web, /isTrustedSameOriginRequest/);
  assert.match(web, /confirmPortalDelivery\(access\.session, reference, body \?\? \{\}, "customer_portal"\)/);
  const app = code(await readFile(repo("app/api/mobile/v1/shipments/[reference]/confirm-delivery/route.ts"), "utf8"));
  assert.match(app, /confirmPortalDelivery\(session, reference, body \?\? \{\}, "customer_app"\)/, "the door, not the body, names the source");
});

test("the operator is told a customer confirmation is not a POD", async () => {
  const source = await readFile(repo("app/portal/portal-delivery-confirmation.server.ts"), "utf8");
  assert.match(source, /not a POD/, "the notification says plainly what it is not");
});

/* ------------------------------------------------------------------ *
 * Remittances are a claim, not a ledger entry
 * ------------------------------------------------------------------ */

test("a remittance never moves money on the invoice", async () => {
  const [route, intake, appRoute, store] = await Promise.all([
    readFile(repo("app/api/portal/invoices/[reference]/remittance/route.ts"), "utf8"),
    readFile(repo("app/portal/portal-remittance-intake.server.ts"), "utf8"),
    readFile(repo("app/api/mobile/v1/invoices/[reference]/remittances/route.ts"), "utf8"),
    readFile(repo("app/portal/portal-remittance.server.ts"), "utf8"),
  ]);
  for (const source of [code(route), code(intake), code(appRoute), code(store)]) {
    for (const ledger of ["amount_paid", "balance_due", "payments"]) {
      assert.equal(source.includes(ledger), false, `${ledger} must not be written`);
    }
    assert.doesNotMatch(source, /status:\s*"paid"/);
  }
  assert.match(code(store), /review_state: "received"/);
});

test("a remittance is sniffed and bounded like any other upload", async () => {
  const source = code(await readFile(repo("app/portal/portal-remittance-intake.server.ts"), "utf8"));
  const web = code(await readFile(repo("app/api/portal/invoices/[reference]/remittance/route.ts"), "utf8"));
  assert.match(web, /isTrustedSameOriginRequest/);
  assert.match(web, /receivePortalRemittance\(auth\.session, reference, request\)/);
  const ownership = source.indexOf("portalOwnsInvoice");
  const signature = source.indexOf("validateShipmentDocumentBytes");
  const save = source.indexOf("saveInvoiceRemittance(");
  assert.ok(ownership > 0 && ownership < save);
  assert.ok(signature > 0 && signature < save, "bytes are checked before storage");
  assert.match(source, /REMITTANCE_MAX_BYTES/);
});

test("the same receipt twice is a double submit, not a second payment", async () => {
  const source = await readFile(repo("app/portal/portal-remittance.server.ts"), "utf8");
  assert.match(source, /where\("sha256", "==", sha256\)/);
  assert.match(source, /kind: "duplicate"/);
});

test("remittance download checks the invoice and the stored customer", async () => {
  const source = code(await readFile(repo("app/api/portal/invoices/[reference]/remittance/[id]/route.ts"), "utf8"));
  assert.match(source, /portalOwnsInvoice/);
  assert.match(source, /result\.customerId !== access\.session\.customerId/);
  assert.match(source, /nosniff/);
});

test("a single invoice read is scoped by the session customer", async () => {
  const source = await readFile(repo("app/portal/portal-data.server.ts"), "utf8");
  const reader = source.slice(source.indexOf("export async function getPortalInvoice"));
  assert.match(reader.slice(0, 1200), /!== session\.customerId/);
  assert.match(reader.slice(0, 1200), /canViewFinance/);
});

test("the printable invoice hides the application chrome", async () => {
  const css = await readFile(repo("app/admin/operations-system.css"), "utf8");
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /portal-topbar/);
  assert.match(print, /portal-print-sheet/);
});
