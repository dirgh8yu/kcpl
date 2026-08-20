import type { KcplBranch } from "../crm/crm-data";
import type { KcplStaffRole } from "../staff-permissions";

export const automationAlertTypes = [
  "job_task_overdue",
  "shipment_exception",
  "eta_customs_blocked",
  "quote_stale",
  "credit_limit_exceeded",
] as const;
export type AutomationAlertType = (typeof automationAlertTypes)[number];

export const automationAlertSeverities = ["info", "warning", "critical"] as const;
export type AutomationAlertSeverity = (typeof automationAlertSeverities)[number];

export const automationAlertStatuses = ["open", "acknowledged", "resolved"] as const;
export type AutomationAlertStatus = (typeof automationAlertStatuses)[number];

export type AutomationAlert = {
  id: string;
  fingerprint: string;
  type: AutomationAlertType;
  severity: AutomationAlertSeverity;
  status: AutomationAlertStatus;
  title: string;
  detail: string;
  entity_type: "shipment" | "quote" | "customer" | "task";
  entity_id: string;
  parent_reference: string | null;
  branch: KcplBranch | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  target_roles: KcplStaffRole[];
  action_path: string;
  first_triggered_at: string;
  last_triggered_at: string;
  escalated_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  acknowledged_by_email: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolved_by_email: string | null;
};

export const automationAlertTypeLabels: Record<AutomationAlertType, string> = {
  job_task_overdue: "Overdue task",
  shipment_exception: "Shipment exception",
  eta_customs_blocked: "ETA / customs risk",
  quote_stale: "Quote follow-up",
  credit_limit_exceeded: "Credit control",
};
