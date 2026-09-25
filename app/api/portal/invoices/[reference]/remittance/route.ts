import { getPortalAccess } from "../../../../../portal/portal-auth";
import { portalWriteResponse } from "../../../../../portal/portal-intake";
import { listPortalRemittances, receivePortalRemittance } from "../../../../../portal/portal-remittance-intake.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function session() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return { response: json({ ok: false, error: "The customer portal is not configured." }, 503) };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { session: access.session };
}

/** Remittances from the web portal. The rules are the shared intake's, used by
 * the KCPL app as well; this door adds the cookie session and, for the upload,
 * the same-origin check a cookie needs. */
export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await session();
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  return portalWriteResponse(await listPortalRemittances(auth.session, reference));
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await session();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin uploads are not accepted." }, 403);
  const { reference } = await context.params;
  return portalWriteResponse(await receivePortalRemittance(auth.session, reference, request));
}
