import type { ShipmentDetail } from "../shipment-types";

export const quoteStatuses = ["new", "reviewing", "quoted", "won", "lost"] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteCurrencies = ["USD", "AUD", "NPR", "INR", "CNY", "EUR", "GBP", "SGD", "AED", "JPY"] as const;
export type QuoteCurrency = (typeof quoteCurrencies)[number];

export type QuoteSummary = {
  reference: string;
  created_at: string;
  status: QuoteStatus;
  origin: string;
  destination: string;
  mode: string;
  cargo_type: string | null;
  contact_name: string;
  contact_email: string;
  company_name: string | null;
  phone: string | null;
  customer_id: string | null;
  assigned_to: string | null;
  assigned_to_uid: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_phone: string | null;
  note_count: number;
  email_count: number;
  last_customer_email_at: string | null;
};

export type QuoteNote = {
  id: number;
  quote_reference: string;
  note: string;
  author_name: string;
  author_email: string;
  created_at: string;
};

export type QuoteCommunication = {
  id: string;
  quote_reference: string;
  type: "quote_email" | string;
  channel: "email" | string;
  direction: "outbound" | "inbound" | string;
  to: string;
  from: string;
  subject: string;
  provider: string;
  provider_message_id: string | null;
  status: string;
  sent_at: string;
  actor_name: string;
  actor_email: string;
  created_at: string;
};

export type QuoteCrmMatch = {
  id: string;
  display_name: string;
  reason: string;
};

export type QuoteDetail = QuoteSummary & {
  weight: string | null;
  weight_unit: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  dimension_unit: string | null;
  timing: string | null;
  requirements: string | null;
  quote_currency: QuoteCurrency;
  quoted_amount: string | null;
  internal_cost: string | null;
  valid_until: string | null;
  customer_quote_note: string | null;
  crm_match_state: string | null;
  crm_matches: QuoteCrmMatch[];
  shipment: ShipmentDetail | null;
  notes: QuoteNote[];
  communications: QuoteCommunication[];
};

export type QuoteCommercialInput = {
  currency: QuoteCurrency;
  quotedAmount: string;
  internalCost: string;
  validUntil: string;
  customerNote: string;
};
