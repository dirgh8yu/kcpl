import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { kcplStaffRoleLabels } from "../../../admin/staff-permissions";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Identity snapshot for the account panel embedded on the shell's profile
 * button. Read-only: role, branch scope and access are directory-controlled,
 * so this endpoint never accepts writes — staff changes stay in the
 * management-only People & Branches workspace. */
export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  try {
    const staff = await getStaffContext(access.user);
    return json({
      ok: true,
      profile: {
        uid: staff.profile.uid,
        name: staff.profile.display_name,
        email: staff.profile.email,
        job_title: staff.profile.job_title,
        role: staff.profile.role,
        role_label: kcplStaffRoleLabels[staff.profile.role],
        branch_scope: staff.profile.branch_scope,
        branches: staff.branches,
        can_access_all_branches: staff.can_access_all_branches,
      },
    });
  } catch (error) {
    console.error("Failed to resolve KCPL staff profile", error);
    return json({ ok: false, error: "Your staff profile is temporarily unavailable." }, 503);
  }
}
