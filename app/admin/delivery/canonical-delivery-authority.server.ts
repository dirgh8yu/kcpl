import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { shipmentDocumentCountsAsReady, shipmentDocumentReviewStatusValue } from "../../shipment-document-policy";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../../shipment-document-types";
import { canAccessBranchSet, strictBranchArray, strictBranchValue, type AccessBranch } from "../branch-access-policy";
import { customsClearanceStatusValue, customsReleaseRequired } from "../customs/customs-policy";
import type { KcplStaffContext } from "../staff-directory.server";
import { buildDocumentIntelligence } from "../workflow-defaults";
import {
  canonicalDeliveryBlockerMessages,
  canonicalDeliveryStatus,
  evaluateCanonicalDeliveryCompletion,
  type CanonicalDeliveryCompletionInput,
  type CanonicalDeliveryCompletionResult,
} from "./canonical-delivery-policy";

export const canonicalDeliverySources = [
  "manual_delivery",
  "pod_verification",
  "external_reconciliation",
  "direct_admin_request",
  "manual_reconciliation",
] as const;
export type CanonicalDeliverySource = (typeof canonicalDeliverySources)[number];

type Actor = { name: string; email: string };

export type CanonicalDeliveryShipmentPatch = {
  eta?: string | null;
  current_location?: string | null;
  carrier?: string | null;
  carrier_reference?: string | null;
  customer_note?: string | null;
};

type CompletionFactSet = {
  reference: string;
  shipmentRef: FirebaseFirestore.DocumentReference;
  shipmentSnapshot: FirebaseFirestore.DocumentSnapshot;
  shipment: Record<string, unknown>;
  primaryBranch: AccessBranch | null;
  handlingBranches: AccessBranch[];
  customerRef: FirebaseFirestore.DocumentReference | null;
  customerSnapshot: FirebaseFirestore.DocumentSnapshot | null;
  attemptId: string | null;
  attemptSnapshot: FirebaseFirestore.DocumentSnapshot | null;
  podDocumentId: string | null;
  podDocumentSnapshot: FirebaseFirestore.DocumentSnapshot | null;
  podManifestSha256: string | null;
  direction: string;
  customsRequiredSteps: number;
  customsCompletedSteps: number;
  customsChecklistReady: boolean;
  customsReleaseRequired: boolean;
  customsClearanceStatus: string;
  requiredDocumentTypes: ShipmentDocumentType[];
  requiredDocumentsReady: boolean;
  hasBlockingException: boolean;
  policyInput: CanonicalDeliveryCompletionInput;
};

export type CanonicalDeliveryReadResult =
  | { kind: "missing" }
  | { kind: "ready"; facts: CompletionFactSet; evaluation: CanonicalDeliveryCompletionResult };

export type CanonicalDeliveryReconciliationResult =
  | { kind: "unavailable" }
  | { kind: "missing" }
  | { kind: "forbidden" }
  | { kind: "invalid_branch"; canonicalStatus: string | null; completionStatus: "invalid_state"; blocker_codes: string[]; blockers: string[] }
  | { kind: "invalid_state"; canonicalStatus: string | null; completionStatus: "invalid_state"; blocker_codes: string[]; blockers: string[] }
  | { kind: "pending"; canonicalStatus: string | null; completionStatus: "blocked"; blocker_codes: string[]; blockers: string[] }
  | { kind: "already_complete"; canonicalStatus: "delivered"; completionStatus: "already_complete"; blocker_codes: []; blockers: [] }
  | { kind: "completed"; canonicalStatus: "delivered"; completionStatus: "complete"; completionId: string; blocker_codes: []; blockers: [] };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function completionId(reference: string, attemptId: string, podDocumentId: string, podSha256: string) {
  return createHash("sha256").update(["kcpl-canonical-delivery-v1", reference, attemptId, podDocumentId, podSha256].join("\n")).digest("hex");
}
function blockerMessages(evaluation: CanonicalDeliveryCompletionResult) {
  return evaluation.blockers.map((code) => canonicalDeliveryBlockerMessages[code]);
}
function activeReadyDocument(snapshot: FirebaseFirestore.QueryDocumentSnapshot, today: string) {
  const reviewStatus = shipmentDocumentReviewStatusValue(snapshot.get("review_status"));
  if (["deleted", "superseded"].includes(reviewStatus)) return false;
  if (nullable(snapshot.get("deleted_at")) || nullable(snapshot.get("superseded_by_document_id"))) return false;
  return shipmentDocumentCountsAsReady({ status: reviewStatus, expiresOn: nullable(snapshot.get("expires_on")), today });
}
function severeExceptionQueries(shipmentRef: FirebaseFirestore.DocumentReference) {
  const exceptions = shipmentRef.collection("exceptions");
  return [
    exceptions.where("status", "==", "open").where("severity", "==", "high").limit(1),
    exceptions.where("status", "==", "monitoring").where("severity", "==", "high").limit(1),
    exceptions.where("status", "==", "open").where("severity", "==", "critical").limit(1),
    exceptions.where("status", "==", "monitoring").where("severity", "==", "critical").limit(1),
  ];
}

export async function readCanonicalDeliveryCompletionFactsInTransaction(
  transaction: FirebaseFirestore.Transaction,
  shipmentRef: FirebaseFirestore.DocumentReference,
  existingShipmentSnapshot?: FirebaseFirestore.DocumentSnapshot,
): Promise<CanonicalDeliveryReadResult> {
  const shipmentSnapshot = existingShipmentSnapshot ?? await transaction.get(shipmentRef);
  if (!shipmentSnapshot.exists) return { kind: "missing" };
  const shipment = shipmentSnapshot.data() as Record<string, unknown>;
  const reference = shipmentRef.id;
  const primaryBranch = strictBranchValue(shipment.primary_branch);
  const handlingBranches = strictBranchArray(shipment.handling_branches);
  const customerId = nullable(shipment.customer_id);
  const quoteReference = nullable(shipment.quote_reference);
  const podDocumentId = nullable(shipment.delivery_pod_document_id);
  const customerRef = customerId ? firebaseAdminDb().collection("customers").doc(customerId) : null;
  const podDocumentRef = podDocumentId ? shipmentRef.collection("documents").doc(podDocumentId) : null;
  const requirementsQuery = shipmentRef.collection("document_requirements").limit(100);
  const customsQuery = shipmentRef.collection("customs_steps").limit(500);

  const [quoteSnapshot, customerSnapshot, podDocumentSnapshot, requirementsSnapshot, customsSnapshot, ...exceptionSnapshots] = await Promise.all([
    quoteReference ? transaction.get(firebaseAdminDb().collection("quotes").doc(quoteReference)) : Promise.resolve(null),
    customerRef ? transaction.get(customerRef) : Promise.resolve(null),
    podDocumentRef ? transaction.get(podDocumentRef) : Promise.resolve(null),
    transaction.get(requirementsQuery),
    transaction.get(customsQuery),
    ...severeExceptionQueries(shipmentRef).map((query) => transaction.get(query)),
  ]);

  const quote = quoteSnapshot?.exists ? quoteSnapshot.data() as Record<string, unknown> : {};
  const intelligence = buildDocumentIntelligence({
    mode: text(quote.mode, text(shipment.mode)),
    origin: nullable(quote.origin) ?? nullable(shipment.origin),
    destination: nullable(quote.destination) ?? nullable(shipment.destination),
    cargoType: nullable(quote.cargo_type) ?? nullable(shipment.cargo_type),
    requirements: nullable(quote.requirements) ?? nullable(shipment.requirements),
    primaryBranch,
  });

  const requirementOverrides = new Map<ShipmentDocumentType, { required: boolean; advisory: boolean; reason: string }>();
  for (const doc of requirementsSnapshot.docs) {
    const documentType = (doc.get("document_type") || doc.id) as ShipmentDocumentType;
    if (!shipmentDocumentTypeLabels[documentType]) continue;
    const source = text(doc.get("source"));
    if (source === "workflow_default" || source === "smart_rule") continue;
    requirementOverrides.set(documentType, {
      required: doc.get("required") === true,
      advisory: doc.get("advisory") === true,
      reason: text(doc.get("reason"), "Shipment-specific document requirement"),
    });
  }
  const requirements = new Map<ShipmentDocumentType, { required: boolean }>();
  for (const item of intelligence.requirements) requirements.set(item.documentType, { required: item.required });
  for (const [documentType, override] of requirementOverrides) requirements.set(documentType, { required: override.required });
  const requiredDocumentTypes = [...requirements.entries()]
    .filter(([documentType, requirement]) => requirement.required && documentType !== "proof_of_delivery")
    .map(([documentType]) => documentType)
    .sort();

  const documentSnapshots = await Promise.all(requiredDocumentTypes.map((documentType) => transaction.get(
    shipmentRef.collection("documents").where("document_type", "==", documentType).limit(100),
  )));
  const today = operationalDate();
  const requirementReadComplete = requirementsSnapshot.size < 100;
  const requiredDocumentsReady = requirementReadComplete && documentSnapshots.every((snapshot) => snapshot.docs.some((doc) => activeReadyDocument(doc, today)));

  const requiredCustoms = customsSnapshot.docs.filter((doc) => doc.get("required") !== false);
  const completedCustoms = requiredCustoms.filter((doc) => doc.get("completed") === true);
  const customsReleaseIsRequired = customsReleaseRequired(intelligence.direction);
  const customsReadComplete = customsSnapshot.size < 500;
  const customsChecklistReady = customsReadComplete
    && (customsReleaseIsRequired ? requiredCustoms.length > 0 : true)
    && completedCustoms.length === requiredCustoms.length;
  const customsClearanceStatus = customsClearanceStatusValue(shipment.customs_clearance_status);
  const hasBlockingException = exceptionSnapshots.some((snapshot) => snapshot && !snapshot.empty);

  const podDocument = podDocumentSnapshot?.exists ? podDocumentSnapshot.data() as Record<string, unknown> : null;
  const podManifestVerified = Boolean(
    podDocumentSnapshot?.exists
    && text(podDocument?.document_type) === "proof_of_delivery"
    && podDocument?.pod_manifest === true
    && activeReadyDocument(podDocumentSnapshot as FirebaseFirestore.QueryDocumentSnapshot, today)
    && nullable(podDocument?.storage_path)
    && nullable(podDocument?.sha256)
  );
  const podAttemptId = nullable(podDocument?.delivery_attempt_id);
  const lastAttemptId = nullable(shipment.delivery_last_attempt_id);
  const attemptId = lastAttemptId ?? (text(shipment.delivery_last_attempt_status) === "delivered" ? podAttemptId : null);
  const attemptRef = attemptId ? shipmentRef.collection("delivery_attempts").doc(attemptId) : null;
  const attemptSnapshot = attemptRef ? await transaction.get(attemptRef) : null;
  const attemptStatus = attemptSnapshot?.exists ? text(attemptSnapshot.get("status")) : null;
  const deliveryAttemptExists = Boolean(attemptSnapshot?.exists && text(shipment.delivery_last_attempt_status) === "delivered");
  const deliveryAttemptMatchesPod = Boolean(attemptId && podAttemptId && attemptId === podAttemptId);
  const podManifestSha256 = nullable(podDocument?.sha256);
  const canonicalStatus = canonicalDeliveryStatus(shipment.status);

  const policyInput: CanonicalDeliveryCompletionInput = {
    canonicalStatus,
    primaryBranchValid: Boolean(primaryBranch),
    customerLinked: Boolean(customerRef && customerSnapshot?.exists),
    jobClosed: Boolean(nullable(shipment.job_closed_at)),
    deliveryAttemptExists,
    deliveryAttemptStatus: attemptStatus,
    deliveryAttemptMatchesPod,
    podStatus: nullable(shipment.delivery_pod_status),
    podManifestVerified,
    requiredDocumentsReady,
    customsReleaseRequired: customsReleaseIsRequired,
    customsChecklistReady,
    customsClearanceStatus,
    hasBlockingException,
  };
  const facts: CompletionFactSet = {
    reference,
    shipmentRef,
    shipmentSnapshot,
    shipment,
    primaryBranch,
    handlingBranches,
    customerRef,
    customerSnapshot: customerSnapshot?.exists ? customerSnapshot : null,
    attemptId,
    attemptSnapshot: attemptSnapshot?.exists ? attemptSnapshot : null,
    podDocumentId,
    podDocumentSnapshot: podDocumentSnapshot?.exists ? podDocumentSnapshot : null,
    podManifestSha256,
    direction: intelligence.direction,
    customsRequiredSteps: requiredCustoms.length,
    customsCompletedSteps: completedCustoms.length,
    customsChecklistReady,
    customsReleaseRequired: customsReleaseIsRequired,
    customsClearanceStatus,
    requiredDocumentTypes,
    requiredDocumentsReady,
    hasBlockingException,
    policyInput,
  };
  return { kind: "ready", facts, evaluation: evaluateCanonicalDeliveryCompletion(policyInput) };
}

export function writeCanonicalDeliveryCompletionInTransaction(
  transaction: FirebaseFirestore.Transaction,
  facts: CompletionFactSet,
  input: { source: CanonicalDeliverySource; actor: Actor; completedAt: string; shipmentPatch?: CanonicalDeliveryShipmentPatch },
) {
  if (!facts.primaryBranch || !facts.customerRef || !facts.customerSnapshot || !facts.attemptId || !facts.podDocumentId || !facts.podManifestSha256) {
    throw new Error("Canonical delivery write called without complete authoritative facts.");
  }
  const id = completionId(facts.reference, facts.attemptId, facts.podDocumentId, facts.podManifestSha256);
  const currentStatus = canonicalDeliveryStatus(facts.shipment.status);
  if (currentStatus !== "out_for_delivery") throw new Error("Canonical delivery write called from an invalid canonical status.");
  const patch = input.shipmentPatch ?? {};

  transaction.update(facts.shipmentRef, {
    status: "delivered",
    delivery_state: "pod_verified",
    delivery_completion_id: id,
    delivery_completed_at: input.completedAt,
    delivery_completion_source: input.source,
    delivery_completion_attempt_id: facts.attemptId,
    delivery_completion_pod_document_id: facts.podDocumentId,
    ...patch,
    updated_at: input.completedAt,
  });

  const active = numberValue(facts.customerSnapshot.get("active_shipment_count"));
  const completed = numberValue(facts.customerSnapshot.get("completed_shipment_count"));
  transaction.update(facts.customerRef, {
    active_shipment_count: Math.max(0, active - 1),
    completed_shipment_count: completed + 1,
    updated_at: input.completedAt,
  });

  const audit = {
    schema_version: 1,
    completion_identity: id,
    shipment_reference: facts.reference,
    delivery_attempt_id: facts.attemptId,
    pod_document_id: facts.podDocumentId,
    pod_manifest_sha256: facts.podManifestSha256,
    previous_canonical_status: currentStatus,
    new_canonical_status: "delivered",
    primary_branch: facts.primaryBranch,
    customs_direction: facts.direction,
    customs_release_required: facts.customsReleaseRequired,
    customs_checklist_ready: facts.customsChecklistReady,
    customs_required_steps: facts.customsRequiredSteps,
    customs_completed_steps: facts.customsCompletedSteps,
    customs_clearance_status: facts.customsClearanceStatus,
    required_document_types: facts.requiredDocumentTypes,
    required_documents_ready: facts.requiredDocumentsReady,
    blocking_operational_exception: facts.hasBlockingException,
    reconciliation_source: input.source,
    actor_name: input.actor.name || null,
    actor_email: input.actor.email || null,
    physical_delivered_at: facts.attemptSnapshot ? nullable(facts.attemptSnapshot.get("event_time")) : null,
    completed_at: input.completedAt,
  };
  transaction.create(facts.shipmentRef.collection("delivery_completions").doc(id), audit);
  transaction.create(facts.shipmentRef.collection("job_activity").doc(`canonical-delivery-${id}`), {
    type: "canonical_delivery_completed",
    title: "Shipment canonically Delivered",
    detail: `Delivery Control, POD, Customs, document and exception gates satisfied. Source: ${input.source}.`,
    branch: facts.primaryBranch,
    actor_name: input.actor.name || "KCPL Delivery Authority",
    actor_email: input.actor.email || null,
    created_at: input.completedAt,
    delivery_attempt_id: facts.attemptId,
    pod_document_id: facts.podDocumentId,
    completion_identity: id,
  });
  transaction.create(facts.customerRef.collection("activity").doc(`shipment-delivered-${id}`), {
    type: "shipment_delivered",
    title: `${facts.reference}: Delivered`,
    detail: "KCPL canonical delivery completion gates satisfied.",
    actor_name: input.actor.name || "KCPL Delivery Authority",
    actor_email: input.actor.email || null,
    created_at: input.completedAt,
    shipment_reference: facts.reference,
    delivery_completion_id: id,
  });
  return id;
}

export async function reconcileCanonicalDelivery(
  reference: string,
  input: { source: CanonicalDeliverySource; actor: Actor; context?: KcplStaffContext; shipmentPatch?: CanonicalDeliveryShipmentPatch },
): Promise<CanonicalDeliveryReconciliationResult> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  const db = firebaseAdminDb();
  const shipmentRef = db.collection("shipments").doc(reference.trim().toUpperCase());
  const completedAt = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    const read = await readCanonicalDeliveryCompletionFactsInTransaction(transaction, shipmentRef);
    if (read.kind === "missing") return { kind: "missing" as const };
    const { facts, evaluation } = read;
    const canonicalStatus = canonicalDeliveryStatus(facts.shipment.status);
    if (!facts.primaryBranch) {
      return { kind: "invalid_branch" as const, canonicalStatus, completionStatus: "invalid_state" as const, blocker_codes: evaluation.blockers, blockers: blockerMessages(evaluation) };
    }
    if (input.context && !canAccessBranchSet(input.context, facts.primaryBranch, facts.handlingBranches)) return { kind: "forbidden" as const };
    if (evaluation.decision === "already_complete") {
      return { kind: "already_complete" as const, canonicalStatus: "delivered" as const, completionStatus: "already_complete" as const, blocker_codes: [] as [], blockers: [] as [] };
    }
    if (evaluation.decision === "invalid_state") {
      return { kind: "invalid_state" as const, canonicalStatus, completionStatus: "invalid_state" as const, blocker_codes: evaluation.blockers, blockers: blockerMessages(evaluation) };
    }
    if (evaluation.decision === "blocked") {
      return { kind: "pending" as const, canonicalStatus, completionStatus: "blocked" as const, blocker_codes: evaluation.blockers, blockers: blockerMessages(evaluation) };
    }
    const id = writeCanonicalDeliveryCompletionInTransaction(transaction, facts, {
      source: input.source,
      actor: input.actor,
      completedAt,
      shipmentPatch: input.shipmentPatch,
    });
    return { kind: "completed" as const, canonicalStatus: "delivered" as const, completionStatus: "complete" as const, completionId: id, blocker_codes: [] as [], blockers: [] as [] };
  });
}
