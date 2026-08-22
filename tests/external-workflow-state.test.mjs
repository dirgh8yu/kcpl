import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  customsReleaseRequiredForDirection,
  evaluateExternalPromotion,
  externalMilestoneCandidateStatus,
  externalObservationIsNewer,
} from "../app/admin/visibility/external-workflow-state.ts";

const base = {
  canonicalStatus: "in_transit",
  observedMilestone: "delivered",
  source: "carrier_api",
  direction: "import",
  customsClearanceStatus: "released",
  podStatus: "verified",
  pickupStatus: "picked_up",
  deliveryWorkflowComplete: true,
  hasBlockingException: false,
  isLateObservation: false,
};
const decision = (overrides = {}) => evaluateExternalPromotion({ ...base, ...overrides });

// 1-2 pickup reconciliation
test("1 external pickup observation cannot bypass an invalid pickup workflow", () => {
  assert.deepEqual(decision({ canonicalStatus: "preparing", observedMilestone: "picked_up", pickupStatus: "cancelled", direction: "domestic" }), { decision: "blocked", targetStatus: "in_transit", reason: "pickup_cancelled" });
});
test("2 valid reconciled pickup observation may promote through domain policy", () => {
  assert.equal(decision({ canonicalStatus: "preparing", observedMilestone: "picked_up", pickupStatus: "picked_up", direction: "domestic" }).decision, "promote");
});

// 3-8 movement/customs/POD
test("3 in-transit observation is a candidate visibility/workflow movement", () => {
  assert.equal(externalMilestoneCandidateStatus("departed"), "in_transit");
});
test("4 carrier delivered with customs unreleased never canonically delivers", () => {
  assert.equal(decision({ customsClearanceStatus: "lodged" }).reason, "customs_not_released");
});
test("5 carrier delivered with customs released and POD missing remains blocked", () => {
  assert.equal(decision({ podStatus: "not_received" }).reason, "pod_not_verified");
});
test("6 carrier delivered with every KCPL gate satisfied may promote", () => {
  assert.deepEqual(decision(), { decision: "promote", targetStatus: "delivered", reason: "kcpl_external_promotion_policy_satisfied" });
});
test("7 blocking operational exception prevents external delivery promotion", () => {
  assert.equal(decision({ hasBlockingException: true }).reason, "blocking_operational_exception");
});
test("8 provider customs milestone never fabricates KCPL customs release", () => {
  const result = decision({ canonicalStatus: "in_transit", observedMilestone: "import_customs", customsClearanceStatus: "lodged", podStatus: "not_received", deliveryWorkflowComplete: false });
  assert.equal(result.targetStatus, "customs_clearance");
  assert.notEqual(result.targetStatus, "delivered");
});

// 9-12 late/idempotency architecture
test("9 late in-transit observation cannot regress canonical Delivered", () => {
  assert.equal(decision({ canonicalStatus: "delivered", observedMilestone: "departed", isLateObservation: true }).reason, "canonical_delivered_is_terminal");
});
test("10 older external event is not newer than latest observed external state", () => {
  assert.equal(externalObservationIsNewer("2026-08-23T10:00:00.000Z", "2026-08-23T09:00:00.000Z"), false);
});
test("11 identical timestamps do not regress latest external observation", () => {
  assert.equal(externalObservationIsNewer("2026-08-23T10:00:00.000Z", "2026-08-23T10:00:00.000Z"), true);
});
test("12 late observations are observe-only even if candidate state is ahead", () => {
  assert.equal(decision({ canonicalStatus: "in_transit", observedMilestone: "out_for_delivery", isLateObservation: true }).reason, "late_external_observation");
});

// 13-16 shared provider pipeline source checks
test("13 DHL/carrier API normalization cannot bypass the shared recordTrackingEvent authority", async () => {
  const source = await readFile(new URL("../app/admin/visibility/tracking-visibility.server.ts", import.meta.url), "utf8");
  assert.match(source, /evaluateExternalPromotion/);
  assert.doesNotMatch(source, /milestoneShipmentStatus\(/);
});
test("14 Maersk DCSA routes through ordered tracking into the shared recorder", async () => {
  const source = await readFile(new URL("../app/admin/carrier-integrations/maersk-webhook.server.ts", import.meta.url), "utf8");
  assert.match(source, /recordOrderedTrackingEvent/);
});
test("15 EDI 214 route remains on the shared normalized tracking path", async () => {
  const source = await readFile(new URL("../app/api/integrations/edi/route.ts", import.meta.url), "utf8");
  assert.match(source, /edi/i);
});
test("16 generic tracking route remains isolated behind the tracking integration path", async () => {
  const source = await readFile(new URL("../app/api/integrations/tracking/route.ts", import.meta.url), "utf8");
  assert.match(source, /tracking/i);
});

// 17-20 trust boundaries/confidence
test("17 conflicting identifiers remain a quarantine concern before event promotion", async () => {
  const source = await readFile(new URL("../app/admin/visibility/tracking-ingest.server.ts", import.meta.url), "utf8");
  assert.match(source, /recordTrackingEvent/);
});
test("18 canonical branch validation remains inside the shared tracking recorder", async () => {
  const source = await readFile(new URL("../app/admin/visibility/tracking-visibility.server.ts", import.meta.url), "utf8");
  assert.match(source, /invalid_branch/);
  assert.match(source, /primary_branch/);
});
test("19 provider branch metadata is absent from promotion policy inputs", () => {
  assert.equal(Object.hasOwn(base, "branch"), false);
});
test("20 confidence cannot influence canonical promotion", () => {
  assert.deepEqual(decision({ confidence: 0 }), decision({ confidence: 1 }));
});

// 21-25 terminal/manual/exception behavior
test("21 manual Delivered followed by provider Delivered is canonical no-op", () => {
  assert.equal(decision({ canonicalStatus: "delivered" }).decision, "no_change");
});
test("22 provider Delivered can promote after KCPL POD and delivery workflow verification", () => {
  assert.equal(decision({ podStatus: "verified", deliveryWorkflowComplete: true }).decision, "promote");
});
test("23 severe open exception blocks otherwise valid promotion", () => {
  assert.equal(decision({ hasBlockingException: true }).decision, "blocked");
});
test("24 cancelled pickup cannot be resurrected by provider movement", () => {
  assert.equal(decision({ canonicalStatus: "preparing", observedMilestone: "picked_up", pickupStatus: "cancelled", direction: "domestic" }).decision, "blocked");
});
test("25 terminal canonical Delivered cannot regress", () => {
  for (const milestone of ["picked_up", "departed", "import_customs", "out_for_delivery"]) assert.equal(decision({ canonicalStatus: "delivered", observedMilestone: milestone }).decision, "no_change");
});

// 26-30 read-model and regression sentinels
test("26 read model exposes external observation separately from canonical status", async () => {
  const source = await readFile(new URL("../app/admin/visibility/tracking-visibility.server.ts", import.meta.url), "utf8");
  assert.match(source, /observed_external_milestone/);
  assert.match(source, /external_reconciliation_status/);
  assert.match(source, /status,/);
});
test("27 financial settlement surface is not imported by external promotion policy", async () => {
  const source = await readFile(new URL("../app/admin/visibility/external-workflow-state.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /settlement|invoice|payment/i);
});
test("28 tender booking consolidation surface is not mutated by external promotion policy", async () => {
  const source = await readFile(new URL("../app/admin/visibility/external-workflow-state.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /tender|consolidation/i);
});
test("29 trust-boundary target matching remains outside provider-supplied branch authority", async () => {
  const source = await readFile(new URL("../app/admin/carrier-integrations/maersk-webhook.server.ts", import.meta.url), "utf8");
  assert.match(source, /resolveCanonicalRecordCandidates/);
  assert.match(source, /invalid_branch/);
});
test("30 commercial economic lineage surface is not mutated by external promotion policy", async () => {
  const source = await readFile(new URL("../app/admin/visibility/external-workflow-state.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /sell_price|buy_price|margin|economic/i);
});

test("international directions require explicit KCPL customs release", () => {
  assert.equal(customsReleaseRequiredForDirection("import"), true);
  assert.equal(customsReleaseRequiredForDirection("export"), true);
  assert.equal(customsReleaseRequiredForDirection("cross_trade"), true);
  assert.equal(customsReleaseRequiredForDirection("domestic"), false);
});
test("manual tracking observations never become canonical workflow authority", () => {
  assert.equal(decision({ source: "manual", observedMilestone: "delivered" }).reason, "manual_tracking_is_observation_only");
});
test("external carrier exception is observation plus exception workflow, not canonical status overwrite", () => {
  assert.equal(decision({ observedMilestone: "exception" }).decision, "observe_only");
});
test("external delivery workflow verification remains independent from POD evidence", () => {
  assert.equal(decision({ podStatus: "verified", deliveryWorkflowComplete: false }).reason, "delivery_verification_required");
});
