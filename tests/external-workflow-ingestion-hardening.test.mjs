import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluateExternalPromotion } from "../app/admin/visibility/external-workflow-state.ts";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const base = {
  canonicalStatus: "booking_confirmed",
  observedMilestone: "pickup_scheduled",
  source: "carrier_api",
  direction: "domestic",
  customsClearanceStatus: "not_started",
  podStatus: "not_received",
  pickupStatus: "cancelled",
  deliveryWorkflowComplete: false,
  hasBlockingException: false,
  isLateObservation: false,
};

test("cancelled pickup blocks even a provider pickup-scheduled observation from advancing canonical state", () => {
  assert.deepEqual(evaluateExternalPromotion(base), {
    decision: "blocked",
    targetStatus: "preparing",
    reason: "pickup_cancelled",
  });
});

test("cancelled pickup also blocks downstream provider movement until KCPL reconciles the pickup truth", () => {
  for (const milestone of ["picked_up", "departed", "import_customs", "out_for_delivery", "delivered"]) {
    assert.equal(evaluateExternalPromotion({ ...base, observedMilestone: milestone }).reason, "pickup_cancelled");
  }
});

test("generic machine tracking requires a stable provider event id before shared ingestion", async () => {
  const code = await source("../app/api/integrations/tracking/route.ts");
  assert.match(code, /providerEventId is required for idempotent machine tracking ingestion/);
  assert.match(code, /if \(!providerEventId\) return json/);
  assert.match(code, /providerEventId,/);
});

test("shared observation fingerprint gives provider event id authority over retry identity", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /event\.provider_event_id\s*\? \[reference, event\.source, event\.provider \?\? "", event\.provider_event_id\]/);
  assert.match(code, /collection\("tracking_events"\)\.doc\(fingerprint\)/);
});

test("provider-event replay is repaired inside the same transaction without another shipment mutation", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  const duplicateStart = code.indexOf("if (duplicateSnapshot.exists)");
  const newEventStart = code.indexOf("const canonicalBefore = canonicalShipmentStatus(shipment.status)", duplicateStart);
  const duplicateBlock = code.slice(duplicateStart, newEventStart);
  assert.match(duplicateBlock, /repairDerivedExceptions/);
  assert.match(duplicateBlock, /writeObservationAncillaryEffects/);
  assert.doesNotMatch(duplicateBlock, /transaction\.update\(scope\.ref/);
});

test("pickup duplicate domain replay still executes shared observation reconciliation", async () => {
  const code = await source("../app/api/integrations/pickups/route.ts");
  const trackingCall = code.lastIndexOf("recordPickupObservation(observationInput)");
  const duplicateReturn = code.indexOf("if (domainResult.kind === \"duplicate\")", trackingCall);
  assert.ok(trackingCall >= 0 && duplicateReturn > trackingCall);
});
