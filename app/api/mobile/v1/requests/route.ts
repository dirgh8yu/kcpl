import { mobileJson, withMobileSession } from "../../../../portal/portal-mobile-api.server";
import { checkPortalRequestRateLimit, createPortalEnquiry, validatePortalEnquiry } from "../../../../portal/portal-requests.server";

/**
 * A quote request from the KCPL app: the portal's own rules (who may raise
 * one, the shared rate limit, the checks, and a suggested CRM match only),
 * behind the app's bearer sign-in instead of the portal's cookie. Bearer
 * requests carry no ambient credential, so the cookie route's same-origin
 * check has nothing to protect here.
 */
export async function POST(request: Request) {
  return withMobileSession(request, async (session) => {
    if (!session.capabilities.canSubmitRequests) {
      return mobileJson({ ok: false, code: "forbidden", error: "This account can view shipments but cannot raise new requests." }, 403);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The request could not be read." }, 400);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return mobileJson({ ok: false, code: "invalid", error: "The request could not be read." }, 400);
    }

    const limit = await checkPortalRequestRateLimit(session);
    if (!limit.allowed) {
      return mobileJson(
        { ok: false, code: "rate_limited", error: "Too many requests from this account. Please try again shortly, or contact your KCPL account manager." },
        429,
      );
    }

    const checked = validatePortalEnquiry(payload);
    if (!checked.ok) {
      return mobileJson({ ok: false, code: "invalid", error: "Please check the highlighted details.", fields: checked.fields }, 400);
    }

    try {
      const reference = await createPortalEnquiry(session, checked.values, "customer_app");
      return mobileJson({ ok: true, reference, message: "Your request has been sent to the KCPL team." }, 201);
    } catch (error) {
      console.error("KCPL app request could not be saved", error);
      return mobileJson({ ok: false, code: "unavailable", error: "The request could not be submitted. Please try again." }, 503);
    }
  });
}
