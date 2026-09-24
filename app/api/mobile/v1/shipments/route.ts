import { listPortalShipments } from "../../../../portal/portal-data.server";
import { mobileJson, mobileUnavailable, withMobileSession } from "../../../../portal/portal-mobile-api.server";

export async function GET(request: Request) {
  return withMobileSession(request, async (session) => {
    const result = await listPortalShipments(session);
    if (result.kind !== "ready") return mobileUnavailable();
    return mobileJson({ ok: true, shipments: result.shipments });
  });
}
