import type { CanonicalDeliveryReconciliationResult } from "./canonical-delivery-authority.server";
import { createDeliveryAttempt, getDeliveryControl, updateDeliveryAttempt, uploadPodEvidence } from "./delivery-control.server";
import { deliveryAttemptStatuses, podEvidenceKinds, type DeliveryAttemptStatus, type PodEvidenceKind } from "./delivery-control";
import type { KcplStaffContext } from "../staff-directory.server";

/*
 * Delivery Control from a request: the web Job File and KCPL Ops share these,
 * so scheduling an attempt, recording its outcome and attaching POD evidence
 * are decided one way whichever screen they came from. All authority stays
 * where it was: attempts and evidence are written by delivery-control, and
 * canonical Delivered is only ever reached through its reconciliation after
 * POD is verified. Nothing here verifies POD.
 */

export type DeliveryRequestResult = { status: number; body: Record<string, unknown> };
type Actor = { name: string; email: string };

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const refused = (status: number, error: string): DeliveryRequestResult => ({ status, body: { ok: false, error } });

export function deliveryError(kind: string): DeliveryRequestResult {
  if (kind === "unavailable" || kind === "storage_unavailable") return refused(503, "Delivery or POD storage is unavailable.");
  if (kind === "missing") return refused(404, "Shipment not found.");
  if (kind === "missing_attempt") return refused(404, "Delivery attempt not found.");
  if (kind === "missing_evidence") return refused(404, "POD evidence not found.");
  if (kind === "forbidden") return refused(403, "This shipment is outside your branch access.");
  if (kind === "invalid_branch") return refused(409, "A valid canonical shipment primary branch is required.");
  if (kind === "schedule_required") return refused(400, "Choose a valid delivery date and time.");
  if (kind === "invalid_status" || kind === "invalid_transition") return refused(409, "That delivery lifecycle transition is not allowed.");
  if (kind === "outcome_detail_required") {
    return refused(400, "Delivered attempts require a recipient name; failed/refused attempts require a reason of at least 6 characters.");
  }
  if (kind === "invalid_coordinates") return refused(400, "Delivery coordinates are invalid.");
  if (kind === "already_delivered") return refused(409, "This shipment is already canonically Delivered and cannot start or adopt another normal attempt.");
  if (kind === "tracking_delivery_required") return refused(409, "No current external Delivered observation is available to adopt into Delivery Control.");
  if (kind === "delivery_required") return refused(409, "POD can only be added after a delivered Delivery Control attempt.");
  if (kind === "evidence_required") return refused(409, "Upload at least one POD evidence item before verification.");
  if (kind === "review_note_required") return refused(400, "Record a rejection reason of at least 8 characters.");
  if (kind === "invalid_kind") return refused(400, "Choose photo, signature or document evidence.");
  if (kind === "invalid_file") return refused(400, "POD files must be JPEG, PNG, WebP or PDF and no larger than 12 MB.");
  if (kind === "already_verified") return refused(409, "Verified POD is immutable. Use Document Vault supersession controls if a replacement is required.");
  return refused(400, "The delivery action could not be completed.");
}

export function completionPayload(completion: CanonicalDeliveryReconciliationResult | null | undefined) {
  if (!completion) return { canonicalStatus: null, completionStatus: "not_requested", blockerCodes: [] as string[], blockers: [] as string[], completionId: null };
  if (completion.kind === "completed") {
    return { canonicalStatus: completion.canonicalStatus, completionStatus: completion.completionStatus, blockerCodes: [] as string[], blockers: [] as string[], completionId: completion.completionId };
  }
  if (completion.kind === "already_complete") {
    return { canonicalStatus: completion.canonicalStatus, completionStatus: completion.completionStatus, blockerCodes: [] as string[], blockers: [] as string[], completionId: null };
  }
  if (completion.kind === "pending" || completion.kind === "invalid_state" || completion.kind === "invalid_branch") {
    return { canonicalStatus: completion.canonicalStatus, completionStatus: completion.completionStatus, blockerCodes: completion.blocker_codes, blockers: completion.blockers, completionId: null };
  }
  if (completion.kind === "unavailable") {
    return {
      canonicalStatus: null,
      completionStatus: "reconciliation_unavailable",
      blockerCodes: ["reconciliation_unavailable"],
      blockers: ["Physical delivery evidence is safe, but canonical reconciliation is temporarily unavailable."],
      completionId: null,
    };
  }
  if (completion.kind === "missing") return { canonicalStatus: null, completionStatus: "missing", blockerCodes: ["shipment_missing"], blockers: ["Shipment no longer exists."], completionId: null };
  return {
    canonicalStatus: null,
    completionStatus: "forbidden",
    blockerCodes: ["branch_forbidden"],
    blockers: ["Canonical reconciliation is outside this staff member's branch authority."],
    completionId: null,
  };
}

export async function deliveryControlView(reference: string, staff: KcplStaffContext): Promise<DeliveryRequestResult> {
  const result = await getDeliveryControl(reference, staff);
  if (result.kind !== "ready") return deliveryError(result.kind);
  return { status: 200, body: { ok: true, ...result } };
}

export async function scheduleDeliveryFromRequest(reference: string, body: Record<string, unknown>, actor: Actor, staff: KcplStaffContext): Promise<DeliveryRequestResult> {
  const result = await createDeliveryAttempt(reference, {
    scheduledFor: clean(body.scheduledFor, 80),
    location: clean(body.location, 300),
    driverName: clean(body.driverName, 160),
    driverPhone: clean(body.driverPhone, 80),
    vehicleReference: clean(body.vehicleReference, 120),
    notes: clean(body.notes, 3000),
  }, actor, staff);
  if (result.kind !== "created") return deliveryError(result.kind);
  return { status: 201, body: { ok: true, attempt: result.attempt } };
}

export async function updateDeliveryFromRequest(reference: string, body: Record<string, unknown>, actor: Actor, staff: KcplStaffContext): Promise<DeliveryRequestResult> {
  const attemptId = clean(body.attemptId, 180);
  const status = clean(body.status, 40) as DeliveryAttemptStatus;
  if (!attemptId) return refused(400, "Delivery attempt is required.");
  if (!deliveryAttemptStatuses.includes(status) || status === "scheduled") return refused(400, "Choose a valid delivery outcome.");
  const result = await updateDeliveryAttempt(reference, attemptId, {
    status,
    eventTime: clean(body.eventTime, 80),
    location: clean(body.location, 300),
    latitude: optionalNumber(body.latitude),
    longitude: optionalNumber(body.longitude),
    recipientName: clean(body.recipientName, 180),
    recipientPhone: clean(body.recipientPhone, 80),
    recipientRelation: clean(body.recipientRelation, 120),
    failureReason: clean(body.failureReason, 1000),
    notes: clean(body.notes, 3000),
  }, actor, staff);
  if (result.kind !== "updated") return deliveryError(result.kind);
  if (!("attempt" in result)) return refused(500, "Delivery attempt state could not be refreshed after the transaction committed.");
  return { status: 200, body: { ok: true, attempt: result.attempt, attemptStatus: result.attempt.status, ...completionPayload(result.completion) } };
}

export async function podEvidenceFromForm(reference: string, form: FormData, actor: Actor, staff: KcplStaffContext): Promise<DeliveryRequestResult> {
  const file = form.get("file");
  const attemptId = clean(form.get("attemptId"), 180);
  const kind = clean(form.get("kind"), 40) as PodEvidenceKind;
  if (!(file instanceof File) || !attemptId || !podEvidenceKinds.includes(kind)) return refused(400, "Delivery attempt, evidence type and file are required.");
  const result = await uploadPodEvidence(reference, attemptId, kind, file, clean(form.get("capturedAt"), 80), actor, staff);
  if (result.kind !== "created") return deliveryError(result.kind);
  return { status: 201, body: { ok: true, evidence: result.evidence } };
}

