import { getPortalAccess } from "../../../portal/portal-auth";
import { portalWriteResponse } from "../../../portal/portal-intake";
import { changePortalTeam, portalTeamView } from "../../../portal/portal-team.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Customer-managed team logins from the web portal. The rules are the shared
 * team module's, used by the KCPL app as well, and take the customer from the
 * session only. This door adds the cookie session and, for changes, the
 * same-origin check a cookie needs. */
export async function GET() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  return portalWriteResponse(await portalTeamView(access.session));
}

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
  return portalWriteResponse(await changePortalTeam(access.session, body ?? {}));
}
