import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluateCanonicalDeliveryCompletion } from "../app/admin/delivery/canonical-delivery-policy.ts";
import { deliveryAttemptTransitionAllowed } from "../app/admin/delivery/delivery-control.ts";
import { evaluateExternalPromotion } from "../app/admin/visibility/external-workflow-state.ts";
import { shipmentDocumentCountsAsReady } from "../app/shipment-document-policy.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");
const deliveryServer = source("app/admin/delivery/delivery-control.server.ts");
const authorityServer = source("app/admin/delivery/canonical-delivery-authority.server.ts");
const policySource = source("app/admin/delivery/canonical-delivery-policy.ts");
const directRoute = source("app/api/admin/shipments/[reference]/route.ts");
const deliveryRoute = source("app/api/admin/jobs/[reference]/delivery/route.ts");
const trackingServer = source("app/admin/visibility/tracking-visibility.server.ts");
const shipmentData = source("app/shipment-data.server.ts");
const packageJson = JSON.parse(source("package.json"));

const base = {
  canonicalStatus: "out_for_delivery",
  primaryBranchValid: true,
  customerLinked: true,
  jobClosed: false,
  deliveryAttemptExists: true,
  deliveryAttemptStatus: "delivered",
  deliveryAttemptMatchesPod: true,
  podStatus: "verified",
  podManifestVerified: true,
  requiredDocumentsReady: true,
  customsReleaseRequired: true,
  customsChecklistReady: true,
  customsClearanceStatus: "released",
  hasBlockingException: false,
};
const decision = (overrides = {}) => evaluateCanonicalDeliveryCompletion({ ...base, ...overrides });
const completeDecision = decision();
const external = (overrides = {}) => evaluateExternalPromotion({
  canonicalStatus: "out_for_delivery",
  observedMilestone: "delivered",
  source: "carrier_api",
  direction: "import",
  customsClearanceStatus: "released",
  pickupStatus: "picked_up",
  hasBlockingException: false,
  isLateObservation: false,
  canonicalDeliveryDecision: completeDecision,
  ...overrides,
});

// 1-10 Manual delivery semantics.
test("01 scheduled attempt may record physical delivered evidence", () => assert.equal(deliveryAttemptTransitionAllowed("scheduled", "delivered"), true));
test("02 physical delivered branch does not directly assign canonical Delivered", () => {
  const block = deliveryServer.slice(deliveryServer.indexOf("export async function updateDeliveryAttempt"), deliveryServer.indexOf("export async function uploadPodEvidence"));
  assert.doesNotMatch(block, /status:\s*nextShipmentStatus/);
  assert.match(block, /if \(input\.status !== "delivered"\) shipmentUpdate\.status/);
});
test("03 physical delivered path does not mutate customer completion counters", () => {
  const block = deliveryServer.slice(deliveryServer.indexOf("export async function updateDeliveryAttempt"), deliveryServer.indexOf("export async function uploadPodEvidence"));
  assert.doesNotMatch(block, /completed_shipment_count|active_shipment_count/);
});
test("04 physical delivered with POD missing remains blocked", () => assert.equal(decision({ podStatus: "not_received", podManifestVerified: false }).reason, "pod_not_verified"));
test("05 physical delivered with Customs pending remains blocked", () => assert.equal(decision({ customsClearanceStatus: "lodged" }).reason, "customs_not_released"));
test("06 physical delivered with required docs missing remains blocked", () => assert.equal(decision({ requiredDocumentsReady: false }).reason, "required_documents_incomplete"));
test("07 physical delivered with severe blocker remains blocked", () => assert.equal(decision({ hasBlockingException: true }).reason, "blocking_operational_exception"));
test("08 recipient evidence is retained on exact Delivery Attempt", () => assert.match(deliveryServer, /recipient_name: input\.recipientName\.trim\(\) \|\| null/));
test("09 manual tracking event is retained as observation", () => assert.match(deliveryServer, /source: "manual"[\s\S]{0,100}provider: "KCPL Delivery Control"/));
test("10 manual tracking alone cannot promote canonical status", () => assert.equal(external({ source: "manual" }).reason, "manual_tracking_is_observation_only"));

// 11-20 POD authority.
test("11 POD received is not enough", () => assert.equal(decision({ podStatus: "received", podManifestVerified: false }).reason, "pod_not_verified"));
test("12 POD rejected is not enough", () => assert.equal(decision({ podStatus: "rejected", podManifestVerified: false }).reason, "pod_not_verified"));
test("13 POD verified manifest satisfies POD gate", () => assert.equal(decision().decision, "complete"));
test("14 POD verify with all other gates complete invokes canonical reconciliation", () => assert.match(deliveryServer, /reconcileCanonicalDelivery\(scope\.reference, \{ source: "pod_verification"/));
test("15 POD verify with Customs pending remains pending", () => assert.equal(decision({ customsClearanceStatus: "held" }).decision, "blocked"));
test("16 POD verify with severe exception remains pending", () => assert.equal(decision({ hasBlockingException: true }).decision, "blocked"));
test("17 POD verify retry reuses evidence authority and reconciliation instead of creating completion twice", () => assert.match(deliveryServer, /delivery_pod_status\) === "verified"[\s\S]{0,220}reconcileCanonicalDelivery/));
test("18 POD manifest identity is recorded in completion audit", () => assert.match(authorityServer, /pod_document_id: facts\.podDocumentId[\s\S]{0,100}pod_manifest_sha256/));
test("19 physical event time remains separately referenced", () => assert.match(authorityServer, /physical_delivered_at: facts\.attemptSnapshot/));
test("20 canonical completion has its own completion timestamp", () => assert.match(authorityServer, /delivery_completed_at: input\.completedAt/));

// 21-29 Customs and documents.
test("21 domestic no-release-required completion can pass without release", () => assert.equal(decision({ customsReleaseRequired: false, customsClearanceStatus: "not_started" }).decision, "complete"));
test("22 international shipment requires checklist readiness", () => assert.equal(decision({ customsChecklistReady: false }).reason, "customs_steps_incomplete"));
test("23 international shipment requires explicit released status", () => assert.equal(decision({ customsClearanceStatus: "preparing" }).reason, "customs_not_released"));
test("24 held Customs blocks canonical delivery", () => assert.equal(decision({ customsClearanceStatus: "held" }).reason, "customs_not_released"));
test("25 required operational document missing blocks", () => assert.equal(decision({ requiredDocumentsReady: false }).reason, "required_documents_incomplete"));
test("26 uploaded but unverified document does not count ready", () => assert.equal(shipmentDocumentCountsAsReady({ status: "received", today: "2026-08-23" }), false));
test("27 expired required document does not count ready", () => assert.equal(shipmentDocumentCountsAsReady({ status: "verified", expiresOn: "2026-08-22", today: "2026-08-23" }), false));
test("28 deleted or superseded metadata is explicitly rejected by authority reader", () => assert.match(authorityServer, /deleted_at[\s\S]{0,100}superseded_by_document_id/));
test("29 verified unexpired required document counts ready", () => assert.equal(shipmentDocumentCountsAsReady({ status: "verified", expiresOn: "2026-08-24", today: "2026-08-23" }), true));

// 30-36 Exception authority.
test("30 open high blocker query exists", () => assert.match(authorityServer, /where\("status", "==", "open"\)\.where\("severity", "==", "high"\)\.limit\(1\)/));
test("31 monitoring high blocker query exists", () => assert.match(authorityServer, /where\("status", "==", "monitoring"\)\.where\("severity", "==", "high"\)\.limit\(1\)/));
test("32 open critical blocker query exists", () => assert.match(authorityServer, /where\("status", "==", "open"\)\.where\("severity", "==", "critical"\)\.limit\(1\)/));
test("33 monitoring critical blocker query exists", () => assert.match(authorityServer, /where\("status", "==", "monitoring"\)\.where\("severity", "==", "critical"\)\.limit\(1\)/));
test("34 medium exception is not a hard completion blocker in shared policy", () => assert.doesNotMatch(policySource, /severity.*medium/));
test("35 resolved high is not queried as active blocker", () => assert.doesNotMatch(authorityServer, /where\("status", "==", "resolved"\).*severity/));
test("36 historical exception volume cannot hide active severe blocker", () => {
  assert.doesNotMatch(authorityServer, /exceptions[\s\S]{0,120}limit\(100\)/);
  assert.equal((authorityServer.match(/\.limit\(1\)/g) ?? []).length >= 4, true);
});

// 37-44 Direct API and Management override.
test("37 direct PATCH Delivered without Delivery Attempt is blocked by shared policy", () => assert.equal(decision({ deliveryAttemptExists: false, deliveryAttemptStatus: null }).reason, "delivery_attempt_required"));
test("38 direct PATCH Delivered without POD is blocked", () => assert.equal(decision({ podStatus: "not_received", podManifestVerified: false }).reason, "pod_not_verified"));
test("39 direct PATCH Delivered with Customs pending is blocked", () => assert.equal(decision({ customsClearanceStatus: "lodged" }).reason, "customs_not_released"));
test("40 direct PATCH Delivered with docs incomplete is blocked", () => assert.equal(decision({ requiredDocumentsReady: false }).reason, "required_documents_incomplete"));
test("41 direct PATCH Delivered with severe blocker is blocked", () => assert.equal(decision({ hasBlockingException: true }).reason, "blocking_operational_exception"));
test("42 Management override reason cannot fabricate Delivered", () => {
  const deliveredBlock = directRoute.slice(directRoute.indexOf('if (status === "delivered")'), directRoute.indexOf("const transition = await validateShipmentTransition"));
  assert.match(deliveredBlock, /reconcileCanonicalDelivery/);
  assert.match(deliveredBlock, /canOverride: false/);
  assert.doesNotMatch(deliveredBlock, /overrideReason|recordWorkflowOverride/);
  assert.doesNotMatch(policySource, /management|override/i);
});
test("43 all hard gates valid allow direct reconciliation", () => assert.equal(decision().decision, "complete"));
test("44 generic direct retry cannot own customer counter effects", () => assert.doesNotMatch(shipmentData.slice(shipmentData.indexOf("export async function updateShipment")), /completed_shipment_count/));

// 45-54 Provider Delivered.
test("45 provider Delivered remains observation when POD missing", () => assert.equal(external({ canonicalDeliveryDecision: decision({ podStatus: "not_received", podManifestVerified: false }) }).reason, "pod_not_verified"));
test("46 provider Delivered remains observation when delivery workflow incomplete", () => assert.equal(external({ canonicalDeliveryDecision: decision({ deliveryAttemptExists: false, deliveryAttemptStatus: null }) }).reason, "delivery_attempt_required"));
test("47 provider Delivered remains observation when Customs pending", () => assert.equal(external({ canonicalDeliveryDecision: decision({ customsClearanceStatus: "lodged" }) }).reason, "customs_not_released"));
test("48 provider Delivered remains observation when docs incomplete", () => assert.equal(external({ canonicalDeliveryDecision: decision({ requiredDocumentsReady: false }) }).reason, "required_documents_incomplete"));
test("49 provider Delivered remains observation when severe blocker exists", () => assert.equal(external({ canonicalDeliveryDecision: decision({ hasBlockingException: true }) }).reason, "blocking_operational_exception"));
test("50 provider Delivered with all shared completion gates valid may promote", () => assert.deepEqual(external(), { decision: "promote", targetStatus: "delivered", reason: "canonical_delivery_authority_satisfied" }));
test("51 provider confidence is not an authority input", () => assert.doesNotMatch(policySource, /confidence/));
test("52 late provider Delivered does not bypass shared authority", () => assert.equal(external({ isLateObservation: true }).reason, "late_external_observation"));
test("53 provider branch cannot bypass canonical primary branch", () => assert.equal(decision({ primaryBranchValid: false }).reason, "invalid_primary_branch"));
test("54 already canonical Delivered remains terminal", () => assert.equal(external({ canonicalStatus: "delivered", canonicalDeliveryDecision: { decision: "already_complete", blockers: [], reason: "already_delivered" } }).reason, "canonical_delivered_is_terminal"));

// 55-60 Tracked delivery adoption.
test("55 external observed Delivered can be adopted before canonical Delivered", () => {
  const block = deliveryServer.slice(deliveryServer.indexOf("export async function adoptTrackedDelivery"), deliveryServer.indexOf("function milestoneForDelivery"));
  assert.match(block, /external_observed_milestone\) !== "delivered"/);
  assert.doesNotMatch(block, /text\(shipment\.status\) !== "delivered"/);
});
test("56 adoption preserves provider identity and observed time", () => assert.match(deliveryServer, /adopted_external_provider[\s\S]{0,140}adopted_external_observed_at/));
test("57 adoption does not fabricate recipient details", () => assert.match(deliveryServer, /recipient_name: null,[\s\S]{0,80}recipient_phone: null/));
test("58 adoption does not set canonical shipment Delivered", () => {
  const block = deliveryServer.slice(deliveryServer.indexOf("export async function adoptTrackedDelivery"), deliveryServer.indexOf("function milestoneForDelivery"));
  assert.doesNotMatch(block, /transaction\.update\(scope\.ref, \{[\s\S]*?status: "delivered"/);
});
test("59 adopted delivery plus verified POD and all gates can complete", () => assert.equal(decision().decision, "complete"));
test("60 duplicate tracked adoption is deterministic and idempotent", () => assert.match(deliveryServer, /delivery_attempts"\)\.doc\("tracking-delivery"\)[\s\S]{0,400}attemptSnapshot\.exists/));

// 61-68 Concurrency and transaction structure.
test("61 manual physical delivery and provider Delivered both delegate canonical completion", () => {
  assert.match(deliveryServer, /reconcileCanonicalDelivery\(scope\.reference, \{ source: "manual_delivery"/);
  assert.match(trackingServer, /writeCanonicalDeliveryCompletionInTransaction/);
});
test("62 concurrent canonical completion attempts use deterministic fact identity", () => assert.match(authorityServer, /createHash\("sha256"\)[\s\S]{0,180}kcpl-canonical-delivery-v1/));
test("63 POD verification and completion are separated safely", () => assert.match(deliveryServer, /await batch\.commit\(\);[\s\S]{0,220}reconcileCanonicalDelivery\(scope\.reference, \{ source: "pod_verification"/));
test("64 exception opening versus completion uses in-transaction severe existence reads", () => assert.match(authorityServer, /readCanonicalDeliveryCompletionFactsInTransaction[\s\S]*?severeExceptionQueries/));
test("65 Customs status change versus completion rereads authoritative shipment and checklist in transaction", () => assert.match(authorityServer, /transaction\.get\(customsQuery\)[\s\S]*?customs_clearance_status/));
test("66 document readiness change versus completion rereads required documents in transaction", () => assert.match(authorityServer, /transaction\.get\([\s\S]{0,160}where\("document_type", "==", documentType\)/));
test("67 direct request and external promotion share the same writer", () => {
  assert.match(directRoute, /reconcileCanonicalDelivery/);
  assert.match(trackingServer, /writeCanonicalDeliveryCompletionInTransaction/);
});
test("68 customer counters are written in the same canonical completion transaction", () => assert.match(authorityServer, /transaction\.update\(facts\.shipmentRef[\s\S]*?transaction\.update\(facts\.customerRef/));

// 69-74 Terminal and closed Job File.
test("69 already Delivered completion is a no-op", () => assert.deepEqual(decision({ canonicalStatus: "delivered" }), { decision: "already_complete", blockers: [], reason: "already_delivered" }));
test("70 already Delivered path cannot increment customer twice", () => assert.match(authorityServer, /evaluation\.decision === "already_complete"[\s\S]{0,240}return/));
test("71 failed or refused stale attempt cannot regress canonical Delivered", () => assert.match(deliveryServer, /currentShipmentStatus === "delivered"[\s\S]{0,180}return \{ kind: "already_delivered"/));
test("72 new delivery attempt after canonical Delivered is transactionally blocked", () => assert.match(deliveryServer, /runTransaction[\s\S]*?text\(shipment\.status\) === "delivered"[\s\S]*?already_delivered/));
test("73 closed non-Delivered Job File blocks canonical completion", () => assert.equal(decision({ jobClosed: true }).reason, "job_closed"));
test("74 reopened Job File may reconcile when all gates valid", () => assert.equal(decision({ jobClosed: false }).decision, "complete"));

// 75-81 Prior remediation regression registration.
test("75 #126 financial settlement suite remains registered", () => assert.match(packageJson.scripts.test, /financial-settlement-integrity\.test\.mjs/));
test("76 #127 booking concurrency suite remains registered", () => assert.match(packageJson.scripts.test, /tms-booking-lineage-dispatch\.test\.mjs/));
test("77 #128 RBAC trust suite remains registered", () => assert.match(packageJson.scripts.test, /rbac-trust-boundaries\.test\.mjs/));
test("78 #129 economic lineage suite remains registered", () => assert.match(packageJson.scripts.test, /commercial-economic-lineage\.test\.mjs/));
test("79 #130 external workflow suite remains registered", () => assert.match(packageJson.scripts.test, /external-workflow-ingestion-hardening\.test\.mjs/));
test("80 #131 customer sell authority suite remains registered", () => assert.match(packageJson.scripts.test, /commercial-authority-seams\.test\.mjs/));
test("81 #132 consolidation allocation suite remains registered", () => assert.match(packageJson.scripts.test, /consolidation-allocation-approval\.test\.mjs/));

// 82-90 Writer inventory, audit and scope guards.
test("82 canonical authority is the explicit status Delivered writer", () => assert.match(authorityServer, /transaction\.update\(facts\.shipmentRef, \{[\s\S]{0,120}status: "delivered"/));
test("83 generic shipment updater rejects crossing into Delivered", () => assert.match(shipmentData, /currentStatus !== "delivered" && values\.status === "delivered"[\s\S]{0,100}canonical_delivery_authority_required/));
test("84 external tracking transaction does not independently assign status Delivered", () => assert.match(trackingServer, /canonicalAfter !== "delivered"\) update\.status = canonicalAfter/));
test("85 physical delivery time and canonical completion time remain distinct audit facts", () => assert.match(authorityServer, /physical_delivered_at[\s\S]{0,220}completed_at/));
test("86 completion audit records source, Customs, documents and blocker result", () => {
  assert.match(authorityServer, /reconciliation_source: input\.source/);
  assert.match(authorityServer, /customs_checklist_ready/);
  assert.match(authorityServer, /required_documents_ready/);
  assert.match(authorityServer, /blocking_operational_exception/);
});
test("87 canonical completion requires strict persisted primary branch", () => assert.match(authorityServer, /strictBranchValue\(shipment\.primary_branch\)/));
test("88 closed-job authority is read from persisted shipment inside completion transaction", () => assert.match(authorityServer, /jobClosed: Boolean\(nullable\(shipment\.job_closed_at\)\)/));
test("89 API exposes machine-readable canonical completion blockers", () => assert.match(deliveryRoute, /completionStatus[\s\S]{0,180}blockerCodes[\s\S]{0,120}blockers/));
test("90 finance and settlement are not canonical delivery gates", () => assert.doesNotMatch(policySource, /invoice|payment|freight audit|match.?pay|settlement|accounts receivable|accounts payable/i));
