import { getAdminAccess } from "../../../../admin/admin-auth";
import { customsClearanceStatuses, type CustomsClearanceStatus } from "../../../../admin/customs/customs-policy";
import { updateCustomsClearance } from "../../../../admin/customs/customs-clearance.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return json({ ok: false, error: "Customs updates are not available for this account." }, 403);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin customs updates are not accepted." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The customs clearance update could not be read." }, 400); }

  const status = clean(body.status, 40);
  if (!customsClearanceStatuses.includes(status as CustomsClearanceStatus)) return json({ ok: false, error: "Choose a valid customs clearance status." }, 400);
  const { reference } = await context.params;
  const result = await updateCustomsClearance(reference, {
    status: status as CustomsClearanceStatus,
    entryPoint: clean(body.entryPoint, 240),
    declarationReference: clean(body.declarationReference, 240),
    agentPartnerId: clean(body.agentPartnerId, 180),
    holdReason: clean(body.holdReason, 2000),
    releaseEvidence: clean(body.releaseEvidence, 3000),
  }, { name: access.user.displayName, email: access.user.email }, staff);

  if (result.kind === "updated") return json({ ok: true, clearance: result.clearance });
  if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (result.kind === "agent_missing") return json({ ok: false, error: "The selected customs agent Partner record was not found." }, 404);
  if (result.kind === "agent_type") return json({ ok: false, error: "Choose a Partner recorded as a Customs agent or Clearing partner." }, 400);
  if (result.kind === "invalid") return json({ ok: false, error: result.error }, 400);
  if (result.kind === "forbidden") return json({ ok: false, error: "This shipment or customs agent is outside your branch access." }, 403);
  return json({ ok: false, error: "Customs clearance storage is unavailable." }, 503);
}
