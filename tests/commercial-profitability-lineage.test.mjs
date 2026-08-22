import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const server = readFileSync(`${root}/app/admin/commercial-lineage/commercial-profitability.server.ts`, "utf8");

test("profitability derives expected economics from the verified booked snapshot", () => {
  assert.match(server, /resolveBookedCommercialLineage\(shipmentData\)/);
  assert.match(server, /lineage\.snapshot\.pricing\?\.sell_amount/);
  assert.match(server, /lineage\.snapshot\.procurement\.total/);
  assert.doesNotMatch(server, /shipment\.get\("expected_customer_revenue"\)/);
  assert.doesNotMatch(server, /shipment\.get\("expected_procurement_cost"\)/);
});

test("profitability accepts actual procurement only from a validated audit for the same booked version", () => {
  assert.match(server, /commercial_lineage_status/);
  assert.match(server, /booked_commercial_version_id/);
  assert.match(server, /booked_commercial_fingerprint/);
  assert.match(server, /value\.versionId === lineage\.versionId && value\.fingerprint === lineage\.fingerprint/);
});

test("profitability performs no current rate pricing or FX reconstruction", () => {
  assert.doesNotMatch(server, /partner_rate_cards|pricing_rules|getNrbForexSnapshot|fxRate|convertCurrency/);
});
