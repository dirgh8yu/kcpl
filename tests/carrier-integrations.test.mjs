import test from "node:test";
import assert from "node:assert/strict";
import {
  dcsaPayloadEvents,
  dhlStatusMilestone,
  inferCarrierIntegrationProvider,
  normalizeDhlTrackingPayload,
  providerConfigState,
  safeCarrierErrorMessage,
} from "../app/admin/carrier-integrations/carrier-integrations.ts";

test("carrier inference maps Maersk and DHL without guessing unrelated carriers", () => {
  assert.equal(inferCarrierIntegrationProvider("Maersk Line", "sea"), "maersk_ocean");
  assert.equal(inferCarrierIntegrationProvider("Sealand", "sea"), "maersk_ocean");
  assert.equal(inferCarrierIntegrationProvider("DHL Express", "courier"), "dhl_express");
  assert.equal(inferCarrierIntegrationProvider("DHL Supply Chain", "road"), null);
  assert.equal(inferCarrierIntegrationProvider("MSC", "sea"), null);
});

test("provider configuration state fails closed and health overrides configured state", () => {
  assert.equal(providerConfigState(0, 2, null, false), "unconfigured");
  assert.equal(providerConfigState(1, 2, null, false), "partial");
  assert.equal(providerConfigState(2, 2, null, false), "configured");
  assert.equal(providerConfigState(2, 2, true, false), "healthy");
  assert.equal(providerConfigState(2, 2, true, true), "degraded");
});

test("DHL status text normalizes into KCPL milestones", () => {
  assert.equal(dhlStatusMilestone("Shipment picked up"), "picked_up");
  assert.equal(dhlStatusMilestone("Clearance processing complete"), "import_customs");
  assert.equal(dhlStatusMilestone("With delivery courier"), "out_for_delivery");
  assert.equal(dhlStatusMilestone("Delivered - signed for"), "delivered");
  assert.equal(dhlStatusMilestone("Shipment is on hold"), "exception");
});

test("MyDHL checkpoint payload is normalized and time ordered", () => {
  const events = normalizeDhlTrackingPayload({ shipments: [{ id: "1234567890", events: [
    { timestamp: "2026-08-22T09:00:00Z", description: "With delivery courier", serviceArea: [{ description: "Kathmandu" }] },
    { timestamp: "2026-08-21T02:00:00Z", description: "Shipment picked up", serviceArea: [{ description: "Melbourne" }] },
  ] }] }, "1234567890");
  assert.equal(events.length, 2);
  assert.equal(events[0].milestone, "picked_up");
  assert.equal(events[0].location, "Melbourne");
  assert.equal(events[1].milestone, "out_for_delivery");
});

test("DCSA Track and Trace events map to existing visibility milestones", () => {
  const events = dcsaPayloadEvents({ events: [
    { eventID: "evt-1", eventType: "TRANSPORT", transportEventTypeCode: "DEPA", eventClassifierCode: "ACT", eventDateTime: "2026-08-20T10:00:00Z", carrierBookingReference: "MAEU123", eventLocation: { locationName: "Singapore" } },
    { eventID: "evt-2", eventType: "EQUIPMENT", equipmentEventTypeCode: "DISC", eventClassifierCode: "ACT", eventDateTime: "2026-08-22T10:00:00Z", transportDocumentReference: "BL123", equipmentReference: "MSKU1234567", eventLocation: { UNLocationCode: "INCCU" } },
  ] });
  assert.equal(events.length, 2);
  assert.equal(events[0].milestone, "departed");
  assert.equal(events[0].carrierBookingReference, "MAEU123");
  assert.equal(events[1].milestone, "arrived_destination");
  assert.equal(events[1].transportDocumentReference, "BL123");
  assert.equal(events[1].location, "INCCU");
});

test("carrier HTTP errors are reduced to safe operator messages", () => {
  assert.equal(safeCarrierErrorMessage(401, { message: "secret detail" }), "Carrier authentication or product entitlement was rejected.");
  assert.match(safeCarrierErrorMessage(429, {}), /rate limit/i);
  assert.match(safeCarrierErrorMessage(503, {}), /temporarily unavailable/i);
});
