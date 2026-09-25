import { portalOwnsShipment } from "../../../../portal/portal-data.server";
import { mobileJson, withMobileSession } from "../../../../portal/portal-mobile-api.server";
import { deleteLiveActivity, saveLiveActivity } from "../../../../mobile-push.server";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Registers a shipment the customer follows on their lock screen, so the
 * notification sweep can move it along. Only their own shipments. */
export async function POST(request: Request) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The request could not be read." }, 400);
    }
    const reference = text(body.shipment, 80).toUpperCase();
    const activityToken = text(body.activityToken, 512);
    const fcmToken = text(body.fcmToken, 4096);
    if (!reference || !activityToken || !fcmToken) return mobileJson({ ok: false, code: "invalid", error: "Shipment and tokens are required." }, 400);
    if (!await portalOwnsShipment(session, reference)) return mobileJson({ ok: false, code: "missing", error: "Shipment not found." }, 404);
    const result = await saveLiveActivity({ email: session.email, customerId: session.customerId, shipmentReference: reference, activityToken, fcmToken });
    if (result.kind !== "saved") return mobileJson({ ok: false, code: "unavailable", error: "Not available just now." }, 503);
    return mobileJson({ ok: true });
  });
}

/** Stops following: the activity was ended on the phone. */
export async function DELETE(request: Request) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The request could not be read." }, 400);
    }
    await deleteLiveActivity(session.email, text(body.activityToken, 512));
    return mobileJson({ ok: true });
  });
}
