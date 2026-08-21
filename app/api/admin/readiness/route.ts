import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { productionRuntimeReadiness } from "../../../production-readiness";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);

  const staff = await getStaffContext(access.user);
  if (staff.profile.role !== "management") {
    return json({ ok: false, error: "Management access is required." }, 403);
  }

  return json({
    ok: true,
    readiness: productionRuntimeReadiness(),
  });
}
