import { getPortalAccess } from "../../../portal/portal-auth";
import { savePortalNotificationPreferences } from "../../../portal/portal-accounts.server";
import { portalNotificationTopics } from "../../../portal/portal-notifications";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * A customer's own notification settings.
 *
 * The account being changed is the signed-in one: the email comes from the
 * verified session and the body carries only topic switches, so nothing in this
 * request can point the write at somebody else's account.
 */
export async function POST(request: Request) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The change could not be read." }, 400);
  }

  const preferences = Object.fromEntries(
    portalNotificationTopics.map((topic) => [topic, body[topic] === true]),
  ) as Record<(typeof portalNotificationTopics)[number], boolean>;

  const result = await savePortalNotificationPreferences(access.session.email, preferences);
  if (result.kind === "missing") return json({ ok: false, error: "This portal account could not be found." }, 404);
  if (result.kind === "unavailable") return json({ ok: false, error: "The change could not be saved. Please try again." }, 503);
  return json({ ok: true, preferences });
}
