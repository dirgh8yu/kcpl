import { mobileJson, withMobileSession } from "../../../../../../portal/portal-mobile-api.server";
import { createTrackingLink, revokeTrackingLinks } from "../../../../../../tracking/public-tracking.server";

/** A link anyone can open to follow this shipment, without a KCPL login:
 * unguessable, expiring in 30 days, and withdrawable. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    const result = await createTrackingLink(session, reference, new URL(request.url).origin);
    return mobileJson(result.body, result.status);
  });
}

/** Withdraws every link this customer made for the shipment. */
export async function DELETE(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    const result = await revokeTrackingLinks(session, reference);
    return mobileJson(result.body, result.status);
  });
}
