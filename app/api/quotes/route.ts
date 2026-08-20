import { firebaseAdminDb } from "../../firebase-admin.server";
import { findCrmDuplicates } from "../../admin/crm/crm-data.server";
import { isTrustedSameOriginRequest } from "../../request-security";

const allowedModes = new Set(["air", "sea", "road", "unsure"]);
const allowedWeightUnits = new Set(["kg", "tonnes", "lb"]);
const allowedDimensionUnits = new Set(["cm", "m", "in"]);

const fieldLimits = {
  origin: 120,
  destination: 120,
  cargoType: 160,
  weight: 40,
  length: 40,
  width: 40,
  height: 40,
  timing: 120,
  requirements: 3000,
  contactName: 120,
  contactEmail: 254,
  companyName: 160,
  phone: 80,
} as const;

type QuotePayload = {
  origin?: unknown;
  destination?: unknown;
  mode?: unknown;
  cargoType?: unknown;
  weight?: unknown;
  weightUnit?: unknown;
  length?: unknown;
  width?: unknown;
  height?: unknown;
  dimensionUnit?: unknown;
  timing?: unknown;
  requirements?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  companyName?: unknown;
  phone?: unknown;
  website?: unknown;
};

type CleanQuote = {
  origin: string;
  destination: string;
  mode: string;
  cargoType: string;
  weight: string;
  weightUnit: string;
  length: string;
  width: string;
  height: string;
  dimensionUnit: string;
  timing: string;
  requirements: string;
  contactName: string;
  contactEmail: string;
  companyName: string;
  phone: string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validate(payload: QuotePayload): { data?: CleanQuote; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const values = {
    origin: text(payload.origin),
    destination: text(payload.destination),
    mode: text(payload.mode),
    cargoType: text(payload.cargoType),
    weight: text(payload.weight),
    weightUnit: text(payload.weightUnit) || "kg",
    length: text(payload.length),
    width: text(payload.width),
    height: text(payload.height),
    dimensionUnit: text(payload.dimensionUnit) || "cm",
    timing: text(payload.timing),
    requirements: text(payload.requirements),
    contactName: text(payload.contactName),
    contactEmail: text(payload.contactEmail).toLowerCase(),
    companyName: text(payload.companyName),
    phone: text(payload.phone),
  };

  for (const [field, max] of Object.entries(fieldLimits)) {
    const value = values[field as keyof typeof values];
    if (value.length > max) errors[field] = `Must be ${max} characters or fewer.`;
  }

  if (!values.origin) errors.origin = "Origin is required.";
  if (!values.destination) errors.destination = "Destination is required.";
  if (!values.contactName) errors.contactName = "Name is required.";
  if (!values.contactEmail) errors.contactEmail = "Email is required.";
  if (!allowedModes.has(values.mode)) errors.mode = "Choose a valid freight mode.";
  if (!allowedWeightUnits.has(values.weightUnit)) errors.weightUnit = "Choose a valid weight unit.";
  if (!allowedDimensionUnits.has(values.dimensionUnit)) errors.dimensionUnit = "Choose a valid dimension unit.";
  if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) errors.contactEmail = "Enter a valid email address.";

  if (Object.keys(errors).length) return { errors };
  return { data: values };
}

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `KCPL-Q-${date}-${suffix}`;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "Send the enquiry as JSON." }, 415);
  }

  if (!isTrustedSameOriginRequest(request)) {
    return json({ ok: false, error: "Cross-origin submissions are not accepted." }, 403);
  }

  let payload: QuotePayload;
  try {
    payload = await request.json() as QuotePayload;
  } catch {
    return json({ ok: false, error: "The enquiry could not be read." }, 400);
  }

  if (text(payload.website)) {
    return json({ ok: false, error: "The enquiry could not be submitted." }, 400);
  }

  const validated = validate(payload);
  if (!validated.data) {
    return json({ ok: false, error: "Please check the highlighted details.", fields: validated.errors }, 400);
  }

  if (!(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)) {
    return json({ ok: false, error: "Quote storage is not configured yet. Please email KCPL instead." }, 503);
  }

  const quote = validated.data;
  const reference = createReference();
  const createdAt = new Date().toISOString();
  let crmMatches: Array<{ id: string; display_name: string; reason: string }> = [];

  try {
    crmMatches = await findCrmDuplicates({
      displayName: quote.companyName || quote.contactName,
      primaryEmail: quote.contactEmail,
      primaryPhone: quote.phone,
      taxId: "",
    });
  } catch (error) {
    console.error("CRM matching skipped for quote", reference, error);
  }

  try {
    await firebaseAdminDb().collection("quotes").doc(reference).create({
      reference,
      created_at: createdAt,
      updated_at: createdAt,
      status: "new",
      assigned_to: null,
      note_count: 0,
      origin: quote.origin,
      destination: quote.destination,
      mode: quote.mode,
      cargo_type: quote.cargoType || null,
      weight: quote.weight || null,
      weight_unit: quote.weightUnit,
      length: quote.length || null,
      width: quote.width || null,
      height: quote.height || null,
      dimension_unit: quote.dimensionUnit,
      timing: quote.timing || null,
      requirements: quote.requirements || null,
      contact_name: quote.contactName,
      contact_email: quote.contactEmail,
      company_name: quote.companyName || null,
      phone: quote.phone || null,
      quote_currency: "USD",
      quoted_amount: null,
      internal_cost: null,
      valid_until: null,
      customer_quote_note: null,
      shipment_reference: null,
      customer_id: null,
      crm_match_state: crmMatches.length ? "suggested" : "unmatched",
      crm_match_ids: crmMatches.map((match) => match.id),
      crm_matches: crmMatches,
      crm_linked_at: null,
      crm_linked_by_name: null,
      crm_linked_by_email: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to save KCPL Firestore quote enquiry", { message });
    return json({ ok: false, error: "KCPL could not save the enquiry. Please try again or email us directly." }, 500);
  }

  return json({
    ok: true,
    reference,
    message: "Your freight enquiry has been received by KCPL.",
  }, 201);
}
