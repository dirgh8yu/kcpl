import { saveCommissionSettings } from "../../../../admin/management/account-margin.server";
import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Commission rates per account manager. Management only. */
export async function PUT(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return json({ ok: false, error: "Management access is required." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const result = await saveCommissionSettings(body, { name: access.user.displayName, email: access.user.email }, staff);
  if (result.kind === "updated") return json({ ok: true, settings: result.settings });
  if (result.kind === "invalid") return json({ ok: false, error: result.error }, 400);
  if (result.kind === "forbidden") return json({ ok: false, error: "Management access is required." }, 403);
  return json({ ok: false, error: "Settings storage is unavailable." }, 503);
}
