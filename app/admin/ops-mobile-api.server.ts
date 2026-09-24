import { getAdminAccessFromBearer, type AdminUser } from "./admin-auth";
import { getStaffContext, type KcplStaffContext } from "./staff-directory.server";
import { kcplStaffRoleLabels } from "./staff-permissions";

/*
 * The one door every /api/mobile/ops/v1 route goes through. A handler
 * receives a verified staff user and their resolved context (role,
 * permissions, branch scope) or never runs.
 *
 * These routes take a bearer credential, which a browser never attaches on
 * its own, so they are not exposed to cross-site request forgery the way the
 * cookie-authenticated admin routes are and need no same-origin check.
 */

export function opsJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export type OpsSession = { user: AdminUser; staff: KcplStaffContext };

export async function withStaffSession(request: Request, handler: (session: OpsSession) => Promise<Response>): Promise<Response> {
  const access = await getAdminAccessFromBearer(request);
  if (access.kind === "unconfigured") return opsJson({ ok: false, code: "unconfigured", error: "KCPL Operations is not configured." }, 503);
  if (access.kind === "signed-out") return opsJson({ ok: false, code: "signed_out", error: "Sign in is required." }, 401);

  let staff: KcplStaffContext;
  try {
    staff = await getStaffContext(access.user);
  } catch {
    // An unresolvable profile is a refusal, never a default role.
    return opsJson({ ok: false, code: "denied", error: "This account is not authorised for KCPL Operations." }, 403);
  }
  // Every staff role holds this today; checked anyway so a future role
  // without Job File access cannot reach the operational feed by phone.
  if (!staff.permissions.canManageJobFile) {
    return opsJson({ ok: false, code: "denied", error: "This account does not have operations access." }, 403);
  }
  return handler({ user: access.user, staff });
}

/** What the app needs to render its chrome and decide what to offer. */
export function opsSessionView({ user, staff }: OpsSession) {
  return {
    displayName: user.displayName,
    email: user.email,
    role: staff.permissions.role,
    roleLabel: kcplStaffRoleLabels[staff.permissions.role],
    branches: staff.branches,
    canAccessAllBranches: staff.can_access_all_branches,
    canViewCosts: staff.permissions.canManageJobCosts,
  };
}

export const opsUnavailable = () =>
  opsJson({ ok: false, code: "unavailable", error: "KCPL operational data is temporarily unavailable." }, 503);
