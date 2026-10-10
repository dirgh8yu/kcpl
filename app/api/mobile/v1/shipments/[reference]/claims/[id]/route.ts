import { withdrawPortalClaim } from "../../../../../../../portal/portal-claims.server";
import { portalWriteResponse } from "../../../../../../../portal/portal-intake";
import { withMobileSession } from "../../../../../../../portal/portal-mobile-api.server";

/** Withdraw a claim KCPL hasn't filed yet, from the KCPL app. */
export async function DELETE(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference, id } = await context.params;
    return portalWriteResponse(await withdrawPortalClaim(session, reference, decodeURIComponent(id)), "private, no-store");
  });
}
