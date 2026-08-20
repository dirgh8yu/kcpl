export const crmEntityKinds = ["company", "individual"] as const;
export type CrmEntityKind = (typeof crmEntityKinds)[number];

export const crmRelationshipTypes = [
  "customer",
  "supplier",
  "carrier",
  "overseas_agent",
  "customs_agent",
  "partner",
  "other",
] as const;
export type CrmRelationshipType = (typeof crmRelationshipTypes)[number];

export const crmAccountStatuses = ["prospect", "active", "dormant", "on_hold", "blacklisted"] as const;
export type CrmAccountStatus = (typeof crmAccountStatuses)[number];

export const crmLeadStages = [
  "new_lead",
  "contacted",
  "qualified",
  "quote_requested",
  "quote_sent",
  "negotiating",
  "won",
  "lost",
] as const;
export type CrmLeadStage = (typeof crmLeadStages)[number];

export const crmLeadSources = [
  "referral",
  "website",
  "existing_customer",
  "walk_in",
  "agent",
  "staff_referral",
  "social_media",
  "other",
] as const;
export type CrmLeadSource = (typeof crmLeadSources)[number];

export const crmCommunicationPreferences = ["phone", "email", "whatsapp", "wechat", "viber", "other"] as const;
export type CrmCommunicationPreference = (typeof crmCommunicationPreferences)[number];

export const kcplBranches = ["Kathmandu", "Birgunj", "Surkhet", "Nepalgunj", "Raxaul", "Kolkata"] as const;
export type KcplBranch = (typeof kcplBranches)[number];

export const crmCurrencies = ["NPR", "USD", "AUD", "INR", "CNY", "EUR", "GBP", "SGD", "AED", "JPY"] as const;
export type CrmCurrency = (typeof crmCurrencies)[number];

export const crmTaskPriorities = ["low", "normal", "high", "urgent"] as const;
export type CrmTaskPriority = (typeof crmTaskPriorities)[number];

export const crmTaskPriorityLabels: Record<CrmTaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export type CrmAddress = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state_region: string | null;
  postal_code: string | null;
  country: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmContact = {
  id: string;
  customer_id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  communication_preference: CrmCommunicationPreference | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmNote = {
  id: string;
  note: string;
  author_name: string;
  author_email: string;
  created_at: string;
};

export type CrmActivity = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  actor_name: string | null;
  actor_email: string | null;
  created_at: string;
};

export type CrmTask = {
  id: string;
  title: string;
  detail: string | null;
  due_at: string | null;
  priority: CrmTaskPriority;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  completed: boolean;
  completed_at: string | null;
  completed_by_name: string | null;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

export type CrmCommercialProfile = {
  preferred_currency: CrmCurrency;
  payment_terms_days: number | null;
  credit_limit: number | null;
  outstanding_balance: number | null;
  pricing_notes: string | null;
  markup_percent: number | null;
  preferred_carriers: string[];
};

export type CrmCustomerSummary = {
  id: string;
  entity_kind: CrmEntityKind;
  display_name: string;
  legal_name: string | null;
  relationship_types: CrmRelationshipType[];
  account_status: CrmAccountStatus;
  lead_stage: CrmLeadStage;
  lead_source: CrmLeadSource | null;
  primary_email: string | null;
  primary_phone: string | null;
  country: string;
  primary_branch: KcplBranch;
  account_manager_name: string | null;
  account_manager_email: string | null;
  tags: string[];
  quote_count: number;
  active_shipment_count: number;
  completed_shipment_count: number;
  follow_up_count: number;
  revenue_total: number;
  cost_total: number;
  profit_total: number;
  preferred_currency: CrmCurrency;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmCustomerDetail = CrmCustomerSummary & {
  trading_name: string | null;
  website: string | null;
  industry: string | null;
  tax_id: string | null;
  billing_email: string | null;
  transport_preferences: string[];
  internal_summary: string | null;
  commercial: CrmCommercialProfile;
  contacts: CrmContact[];
  addresses: CrmAddress[];
  notes: CrmNote[];
  activity: CrmActivity[];
  tasks: CrmTask[];
};

export type CrmDashboardStats = {
  total: number;
  prospects: number;
  active: number;
  dormant: number;
  onHold: number;
  blacklisted: number;
  followUpsDue: number;
};

export type CrmCreateCustomerInput = {
  entityKind: CrmEntityKind;
  displayName: string;
  legalName: string;
  tradingName: string;
  relationshipTypes: CrmRelationshipType[];
  accountStatus: CrmAccountStatus;
  leadStage: CrmLeadStage;
  leadSource: CrmLeadSource | "";
  primaryEmail: string;
  primaryPhone: string;
  website: string;
  industry: string;
  taxId: string;
  country: string;
  primaryBranch: KcplBranch;
  accountManagerName: string;
  accountManagerEmail: string;
  billingEmail: string;
  preferredCurrency: CrmCurrency;
  paymentTermsDays: string;
  creditLimit: string;
  outstandingBalance: string;
  pricingNotes: string;
  markupPercent: string;
  preferredCarriers: string[];
  transportPreferences: string[];
  tags: string[];
  internalSummary: string;
};

export type CrmDuplicateMatch = {
  id: string;
  display_name: string;
  reason: "name" | "email" | "phone" | "tax_id";
};

export const crmAccountStatusLabels: Record<CrmAccountStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  dormant: "Dormant",
  on_hold: "On hold",
  blacklisted: "Blacklisted",
};

export const crmLeadStageLabels: Record<CrmLeadStage, string> = {
  new_lead: "New lead",
  contacted: "Contacted",
  qualified: "Qualified",
  quote_requested: "Quote requested",
  quote_sent: "Quote sent",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export const crmRelationshipLabels: Record<CrmRelationshipType, string> = {
  customer: "Customer",
  supplier: "Supplier",
  carrier: "Carrier",
  overseas_agent: "Overseas agent",
  customs_agent: "Customs agent",
  partner: "Partner",
  other: "Other",
};
