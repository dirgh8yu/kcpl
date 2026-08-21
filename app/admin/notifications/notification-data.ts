import type { AutomationAlertSeverity } from "../alerts/alert-data";
import type { KcplBranch } from "../crm/crm-data";

export const notificationCategories = ["assignments", "tasks", "shipments", "customs", "documents", "finance", "quotes"] as const;
export type NotificationCategory = (typeof notificationCategories)[number];

export const notificationEmailModes = ["in_app", "important", "critical_only"] as const;
export type NotificationEmailMode = (typeof notificationEmailModes)[number];

export type NotificationPreferences = {
  email_mode: NotificationEmailMode;
  categories: Record<NotificationCategory, boolean>;
};

export type OperationsNotification = {
  id: string;
  source: "alert" | "direct";
  source_id: string;
  category: NotificationCategory;
  severity: AutomationAlertSeverity;
  title: string;
  detail: string;
  action_path: string;
  branch: KcplBranch | null;
  created_at: string;
  resolved: boolean;
  read_at: string | null;
};

export const notificationCategoryLabels: Record<NotificationCategory, string> = {
  assignments: "Assignments",
  tasks: "Tasks",
  shipments: "Shipments",
  customs: "Customs",
  documents: "Documents",
  finance: "Finance",
  quotes: "Quotes",
};

export const notificationEmailModeLabels: Record<NotificationEmailMode, string> = {
  in_app: "In-app only",
  important: "Email + in-app",
  critical_only: "Critical email only",
};

export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    email_mode: "important",
    categories: {
      assignments: true,
      tasks: true,
      shipments: true,
      customs: true,
      documents: true,
      finance: true,
      quotes: true,
    },
  };
}
