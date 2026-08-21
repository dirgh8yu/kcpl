import type { KcplBranch } from "./crm/crm-data";

export const shipmentActivityCategories = [
  "shipment",
  "ownership",
  "task",
  "customs",
  "document",
  "finance",
  "alert",
  "workflow",
] as const;

export type ShipmentActivityCategory = (typeof shipmentActivityCategories)[number];
export type ShipmentActivityTone = "neutral" | "info" | "warning" | "danger" | "success" | "violet";

export type ShipmentActivityItem = {
  id: string;
  category: ShipmentActivityCategory;
  title: string;
  detail: string | null;
  occurred_at: string;
  actor_name: string | null;
  actor_email: string | null;
  branch: KcplBranch | null;
  source: string;
  tone: ShipmentActivityTone;
};

export type ShipmentActivityTimeline = {
  reference: string;
  generated_at: string;
  items: ShipmentActivityItem[];
};

export const shipmentActivityCategoryLabels: Record<ShipmentActivityCategory, string> = {
  shipment: "Movement",
  ownership: "Ownership",
  task: "Tasks",
  customs: "Customs",
  document: "Documents",
  finance: "Finance",
  alert: "Alerts",
  workflow: "Workflow",
};
