import { getPortalAccess } from "../../../../../portal/portal-auth";
import { createPaymentIntent, paymentOptionsFor } from "../../../../../payments/payments.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function session() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return { response: json({ ok: false, error: "The customer portal is not configured." }, 503) };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { session: access.session };
}

/** How the invoice can be paid online, from the web portal's own cookie session. */
export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await session();
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  const options = await paymentOptionsFor(auth.session, decodeURIComponent(reference));
  return json(options ? { ok: true, ...options } : { ok: true, gateways: [] });
}

/** Starts a full or partial payment. The rupee amount and FX rate are fixed server-side. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await session();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin payments are not accepted." }, 403);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid", error: "The payment request could not be read." }, 400);
  }
  const { reference } = await context.params;
  const result = await createPaymentIntent(auth.session, decodeURIComponent(reference), String(body.gateway ?? ""), new URL(request.url).origin, body.amount);
  return json(result.body, result.status);
}
