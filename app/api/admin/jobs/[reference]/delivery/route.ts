import { getAdminAccess } from "../../../../../admin/admin-auth";
import { reconcileCanonicalDelivery, type CanonicalDeliveryReconciliationResult } from "../../../../../admin/delivery/canonical-delivery-authority.server";
import { adoptTrackedDelivery, createDeliveryAttempt, getDeliveryControl, reviewPod, updateDeliveryAttempt } from "../../../../../admin/delivery/delivery-control.server";
import { deliveryAttemptStatuses, type DeliveryAttemptStatus } from "../../../../../admin/delivery/delivery-control";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function optionalNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Digital Job File access is required." }, 403) };
  return { user: access.user, staff };
}

function errorFor(kind: string) {
  if (kind === "unavailable" || kind === "storage_unavailable") return json({ ok: false, error: "Delivery or POD storage is unavailable." }, 503);
  if (kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (kind === "missing_attempt") return json({ ok: false, error: "Delivery attempt not found." }, 404);
  if (kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
  if (kind === "invalid_branch") return json({ ok: false, error: "A valid canonical shipment primary branch is required." }, 409);
  if (kind === "schedule_required") return json({ ok: false, error: "Choose a valid delivery date and time." }, 400);
  if (kind === "invalid_status" || kind === "invalid_transition") return json({ ok: false, error: "That delivery lifecycle transition is not allowed." }, 409);
  if (kind === "outcome_detail_required") return json({ ok: false, error: "Delivered attempts require a recipient name; failed/refused attempts require a reason of at least 6 characters." }, 400);
  if (kind === "invalid_coordinates") return json({ ok: false, error: "Delivery coordinates are invalid." }, 400);
  if (kind === "already_delivered") return json({ ok: false, error: "This shipment is already canonically Delivered and cannot start or adopt another normal attempt." }, 409);
  if (kind === "tracking_delivery_required") return json({ ok: false, error: "No current external Delivered observation is available to adopt into Delivery Control." }, 409);
  if (kind === "delivery_required") return json({ ok: false, error: "POD can only be reviewed after a delivered Delivery Control attempt." }, 409);
  if (kind === "evidence_required") return json({ ok: false, error: "Upload at least one POD evidence item before verification." }, 409);
  if (kind === "review_note_required") return json({ ok: false, error: "Record a rejection reason of at least 8 characters." }, 400);
  if (kind === "already_verified") return json({ ok: false, error: "Verified POD is immutable. Use Document Vault supersession controls if a replacement is required." }, 409);
  return json({ ok: false, error: "The delivery action could not be completed." }, 400);
}

function completionPayload(completion: CanonicalDeliveryReconciliationResult | null | undefined) {
  if (!completion) return { canonicalStatus: null, completionStatus: "not_requested", blockerCodes: [] as string[], blockers: [] as string[], completionId: null };
  if (completion.kind === "completed") return { canonicalStatus: completion.canonicalStatus, completionStatus: completion.completionStatus, blockerCodes: [] as string[], blockers: [] as string[], completionId: completion.completionId };
  if (completion.kind === "already_complete") return { canonicalStatus: completion.canonicalStatus, completionStatus: completion.completionStatus, blockerCodes: [] as string[], blockers: [] as string[], completionId: null };
  if (completion.kind === "pending" || completion.kind === "invalid_state" || completion.kind === "invalid_branch") {
    return { canonicalStatus: completion.canonicalStatus, completionStatus: completion.completionStatus, blockerCodes: completion.blocker_codes, blockers: completion.blockers, completionId: null };
  }
  if (completion.kind === "unavailable") return { canonicalStatus: null, completionStatus: "reconciliation_unavailable", blockerCodes: ["reconciliation_unavailable"], blockers: ["Physical delivery evidence is safe, but canonical reconciliation is temporarily unavailable."], completionId: null };
  if (completion.kind === "missing") return { canonicalStatus: null, completionStatus: "missing", blockerCodes: ["shipment_missing"], blockers: ["Shipment no longer exists."], completionId: null };
  return { canonicalStatus: null, completionStatus: "forbidden", blockerCodes: ["branch_forbidden"], blockers: ["Canonical reconciliation is outside this staff member's branch authority."], completionId: null };
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  const result = await getDeliveryControl(reference, auth.staff);
  if (result.kind !== "ready") return errorFor(result.kind);
  return json({ ok: true, ...result });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin delivery updates are not accepted." }, 403);
  const { reference } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The delivery request could not be read." }, 400); }
  const action = clean(body.action, 40);
  const actor = { name: auth.user.displayName, email: auth.user.email };

  if (action === "schedule") {
    const result = await createDeliveryAttempt(reference, {
      scheduledFor: clean(body.scheduledFor, 80),
      location: clean(body.location, 300),
      driverName: clean(body.driverName, 160),
      driverPhone: clean(body.driverPhone, 80),
      vehicleReference: clean(body.vehicleReference, 120),
      notes: clean(body.notes, 3000),
    }, actor, auth.staff);
    if (result.kind !== "created") return errorFor(result.kind);
    return json({ ok: true, attempt: result.attempt }, 201);
  }

  if (action === "adopt_delivered") {
    const result = await adoptTrackedDelivery(reference, actor, auth.staff);
    if (result.kind !== "created" && result.kind !== "ready") return errorFor(result.kind);
    return json({ ok: true, attempt: result.attempt, attemptStatus: "delivered", ...completionPayload(result.completion) });
  }

  if (action === "update_attempt") {
    const attemptId = clean(body.attemptId, 180);
    const status = clean(body.status, 40) as DeliveryAttemptStatus;
    if (!attemptId) return json({ ok: false, error: "Delivery attempt is required." }, 400);
    if (!deliveryAttemptStatuses.includes(status) || status === "scheduled") return json({ ok: false, error: "Choose a valid delivery outcome." }, 400);
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
    }, actor, auth.staff);
    if (result.kind !== "updated") return errorFor(result.kind);
    if (!("attempt" in result)) return json({ ok: false, error: "Delivery attempt state could not be refreshed after the transaction committed." }, 500);
    return json({ ok: true, attempt: result.attempt, attemptStatus: result.attempt.status, ...completionPayload(result.completion) });
  }

  if (action === "review_pod") {
    if (!auth.staff.permissions.canManageCustomerDocuments) return json({ ok: false, error: "Document verification permission is required." }, 403);
    const attemptId = clean(body.attemptId, 180);
    const decision = clean(body.decision, 20);
    if (!attemptId || (decision !== "verify" && decision !== "reject")) return json({ ok: false, error: "Choose the delivered attempt and POD review decision." }, 400);
    const result = await reviewPod(reference, attemptId, decision, clean(body.note, 2000), body.customerSafe === true, actor, auth.staff);
    if (result.kind === "already_verified" && decision === "verify") return json({ ok: true, podStatus: "verified", ...completionPayload(result.completion) });
    if (result.kind !== "verified" && result.kind !== "rejected") return errorFor(result.kind);
    return json({ ok: true, ...result, podStatus: result.kind === "verified" ? "verified" : "rejected", ...completionPayload("completion" in result ? result.completion : null) });
  }

  if (action === "reconcile_delivery") {
    const completion = await reconcileCanonicalDelivery(reference, { source: "manual_reconciliation", actor, context: auth.staff });
    if (completion.kind === "unavailable") return json({ ok: false, error: "Canonical delivery reconciliation is unavailable." }, 503);
    if (completion.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
    if (completion.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
    return json({ ok: true, ...completionPayload(completion) });
  }

  return json({ ok: false, error: "Unknown delivery action." }, 400);
}
