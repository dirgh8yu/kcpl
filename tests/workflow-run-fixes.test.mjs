import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/*
 * Found by running the whole business path, enquiry to paid invoice, through
 * the real routes against the Firestore and Storage emulators.
 */

const repo = (path) => new URL(`../${path}`, import.meta.url);
const code = async (path) => (await readFile(repo(path), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a customer's pickup reaches the desk without a carrier booking", async () => {
  const source = await code("app/admin/pickups/pickup-appointments.server.ts");
  const listing = source.slice(source.indexOf("export async function listPickupWorkspace"), source.indexOf("const rows: PickupQueueRow[]"));
  assert.match(listing, /const accessible = open\.filter\(\(doc\) => booked\(doc\)\s*\|\| Boolean\(customerPickupRequest\(/);
  assert.ok(listing.indexOf('loadMap("quotes"') < listing.indexOf("const accessible = "), "the quote is read before deciding");
});

test("a status-only update keeps the carrier, its reference and the ETA", async () => {
  const types = await code("app/shipment-types.ts");
  assert.match(types, /eta\?: string;\s*currentLocation\?: string;\s*carrier\?: string;\s*carrierReference\?: string;\s*customerNote\?: string;/);
  const data = await code("app/shipment-data.server.ts");
  assert.match(data, /const keep = \(value: string \| undefined, current: unknown\) => value === undefined \? nullableString\(current\) : value \|\| null;/);
  for (const [field, stored] of [["eta", "eta"], ["carrier", "carrier"], ["carrierReference", "carrier_reference"], ["customerNote", "customer_note"]]) {
    assert.match(data, new RegExp(`keep\\(values\\.${field}, stored\\.${stored}\\)`), field);
  }
  const route = await code("app/api/admin/shipments/[reference]/route.ts");
  assert.match(route, /Object\.prototype\.hasOwnProperty\.call\(body, key\) \? clean\(body\[key\]\) : undefined/);
  assert.match(route, /\.filter\(\(\[, value\]\) => value !== undefined\)/, "the delivered path merges only what was sent");
  // Details are edited in the Job File now; it sends every field it shows, so clearing one works.
  const movement = await code("app/admin/jobs/[reference]/movement-control.tsx");
  assert.match(movement, /carrierReference: String\(form\.get\("carrierReference"\) \|\| ""\)/, "the details form sends the field even when cleared");
});

test("a retried payment is recognised before the balance is checked again", async () => {
  for (const [path, balanceCheck] of [
    ["app/admin/financial-settlement/receivables-settlement.server.ts", 'return { kind: "already_paid" as const }'],
    ["app/admin/financial-settlement/payables-settlement.server.ts", 'return { kind: "already_paid" as const }'],
  ]) {
    const source = await code(path);
    const retry = source.indexOf("const existingPayment = await transaction.get(paymentRef);");
    assert.ok(retry > 0, path);
    assert.ok(retry < source.indexOf(balanceCheck), `${path}: idempotency before already-paid`);
    assert.ok(retry < source.indexOf("applySettlementPayment("), `${path}: idempotency before overpayment`);
    assert.equal(source.split("const existingPayment = await transaction.get(paymentRef);").length, 2, `${path}: checked once`);
  }
});

test("customer notifications run without a mail provider; only email is skipped", async () => {
  const source = await code("app/portal/portal-notifications.server.ts");
  const sweep = source.slice(source.indexOf("export async function dispatchPortalNotifications"));
  assert.doesNotMatch(sweep.slice(0, 400), /transactionalEmailConfigured\(\)/, "no email gate on the whole sweep");
  const email = source.slice(source.indexOf("async function sendOnce"), source.indexOf("export async function dispatchPortalNotifications"));
  assert.ok(email.indexOf("if (!transactionalEmailConfigured()) return") < email.indexOf(".create({"), "no delivery record is claimed for an email that cannot be sent");
});
