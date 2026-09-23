import { getAdminAccess } from "../../../admin/admin-auth";
import { getNotificationPreferences, listOperationsNotifications } from "../../../admin/notifications/notification-centre.server";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { loadCommandCentre } from "../../../admin/command-centre/command-centre.server";
import { buildWallboard } from "../../../admin/wallboard-data";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Read-only feed for the ops wallboard (TV mode). Same authorization shape as
 * the register queue API: admin session + Job File access. Returns the SAME
 * CommandCentreData snapshot the register renders, projected through the pure
 * wallboard builder, plus the same notification feed the centre uses — one
 * notion of "now" across every operational surface. No writes, ever.
 */
export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return json({ ok: false, error: "You do not have access to the operational wallboard." }, 403);
  try {
    const [data, notificationsResult, preferences] = await Promise.all([
      loadCommandCentre(staff, { includeDelivered: true }),
      listOperationsNotifications(staff, access.user.email).catch((error: unknown) => {
        console.error("KCPL wallboard notification feed failed", error);
        return null;
      }),
      getNotificationPreferences(staff.profile.uid),
    ]);
    if (!data) return json({ ok: false, error: "Firestore is not available for this deployment." }, 503);
    const notifications = notificationsResult?.notifications.filter((item) => preferences.categories[item.category]) ?? [];
    return json({ ok: true, wallboard: buildWallboard(data, notifications, new Date()), generated_at: data.generated_at });
  } catch (error) {
    console.error("KCPL wallboard load failed", error);
    return json({ ok: false, error: "KCPL operational data is temporarily unavailable." }, 503);
  }
}
