import { listOperationsNotifications } from "../../../../../admin/notifications/notification-centre.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../admin/ops-mobile-api.server";

/** The same feed as the web notification centre: branch-filtered alerts and
 * direct notices, with this login's read receipts and muted categories. */
export async function GET(request: Request) {
  return withStaffSession(request, async ({ user, staff }) => {
    try {
      const result = await listOperationsNotifications(staff, user.email);
      if (!result) return opsUnavailable();
      return opsJson({ ok: true, notifications: result.notifications, unreadCount: result.unread_count });
    } catch (error) {
      console.error("KCPL ops mobile notifications failed", error);
      return opsUnavailable();
    }
  });
}
