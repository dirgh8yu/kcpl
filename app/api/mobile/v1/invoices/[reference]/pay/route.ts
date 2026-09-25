import { mobileJson, withMobileSession } from "../../../../../../portal/portal-mobile-api.server";
import { createPaymentIntent, paymentOptionsFor } from "../../../../../../payments/payments.server";

/** How this invoice can be paid online, if at all: the gateways, and for
 * an invoice in another currency the rate its rupee sum is worked out at. */
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    const options = await paymentOptionsFor(session, reference);
    return mobileJson(options ? { ok: true, ...options } : { ok: true, gateways: [] });
  });
}

/** Starts paying the balance, or part of it, through the chosen gateway. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The request could not be read." }, 400);
    }
    const { reference } = await context.params;
    const result = await createPaymentIntent(session, reference, String(body?.gateway ?? ""), new URL(request.url).origin, body?.amount);
    return mobileJson(result.body, result.status);
  });
}
