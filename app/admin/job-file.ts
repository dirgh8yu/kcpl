import type { KcplBranch, CrmCurrency } from "./crm/crm-data";
import type { ShipmentStatus } from "../shipment-types";

export const jobPriorities = ["standard", "high", "urgent"] as const;
export type JobPriority = (typeof jobPriorities)[number];

export const jobCostCategories = ["freight", "customs", "transport", "handling", "storage", "documentation", "agent", "other"] as const;
export type JobCostCategory = (typeof jobCostCategories)[number];

export type JobTask = {
  id: string;
  title: string;
  detail: string | null;
  branch: KcplBranch;
  due_at: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_phone: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  created_by: string;
};

export type CustomsStep = {
  id: string;
  title: string;
  detail: string | null;
  branch: KcplBranch;
  required: boolean;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
};

export type JobCost = {
  id: string;
  category: JobCostCategory;
  label: string;
  vendor: string | null;
  amount: number;
  currency: CrmCurrency;
  notes: string | null;
  source_type: "manual" | "payable";
  source_reference: string | null;
  locked: boolean;
  created_at: string;
  created_by: string;
};

export type DigitalJobFile = {
  reference: string;
  quote_reference: string;
  customer_id: string | null;
  customer_name: string | null;
  status: ShipmentStatus;
  origin: string;
  destination: string;
  mode: string;
  eta: string | null;
  current_location: string | null;
  carrier: string | null;
  carrier_reference: string | null;
  primary_branch: KcplBranch;
  handling_branches: KcplBranch[];
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_phone: string | null;
  priority: JobPriority;
  internal_reference: string | null;
  internal_notes: string | null;
  tasks: JobTask[];
  customs_steps: CustomsStep[];
  costs: JobCost[];
  cost_totals: Partial<Record<CrmCurrency, number>>;
  revenue_totals: Partial<Record<CrmCurrency, number>>;
  profit_totals: Partial<Record<CrmCurrency, number>>;
  margin_percent: Partial<Record<CrmCurrency, number>>;
  can_view_costs: boolean;
  updated_at: string;
};

export const jobPriorityLabels: Record<JobPriority, string> = {
  standard: "Standard",
  high: "High",
  urgent: "Urgent",
};

export const jobCostCategoryLabels: Record<JobCostCategory, string> = {
  freight: "Freight",
  customs: "Customs",
  transport: "Transport",
  handling: "Handling",
  storage: "Storage",
  documentation: "Documentation",
  agent: "Agent / counterpart",
  other: "Other",
};