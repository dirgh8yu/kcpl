import { getPortalAccess, portalCustomerCookie } from "../../../portal/portal-auth";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/**
 * Switch which of an agent's linked customers the portal is showing.
 *
 * The request names a customer; it does not grant one. The allowed set on the
 * session was resolved from Firestore moments ago, and an id outside it is
 * refused here rather than written to a cookie and quietly dropped later. That
 * ordering matters: it means this route cannot widen a session's scope even by
 * mistake, only move it between customers KCPL already granted.
 */
export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);

  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);

  let customerId = "";
  try {
    const body = await request.json() as { customerId?: unknown };
    customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
  } catch {
    return json({ ok: false, error: "The request could not be read." }, 400);
  }

  const match = access.session.customers.find((customer) => customer.id === customerId);
  if (!match) return json({ ok: false, error: "That account is not available on this login." }, 403);

  return json({ ok: true, customerId: match.id, customerName: match.name }, 200, {
    "set-cookie": portalCustomerCookie(match.id),
  });
}
