import { shipmentStatusLabels } from "../../shipment-types.ts";
import type { DirectNotificationInput } from "../notifications/notification-centre.server";
import type { NotificationPreferences, TransitionDesk } from "../notifications/notification-data";
import type { RegisterStatusChange } from "../use-register-poll";

/** Turn register status transitions into activity notifications. Pure mapping
 * so the E2E test asserts exactly what the queue API writes. Cap matches the
 * UI toast so a mass migration doesn't flood the feed. */
export const TRANSITION_NOTIFICATION_LIMIT = 3;

export function transitionNotifications(changes: RegisterStatusChange[]): DirectNotificationInput[] {
  return changes.slice(0, TRANSITION_NOTIFICATION_LIMIT).map((change) => ({
    targetEmail: "", // filled per staff member by the queue API
    category: "activity" as const,
    severity: change.to === "exception" ? "critical" as const : change.to === "delivered" ? "info" as const : "warning" as const,
    title: `${change.reference} → ${shipmentStatusLabels[change.to]}`,
    detail: `Status moved from ${shipmentStatusLabels[change.from]} to ${shipmentStatusLabels[change.to]} while the register was open.`,
    actionPath: `/admin/shipments?selected=${encodeURIComponent(change.reference)}`,
    sourceType: "register-transition",
    sourceId: `${change.reference}:${change.from}:${change.to}`,
  }));
}

/** Per-workspace transition subscriptions. A transition reaches a staff member
 * when the register is subscribed (every status change), or when either
 * endpoint status touches a subscribed desk: customs clearance for the customs
 * desk; delivery and completion for the delivery desk. Pure so the E2E test
 * pins exactly what the notification centre filters on. */
export function transitionTouchesDesk(from: string, to: string, desks: Record<TransitionDesk, boolean>): boolean {
  if (desks.register) return true;
  const touchesCustoms = (status: string) => status === "customs_clearance";
  const touchesDelivery = (status: string) => status === "out_for_delivery" || status === "delivered";
  return (desks.customs && (touchesCustoms(from) || touchesCustoms(to)))
    || (desks.delivery && (touchesDelivery(from) || touchesDelivery(to)));
}

export type TransitionDeskPrefs = NotificationPreferences["transition_desks"];
