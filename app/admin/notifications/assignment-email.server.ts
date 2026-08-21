import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "../../integrations/sendgrid-email.server";
import { staffCapabilitiesForRole } from "../staff-permissions";
import { listStaffProfiles, type KcplStaffContext } from "../staff-directory.server";
import type { KcplStaffProfile } from "../staff-directory";
import { listCurrentStaffAssignmentNotifications } from "./assignment-notifications.server";
import { getNotificationPreferences } from "./notification-centre.server";
import type { OperationsNotification } from "./notification-data";

function deliveryId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 48);
}

function contextForProfile(profile: KcplStaffProfile): KcplStaffContext {
  const allBranches = profile.role === "management" || profile.branch_scope === "all";
  return {
    profile,
    permissions: staffCapabilitiesForRole(profile.role),
    can_access_all_branches: allBranches,
    branches: profile.branches,
  };
}

function absoluteActionPath(path: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "";
  return origin && path.startsWith("/") ? `${origin}${path}` : path;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

async function recordShipmentEmail(item: OperationsNotification, recipient: string, messageId: string | null) {
  if (!item.action_path.startsWith("/admin/jobs/") || !firebaseRuntimeConfigured()) return;
  const reference = decodeURIComponent(item.action_path.slice("/admin/jobs/".length).split("/")[0]);
  if (!reference) return;
  const ref = firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase());
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  const now = new Date().toISOString();
  await ref.collection("job_activity").doc(`assignment-email-${Date.now()}-${deliveryId(`${recipient}:${item.id}`).slice(0, 8)}`).create({
    type: "notification_email_sent",
    title: "Staff assignment email sent",
    detail: `${item.title} · sent to ${recipient}`,
    actor_name: "KCPL Notifications",
    actor_email: null,
    recipient_email: recipient,
    provider: "sendgrid",
    provider_message_id: messageId,
    created_at: now,
  });
}

async function sendAssignmentEmail(profile: KcplStaffProfile, item: OperationsNotification) {
  const preferences = await getNotificationPreferences(profile.uid);
  if (preferences.email_mode !== "important" || !preferences.categories[item.category]) return false;
  if (item.resolved) return false;
  const db = firebaseAdminDb();
  const deliveryRef = db.collection("notification_email_deliveries").doc(deliveryId(`assignment:${profile.email}:${item.id}`));
  const previous = await deliveryRef.get();
  if (previous.exists && previous.get("status") === "sent") return false;
  const actionUrl = absoluteActionPath(item.action_path);
  try {
    const delivery = await sendTransactionalEmail({
      to: profile.email,
      toName: profile.display_name,
      subject: `[KCPL Assignment] ${item.title}`,
      text: `${item.title}\n\n${item.detail}\n\nOpen in KCPL Operations: ${actionUrl}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;color:#342f2b"><p style="font-size:12px;color:#b65f4c;font-weight:700">KCPL Operations</p><h2 style="font-size:20px">${escapeHtml(item.title)}</h2><p style="font-size:14px;line-height:1.6">${escapeHtml(item.detail)}</p><p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#df7159;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">Open assignment</a></p><p style="font-size:11px;color:#8b817a">Change email delivery from the KCPL notification bell.</p></div>`,
      category: "kcpl-assignment",
      customArgs: { notification_id: item.id, category: item.category },
    });
    await deliveryRef.set({
      status: "sent",
      recipient_email: profile.email,
      notification_id: item.id,
      category: item.category,
      sent_at: delivery.acceptedAt,
      provider_message_id: delivery.messageId,
    }, { merge: true });
    await recordShipmentEmail(item, profile.email, delivery.messageId);
    return true;
  } catch (error) {
    await deliveryRef.set({
      status: "failed",
      recipient_email: profile.email,
      notification_id: item.id,
      category: item.category,
      failed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message.slice(0, 800) : "Email delivery failed.",
    }, { merge: true });
    console.error("KCPL assignment notification email failed", profile.email, item.id, error);
    return false;
  }
}

export async function dispatchAssignmentEmailsForStaff(context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const, sent: 0 };
  if (!transactionalEmailConfigured()) return { kind: "not_configured" as const, sent: 0 };
  const notifications = await listCurrentStaffAssignmentNotifications(context, context.profile.email);
  let sent = 0;
  for (const item of notifications.filter((notification) => !notification.resolved && (notification.category === "assignments" || notification.category === "tasks"))) {
    if (await sendAssignmentEmail(context.profile, item)) sent += 1;
  }
  return { kind: "completed" as const, sent };
}

export async function dispatchAllAssignmentEmails() {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const, sent: 0 };
  if (!transactionalEmailConfigured()) return { kind: "not_configured" as const, sent: 0 };
  const profiles = await listStaffProfiles();
  if (!profiles) return { kind: "unavailable" as const, sent: 0 };
  let sent = 0;
  for (const profile of profiles.filter((item) => item.active)) {
    const result = await dispatchAssignmentEmailsForStaff(contextForProfile(profile));
    sent += result.sent;
  }
  return { kind: "completed" as const, sent };
}
