import { getPortalAccess } from "../../../portal/portal-auth";
import { isTrustedSameOriginRequest } from "../../../request-security";
import { checkPortalRequestRateLimit, createPortalEnquiry, requestPortalBooking, validatePortalEnquiry } from "../../../portal/portal-requests.server";

/* Customer-raised requests from the web portal: see portal-requests.server.ts. */

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin submissions are not accepted." }, 403);
  if (!access.session.capabilities.canSubmitRequests) {
    return json({ ok: false, error: "This account can view shipments but cannot raise new requests." }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The request could not be read." }, 400);
  }

  const limit = await checkPortalRequestRateLimit(access.session);
  if (!limit.allowed) {
    return json(
      { ok: false, error: "Too many requests from this account. Please try again shortly, or contact your KCPL account manager." },
      429,
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  const kind = text(payload.kind) || "enquiry";
  if (kind === "booking") {
    const booked = await requestPortalBooking(access.session, payload);
    return json(booked.body, booked.status);
  }
  if (kind !== "enquiry") return json({ ok: false, error: "Unknown request type." }, 400);

  const checked = validatePortalEnquiry(payload);
  if (!checked.ok) {
    return json({ ok: false, error: "Please check the highlighted details.", fields: checked.fields }, 400);
  }

  let reference: string;
  try {
    reference = await createPortalEnquiry(access.session, checked.values, "customer_portal");
  } catch (error) {
    console.error("KCPL portal request could not be saved", error);
    return json({ ok: false, error: "The request could not be submitted. Please try again." }, 500);
  }

  return json({ ok: true, reference, message: "Your request has been sent to the KCPL team." }, 201);
}
