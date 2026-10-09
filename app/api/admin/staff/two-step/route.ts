import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext, staffProfileByUid } from "../../../../admin/staff-directory.server";
import { resetTwoStep } from "../../../../admin/two-step.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Turn two-step sign-in off for someone who lost their phone; they set it up
 * again at their next sign-in. Management only, and never for themselves: a
 * stolen session must not be able to swap the authenticator for its own.
 */
export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageStaff) return json({ ok: false, error: "Only Management can reset two-step sign-in." }, 403);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);
  let uid = "";
  try { const body = await request.json() as Record<string, unknown>; uid = typeof body.uid === "string" ? body.uid.trim() : ""; }
  catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  if (!uid) return json({ ok: false, error: "Choose the person." }, 400);
  if (uid === access.user.uid) return json({ ok: false, error: "Ask another manager to reset your own two-step sign-in." }, 403);
  const profile = await staffProfileByUid(uid);
  if (!profile) return json({ ok: false, error: "No staff profile with that sign-in." }, 404);
  try {
    await resetTwoStep(uid, { name: access.user.displayName, email: access.user.email });
    return json({ ok: true });
  } catch (error) {
    console.error("KCPL two-step reset failed", error);
    return json({ ok: false, error: "The reset didn’t go through. Try again." }, 503);
  }
}
