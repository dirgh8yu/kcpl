import { getPortalAccess } from "../../../portal/portal-auth";
import { savePortalTextNotices } from "../../../portal/portal-accounts.server";
import { textNoticeSettingsFromBody } from "../../../portal/portal-text-notices";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** The signed-in account's own SMS / WhatsApp setting, with its consent. */
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
  const parsed = textNoticeSettingsFromBody(body ?? {});
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const result = await savePortalTextNotices(access.session.email, parsed.settings);
  if (result.kind === "missing") return json({ ok: false, error: "This portal account could not be found." }, 404);
  if (result.kind === "unavailable") return json({ ok: false, error: "The change could not be saved. Please try again." }, 503);
  return json({ ok: true, settings: parsed.settings });
}
