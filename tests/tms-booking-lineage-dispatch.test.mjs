import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dispatcher = readFileSync(`${root}/app/admin/tenders/tms-booking-lineage-dispatch.server.ts`, "utf8");
const route = readFileSync(`${root}/app/api/admin/tenders/route.ts`, "utf8");

test("standard lineage booking preserves PR #127 result and adds canonical booking type", () => {
  assert.match(dispatcher, /return confirmTmsTenderBooking\(tenderId, input, actor, staff\)/);
  assert.match(dispatcher, /result\.kind === "booked" \? \{ \.\.\.result, bookingType: "standard" as const \} : result/);
});

test("consolidated lineage booking maps the master shipment to the canonical route reference without dropping metadata", () => {
  assert.match(dispatcher, /\.\.\.result,[\s\S]{0,160}shipmentReference: result\.masterShipmentReference,[\s\S]{0,160}bookingType: "consolidated" as const/);
  assert.match(dispatcher, /consolidationLoadId: loadId/);
});

test("tender route consumes only the normalized success reference instead of guessing booking shape", () => {
  assert.match(route, /shipmentReference: result\.shipmentReference, bookingType: result\.bookingType/);
  assert.doesNotMatch(route, /result\.masterShipmentReference/);
});

test("tender creation route no longer couples immutable lineage to mutable rate-card availability", () => {
  assert.doesNotMatch(route, /result\.kind === "rate_unavailable"/);
});
