import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext, listStaffProfiles, saveStaffProfile } from "../../../admin/staff-directory.server";
import { kcplStaffRoles, type KcplStaffRole } from "../../../admin/staff-permissions";
import { kcplBranches, type KcplBranch } from "../../../admin/crm/crm-data";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorizeManagement() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageStaff) return { response: json({ ok: false, error: "Management access is required." }, 403) };
  return { user: access.user };
}

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const auth = await authorizeManagement();
  if ("response" in auth) return auth.response;
  const profiles = await listStaffProfiles();
  if (profiles === null) return json({ ok: false, error: "Staff directory storage is unavailable." }, 503);
  return json({ ok: true, profiles });
}

export async function POST(request: Request) {
  const auth = await authorizeManagement();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin staff updates are not accepted." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The staff profile could not be read." }, 400); }

  const email = clean(body.email).toLowerCase();
  const role = clean(body.role, 30);
  const branchScope = body.branchScope === "selected" ? "selected" : "all";
  const branches = Array.isArray(body.branches)
    ? body.branches.filter((item): item is KcplBranch => typeof item === "string" && kcplBranches.includes(item as KcplBranch))
    : [];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Enter a valid staff email." }, 400);
  if (!kcplStaffRoles.includes(role as KcplStaffRole)) return json({ ok: false, error: "Choose a valid staff role." }, 400);
  if (branchScope === "selected" && !branches.length) return json({ ok: false, error: "Choose at least one branch for selected branch access." }, 400);

  const result = await saveStaffProfile({
    email,
    displayName: clean(body.displayName, 160),
    jobTitle: clean(body.jobTitle, 160),
    phone: clean(body.phone, 80),
    role: role as KcplStaffRole,
    branchScope,
    branches,
    active: body.active !== false,
  }, { name: auth.user.displayName, email: auth.user.email });

  if (result.kind === "unavailable") return json({ ok: false, error: "Staff directory storage is unavailable." }, 503);
  if (result.kind === "missing_auth_user") return json({ ok: false, error: "Create this staff member in Firebase Authentication first, then add them here." }, 404);
  return json({ ok: true, profile: result.profile }, result.kind === "created" ? 201 : 200);
}
