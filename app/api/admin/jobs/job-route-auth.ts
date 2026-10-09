import { getAdminAccess } from "../../../admin/admin-auth";
import { checkShipmentBranchAccess } from "../../../admin/shipment-access.server";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * A change to a shipment's Job File: signed-in staff with Job File access,
 * the shipment in their branches, a same-origin request with a JSON body.
 */
export async function jobWriteRequest(request: Request, reference: string) {
  if (!isTrustedSameOriginRequest(request)) return { ok: false as const, response: json({ ok: false, error: "Cross-origin changes are not accepted." }, 403) };
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { ok: false as const, response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { ok: false as const, response: json({ ok: false, error: "Job File editing is not available for this account." }, 403) };
  if (!firebaseRuntimeConfigured()) return { ok: false as const, response: json({ ok: false, error: "Shipment records aren’t responding. Try again in a minute." }, 503) };
  const normalized = reference.trim().toUpperCase();
  const branchAccess = await checkShipmentBranchAccess(normalized, staff);
  if (branchAccess.kind === "unavailable") return { ok: false as const, response: json({ ok: false, error: "Shipment records aren’t responding. Try again in a minute." }, 503) };
  if (branchAccess.kind === "missing") return { ok: false as const, response: json({ ok: false, error: "Shipment not found." }, 404) };
  if (branchAccess.kind === "forbidden") return { ok: false as const, response: json({ ok: false, error: "This shipment is outside your branch access." }, 403) };
  let body: Record<string, unknown> = {};
  if (request.method !== "DELETE") {
    try { body = await request.json() as Record<string, unknown>; }
    catch { return { ok: false as const, response: json({ ok: false, error: "The change could not be read." }, 400) }; }
  }
  return { ok: true as const, reference: normalized, body, staff, actor: { name: access.user.displayName, email: access.user.email } };
}
