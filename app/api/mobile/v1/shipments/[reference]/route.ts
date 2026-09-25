import { getPortalShipment } from "../../../../../portal/portal-data.server";
import { portalConfirmableDeliveryStatus } from "../../../../../portal/portal-access-policy";
import { portalMobileFreeTime } from "../../../../../portal/portal-mobile-auth";
import { mobileJson, mobileMissing, mobileUnavailable, withMobileSession } from "../../../../../portal/portal-mobile-api.server";

export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    const result = await getPortalShipment(session, reference);
    // Another customer's shipment reads as missing, as it does on the web.
    if (result.kind === "missing") return mobileMissing("Shipment");
    if (result.kind !== "ready") return mobileUnavailable();
    const { detail } = result;
    return mobileJson({
      ok: true,
      detail: {
        ...detail,
        freeTime: portalMobileFreeTime(detail.freeTime as unknown as Parameters<typeof portalMobileFreeTime>[0]),
        // Decided here, as the web page decides whether to offer the button, so
        // the app never has to know which statuses count as delivery.
        canConfirmDelivery: session.capabilities.canSubmitRequests && portalConfirmableDeliveryStatus(detail.shipment.status),
      },
    });
  });
}
