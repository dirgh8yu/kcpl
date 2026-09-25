import { confirmPortalDelivery } from "../../../../../../portal/portal-delivery-confirmation.server";
import { portalWriteResponse } from "../../../../../../portal/portal-intake";
import { mobileJson, withMobileSession } from "../../../../../../portal/portal-mobile-api.server";

/** "It arrived", from the KCPL app. `confirmPortalDelivery` decides what may
 * be written, as it does for the web: evidence, never canonical delivery. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The confirmation could not be read." }, 400);
    }
    const { reference } = await context.params;
    return portalWriteResponse(await confirmPortalDelivery(session, reference, body ?? {}, "customer_app"), "private, no-store");
  });
}
