import test from "node:test";
import assert from "node:assert/strict";
import {
  etaDeltaHours,
  isTrackingStale,
  milestoneShipmentStatus,
  normalizeTrackingMilestone,
  shouldOpenEtaDelayException,
  summarizeVisibility,
  trackingStaleHours,
} from "../app/admin/visibility/tracking-visibility.ts";

test("carrier-specific statuses normalize into KCPL milestones", () => {
  assert.equal(normalizeTrackingMilestone("Vessel sailed from Singapore"), "departed");
  assert.equal(normalizeTrackingMilestone("Consignee refused delivery"), "delivery_refused");
  assert.equal(normalizeTrackingMilestone("Proof of delivery completed"), "delivered");
  assert.equal(normalizeTrackingMilestone("Held at customs"), "import_customs");
});

test("explicit valid milestone wins over raw provider wording", () => {
  assert.equal(normalizeTrackingMilestone("weird provider code 441", "transshipment"), "transshipment");
  assert.equal(normalizeTrackingMilestone("weird provider code 441", "not_real"), "unknown");
});

test("delivered shipment state is terminal against later carrier noise", () => {
  assert.equal(milestoneShipmentStatus("departed", "delivered"), "delivered");
  assert.equal(milestoneShipmentStatus("exception", "delivered"), "delivered");
  assert.equal(milestoneShipmentStatus("delivered", "out_for_delivery"), "delivered");
});

test("tracking staleness window varies by mode", () => {
  assert.equal(trackingStaleHours("in_transit", "air"), 24);
  assert.equal(trackingStaleHours("in_transit", "sea"), 72);
  assert.equal(trackingStaleHours("in_transit", "road"), 36);
  assert.equal(isTrackingStale("2026-08-20T00:00:00Z", "in_transit", "air", "2026-08-22T00:00:00Z"), true);
  assert.equal(isTrackingStale("2026-08-21T12:00:00Z", "in_transit", "sea", "2026-08-22T00:00:00Z"), false);
  assert.equal(isTrackingStale(null, "delivered", "air", "2026-08-22T00:00:00Z"), false);
});

test("ETA slip detection uses hours and opens at 24-hour threshold", () => {
  const original = "2026-08-22T00:00:00Z";
  const delayed = "2026-08-23T06:00:00Z";
  assert.equal(etaDeltaHours(original, delayed), 30);
  assert.equal(shouldOpenEtaDelayException(original, delayed), true);
  assert.equal(shouldOpenEtaDelayException(original, "2026-08-22T12:00:00Z"), false);
});

test("visibility summary separates stale, delayed, customs and delivery work", () => {
  const base = {
    reference: "S1", quote_reference: "Q1", customer_id: "C1", customer_name: "Customer", origin: "KTM", destination: "CCU", mode: "road",
    primary_branch: "Kathmandu", handling_branches: ["Kathmandu"], status: "in_transit", carrier: null, carrier_reference: null,
    eta: null, original_eta: null, current_location: null, last_milestone: "departed", last_event_at: "2026-08-21T00:00:00Z",
    last_received_at: null, last_source: "manual", last_provider: null, stale_after: null, stale: false, eta_delta_hours: null, updated_at: "2026-08-21T00:00:00Z",
  };
  const rows = [
    { ...base, reference: "S1", stale: true },
    { ...base, reference: "S2", eta_delta_hours: 30 },
    { ...base, reference: "S3", status: "customs_clearance" },
    { ...base, reference: "S4", status: "out_for_delivery" },
    { ...base, reference: "S5", status: "delivered", last_event_at: "2026-08-22T01:00:00Z" },
  ];
  assert.deepEqual(summarizeVisibility(rows, "2026-08-22T05:00:00Z"), { active: 4, delayed: 1, stale: 1, customs: 1, out_for_delivery: 1, delivered_today: 1 });
});
