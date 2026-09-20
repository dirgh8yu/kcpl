import { getPortalAccess } from "../../../portal/portal-auth";
import {
  deletePortalPushSubscription,
  portalPushConfigured,
  savePortalPushSubscription,
} from "../../../portal/portal-push.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function text(value: unknown, max = 1024) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Register this browser for push on the signed-in account.
 *
 * The account is the session's, never the request's: a subscription cannot be
 * filed against somebody else's login, and removing one requires being the
 * account that created it rather than merely knowing its endpoint.
 */
export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);
  if (!portalPushConfigured()) return json({ ok: false, error: "Push notifications are not configured." }, 503);

  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ ok: false, error: "The request could not be read." }, 400);
  }

  const result = await savePortalPushSubscription({
    email: access.session.email,
    customerId: access.session.customerId,
    locale: access.session.locale,
    endpoint: text(body.endpoint, 2048),
    p256dh: text(body.keys?.p256dh, 256),
    auth: text(body.keys?.auth, 256),
  });
  if (result.kind === "invalid") return json({ ok: false, error: "That subscription could not be read." }, 400);
  if (result.kind !== "saved") return json({ ok: false, error: "The subscription could not be saved." }, 503);
  return json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);

  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);

  let endpoint = "";
  try {
    const body = await request.json() as { endpoint?: unknown };
    endpoint = text(body.endpoint, 2048);
  } catch {
    return json({ ok: false, error: "The request could not be read." }, 400);
  }
  if (!endpoint) return json({ ok: false, error: "That subscription could not be read." }, 400);

  const result = await deletePortalPushSubscription(access.session.email, endpoint);
  if (result.kind === "forbidden") return json({ ok: false, error: "That subscription belongs to another account." }, 403);
  if (result.kind !== "removed") return json({ ok: false, error: "The subscription could not be removed." }, 503);
  return json({ ok: true });
}
