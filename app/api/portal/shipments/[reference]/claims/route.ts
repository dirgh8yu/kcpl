import { getPortalAccess } from "../../../../../portal/portal-auth";
import { receivePortalClaim } from "../../../../../portal/portal-claims.server";
import { portalWriteResponse } from "../../../../../portal/portal-intake";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** A claim for damage, shortage, loss or delay, from the web portal: receivePortalClaim's rules, shared with the KCPL app. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin claims are not accepted." }, 403);
  const { reference } = await context.params;
  return portalWriteResponse(await receivePortalClaim(access.session, reference, request));
}
