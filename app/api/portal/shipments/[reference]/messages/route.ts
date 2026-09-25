import { getPortalAccess } from "../../../../../portal/portal-auth";
import { isTrustedSameOriginRequest } from "../../../../../request-security";
import { customerPostsMessage, customerReadsMessages } from "../../../../../shipment-messages.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** The shipment's conversation with KCPL, from the web portal. The rules are
 * shipment-messages.server.ts's, shared with the KCPL app; this door adds the
 * cookie session and, for a write, the same-origin check a cookie needs. */
export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  const { reference } = await context.params;
  const result = await customerReadsMessages(access.session, reference);
  return json(result.body, result.status);
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin messages are not accepted." }, 403);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The message could not be read." }, 400);
  }
  const { reference } = await context.params;
  const result = await customerPostsMessage(access.session, reference, body ?? {});
  return json(result.body, result.status);
}
