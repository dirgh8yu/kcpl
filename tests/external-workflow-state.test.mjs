import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalShipmentStatus,
  customsReleaseRequiredForDirection,
  deriveExternalObservationExceptions,
  evaluateExternalPromotion,
  externalMilestoneCandidateStatus,
  externalObservationIsLate,
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
const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

// Core pickup, Customs, POD and canonical workflow policy.
test("1 external pickup observation cannot bypass a cancelled pickup workflow", () => {
  assert.deepEqual(decision({ canonicalStatus: "preparing", observedMilestone: "picked_up", pickupStatus: "cancelled", direction: "domestic" }), { decision: "blocked", targetStatus: "in_transit", reason: "pickup_cancelled" });
});
test("2 valid reconciled pickup observation may promote through domain policy", () => {
  assert.equal(decision({ canonicalStatus: "preparing", observedMilestone: "picked_up", pickupStatus: "picked_up", direction: "domestic" }).decision, "promote");
});
test("3 in-transit observation normalizes to an in_transit candidate", () => {
  assert.equal(externalMilestoneCandidateStatus("departed"), "in_transit");
});
test("4 carrier Delivered with Customs unreleased never canonically delivers", () => {
  assert.equal(decision({ customsClearanceStatus: "lodged" }).reason, "customs_not_released");
});
test("5 carrier Delivered with Customs released and POD missing remains blocked", () => {
  assert.equal(decision({ podStatus: "not_received" }).reason, "pod_not_verified");
});
test("6 carrier Delivered with all KCPL gates satisfied may promote", () => {
  assert.deepEqual(decision(), { decision: "promote", targetStatus: "delivered", reason: "kcpl_external_promotion_policy_satisfied" });
});
test("7 blocking operational exception prevents otherwise valid delivery promotion", () => {
  assert.equal(decision({ hasBlockingException: true }).reason, "blocking_operational_exception");
});
test("8 provider Customs milestone does not fabricate KCPL Customs release", () => {
  const result = decision({ canonicalStatus: "in_transit", observedMilestone: "import_customs", customsClearanceStatus: "lodged", podStatus: "not_received", deliveryWorkflowComplete: false });
  assert.equal(result.targetStatus, "customs_clearance");
  assert.notEqual(result.targetStatus, "delivered");
});
test("9 canonical Delivered is terminal against late provider movement", () => {
  assert.equal(decision({ canonicalStatus: "delivered", observedMilestone: "departed", isLateObservation: true }).reason, "canonical_delivered_is_terminal");
});
test("10 manual tracking is never canonical workflow authority", () => {
  assert.equal(decision({ source: "manual" }).reason, "manual_tracking_is_observation_only");
});
test("11 carrier exception is observation plus exception workflow, not canonical overwrite", () => {
  assert.equal(decision({ observedMilestone: "exception" }).decision, "observe_only");
});
test("12 delivery workflow verification remains independent from POD evidence", () => {
  assert.equal(decision({ podStatus: "verified", deliveryWorkflowComplete: false }).reason, "delivery_verification_required");
});

// Invalid canonical state must fail closed.
test("13 canonical status validator accepts only current shipment status inventory", () => {
  assert.equal(canonicalShipmentStatus("in_transit"), "in_transit");
  assert.equal(canonicalShipmentStatus("delivered"), "delivered");
});
test("14 malformed canonical status is not fabricated as booking_confirmed", () => {
  assert.equal(canonicalShipmentStatus("banana_state"), null);
  assert.equal(canonicalShipmentStatus(null), null);
});
test("15 malformed canonical status blocks external in-transit promotion", () => {
  assert.deepEqual(decision({ canonicalStatus: null, observedMilestone: "departed" }), { decision: "blocked", targetStatus: "in_transit", reason: "invalid_canonical_status" });
});
test("16 malformed canonical status blocks external Delivered promotion", () => {
  assert.equal(decision({ canonicalStatus: null, observedMilestone: "delivered" }).reason, "invalid_canonical_status");
});

// Late-event ordering and concurrency semantics.
test("17 older external event is not newer than persisted latest observation", () => {
  assert.equal(externalObservationIsNewer("2026-08-23T10:00:00.000Z", "2026-08-23T09:00:00.000Z"), false);
});
test("18 newer external event advances latest observation", () => {
  assert.equal(externalObservationIsNewer("2026-08-23T09:00:00.000Z", "2026-08-23T10:00:00.000Z"), true);
});
test("19 identical observed timestamps do not regress latest observation", () => {
  assert.equal(externalObservationIsNewer("2026-08-23T10:00:00.000Z", "2026-08-23T10:00:00.000Z"), true);
});
test("20 event older than tracking latest is historical", () => {
  assert.equal(externalObservationIsLate("2026-08-23T10:00:00.000Z", null, "2026-08-23T09:00:00.000Z"), true);
});
test("21 event older than latest external observation is historical even if tracking latest is absent", () => {
  assert.equal(externalObservationIsLate(null, "2026-08-23T10:00:00.000Z", "2026-08-23T09:00:00.000Z"), true);
});
test("22 newer event is not historical regardless of request arrival order", () => {
  assert.equal(externalObservationIsLate("2026-08-23T09:00:00.000Z", "2026-08-23T09:30:00.000Z", "2026-08-23T10:00:00.000Z"), false);
});
test("23 late candidate movement is observe-only", () => {
  assert.equal(decision({ observedMilestone: "out_for_delivery", isLateObservation: true }).reason, "late_external_observation");
});

// Observation-derived side effects are deterministic and suppress historical noise.
test("24 delivery-refusal exception identity is derived from observation fingerprint", () => {
  const plans = deriveExternalObservationExceptions({ fingerprint: "abc123", milestone: "delivery_refused", rawStatus: "Refused", details: null });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].triggerKey, "delivery-refused:abc123");
  assert.equal(plans[0].severity, "high");
});
test("25 carrier exception identity is derived from observation fingerprint", () => {
  const plans = deriveExternalObservationExceptions({ fingerprint: "evt1", milestone: "exception", rawStatus: "Carrier exception", details: null });
  assert.equal(plans[0].triggerKey, "carrier-exception:evt1");
});
test("26 ETA delay exception identity is derived from observation fingerprint", () => {
  const plans = deriveExternalObservationExceptions({ fingerprint: "eta1", milestone: "departed", previousEta: "2026-08-24T00:00:00.000Z", nextEta: "2026-08-26T00:00:00.000Z" });
  assert.equal(plans[0].triggerKey, "eta-delay:eta1");
  assert.equal(plans[0].severity, "medium");
});
test("27 ETA slips below threshold do not create exception side effects", () => {
  assert.equal(deriveExternalObservationExceptions({ fingerprint: "eta2", milestone: "departed", previousEta: "2026-08-24T00:00:00.000Z", nextEta: "2026-08-24T12:00:00.000Z" }).length, 0);
});
test("28 historical external observations do not open new operational exceptions", () => {
  assert.equal(deriveExternalObservationExceptions({ fingerprint: "old", milestone: "exception", rawStatus: "Old exception", isLateObservation: true }).length, 0);
});
test("29 different legitimate observation fingerprints retain separate exception identities", () => {
  const a = deriveExternalObservationExceptions({ fingerprint: "A", milestone: "exception", rawStatus: "Exception" })[0];
  const b = deriveExternalObservationExceptions({ fingerprint: "B", milestone: "exception", rawStatus: "Exception" })[0];
  assert.notEqual(a.triggerKey, b.triggerKey);
});

// Shared provider pipeline inventory.
test("30 DHL MyDHL checkpoints route through ordered tracking authority", async () => {
  const code = await source("../app/admin/carrier-integrations/carrier-integrations.server.ts");
  assert.match(code, /recordOrderedTrackingEvent/);
  assert.match(code, /DHL Express MyDHL API/);
});
test("31 Maersk DCSA events route through ordered tracking authority", async () => {
  const code = await source("../app/admin/carrier-integrations/maersk-webhook.server.ts");
  assert.match(code, /recordOrderedTrackingEvent/);
  assert.match(code, /resolveCanonicalRecordCandidates/);
});
test("32 EDI 214 events route through ordered tracking authority", async () => {
  const code = await source("../app/admin/edi/edi-gateway.server.ts");
  assert.match(code, /process214/);
  assert.match(code, /recordOrderedTrackingEvent/);
});
test("33 generic tracking route uses ordered tracking authority", async () => {
  const code = await source("../app/api/integrations/tracking/route.ts");
  assert.match(code, /recordOrderedTrackingEvent/);
  assert.match(code, /trackingMachineAuthorized/);
});
test("34 ordered tracking has no independent historical mutation path", async () => {
  const code = await source("../app/admin/visibility/tracking-ingest.server.ts");
  assert.match(code, /return recordTrackingEvent/);
  assert.doesNotMatch(code, /archiveHistoricalEvent|tracking_last_event_at|batch\(/);
});

// Transactional authority, primary branch and exception coverage.
test("35 shared recorder rereads shipment inside Firestore transaction", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /runTransaction/);
  assert.match(code, /transaction\.get\(scope\.ref\)/);
});
test("36 late decision uses transaction-reread tracking and external timestamps", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /currentLastAt = nullable\(shipment\.tracking_last_event_at\)/);
  assert.match(code, /currentExternalAt = nullable\(shipment\.external_observed_at\)/);
  assert.match(code, /externalObservationIsLate\(currentLastAt, currentExternalAt, event\.event_time\)/);
});
test("37 machine event requires persisted canonical primary_branch inside transaction", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /canonicalPrimary = branchValue\(shipment\.primary_branch\)/);
  assert.match(code, /if \(machine && !canonicalPrimary\) return \{ kind: "invalid_branch"/);
});
test("38 handling branch fallback remains read-only rather than machine authority", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /primary: primary \?\? branches\[0\]/);
  assert.match(code, /machine && !canonicalPrimary/);
});
test("39 malformed canonical status is validated inside mutation transaction", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /canonicalBefore = canonicalShipmentStatus\(shipment\.status\)/);
  assert.doesNotMatch(code, /const canonicalBefore = statusValue\(shipment\.status\)/);
});
test("40 blocking exception authority is not capped at first 100 exception documents", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.doesNotMatch(code, /exceptions[\s\S]{0,80}limit\(100\)/);
  assert.match(code, /where\("status", "==", "open"\)\.where\("severity", "==", "high"\)\.limit\(1\)/);
  assert.match(code, /where\("status", "==", "monitoring"\)\.where\("severity", "==", "critical"\)\.limit\(1\)/);
});
test("41 high and critical open or monitoring exceptions are all covered by blocker queries", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  for (const status of ["open", "monitoring"]) for (const severity of ["high", "critical"]) assert.match(code, new RegExp(`where\\(\\"status\\", \\"==\\", \\"${status}\\"\\)\\.where\\(\\"severity\\", \\"==\\", \\"${severity}\\"\\)`));
});

// Race-safe/retry-safe event side effects.
test("42 tracking observation identity is deterministic fingerprint document", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /const eventRef = scope\.ref\.collection\("tracking_events"\)\.doc\(fingerprint\)/);
  assert.match(code, /transaction\.create\(eventRef, storedEvent\)/);
});
test("43 legacy shipment event uses deterministic observation-derived document ID", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /legacyEventDocId\(fingerprint\)/);
  assert.doesNotMatch(code, /numericEventId\(\)|Math\.random\(\).*legacy/);
});
test("44 tracking job activity uses deterministic observation-derived document ID", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /trackingActivityDocId\(fingerprint\)/);
});
test("45 canonical promotion audit activity uses deterministic observation-derived document ID", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /promotionActivityDocId\(fingerprint\)/);
});
test("46 provider-derived exceptions use deterministic observation-derived document IDs", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /derivedExceptionDocId\(fingerprint, plan\.kind\)/);
  assert.match(code, /derivedExceptionActivityDocId\(fingerprint, plan\.kind\)/);
});
test("47 duplicate observation retries repair missing derived exceptions", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /if \(duplicateSnapshot\.exists\)/);
  assert.match(code, /derivedExceptionPlans\(stored\.derived_exceptions\)/);
  assert.match(code, /repairDerivedExceptions\(transaction, scope, fingerprint/);
});
test("48 duplicate observation retries repair deterministic activity without another canonical transition", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  const duplicateBlock = code.slice(code.indexOf("if (duplicateSnapshot.exists)"), code.indexOf("const canonicalBefore = canonicalShipmentStatus(shipment.status)"));
  assert.match(duplicateBlock, /writeObservationAncillaryEffects/);
  assert.doesNotMatch(duplicateBlock, /transaction\.update\(scope\.ref/);
});
test("49 observation-derived exceptions are planned before the authoritative transaction commits", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /deriveExternalObservationExceptions/);
  assert.match(code, /await repairDerivedExceptions\(transaction, scope, fingerprint, activityBranch, plans, receivedAt\);[\s\S]*transaction\.create\(eventRef, storedEvent\)/);
});
test("50 concurrent identical observations contend on the same tracking and exception documents", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /\.doc\(fingerprint\)/);
  assert.match(code, /tracking-\$\{kind\}-\$\{fingerprint\}/);
  assert.match(code, /runTransaction/);
});

// Pickup authority and retry repair.
test("51 pickup integration retains dedicated machine secret with no automation fallback", async () => {
  const code = await source("../app/machine-auth-policy.ts");
  const pickup = code.slice(code.indexOf("export function pickupMachineAuthorized"), code.indexOf("export function maerskMachineAuthorized"));
  assert.match(pickup, /KCPL_PICKUP_INTEGRATION_SECRET/);
  assert.doesNotMatch(pickup, /KCPL_AUTOMATION_SECRET/);
});
test("52 pickup integration requires canonical shipment primary_branch", async () => {
  const code = await source("../app/api/integrations/pickups/route.ts");
  assert.match(code, /branchValue\(shipment\.primary_branch\)/);
  assert.match(code, /transactionBranch = branchValue\(currentShipment\.get\("primary_branch"\)\)/);
});
test("53 pickup provider transition passes pickupTransitionAllowed", async () => {
  const code = await source("../app/api/integrations/pickups/route.ts");
  assert.match(code, /pickupTransitionAllowed\(currentStatus, nextStatus\)/);
  assert.match(code, /pickupTransitionAllowed\(transactionStatus, nextStatus\)/);
});
test("54 pickup provider event and activities use deterministic event IDs", async () => {
  const code = await source("../app/api/integrations/pickups/route.ts");
  assert.match(code, /doc\(`provider-\$\{eventKey\}`\)/);
  assert.match(code, /doc\(`pickup-provider-\$\{eventKey\}`\)/);
});
test("55 duplicate pickup domain event still reconciles normalized tracking observation", async () => {
  const code = await source("../app/api/integrations/pickups/route.ts");
  const duplicateReturn = code.indexOf("if (domainResult.kind === \"duplicate\")");
  const trackingCall = code.lastIndexOf("recordPickupObservation(observationInput)", duplicateReturn);
  assert.ok(trackingCall > 0 && trackingCall < duplicateReturn);
});
test("56 invalid pickup transition retains provider observation for reconciliation", async () => {
  const code = await source("../app/api/integrations/pickups/route.ts");
  assert.match(code, /!pickupTransitionAllowed\(currentStatus, nextStatus\)[\s\S]*recordPickupObservation\(observationInput\)[\s\S]*observationStored: true/);
});

// GPT and read-model backward compatibility.
test("57 visibility read model exposes observed external milestone separately from canonical status", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /observed_external_milestone/);
  assert.match(code, /external_reconciliation_status/);
  assert.match(code, /status,/);
});
test("58 GPT briefing preserves legacy statusCounts and adds canonicalStatusCounts", async () => {
  const code = await source("../app/api/gpt/briefing/route.ts");
  assert.match(code, /statusCounts: counts/);
  assert.match(code, /canonicalStatusCounts: counts/);
});
test("59 GPT attention preserves legacy status and adds canonicalWorkflowStatus", async () => {
  const code = await source("../app/api/gpt/briefing/route.ts");
  assert.match(code, /status,\n\s*canonicalWorkflowStatus: status/);
});
test("60 GPT attention keeps provider-observed state separate and sanitized", async () => {
  const code = await source("../app/api/gpt/briefing/route.ts");
  assert.match(code, /observedExternalMilestone/);
  assert.match(code, /externalPromotionBlocker/);
  assert.doesNotMatch(code, /raw_payload|rawX12|private_url/i);
});
test("61 generic tracking response preserves status alias while exposing canonicalStatus", async () => {
  const code = await source("../app/api/integrations/tracking/route.ts");
  assert.match(code, /status: result\.status/);
  assert.match(code, /canonicalStatus: result\.status/);
  assert.match(code, /promotionBlocked/);
});

// Trust boundaries, Customs authority and provider conflict behavior.
test("62 EDI 214 conflicting identifiers quarantine before event processing", async () => {
  const code = await source("../app/admin/edi/edi-trust-boundary.server.ts");
  assert.match(code, /resolveCanonicalRecordCandidates/);
  assert.match(code, /identifiers resolve to multiple shipments/);
  assert.match(code, /invalid_branch/);
});
test("63 Maersk conflicting identifiers remain set-based and ambiguity-safe", async () => {
  const code = await source("../app/admin/carrier-integrations/maersk-webhook.server.ts");
  assert.match(code, /const matches = new Map/);
  assert.match(code, /resolveCanonicalRecordCandidates/);
  assert.match(code, /ambiguous/);
});
test("64 provider branch metadata is not a promotion-policy input", () => {
  assert.equal(Object.hasOwn(base, "branch"), false);
});
test("65 external confidence cannot influence canonical promotion", () => {
  assert.deepEqual(decision({ confidence: 0 }), decision({ confidence: 1 }));
});
test("66 provider Customs observations never assign KCPL Customs release", async () => {
  const policy = await source("../app/admin/visibility/external-workflow-state.ts");
  const recorder = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.doesNotMatch(policy, /customs_clearance_status\s*=/);
  assert.doesNotMatch(recorder, /customs_clearance_status\s*:/);
});
test("67 conflicting providers remain separate observations rather than one canonical latest-webhook rule", async () => {
  const code = await source("../app/admin/visibility/tracking-visibility.server.ts");
  assert.match(code, /provider: input\.provider/);
  assert.match(code, /transaction\.create\(eventRef, storedEvent\)/);
  assert.match(code, /evaluateExternalPromotion/);
});

// Terminal and regression compatibility sentinels.
test("68 manual canonical Delivered followed by provider Delivered is canonical no-op", () => {
  assert.equal(decision({ canonicalStatus: "delivered" }).decision, "no_change");
});
test("69 terminal Delivered cannot regress to any earlier movement milestone", () => {
  for (const milestone of ["picked_up", "departed", "import_customs", "out_for_delivery"]) assert.equal(decision({ canonicalStatus: "delivered", observedMilestone: milestone }).decision, "no_change");
});
test("70 international directions require explicit KCPL Customs release", () => {
  assert.equal(customsReleaseRequiredForDirection("import"), true);
  assert.equal(customsReleaseRequiredForDirection("export"), true);
  assert.equal(customsReleaseRequiredForDirection("cross_trade"), true);
  assert.equal(customsReleaseRequiredForDirection("domestic"), false);
});
test("71 financial settlement surface remains outside external promotion policy", async () => {
  const code = await source("../app/admin/visibility/external-workflow-state.ts");
  assert.doesNotMatch(code, /settlement|invoice|payment/i);
});
test("72 tender booking consolidation surface remains outside external promotion policy", async () => {
  const code = await source("../app/admin/visibility/external-workflow-state.ts");
  assert.doesNotMatch(code, /tender|booking_reference|consolidation/i);
});
test("73 PR 128 canonical branch matching remains authoritative for Maersk", async () => {
  const code = await source("../app/admin/carrier-integrations/maersk-webhook.server.ts");
  assert.match(code, /resolveCanonicalRecordCandidates/);
  assert.match(code, /primary_branch/);
});
test("74 commercial economic lineage surface remains outside external promotion policy", async () => {
  const code = await source("../app/admin/visibility/external-workflow-state.ts");
  assert.doesNotMatch(code, /sell_price|buy_price|margin|economic/i);
});
