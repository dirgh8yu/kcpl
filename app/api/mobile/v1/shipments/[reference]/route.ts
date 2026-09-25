import { getPortalShipment } from "../../../../../portal/portal-data.server";
import { portalConfirmableDeliveryStatus } from "../../../../../portal/portal-access-policy";
import { deliveryRatable } from "../../../../../portal/portal-delivery-rating";
import { portalDeliveryRating } from "../../../../../portal/portal-delivery-rating.server";
import { portalProofOfDelivery } from "../../../../../portal/portal-proof-of-delivery.server";
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
    const delivered = deliveryRatable(detail.shipment.status);
    const [rating, proofOfDelivery] = delivered
      ? await Promise.all([portalDeliveryRating(session, detail.shipment.reference), portalProofOfDelivery(session, detail.shipment.reference)])
      : [null, null];
    return mobileJson({
      ok: true,
      detail: {
        ...detail,
        freeTime: portalMobileFreeTime(detail.freeTime as unknown as Parameters<typeof portalMobileFreeTime>[0]),
        // Decided here, as the web page decides whether to offer the button, so
        // the app never has to know which statuses count as delivery.
        canConfirmDelivery: session.capabilities.canSubmitRequests && portalConfirmableDeliveryStatus(detail.shipment.status),
        // Asked once, after delivery, of any login that can see the shipment.
        canRate: delivered && rating === null,
        rating,
        // Only what KCPL verified and chose to share; files at pod/{id}.
        proofOfDelivery,
      },
    });
  });
}
