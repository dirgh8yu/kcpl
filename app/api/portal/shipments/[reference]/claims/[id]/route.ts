import { getPortalAccess } from "../../../../../../portal/portal-auth";
import { withdrawPortalClaim } from "../../../../../../portal/portal-claims.server";
import { portalWriteResponse } from "../../../../../../portal/portal-intake";
import { isTrustedSameOriginRequest } from "../../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** The customer withdraws a claim KCPL hasn't filed yet. */
export async function DELETE(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);
  const { reference, id } = await context.params;
  return portalWriteResponse(await withdrawPortalClaim(access.session, reference, decodeURIComponent(id)));
}
