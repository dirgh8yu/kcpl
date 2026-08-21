import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext, listStaffProfiles } from "../../../../admin/staff-directory.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);

  const context = await getStaffContext(access.user);
  const profiles = await listStaffProfiles();
  if (profiles === null) return json({ ok: false, error: "Staff directory storage is unavailable." }, 503);

  const options = profiles
    .filter((profile) => profile.active)
    .filter((profile) => {
      if (context.can_access_all_branches) return true;
      if (profile.branch_scope === "all") return true;
      return profile.branches.some((branch) => context.branches.includes(branch));
    })
    .map((profile) => ({
      uid: profile.uid,
      display_name: profile.display_name,
      email: profile.email,
      phone: profile.phone,
      job_title: profile.job_title,
      role: profile.role,
      branch_scope: profile.branch_scope,
      branches: profile.branches,
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return json({ ok: true, options });
}
