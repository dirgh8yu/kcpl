import type { CrmCurrency, KcplBranch } from "../crm/crm-data";

export const partnerTypes = [
  "overseas_counterpart",
  "shipping_line",
  "airline",
  "transporter",
  "customs_agent",
  "clearing_partner",
  "warehouse",
  "terminal",
  "supplier",
  "insurance",
  "other",
] as const;
export type PartnerType = (typeof partnerTypes)[number];

export const partnerTypeLabels: Record<PartnerType, string> = {
  overseas_counterpart: "Overseas counterpart",
  shipping_line: "Shipping line",
  airline: "Airline",
  transporter: "Transporter",
  customs_agent: "Customs agent",
  clearing_partner: "Clearing partner",
  warehouse: "Warehouse",
  terminal: "Terminal / depot",
  supplier: "Supplier",
  insurance: "Insurance",
  other: "Other",
};

export const partnerModes = ["air", "sea", "road", "rail", "customs", "warehousing", "multimodal"] as const;
export type PartnerMode = (typeof partnerModes)[number];
export const partnerModeLabels: Record<PartnerMode, string> = {
  air: "Air",
  sea: "Sea",
  road: "Road",
  rail: "Rail",
  customs: "Customs",
  warehousing: "Warehousing",
  multimodal: "Multimodal",
};

export const partnerStatuses = ["active", "on_hold", "inactive"] as const;
export type PartnerStatus = (typeof partnerStatuses)[number];
export const partnerStatusLabels: Record<PartnerStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  inactive: "Inactive",
};

export type PartnerOwnerBranch = KcplBranch | "Global";

export type PartnerCurrencyAmount = {
  currency: CrmCurrency;
  amount: number;
};

export type PartnerRecord = {
  id: string;
  display_name: string;
  legal_name: string | null;
  normalized_name: string;
  types: PartnerType[];
  modes: PartnerMode[];
  status: PartnerStatus;
  preferred: boolean;
  country: string;
  owner_branch: PartnerOwnerBranch;
  cities_served: string[];
  countries_served: string[];
  ports_served: string[];
  primary_contact_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  whatsapp: string | null;
  website: string | null;
  preferred_currency: CrmCurrency;
  payment_terms_days: number;
  service_rating: number | null;
  registration_number: string | null;
  tax_id: string | null;
  contract_reference: string | null;
  contract_expiry_date: string | null;
  document_url: string | null;
  commercial_terms: string | null;
  internal_notes: string | null;
  tags: string[];
  created_at: string;
  created_by_name: string;
  created_by_email: string;
  updated_at: string;
  updated_by_name: string;
  updated_by_email: string;
  payable_open: PartnerCurrencyAmount[];
  payable_spend: PartnerCurrencyAmount[];
  bill_count: number;
  overdue_bill_count: number;
  shipment_count: number;
  last_activity_at: string | null;
};

export type PartnerDashboard = {
  generated_at: string;
  partners: PartnerRecord[];
  active_count: number;
  preferred_count: number;
  country_count: number;
  unlinked_supplier_bills: number;
  open_payables: PartnerCurrencyAmount[];
};

export type PartnerInput = {
  displayName: string;
  legalName: string;
  types: PartnerType[];
  modes: PartnerMode[];
  status: PartnerStatus;
  preferred: boolean;
  country: string;
  ownerBranch: PartnerOwnerBranch;
  citiesServed: string[];
  countriesServed: string[];
  portsServed: string[];
  primaryContactName: string;
  primaryEmail: string;
  primaryPhone: string;
  whatsapp: string;
  website: string;
  preferredCurrency: CrmCurrency;
  paymentTermsDays: number;
  serviceRating: number | null;
  registrationNumber: string;
  taxId: string;
  contractReference: string;
  contractExpiryDate: string;
  documentUrl: string;
  commercialTerms: string;
  internalNotes: string;
  tags: string[];
};

export type PartnerOption = {
  id: string;
  name: string;
  currency: CrmCurrency;
  payment_terms_days: number;
};
