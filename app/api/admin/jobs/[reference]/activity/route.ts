import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getShipmentActivityTimeline } from "../../../../../admin/shipment-activity.server";
import { checkShipmentBranchAccess } from "../../../../../admin/shipment-access.server";
import { getStaffContext } from "../../../../../admin/staff-directory.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  const { reference } = await context.params;
  const shipmentAccess = await checkShipmentBranchAccess(reference, staff);
  if (shipmentAccess.kind === "unavailable") return json({ ok: false, error: "Shipment activity storage is unavailable." }, 503);
  if (shipmentAccess.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (shipmentAccess.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);

  const result = await getShipmentActivityTimeline(reference, staff);
  if (result.kind === "unavailable") return json({ ok: false, error: "Shipment activity storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
  return json({ ok: true, timeline: result.timeline });
}
