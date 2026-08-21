import { getAdminAccess } from "../../../admin/admin-auth";
import { listCurrentStaffAssignmentNotifications } from "../../../admin/notifications/assignment-notifications.server";
import {
  getNotificationPreferences,
  listOperationsNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreferences,
} from "../../../admin/notifications/notification-centre.server";
import {
  notificationCategories,
  notificationEmailModes,
  type NotificationPreferences,
  type OperationsNotification,
} from "../../../admin/notifications/notification-data";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { transactionalEmailConfigured } from "../../../integrations/sendgrid-email.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  return { user: access.user, staff };
}

function combineNotifications(base: OperationsNotification[], assignments: OperationsNotification[]) {
  const byId = new Map<string, OperationsNotification>();
  for (const item of [...base, ...assignments]) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 250);
}

async function currentNotifications(auth: Exclude<Awaited<ReturnType<typeof authorize>>, { response: Response }>) {
  const [base, assignments] = await Promise.all([
    listOperationsNotifications(auth.staff, auth.user.email),
    listCurrentStaffAssignmentNotifications(auth.staff, auth.user.email),
  ]);
  if (!base) return null;
  const notifications = combineNotifications(base.notifications, assignments);
  return {
    notifications,
    unread_count: notifications.filter((item) => !item.read_at && !item.resolved).length,
    preferences: base.preferences,
  };
}

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const result = await currentNotifications(auth);
  if (!result) return json({ ok: false, error: "Notification storage is unavailable." }, 503);
  return json({ ok: true, ...result, email_configured: transactionalEmailConfigured() });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin notification actions are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The notification action could not be read." }, 400); }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "mark_read") {
    const notificationId = typeof body.notificationId === "string" ? body.notificationId.trim() : "";
    if (!notificationId) return json({ ok: false, error: "Notification not found." }, 404);
    const result = await markNotificationRead(auth.staff.profile.uid, notificationId);
    if (result.kind !== "updated") return json({ ok: false, error: "Notification storage is unavailable." }, 503);
    return json({ ok: true, read_at: result.read_at });
  }

  if (action === "mark_all_read") {
    const current = await currentNotifications(auth);
    if (!current) return json({ ok: false, error: "Notification storage is unavailable." }, 503);
    const ids = current.notifications.filter((item) => !item.read_at && !item.resolved).map((item) => item.id);
    const result = await markAllNotificationsRead(auth.staff.profile.uid, ids);
    if (result.kind !== "updated") return json({ ok: false, error: "Notification storage is unavailable." }, 503);
    return json({ ok: true, read_at: result.read_at, count: ids.length });
  }

  if (action === "save_preferences") {
    const rawMode = typeof body.emailMode === "string" ? body.emailMode : "";
    if (!notificationEmailModes.includes(rawMode as NotificationPreferences["email_mode"])) return json({ ok: false, error: "Choose a valid email notification mode." }, 400);
    const existing = await getNotificationPreferences(auth.staff.profile.uid);
    const rawCategories = typeof body.categories === "object" && body.categories !== null ? body.categories as Record<string, unknown> : {};
    const preferences: NotificationPreferences = {
      email_mode: rawMode as NotificationPreferences["email_mode"],
      categories: Object.fromEntries(notificationCategories.map((category) => [category, typeof rawCategories[category] === "boolean" ? rawCategories[category] : existing.categories[category]])) as NotificationPreferences["categories"],
    };
    const result = await saveNotificationPreferences(auth.staff.profile.uid, preferences);
    if (result.kind !== "updated") return json({ ok: false, error: "Notification preferences could not be saved." }, 503);
    return json({ ok: true, preferences: result.preferences, email_configured: transactionalEmailConfigured() });
  }

  return json({ ok: false, error: "Choose a valid notification action." }, 400);
}
