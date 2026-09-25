import { firebaseAdminDb } from "../firebase-admin.server";
import { checkQuoteRateLimit, quoteRateLimitPolicies } from "../api/quotes/quote-rate-limit-policy";
import { firestoreQuoteRateLimitStore } from "../api/quotes/quote-rate-limit.server";
import type { PortalSession } from "./portal-auth";

/*
 * A quote request raised by a signed-in customer, from the web portal or the
 * KCPL app. Both doors share this, so the rules are one set.
 *
 * What this deliberately does NOT do: it never writes `customer_id`,
 * pricing, status transitions or any commercial field on a quote. A
 * submission lands as an ordinary enquiry with a *suggested* CRM match, and a
 * staff member confirms the link in the workflow they already use. The
 * portal's own scoping uses `portal_customer_id`, a field only the portal
 * writes and only the portal reads, so customer-supplied intent can never be
 * mistaken for KCPL-confirmed commercial authority.
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

export type PortalEnquiryValues = {
  origin: string;
  destination: string;
  mode: string;
  cargoType: string;
  weight: string;
  weightUnit: string;
  timing: string;
  requirements: string;
};

export type PortalEnquiryValidation =
  | { ok: true; values: PortalEnquiryValues }
  | { ok: false; fields: Record<string, string> };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Reads and checks a submission. Pure: no I/O. */
export function validatePortalEnquiry(payload: Record<string, unknown>): PortalEnquiryValidation {
  const values: PortalEnquiryValues = {
    origin: text(payload.origin),
    destination: text(payload.destination),
    mode: text(payload.mode) || "unsure",
    cargoType: text(payload.cargoType),
    weight: text(payload.weight),
    weightUnit: text(payload.weightUnit) || "kg",
    timing: text(payload.timing),
    requirements: text(payload.requirements),
  };

  const fields: Record<string, string> = {};
  for (const [field, max] of Object.entries(fieldLimits)) {
    if (values[field as keyof typeof values].length > max) fields[field] = `Must be ${max} characters or fewer.`;
  }
  if (!values.origin) fields.origin = "Origin is required.";
  if (!values.destination) fields.destination = "Destination is required.";
  if (!allowedModes.has(values.mode)) fields.mode = "Choose a valid freight mode.";
  if (!allowedWeightUnits.has(values.weightUnit)) fields.weightUnit = "Choose a valid weight unit.";
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, values };
}

/**
 * One shared budget for every request an account raises, from either door:
 * a compromised account should not be able to flood the enquiry pipeline.
 */
export function checkPortalRequestRateLimit(session: PortalSession) {
  return checkQuoteRateLimit({
    subjects: [{ policy: quoteRateLimitPolicies.contact, value: session.email }],
    store: firestoreQuoteRateLimitStore(),
  });
}

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `KCPL-Q-${date}-${suffix}`;
}

/** Saves a checked enquiry; returns its reference. Throws if it could not be saved. */
export async function createPortalEnquiry(session: PortalSession, values: PortalEnquiryValues, source: "customer_portal" | "customer_app") {
  const reference = createReference();
  const now = new Date().toISOString();
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
      source,
      portal_customer_id: session.customerId,
      portal_submitted_by_email: session.email,
      portal_submitted_at: now,
    });
  return reference;
}
