import { createHash, randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { listAutomationAlerts } from "../alerts/alert-engine.server";
import type { AutomationAlert, AutomationAlertType } from "../alerts/alert-data";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import {
  defaultNotificationPreferences,
  notificationCategories,
  notificationEmailModes,
  type NotificationCategory,
  type NotificationPreferences,
  type OperationsNotification,
} from "./notification-data";

export type DirectNotificationInput = {
  targetEmail: string;
  targetName?: string | null;
  category: NotificationCategory;
  severity?: "info" | "warning" | "critical";
  title: string;
  detail: string;
  actionPath: string;
  branch?: KcplBranch | null;
  parentReference?: string | null;
  sourceType?: string;
  sourceId?: string | null;
};

export type StoredDirectNotification = DirectNotificationInput & {
  id: string;
  createdAt: string;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

function categoryValue(value: unknown): NotificationCategory {
  return notificationCategories.includes(value as NotificationCategory) ? value as NotificationCategory : "shipments";
}

function receiptId(notificationId: string) {
  return createHash("sha256").update(notificationId).digest("hex").slice(0, 40);
}

function directId() {
  return `notification-${Date.now()}-${randomBytes(5).toString("hex")}`;
}

function alertCategory(type: AutomationAlertType): NotificationCategory {
  if (type === "job_task_overdue") return "tasks";
  if (type === "eta_customs_blocked" || type === "customs_open") return "customs";
  if (type === "required_document_missing" || type === "pod_missing") return "documents";
  if (type === "invoice_overdue" || type === "payable_overdue" || type === "credit_limit_exceeded") return "finance";
  if (type === "quote_stale") return "quotes";
  if (type === "shipment_unassigned") return "assignments";
  return "shipments";
}

function prefsFromData(data: Record<string, unknown> | undefined): NotificationPreferences {
  const defaults = defaultNotificationPreferences();
  if (!data) return defaults;
  const rawMode = text(data.email_mode);
  const emailMode = notificationEmailModes.includes(rawMode as NotificationPreferences["email_mode"])
    ? rawMode as NotificationPreferences["email_mode"]
    : defaults.email_mode;
  const rawCategories = typeof data.categories === "object" && data.categories !== null
    ? data.categories as Record<string, unknown>
    : {};
  return {
    email_mode: emailMode,
    categories: Object.fromEntries(notificationCategories.map((category) => [category, rawCategories[category] !== false])) as NotificationPreferences["categories"],
  };
}

export async function getNotificationPreferences(uid: string) {
  if (!firebaseRuntimeConfigured()) return defaultNotificationPreferences();
  const snapshot = await firebaseAdminDb().collection("staff_notification_settings").doc(uid).get();
  return prefsFromData(snapshot.exists ? snapshot.data() as Record<string, unknown> : undefined);
}

export async function saveNotificationPreferences(uid: string, preferences: NotificationPreferences) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("staff_notification_settings").doc(uid).set({
    email_mode: preferences.email_mode,
    categories: preferences.categories,
    updated_at: now,
  }, { merge: true });
  return { kind: "updated" as const, preferences };
}

export async function createDirectNotification(input: DirectNotificationInput) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const targetEmail = input.targetEmail.trim().toLowerCase();
  if (!targetEmail) return { kind: "invalid_target" as const };
  const id = directId();
  const createdAt = new Date().toISOString();
  await firebaseAdminDb().collection("staff_notifications").doc(id).create({
    target_email: targetEmail,
    target_name: input.targetName?.trim() || null,
    category: input.category,
    severity: input.severity || "info",
    title: input.title.trim(),
    detail: input.detail.trim(),
    action_path: input.actionPath,
    branch: input.branch ?? null,
    parent_reference: input.parentReference ?? null,
    source_type: input.sourceType || "operational",
    source_id: input.sourceId ?? null,
    created_at: createdAt,
  });
  return { kind: "created" as const, notification: { ...input, targetEmail, id, createdAt } satisfies StoredDirectNotification };
}

function directFromDoc(id: string, data: Record<string, unknown>): OperationsNotification {
  const severity = data.severity === "critical" ? "critical" : data.severity === "warning" ? "warning" : "info";
  return {
    id: `direct:${id}`,
    source: "direct",
    source_id: id,
    category: categoryValue(data.category),
    severity,
    title: text(data.title, "KCPL notification"),
    detail: text(data.detail),
    action_path: text(data.action_path, "/admin/command-centre"),
    branch: branchValue(data.branch),
    created_at: text(data.created_at),
    resolved: false,
    read_at: null,
  };
}

function alertNotification(alert: AutomationAlert): OperationsNotification {
  return {
    id: `alert:${alert.id}`,
    source: "alert",
    source_id: alert.id,
    category: alertCategory(alert.type),
    severity: alert.severity,
    title: alert.title,
    detail: alert.detail,
    action_path: alert.action_path,
    branch: alert.branch,
    created_at: alert.last_triggered_at,
    resolved: alert.status === "resolved",
    read_at: alert.status === "acknowledged" || alert.status === "resolved" ? alert.acknowledged_at || alert.resolved_at : null,
  };
}

export async function listOperationsNotifications(context: KcplStaffContext, email: string) {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const normalizedEmail = email.trim().toLowerCase();
  const [alerts, directSnapshot, receiptsSnapshot, preferences] = await Promise.all([
    listAutomationAlerts(context, normalizedEmail, true),
    db.collection("staff_notifications").where("target_email", "==", normalizedEmail).limit(500).get(),
    db.collection("staff_notification_receipts").doc(context.profile.uid).collection("items").limit(1000).get(),
    getNotificationPreferences(context.profile.uid),
  ]);
  if (!alerts) return null;
  const receipts = new Map(receiptsSnapshot.docs.map((doc) => [text(doc.get("notification_id")), text(doc.get("read_at"))]));
  const direct = directSnapshot.docs
    .map((doc) => directFromDoc(doc.id, doc.data() as Record<string, unknown>))
    .filter((item) => !item.branch || staffCanAccessBranch(context, item.branch));
  const combined = [...alerts.map(alertNotification), ...direct]
    .filter((item) => preferences.categories[item.category])
    .map((item) => ({ ...item, read_at: receipts.get(item.id) || item.read_at }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 250);
  return {
    notifications: combined,
    unread_count: combined.filter((item) => !item.read_at && !item.resolved).length,
    preferences,
  };
}

export async function markNotificationRead(uid: string, notificationId: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("staff_notification_receipts").doc(uid).collection("items").doc(receiptId(notificationId)).set({
    notification_id: notificationId,
    read_at: now,
  }, { merge: true });
  return { kind: "updated" as const, read_at: now };
}

export async function markAllNotificationsRead(uid: string, notificationIds: string[]) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const now = new Date().toISOString();
  const db = firebaseAdminDb();
  for (let offset = 0; offset < notificationIds.length; offset += 400) {
    const batch = db.batch();
    for (const notificationId of notificationIds.slice(offset, offset + 400)) {
      const ref = db.collection("staff_notification_receipts").doc(uid).collection("items").doc(receiptId(notificationId));
      batch.set(ref, { notification_id: notificationId, read_at: now }, { merge: true });
    }
    await batch.commit();
  }
  return { kind: "updated" as const, read_at: now };
}
