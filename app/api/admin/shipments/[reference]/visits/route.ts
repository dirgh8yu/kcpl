import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { checkShipmentBranchAccess } from "../../../../../admin/shipment-access.server";
import { readShipmentLastVisit, recordShipmentVisit } from "../../../../../admin/shipment-activity.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Server-side per-staff "since your last visit" anchors for shipment activity.
 * GET returns the previously stored anchor; POST records this visit. Anchors
 * follow the staff member across devices, unlike the original localStorage
 * implementation. Firestore outages degrade to "no divider", never to a
 * blocked timeline. */
export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  const { reference } = await context.params;
  const shipmentAccess = await checkShipmentBranchAccess(reference, staff);
  if (shipmentAccess.kind !== "allowed") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);

  const result = await readShipmentLastVisit(staff.profile.uid, reference);
  if (result.kind === "unavailable") return json({ ok: false, error: "Visit storage is temporarily unavailable." }, 503);
  return json({ ok: true, seen_through_at: result.seenThroughAt });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  const { reference } = await context.params;
  const shipmentAccess = await checkShipmentBranchAccess(reference, staff);
  if (shipmentAccess.kind !== "allowed") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The visit record could not be read." }, 400); }
  const seenThroughAt = typeof body.seen_through_at === "string" ? body.seen_through_at.trim() : "";
  const parsed = seenThroughAt ? Date.parse(seenThroughAt) : Number.NaN;
  if (!seenThroughAt || Number.isNaN(parsed)) return json({ ok: false, error: "A valid seen_through_at timestamp is required." }, 400);

  const result = await recordShipmentVisit(staff.profile.uid, reference, new Date(parsed).toISOString());
  if (result.kind === "unavailable") return json({ ok: false, error: "Visit storage is temporarily unavailable." }, 503);
  return json({ ok: true });
}
