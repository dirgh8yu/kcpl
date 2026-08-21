import type { CrmCurrency, KcplBranch } from "../crm/crm-data";
import type { PayableStatus } from "../payables/payables-data";
import type { ShipmentStatus } from "../../shipment-types";
import type { PartnerRecord } from "./partners-data";

export type PartnerFinanceSummary = {
  currency: CrmCurrency;
  billed: number;
  paid: number;
  outstanding: number;
  overdue: number;
  bill_count: number;
  open_bill_count: number;
  overdue_bill_count: number;
};

export type PartnerBillSummary = {
  reference: string;
  supplier_bill_reference: string | null;
  shipment_reference: string | null;
  branch: KcplBranch | null;
  status: PayableStatus;
  bill_date: string;
  due_date: string;
  currency: CrmCurrency;
  total: number;
  amount_paid: number;
  balance_due: number;
  description: string;
  updated_at: string;
  legacy_name_link: boolean;
};

export type PartnerJobSummary = {
  reference: string;
  quote_reference: string | null;
  status: ShipmentStatus;
  primary_branch: KcplBranch | null;
  handling_branches: KcplBranch[];
  customer_id: string | null;
  origin: string | null;
  destination: string | null;
  mode: string | null;
  current_location: string | null;
  eta: string | null;
  updated_at: string;
};

export type PartnerActivityItem = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  actor_name: string | null;
  actor_email: string | null;
  created_at: string;
};

export type Partner360Snapshot = {
  generated_at: string;
  partner: PartnerRecord;
  finance_summaries: PartnerFinanceSummary[];
  bills: PartnerBillSummary[];
  jobs: PartnerJobSummary[];
  activity: PartnerActivityItem[];
  legacy_name_linked_bill_count: number;
  finance_integrity_warning_count: number;
};
