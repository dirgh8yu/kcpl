import { getAdminAccess } from "../../../../../admin/admin-auth";
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
  if (kind === "schedule_required") return json({ ok: false, error: "Choose a valid delivery date and time." }, 400);
  if (kind === "invalid_status" || kind === "invalid_transition") return json({ ok: false, error: "That delivery lifecycle transition is not allowed." }, 409);
  if (kind === "outcome_detail_required") return json({ ok: false, error: "Delivered attempts require a recipient name; failed/refused attempts require a reason of at least 6 characters." }, 400);
  if (kind === "invalid_coordinates") return json({ ok: false, error: "Delivery coordinates are invalid." }, 400);
  if (kind === "already_delivered") return json({ ok: false, error: "This shipment is already delivered and cannot start another attempt." }, 409);
  if (kind === "not_delivered") return json({ ok: false, error: "Only a shipment already marked Delivered by Live Visibility can be adopted into the POD workflow." }, 409);
  if (kind === "delivery_required") return json({ ok: false, error: "POD can only be reviewed after a delivered attempt." }, 409);
  if (kind === "evidence_required") return json({ ok: false, error: "Upload at least one POD evidence item before verification." }, 409);
  if (kind === "review_note_required") return json({ ok: false, error: "Record a rejection reason of at least 8 characters." }, 400);
  if (kind === "already_verified") return json({ ok: false, error: "Verified POD is immutable. Use Document Vault supersession controls if a replacement is required." }, 409);
  return json({ ok: false, error: "The delivery action could not be completed." }, 400);
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
    return json({ ok: true, attempt: result.attempt });
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
    return json({ ok: true, attempt: result.attempt });
  }

  if (action === "review_pod") {
    if (!auth.staff.permissions.canManageCustomerDocuments) return json({ ok: false, error: "Document verification permission is required." }, 403);
    const attemptId = clean(body.attemptId, 180);
    const decision = clean(body.decision, 20);
    if (!attemptId || (decision !== "verify" && decision !== "reject")) return json({ ok: false, error: "Choose the delivered attempt and POD review decision." }, 400);
    const result = await reviewPod(reference, attemptId, decision, clean(body.note, 2000), body.customerSafe === true, actor, auth.staff);
    if (result.kind !== "verified" && result.kind !== "rejected") return errorFor(result.kind);
    return json({ ok: true, ...result });
  }

  return json({ ok: false, error: "Unknown delivery action." }, 400);
}
