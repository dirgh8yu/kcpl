import { markNotificationRead } from "../../../../../../admin/notifications/notification-centre.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../../admin/ops-mobile-api.server";

/** Marks one notification read. The receipt is written under the caller's
 * own uid, so it can only ever change what this login sees. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withStaffSession(request, async ({ staff }) => {
    const { id } = await context.params;
    const notificationId = id.trim().slice(0, 300);
    if (!notificationId) return opsJson({ ok: false, code: "missing", error: "Notification not found." }, 404);
    const result = await markNotificationRead(staff.profile.uid, notificationId);
    if (result.kind !== "updated") return opsUnavailable();
    return opsJson({ ok: true, readAt: result.read_at });
  });
}
