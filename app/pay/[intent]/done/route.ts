import { paymentDonePage } from "../../../payments/payments.server";

/** Where every gateway lands: what happened, and the way back to the app. */
export async function GET(_request: Request, context: { params: Promise<{ intent: string }> }) {
  const { intent } = await context.params;
  return paymentDonePage(intent);
}
