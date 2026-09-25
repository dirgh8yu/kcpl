import { completeEsewa } from "../../../../payments/payments.server";

/** The gateway sends the payer back here. Nothing it says is believed until
 * the payment has been confirmed with the gateway, server to server. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = await completeEsewa(url).catch((error) => {
    console.error("KCPL esewa return failed", error);
    return null;
  });
  return Response.redirect(id ? `${url.origin}/pay/${id}/done` : `${url.origin}/`, 303);
}
