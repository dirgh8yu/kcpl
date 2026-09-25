import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb } from "../../../firebase-admin.server";
import { getPortalAccess, type PortalSession } from "../../../portal/portal-auth";
import { isTrustedSameOriginRequest } from "../../../request-security";
import { checkPortalRequestRateLimit, createPortalEnquiry, validatePortalEnquiry } from "../../../portal/portal-requests.server";

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
  if (kind === "booking") return submitBookingRequest(payload, access.session);
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

async function submitBookingRequest(payload: Record<string, unknown>, session: PortalSession) {
  const quoteReference = text(payload.quoteReference).toUpperCase();
  const note = text(payload.note).slice(0, 2000);
  if (!quoteReference) return json({ ok: false, error: "A quote reference is required." }, 400);

  const db = firebaseAdminDb();
  const quoteRef = db.collection("quotes").doc(quoteReference);
  try {
    const quote = await quoteRef.get();
    const ownedByCustomer = quote.exists
      && (String(quote.get("customer_id") ?? "") === session.customerId
        || String(quote.get("portal_customer_id") ?? "") === session.customerId);
    if (!ownedByCustomer) return json({ ok: false, error: "Quote not found." }, 404);

    const now = new Date().toISOString();
    const noteId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const batch = db.batch();
    batch.set(quoteRef.collection("notes").doc(String(noteId)), {
      id: noteId,
      quote_reference: quoteReference,
      note: note
        ? `Customer portal booking request from ${session.email}: ${note}`
        : `Customer portal booking request from ${session.email}.`,
      author_name: session.displayName,
      author_email: session.email,
      created_at: now,
    });
    // Namespaced field: nothing downstream reads it as commercial state, and it
    // gives the enquiry workspace a visible "customer asked to proceed" marker.
    batch.update(quoteRef, {
      note_count: FieldValue.increment(1),
      portal_booking_request: { requested_at: now, requested_by_email: session.email, note: note || null },
      updated_at: now,
    });
    await batch.commit();
    return json({ ok: true, reference: quoteReference, message: "KCPL has been notified that you want to proceed." }, 201);
  } catch (error) {
    console.error("KCPL portal booking request failed", error);
    return json({ ok: false, error: "The booking request could not be sent. Please try again." }, 500);
  }
}
