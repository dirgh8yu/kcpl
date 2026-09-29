import { getPortalOverview } from "../../../../portal/portal-data.server";
import { portalNeeds } from "../../../../portal/portal-needs";
import { mobileJson, mobileSessionView, mobileUnavailable, withMobileSession } from "../../../../portal/portal-mobile-api.server";

export async function GET(request: Request) {
  return withMobileSession(request, async (session) => {
    const result = await getPortalOverview(session);
    if (result.kind !== "ready") return mobileUnavailable();
    return mobileJson({ ok: true, session: mobileSessionView(session), overview: result.overview, needs: portalNeeds(result.overview) });
  });
}
