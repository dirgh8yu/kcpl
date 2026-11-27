import type { QuoteAttribution } from "../../quote-attribution";

/*
 * The document written to `quotes/{reference}`.
 *
 * It lives outside the route so the stored shape can be asserted in a test
 * without Firestore: the attribution block, including the lane page that handed
 * the reader over, is part of the record and not only of the request.
 */

/** The enquiry as validated by the route, before it becomes a document. */
export type CleanQuote = {
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

export type QuoteCrmMatch = { id: string; display_name: string; reason: string };

export type QuoteRecordInput = {
  reference: string;
  createdAt: string;
  quote: CleanQuote;
  attribution: QuoteAttribution | null;
  crmMatches: QuoteCrmMatch[];
};

export function buildQuoteRecord({ reference, createdAt, quote, attribution, crmMatches }: QuoteRecordInput) {
  return {
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
    attribution,
  };
}
