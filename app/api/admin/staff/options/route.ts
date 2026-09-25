import { getAdminAccess } from "../../../../admin/admin-auth";
import { staffAssignmentOptions } from "../../../../admin/job-file-requests.server";
import { ensureStaffAssignmentUidMigration, getStaffContext, listStaffProfiles } from "../../../../admin/staff-directory.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);

  const context = await getStaffContext(access.user);
  const profiles = await listStaffProfiles();
  if (profiles === null) return json({ ok: false, error: "Staff directory storage is unavailable." }, 503);

  try {
    await ensureStaffAssignmentUidMigration(profiles);
  } catch (error) {
    console.error("KCPL staff assignment UID migration failed", error);
  }

  const options = await staffAssignmentOptions(context, profiles);

  return json({ ok: true, options });
}
