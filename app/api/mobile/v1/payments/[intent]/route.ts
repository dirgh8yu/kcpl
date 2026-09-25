import { mobileJson, withMobileSession } from "../../../../../portal/portal-mobile-api.server";
import { paymentIntentStatus } from "../../../../../payments/payments.server";

/** Where a payment stands, for the app to show when the payer returns. */
export async function GET(request: Request, context: { params: Promise<{ intent: string }> }) {
  return withMobileSession(request, async (session) => {
    const { intent } = await context.params;
    const result = await paymentIntentStatus(session, intent);
    return mobileJson(result.body, result.status);
  });
}
