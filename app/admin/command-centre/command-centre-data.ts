import type { KcplBranch } from "../crm/crm-data";
import type { ShipmentStatus } from "../../shipment-types";
import type { JobPriority } from "../job-file";

export type CommandCentreJob = {
  reference: string;
  quote_reference: string;
  customer_id: string | null;
  customer_name: string;
  origin: string;
  destination: string;
  mode: string;
  status: ShipmentStatus;
  primary_branch: KcplBranch;
  handling_branches: KcplBranch[];
  assigned_to_uid: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_phone: string | null;
  priority: JobPriority;
  eta: string | null;
  current_location: string | null;
  carrier: string | null;
  open_tasks: number;
  overdue_tasks: number;
  required_customs_open: number;
  required_customs_total: number;
  updated_at: string;
};

export type CommandCentreBranchLoad = {
  branch: KcplBranch;
  active_jobs: number;
  urgent_jobs: number;
  overdue_tasks: number;
  customs_blockers: number;
  deliveries_today: number;
};

export type CommandCentreStaffLoad = {
  key: string;
  uid: string | null;
  name: string;
  email: string;
  phone: string | null;
  active_jobs: number;
  urgent_jobs: number;
  open_tasks: number;
  overdue_tasks: number;
};

export type CommandCentreTotals = {
  active_jobs: number;
  urgent_jobs: number;
  overdue_tasks: number;
  customs_blockers: number;
  deliveries_today: number;
  unassigned_jobs: number;
  exception_jobs: number;
};

export type CommandCentreData = {
  generated_at: string;
  operational_date: string;
  accessible_branches: KcplBranch[];
  totals: CommandCentreTotals;
  jobs: CommandCentreJob[];
  branch_load: CommandCentreBranchLoad[];
  staff_load: CommandCentreStaffLoad[];
};
