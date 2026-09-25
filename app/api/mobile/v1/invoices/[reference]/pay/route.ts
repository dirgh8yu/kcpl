import { mobileJson, withMobileSession } from "../../../../../../portal/portal-mobile-api.server";
import { createPaymentIntent, paymentOptionsFor } from "../../../../../../payments/payments.server";

/** How this invoice can be paid online, if at all. */
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    return mobileJson({ ok: true, gateways: await paymentOptionsFor(session, reference) });
  });
}

/** Starts paying the whole balance through the chosen gateway. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The request could not be read." }, 400);
    }
    const { reference } = await context.params;
    const result = await createPaymentIntent(session, reference, String(body?.gateway ?? ""), new URL(request.url).origin);
    return mobileJson(result.body, result.status);
  });
}
