import { listPortalClaims, receivePortalClaim } from "../../../../../../portal/portal-claims.server";
import { portalWriteResponse } from "../../../../../../portal/portal-intake";
import { withMobileSession } from "../../../../../../portal/portal-mobile-api.server";

/** The customer's claims on a shipment, for the KCPL app. */
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    const claims = await listPortalClaims(session, reference);
    if (claims === null) return Response.json({ ok: false, error: "Shipment not found." }, { status: 404, headers: { "cache-control": "private, no-store" } });
    return Response.json({ ok: true, claims }, { headers: { "cache-control": "private, no-store" } });
  });
}

/** A claim from the KCPL app, with photos taken on the spot: receivePortalClaim's rules, the web portal's own. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    return portalWriteResponse(await receivePortalClaim(session, reference, request), "private, no-store");
  });
}
