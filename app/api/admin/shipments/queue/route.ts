import { getAdminAccess } from "../../../../admin/admin-auth";
import { loadCommandCentre } from "../../../../admin/command-centre/command-centre.server";
import { createDirectNotification, getNotificationPreferences } from "../../../../admin/notifications/notification-centre.server";
import { transitionNotifications, transitionTouchesDesk } from "../../../../admin/shipments/register-transition-notifications";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { diffRegisterStatuses } from "../../../../admin/use-register-poll";
import type { ShipmentStatus } from "../../../../shipment-types";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Live refresh for the shipments register: returns the same CommandCentreData
 * snapshot the page renders with, so the client can quietly refresh KPIs,
 * live-activity badges and rows without a full reload. Reuses the page's
 * loader verbatim — identical branch scoping, limits and QA-mock behaviour.
 *
 * Callers pass their last-applied `generated_at` and known statuses; genuine
 * status transitions are additionally persisted as per-staff activity
 * notifications so a transition seen on one device is recoverable from the
 * notification history on every device. */
export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return json({ ok: false, error: "You do not have access to the shipment register." }, 403);
  try {
    const data = await loadCommandCentre(staff, { includeDelivered: true });
    if (!data) return json({ ok: false, error: "Firestore is not available for this deployment." }, 503);

    // Transition persistence: the client reports what it last rendered; the
    // authoritative statuses come from this fresh server snapshot. Only
    // transitions that are still real in the new snapshot are recorded —
    // a stale client report can never fabricate history.
    const url = new URL(request.url);
    const knownRaw = url.searchParams.get("known");
    if (knownRaw) {
      try {
        const parsed = JSON.parse(knownRaw) as Record<string, string>;
        const known = new Map<string, ShipmentStatus>(
          Object.entries(parsed).filter(([reference, status]) => reference && typeof status === "string" && reference.length <= 40).map(([reference, status]) => [reference, status as ShipmentStatus]),
        );
        const changes = diffRegisterStatuses(known, data);
        // Respect per-workspace transition subscriptions: staff who muted the
        // register desk don't accrue notification history they asked not to get.
        const desks = (await getNotificationPreferences(staff.profile.uid)).transition_desks;
        const subscribed = changes.filter((change) => transitionTouchesDesk(change.from, change.to, desks));
        const notifications = transitionNotifications(subscribed);
        const results = await Promise.allSettled(notifications.map((notification) =>
          createDirectNotification({
            ...notification,
            targetEmail: staff.profile.email,
            branch: data.jobs.find((job) => job.reference === notification.sourceId?.split(":")[0])?.primary_branch ?? null,
          })));
        const persisted = results.filter((result) => result.status === "fulfilled" && result.value.kind === "created").length;
        return json({ ok: true, data, persisted_transitions: persisted });
      } catch (error) {
        console.error("KCPL register transition persistence failed", error);
        // Snapshot stays usable even if the notification write failed.
        return json({ ok: true, data, persisted_transitions: 0 });
      }
    }
    return json({ ok: true, data });
  } catch (error) {
    console.error("KCPL shipment queue refresh failed", error);
    return json({ ok: false, error: "KCPL operational data is temporarily unavailable." }, 503);
  }
}
