import { ratePortalDelivery } from "../../../../../../portal/portal-delivery-rating.server";
import { portalWriteResponse } from "../../../../../../portal/portal-intake";
import { mobileJson, withMobileSession } from "../../../../../../portal/portal-mobile-api.server";

/** "How did this delivery go?" from the KCPL app: the web portal's rules. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The rating could not be read." }, 400);
    }
    const { reference } = await context.params;
    return portalWriteResponse(await ratePortalDelivery(session, reference, body ?? {}, "customer_app"), "private, no-store");
  });
}
