import { getPortalAccess } from "../../../../../portal/portal-auth";
import { ratePortalDelivery } from "../../../../../portal/portal-delivery-rating.server";
import { portalWriteResponse } from "../../../../../portal/portal-intake";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** "How did this delivery go?" from the web portal: ratePortalDelivery's
 * rules, shared with the KCPL app. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin ratings are not accepted." }, 403);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The rating could not be read." }, 400);
  }
  const { reference } = await context.params;
  return portalWriteResponse(await ratePortalDelivery(access.session, reference, body ?? {}, "customer_portal"));
}
