import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { clearDisplayPreferences, getDisplayPreferences, saveDisplayPreferences } from "../../../admin/notifications/display-preferences.server";
import { defaultDisplayPreferences, displayDensities, displayMotions } from "../../../admin/notifications/display-preferences";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Per-staff display preferences (account panel's Display tab). GET returns the
 * stored choice — or the defaults when nothing is saved yet — so first use
 * never looks like an error. PUT validates both fields against their enums and
 * merges, so an update to one preference can never clear the other. */
export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  try {
    const staff = await getStaffContext(access.user);
    const preferences = await getDisplayPreferences(staff.profile.uid);
    return json({ ok: true, preferences });
  } catch (error) {
    console.error("Failed to load KCPL display preferences", error);
    return json({ ok: false, error: "Display preferences are temporarily unavailable." }, 503);
  }
}

export async function PUT(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin preference changes are not accepted." }, 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const staff = await getStaffContext(access.user);
    // Merge against the stored doc so a density-only save cannot silently
    // reset motion (and vice versa) for an operator who only touches one.
    const existing = await getDisplayPreferences(staff.profile.uid);
    const rawDensity = typeof body.density === "string" ? body.density : "";
    const rawMotion = typeof body.motion === "string" ? body.motion : "";
    const preferences = {
      density: displayDensities.includes(rawDensity as never) ? rawDensity as DisplayPreferencesUnion["density"] : existing.density,
      motion: displayMotions.includes(rawMotion as never) ? rawMotion as DisplayPreferencesUnion["motion"] : existing.motion,
    };
    const result = await saveDisplayPreferences(staff.profile.uid, preferences);
    if (result.kind !== "updated") return json({ ok: false, error: "Display preferences could not be saved. Storage is unavailable." }, 503);
    return json({ ok: true, preferences: result.preferences });
  } catch (error) {
    console.error("Failed to save KCPL display preferences", error);
    return json({ ok: false, error: "Display preferences could not be saved." }, 503);
  }
}

type DisplayPreferencesUnion = Awaited<ReturnType<typeof getDisplayPreferences>>;

/** Reset to the never-customised state: the stored doc is deleted and the
 * defaults are returned, so the client radios and route-root attributes land
 * back on comfortable/full-motion without guessing them client-side. */
export async function DELETE() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  try {
    const staff = await getStaffContext(access.user);
    const result = await clearDisplayPreferences(staff.profile.uid);
    if (result.kind !== "updated") return json({ ok: false, error: "Display preferences could not be reset. Storage is unavailable." }, 503);
    return json({ ok: true, preferences: defaultDisplayPreferences() });
  } catch (error) {
    console.error("Failed to reset KCPL display preferences", error);
    return json({ ok: false, error: "Display preferences could not be reset." }, 503);
  }
}
