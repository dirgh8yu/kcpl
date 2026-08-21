import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "../../integrations/sendgrid-email.server";
import type { AutomationAlert, AutomationAlertType } from "../alerts/alert-data";
import type { KcplBranch } from "../crm/crm-data";
import { listStaffProfiles } from "../staff-directory.server";
import type { KcplStaffProfile } from "../staff-directory";
import { createDirectNotification, getNotificationPreferences, type DirectNotificationInput } from "./notification-centre.server";
import type { NotificationCategory, NotificationPreferences } from "./notification-data";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
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

function alertFromDoc(id: string, data: Record<string, unknown>): AutomationAlert {
  const severity = data.severity === "critical" ? "critical" : data.severity === "warning" ? "warning" : "info";
  const status = data.status === "resolved" ? "resolved" : data.status === "acknowledged" ? "acknowledged" : "open";
  return {
    id,
    fingerprint: text(data.fingerprint, id),
    type: text(data.type) as AutomationAlertType,
    severity,
    status,
    title: text(data.title, "KCPL operational alert"),
    detail: text(data.detail),
    entity_type: text(data.entity_type, "shipment") as AutomationAlert["entity_type"],
    entity_id: text(data.entity_id),
    parent_reference: nullable(data.parent_reference),
    branch: nullable(data.branch) as KcplBranch | null,
    assigned_to_name: nullable(data.assigned_to_name),
    assigned_to_email: nullable(data.assigned_to_email),
    target_roles: Array.isArray(data.target_roles) ? data.target_roles as AutomationAlert["target_roles"] : [],
    action_path: text(data.action_path, "/admin/alerts"),
    first_triggered_at: text(data.first_triggered_at),
    last_triggered_at: text(data.last_triggered_at),
    escalated_at: nullable(data.escalated_at),
    acknowledged_at: nullable(data.acknowledged_at),
    acknowledged_by_name: nullable(data.acknowledged_by_name),
    acknowledged_by_email: nullable(data.acknowledged_by_email),
    resolved_at: nullable(data.resolved_at),
    resolved_by_name: nullable(data.resolved_by_name),
    resolved_by_email: nullable(data.resolved_by_email),
  };
}

function emailAllowed(preferences: NotificationPreferences, category: NotificationCategory, severity: "info" | "warning" | "critical", direct = false) {
  if (!preferences.categories[category] || preferences.email_mode === "in_app") return false;
  if (preferences.email_mode === "critical_only") return severity === "critical";
  if (direct) return category === "assignments" || category === "tasks" || severity !== "info";
  return severity === "warning" || severity === "critical";
}

function profileCanReceiveAlert(profile: KcplStaffProfile, alert: AutomationAlert) {
  if (!profile.active || !alert.target_roles.includes(profile.role)) return false;
  if (alert.assigned_to_email) return profile.email.toLowerCase() === alert.assigned_to_email.toLowerCase();
  if (profile.role === "management" || profile.branch_scope === "all") return true;
  if (!alert.branch) return profile.role === "accounts" || profile.role === "commercial";
  return profile.branches.includes(alert.branch);
}

function deliveryId(key: string) {
  return createHash("sha256").update(key).digest("hex").slice(0, 48);
}

function absoluteActionPath(path: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "";
  return origin && path.startsWith("/") ? `${origin}${path}` : path;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

async function recordShipmentEmail(reference: string | null | undefined, title: string, detail: string, recipient: string, messageId: string | null) {
  if (!reference || !firebaseRuntimeConfigured()) return;
  const shipmentRef = firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase());
  const shipment = await shipmentRef.get();
  if (!shipment.exists) return;
  const now = new Date().toISOString();
  await shipmentRef.collection("job_activity").doc(`notification-email-${Date.now()}-${deliveryId(`${recipient}:${now}`).slice(0, 8)}`).create({
    type: "notification_email_sent",
    title,
    detail,
    actor_name: "KCPL Notifications",
    actor_email: null,
    recipient_email: recipient,
    provider: "sendgrid",
    provider_message_id: messageId,
    created_at: now,
  });
}

async function sendOnce(input: {
  key: string;
  recipient: KcplStaffProfile;
  category: NotificationCategory;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  actionPath: string;
  parentReference?: string | null;
  direct?: boolean;
}) {
  if (!transactionalEmailConfigured()) return { kind: "not_configured" as const };
  const preferences = await getNotificationPreferences(input.recipient.uid);
  if (!emailAllowed(preferences, input.category, input.severity, input.direct)) return { kind: "preferences" as const };
  const db = firebaseAdminDb();
  const ref = db.collection("notification_email_deliveries").doc(deliveryId(input.key));
  const previous = await ref.get();
  if (previous.exists && previous.get("status") === "sent") return { kind: "already_sent" as const };
  const actionUrl = absoluteActionPath(input.actionPath);
  const subjectPrefix = input.severity === "critical" ? "Critical" : input.severity === "warning" ? "Attention" : "Update";
  const subject = `[KCPL ${subjectPrefix}] ${input.title}`;
  try {
    const delivery = await sendTransactionalEmail({
      to: input.recipient.email,
      toName: input.recipient.display_name,
      subject,
      text: `${input.title}\n\n${input.detail}\n\nOpen in KCPL Operations: ${actionUrl}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;color:#342f2b"><p style="font-size:12px;color:#b65f4c;font-weight:700">KCPL Operations</p><h2 style="font-size:20px">${escapeHtml(input.title)}</h2><p style="font-size:14px;line-height:1.6">${escapeHtml(input.detail)}</p><p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#df7159;color:white;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">Open in KCPL Operations</a></p><p style="font-size:11px;color:#8b817a">You are receiving this based on your KCPL notification preferences.</p></div>`,
      category: `kcpl-${input.category}`,
      customArgs: { notification_key: input.key, category: input.category, severity: input.severity },
    });
    await ref.set({
      status: "sent",
      recipient_email: input.recipient.email,
      category: input.category,
      severity: input.severity,
      title: input.title,
      sent_at: delivery.acceptedAt,
      provider_message_id: delivery.messageId,
    }, { merge: true });
    await recordShipmentEmail(input.parentReference, "Staff notification email sent", `${input.title} · sent to ${input.recipient.email}`, input.recipient.email, delivery.messageId);
    return { kind: "sent" as const };
  } catch (error) {
    await ref.set({
      status: "failed",
      recipient_email: input.recipient.email,
      category: input.category,
      severity: input.severity,
      title: input.title,
      failed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message.slice(0, 800) : "Email delivery failed.",
    }, { merge: true });
    console.error("KCPL notification email delivery failed", input.recipient.email, input.title, error);
    return { kind: "failed" as const };
  }
}

export async function publishStaffNotification(input: DirectNotificationInput) {
  const created = await createDirectNotification(input);
  if (created.kind !== "created") return created;
  try {
    const profiles = await listStaffProfiles();
    const recipient = profiles?.find((profile) => profile.active && profile.email.toLowerCase() === created.notification.targetEmail.toLowerCase());
    if (recipient) {
      await sendOnce({
        key: `direct:${created.notification.id}:${recipient.email}`,
        recipient,
        category: input.category,
        severity: input.severity || "info",
        title: input.title,
        detail: input.detail,
        actionPath: input.actionPath,
        parentReference: input.parentReference,
        direct: true,
      });
    }
  } catch (error) {
    console.error("KCPL direct notification email dispatch failed", error);
  }
  return created;
}

export async function dispatchPendingAlertEmails() {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!transactionalEmailConfigured()) return { kind: "not_configured" as const, sent: 0 };
  const [snapshot, profiles] = await Promise.all([
    firebaseAdminDb().collection("alerts").orderBy("last_triggered_at", "desc").limit(1000).get(),
    listStaffProfiles(),
  ]);
  if (!profiles) return { kind: "unavailable" as const };
  const activeAlerts = snapshot.docs
    .map((doc) => alertFromDoc(doc.id, doc.data() as Record<string, unknown>))
    .filter((alert) => alert.status !== "resolved" && (alert.severity === "warning" || alert.severity === "critical"));
  let sent = 0;
  for (const alert of activeAlerts) {
    const category = alertCategory(alert.type);
    const recipients = profiles.filter((profile) => profileCanReceiveAlert(profile, alert)).slice(0, 30);
    for (const recipient of recipients) {
      const revision = alert.severity === "critical" && alert.escalated_at ? alert.escalated_at : alert.first_triggered_at;
      const result = await sendOnce({
        key: `alert:${alert.id}:${recipient.email}:${alert.severity}:${revision}`,
        recipient,
        category,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        actionPath: alert.action_path,
        parentReference: alert.parent_reference || (alert.entity_type === "shipment" ? alert.entity_id : null),
      });
      if (result.kind === "sent") sent += 1;
    }
  }
  return { kind: "completed" as const, sent };
}
