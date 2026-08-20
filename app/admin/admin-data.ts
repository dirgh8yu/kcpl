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
  contact_name: string;
  company_name: string | null;
  assigned_to: string | null;
  note_count: number;
};

export type QuoteNote = {
  id: number;
  quote_reference: string;
  note: string;
  author_name: string;
  author_email: string;
  created_at: string;
};

export type QuoteDetail = QuoteSummary & {
  cargo_type: string | null;
  weight: string | null;
  weight_unit: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  dimension_unit: string | null;
  timing: string | null;
  requirements: string | null;
  contact_email: string;
  phone: string | null;
  quote_currency: QuoteCurrency;
  quoted_amount: string | null;
  internal_cost: string | null;
  valid_until: string | null;
  customer_quote_note: string | null;
  shipment: ShipmentDetail | null;
  notes: QuoteNote[];
};

export type QuoteCommercialInput = {
  currency: QuoteCurrency;
  quotedAmount: string;
  internalCost: string;
  validUntil: string;
  customerNote: string;
};
