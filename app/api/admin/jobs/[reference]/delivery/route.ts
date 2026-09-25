import { getAdminAccess } from "../../../../../admin/admin-auth";
import { reconcileCanonicalDelivery } from "../../../../../admin/delivery/canonical-delivery-authority.server";
import { adoptTrackedDelivery, reviewPod } from "../../../../../admin/delivery/delivery-control.server";
import {
  completionPayload,
  deliveryControlView,
  deliveryError,
  scheduleDeliveryFromRequest,
  updateDeliveryFromRequest,
  type DeliveryRequestResult,
} from "../../../../../admin/delivery/delivery-requests.server";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Digital Job File access is required." }, 403) };
  return { user: access.user, staff };
}

function errorFor(kind: string) {
  const result = deliveryError(kind);
  return json(result.body, result.status);
}

function respond(result: DeliveryRequestResult) {
  return json(result.body, result.status);
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  return respond(await deliveryControlView(reference, auth.staff));
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

  if (action === "schedule") return respond(await scheduleDeliveryFromRequest(reference, body, actor, auth.staff));

  if (action === "adopt_delivered") {
    const result = await adoptTrackedDelivery(reference, actor, auth.staff);
    if (result.kind !== "created" && result.kind !== "ready") return errorFor(result.kind);
    return json({ ok: true, attempt: result.attempt, attemptStatus: "delivered", ...completionPayload(result.completion) });
  }

  if (action === "update_attempt") return respond(await updateDeliveryFromRequest(reference, body, actor, auth.staff));

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
