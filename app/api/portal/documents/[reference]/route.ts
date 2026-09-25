import { getPortalAccess } from "../../../../portal/portal-auth";
import { receivePortalDocument } from "../../../../portal/portal-document-intake.server";
import { portalWriteResponse } from "../../../../portal/portal-intake";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Customer document upload from the web portal. The rules are
 * `receivePortalDocument`'s, shared with the KCPL app; this door adds the
 * cookie session and the same-origin check a cookie needs. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin uploads are not accepted." }, 403);

  const { reference } = await context.params;
  return portalWriteResponse(await receivePortalDocument(access.session, reference, request));
}
