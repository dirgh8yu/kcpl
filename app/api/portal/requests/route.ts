import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb } from "../../../firebase-admin.server";
import { getPortalAccess, type PortalSession } from "../../../portal/portal-auth";
import { isTrustedSameOriginRequest } from "../../../request-security";
import { checkQuoteRateLimit, quoteRateLimitPolicies } from "../../quotes/quote-rate-limit-policy";
import { firestoreQuoteRateLimitStore } from "../../quotes/quote-rate-limit.server";

/*
 * Customer-raised requests.
 *
 * What this route deliberately does NOT do: it never writes `customer_id`,
 * pricing, status transitions or any commercial field on a quote. A portal
 * submission lands as an ordinary enquiry with a *suggested* CRM match, and a
 * staff member confirms the link in the workflow they already use. The portal's
 * own scoping uses `portal_customer_id`, a field only the portal writes and only
 * the portal reads, so customer-supplied intent can never be mistaken for
 * KCPL-confirmed commercial authority.
 */

const allowedModes = new Set(["air", "sea", "road", "unsure"]);
const allowedWeightUnits = new Set(["kg", "tonnes", "lb"]);

const fieldLimits = {
  origin: 120,
  destination: 120,
  cargoType: 160,
  weight: 40,
  timing: 120,
  requirements: 3000,
} as const;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `KCPL-Q-${date}-${suffix}`;
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

  // One shared budget for both request kinds: a compromised portal account
  // should not be able to flood the enquiry pipeline either way.
  const limit = await checkQuoteRateLimit({
    subjects: [{ policy: quoteRateLimitPolicies.contact, value: access.session.email }],
    store: firestoreQuoteRateLimitStore(),
  });
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

  const values = {
    origin: text(payload.origin),
    destination: text(payload.destination),
    mode: text(payload.mode) || "unsure",
    cargoType: text(payload.cargoType),
    weight: text(payload.weight),
    weightUnit: text(payload.weightUnit) || "kg",
    timing: text(payload.timing),
    requirements: text(payload.requirements),
  };

  const errors: Record<string, string> = {};
  for (const [field, max] of Object.entries(fieldLimits)) {
    if (values[field as keyof typeof values].length > max) errors[field] = `Must be ${max} characters or fewer.`;
  }
  if (!values.origin) errors.origin = "Origin is required.";
  if (!values.destination) errors.destination = "Destination is required.";
  if (!allowedModes.has(values.mode)) errors.mode = "Choose a valid freight mode.";
  if (!allowedWeightUnits.has(values.weightUnit)) errors.weightUnit = "Choose a valid weight unit.";
  if (Object.keys(errors).length) {
    return json({ ok: false, error: "Please check the highlighted details.", fields: errors }, 400);
  }

  const reference = createReference();
  const now = new Date().toISOString();
  const session = access.session;

  try {
    await firebaseAdminDb().collection("quotes").doc(reference).create({
      reference,
      created_at: now,
      updated_at: now,
      status: "new",
      assigned_to: null,
      note_count: 0,
      origin: values.origin,
      destination: values.destination,
      mode: values.mode,
      cargo_type: values.cargoType || null,
      weight: values.weight || null,
      weight_unit: values.weightUnit,
      length: null,
      width: null,
      height: null,
      dimension_unit: "cm",
      timing: values.timing || null,
      requirements: values.requirements || null,
      contact_name: session.displayName,
      contact_email: session.email,
      company_name: session.customerName,
      phone: null,
      quote_currency: "USD",
      quoted_amount: null,
      internal_cost: null,
      valid_until: null,
      customer_quote_note: null,
      shipment_reference: null,
      // Staff-owned CRM linkage stays unset; the portal only suggests.
      customer_id: null,
      crm_match_state: "suggested",
      crm_match_ids: [session.customerId],
      crm_matches: [{ id: session.customerId, display_name: session.customerName, reason: "Raised from the customer portal" }],
      crm_linked_at: null,
      crm_linked_by_name: null,
      crm_linked_by_email: null,
      source: "customer_portal",
      portal_customer_id: session.customerId,
      portal_submitted_by_email: session.email,
      portal_submitted_at: now,
    });
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
