import { getPortalAccessFromBearer, type PortalSession } from "./portal-auth";

/*
 * The one door every /api/mobile/v1 route goes through. A route receives a
 * resolved session or never runs, so no mobile handler can forget the check
 * or read before it.
 *
 * Status codes are what the app acts on: 401 means refresh the token and retry
 * once, then sign out; 403 means signed in but not allowed (show the message);
 * 503 means try again later.
 */

export function mobileJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export async function withMobileSession(
  request: Request,
  handler: (session: PortalSession) => Promise<Response>,
): Promise<Response> {
  const access = await getPortalAccessFromBearer(request);
  switch (access.kind) {
    case "unconfigured":
      return mobileJson({ ok: false, code: "unconfigured", error: "The KCPL customer portal is not configured." }, 503);
    case "unavailable":
      return mobileJson({ ok: false, code: "unavailable", error: "Customer portal storage is unavailable. Please try again shortly." }, 503);
    case "signed-out":
      return mobileJson({ ok: false, code: "signed_out", error: "Sign in is required." }, 401);
    case "denied":
      return mobileJson({ ok: false, code: "denied", error: access.message }, 403);
    case "authorized":
      return handler(access.session);
  }
}

/** What the app needs to render its chrome. The uid stays server-side. */
export function mobileSessionView(session: PortalSession) {
  return {
    email: session.email,
    displayName: session.displayName,
    customerId: session.customerId,
    customerName: session.customerName,
    customers: session.customers,
    role: session.role,
    capabilities: session.capabilities,
    locale: session.locale,
  };
}

export const mobileUnavailable = () =>
  mobileJson({ ok: false, code: "unavailable", error: "This information is temporarily unavailable." }, 503);

export const mobileMissing = (what: string) =>
  mobileJson({ ok: false, code: "missing", error: `${what} not found.` }, 404);

export const mobileForbidden = () =>
  mobileJson({ ok: false, code: "forbidden", error: "This login cannot view invoices." }, 403);
