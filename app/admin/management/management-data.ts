import type { CrmCurrency, KcplBranch } from "../crm/crm-data";

export const managementRangeKeys = ["today", "7d", "month", "quarter", "year", "all", "custom"] as const;
export type ManagementRangeKey = (typeof managementRangeKeys)[number];

export type ManagementRange = {
  key: ManagementRangeKey;
  label: string;
  from: string | null;
  to: string | null;
};

export type CurrencyFinancialMetric = {
  currency: CrmCurrency;
  revenue: number;
  cost: number;
  profit: number;
  margin_percent: number | null;
  receivables: number;
  overdue_receivables: number;
  payables: number;
  overdue_payables: number;
  invoice_count: number;
  cost_item_count: number;
};

export type BranchPerformance = {
  branch: KcplBranch;
  currency: CrmCurrency;
  revenue: number;
  cost: number;
  profit: number;
  margin_percent: number | null;
  active_jobs: number;
  invoice_count: number;
};

export type CustomerPerformance = {
  customer_id: string;
  customer_name: string;
  currency: CrmCurrency;
  revenue: number;
  cost: number;
  profit: number;
  margin_percent: number | null;
  invoice_count: number;
  shipment_count: number;
};

export type JobPerformance = {
  shipment_reference: string;
  customer_id: string | null;
  customer_name: string;
  branch: KcplBranch;
  origin: string;
  destination: string;
  mode: string;
  status: string;
  currency: CrmCurrency;
  revenue: number;
  cost: number;
  profit: number;
  margin_percent: number | null;
};

export type RoutePerformance = {
  origin: string;
  destination: string;
  mode: string;
  currency: CrmCurrency;
  revenue: number;
  cost: number;
  profit: number;
  margin_percent: number | null;
  jobs: number;
};

export type TrendPoint = {
  month: string;
  currency: CrmCurrency;
  revenue: number;
  cost: number;
  profit: number;
};

export type ConcentrationRisk = {
  currency: CrmCurrency;
  total_revenue: number;
  top_customer_name: string | null;
  top_customer_share_percent: number;
  top_five_share_percent: number;
};

export type StaffWorkload = {
  staff_name: string;
  staff_email: string | null;
  active_jobs: number;
  urgent_jobs: number;
  open_tasks: number;
  overdue_tasks: number;
};

export type ManagementAnalytics = {
  generated_at: string;
  range: ManagementRange;
  financials: CurrencyFinancialMetric[];
  branches: BranchPerformance[];
  customers: CustomerPerformance[];
  jobs: JobPerformance[];
  loss_making_jobs: JobPerformance[];
  routes: RoutePerformance[];
  trends: TrendPoint[];
  concentration: ConcentrationRisk[];
  staff_workload: StaffWorkload[];
  quote_total: number;
  quote_won: number;
  quote_lost: number;
  quote_conversion_percent: number;
  active_shipments: number;
  delivered_in_period: number;
  urgent_shipments: number;
  exception_shipments: number;
  customs_blocked_shipments: number;
  unassigned_shipments: number;
};
