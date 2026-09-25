import { getPortalNotificationPreferences, savePortalNotificationPreferences } from "../../../../portal/portal-accounts.server";
import { portalPreferencesFromBody } from "../../../../portal/portal-notifications";
import { mobileJson, mobileUnavailable, withMobileSession } from "../../../../portal/portal-mobile-api.server";

/**
 * The signed-in customer's own notification settings, as the portal's
 * settings page shows them. The account is always the session's; the body
 * carries only topic switches.
 */
export async function GET(request: Request) {
  return withMobileSession(request, async (session) => {
    const preferences = await getPortalNotificationPreferences(session.email);
    if (!preferences) return mobileUnavailable();
    return mobileJson({ ok: true, preferences });
  });
}

export async function POST(request: Request) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The change could not be read." }, 400);
    }
    const preferences = portalPreferencesFromBody(body ?? {});
    const result = await savePortalNotificationPreferences(session.email, preferences);
    if (result.kind === "missing") return mobileJson({ ok: false, code: "missing", error: "This portal account could not be found." }, 404);
    if (result.kind === "unavailable") return mobileUnavailable();
    return mobileJson({ ok: true, preferences });
  });
}
