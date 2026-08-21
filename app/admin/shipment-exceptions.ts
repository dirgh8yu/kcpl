import type { KcplBranch } from "./crm/crm-data";

export const shipmentExceptionCategories = [
  "delay",
  "customs",
  "document",
  "damage",
  "shortage",
  "lost_cargo",
  "delivery_refusal",
  "carrier",
  "other",
] as const;
export type ShipmentExceptionCategory = (typeof shipmentExceptionCategories)[number];

export const shipmentExceptionSeverities = ["low", "medium", "high", "critical"] as const;
export type ShipmentExceptionSeverity = (typeof shipmentExceptionSeverities)[number];

export const shipmentExceptionStatuses = ["open", "monitoring", "resolved"] as const;
export type ShipmentExceptionStatus = (typeof shipmentExceptionStatuses)[number];

export type ShipmentException = {
  id: string;
  reference: string;
  category: ShipmentExceptionCategory;
  severity: ShipmentExceptionSeverity;
  status: ShipmentExceptionStatus;
  title: string;
  detail: string | null;
  operational_impact: string | null;
  branch: KcplBranch;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  sla_due_at: string;
  opened_at: string;
  opened_by_name: string | null;
  opened_by_email: string | null;
  updated_at: string;
  updated_by_name: string | null;
  updated_by_email: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolved_by_email: string | null;
  resolution: string | null;
};

export type ShipmentExceptionSummary = {
  total: number;
  open: number;
  monitoring: number;
  resolved: number;
  critical_open: number;
  high_open: number;
  overdue_open: number;
};

export const shipmentExceptionCategoryLabels: Record<ShipmentExceptionCategory, string> = {
  delay: "Delay",
  customs: "Customs issue",
  document: "Document issue",
  damage: "Cargo damage",
  shortage: "Shortage",
  lost_cargo: "Lost cargo",
  delivery_refusal: "Delivery refusal",
  carrier: "Carrier issue",
  other: "Other",
};

export const shipmentExceptionSeverityLabels: Record<ShipmentExceptionSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const shipmentExceptionStatusLabels: Record<ShipmentExceptionStatus, string> = {
  open: "Open",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

const severitySlaHours: Record<ShipmentExceptionSeverity, number> = {
  low: 72,
  medium: 24,
  high: 6,
  critical: 2,
};

export function shipmentExceptionSlaDue(openedAt: string, severity: ShipmentExceptionSeverity) {
  const opened = Date.parse(openedAt);
  if (!Number.isFinite(opened)) return null;
  return new Date(opened + severitySlaHours[severity] * 60 * 60 * 1000).toISOString();
}

export function shipmentExceptionTransitionAllowed(current: ShipmentExceptionStatus, next: ShipmentExceptionStatus) {
  if (current === next) return true;
  if (current === "open") return next === "monitoring" || next === "resolved";
  if (current === "monitoring") return next === "open" || next === "resolved";
  return false;
}

export function shipmentExceptionResolutionValid(next: ShipmentExceptionStatus, resolution: string) {
  if (next !== "resolved") return true;
  return resolution.trim().length >= 12;
}

export function shipmentExceptionIsOverdue(exception: Pick<ShipmentException, "status" | "sla_due_at">, nowIso: string) {
  return exception.status !== "resolved" && Boolean(exception.sla_due_at) && exception.sla_due_at < nowIso;
}

export function summarizeShipmentExceptions(exceptions: ShipmentException[], nowIso: string): ShipmentExceptionSummary {
  return {
    total: exceptions.length,
    open: exceptions.filter((item) => item.status === "open").length,
    monitoring: exceptions.filter((item) => item.status === "monitoring").length,
    resolved: exceptions.filter((item) => item.status === "resolved").length,
    critical_open: exceptions.filter((item) => item.status !== "resolved" && item.severity === "critical").length,
    high_open: exceptions.filter((item) => item.status !== "resolved" && item.severity === "high").length,
    overdue_open: exceptions.filter((item) => shipmentExceptionIsOverdue(item, nowIso)).length,
  };
}
