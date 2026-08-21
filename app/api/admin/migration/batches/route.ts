import { getAdminAccess } from "../../../../admin/admin-auth";
import { listMigrationBatches } from "../../../../admin/migration/migration-batches.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return json({ ok: false, error: "Migration batch history is restricted to KCPL Management." }, 403);

  try {
    const dashboard = await listMigrationBatches();
    if (!dashboard) return json({ ok: false, error: "Firebase migration storage is unavailable." }, 503);
    return json({ ok: true, dashboard });
  } catch (error) {
    console.error("Failed to load KCPL migration batch history", error);
    return json({ ok: false, error: "Migration batch history could not be loaded." }, 500);
  }
}
