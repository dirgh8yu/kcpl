import { getPortalAccess } from "../../../../portal/portal-auth";
import { bookAtInstantPrice } from "../../../../portal/portal-instant-price.server";
import { checkPortalRequestRateLimit } from "../../../../portal/portal-requests.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** Book at an agreed price: a request to KCPL with the lane, quantity and price worked out from the rate card on file. */
export async function POST(request: Request) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin submissions are not accepted." }, 403);
  if (!access.session.capabilities.canSubmitRequests) return json({ ok: false, error: "This account can view shipments but cannot raise new requests." }, 403);
  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const limit = await checkPortalRequestRateLimit(access.session);
  if (!limit.allowed) return json({ ok: false, error: "Too many requests from this account. Please try again shortly." }, 429, { "retry-after": String(limit.retryAfterSeconds) });
  const text = (key: string) => typeof payload[key] === "string" ? payload[key] as string : "";
  try {
    const result = await bookAtInstantPrice(access.session, { rateCardId: text("rateCardId"), quantity: payload.quantity, timing: text("timing"), requirements: text("requirements") }, "customer_portal");
    if (result.kind === "created") return json({ ok: true, reference: result.reference, price: result.price, currency: result.currency });
    if (result.kind === "invalid_quantity") return json({ ok: false, error: "Enter the quantity to price." }, 400);
    return json({ ok: false, error: "That price is no longer available. Ask KCPL for a quote." }, 409);
  } catch (error) {
    console.error("KCPL portal instant-price booking failed", error);
    return json({ ok: false, error: "The request couldn’t be sent. Try again." }, 503);
  }
}
