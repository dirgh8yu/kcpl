import { getPortalAccess } from "../../../portal/portal-auth";
import { savePortalLocale } from "../../../portal/portal-accounts.server";
import { portalLocaleValue, portalLocales } from "../../../portal/portal-i18n";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * A customer's own reading language.
 *
 * Written to their account record rather than a cookie: the scheduled
 * notification sweep has no browser to read a cookie from, and an email that
 * arrives in a different language from the portal that sent it is worse than
 * one that was never translated.
 */
export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);

  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);

  let requested: unknown;
  try {
    const body = await request.json() as { locale?: unknown };
    requested = body.locale;
  } catch {
    return json({ ok: false, error: "The request could not be read." }, 400);
  }
  if (!portalLocales.includes(requested as never)) return json({ ok: false, error: "That language is not available." }, 400);

  // The address is the session's, so one customer cannot change another's.
  const result = await savePortalLocale(access.session.email, portalLocaleValue(requested));
  if (result.kind === "missing") return json({ ok: false, error: "This account was not found." }, 404);
  if (result.kind !== "saved") return json({ ok: false, error: "The language could not be saved." }, 503);
  return json({ ok: true, locale: portalLocaleValue(requested) });
}
