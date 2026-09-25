import { startPayment } from "../../payments/payments.server";

/** Hands the browser to the payment gateway chosen in the app. The intent id
 * is unguessable and only ever pays its own invoice's balance. */
export async function GET(request: Request, context: { params: Promise<{ intent: string }> }) {
  const { intent } = await context.params;
  return startPayment(intent, new URL(request.url).origin);
}
