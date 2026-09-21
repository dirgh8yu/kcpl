import type { AutomationAlertSeverity } from "../alerts/alert-data";
import type { KcplBranch } from "../crm/crm-data";

export const notificationCategories = ["assignments", "tasks", "shipments", "customs", "documents", "finance", "quotes", "activity"] as const;
export type NotificationCategory = (typeof notificationCategories)[number];

export const notificationEmailModes = ["in_app", "important", "critical_only"] as const;
export type NotificationEmailMode = (typeof notificationEmailModes)[number];

/** Workspaces a staff member can subscribe to for register-transition alerts.
 * "register" covers every status change; customs/delivery narrow it to the
 * transitions that touch those desks, so e.g. a customs officer can silence
 * unrelated register churn. */
export const transitionDesks = ["register", "customs", "delivery"] as const;
export type TransitionDesk = (typeof transitionDesks)[number];

export const transitionDeskLabels: Record<TransitionDesk, string> = {
  register: "Register",
  customs: "Customs desk",
  delivery: "Delivery desk",
};

export type NotificationPreferences = {
  email_mode: NotificationEmailMode;
  categories: Record<NotificationCategory, boolean>;
  transition_desks: Record<TransitionDesk, boolean>;
};

export type OperationsNotification = {
  id: string;
  source: "alert" | "direct";
  source_id: string;
  /** Emitter kind for direct notifications (e.g. "register-transition").
   * Alerts and assignment notices leave it unset. */
  source_type?: string | null;
  /** For register transitions: the two endpoint statuses ("<ref>:<from>:<to>"
   * stored source id). Lets the workspace and CSV export show real from/to
   * without parsing the title. Unset on every other notification kind. */
  transition_from?: string;
  transition_to?: string;
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
  activity: "Live activity",
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
      activity: true,
    },
    // Opt-out model: every desk subscribed by default, matching the previous
    // behaviour where all persisted transitions reached the polling staff.
    transition_desks: { register: true, customs: true, delivery: true },
  };
}
