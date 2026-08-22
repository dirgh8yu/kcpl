import type { KcplStaffContext } from "../staff-directory.server";
import { listTmsOrders } from "../rating/tms-rating.server";
import { listTmsTenders } from "../tenders/tms-tendering.server";
import { tenderIsActive } from "../tenders/tms-tendering";
import { listPickupWorkspace } from "../pickups/pickup-appointments.server";
import { listTrackingVisibility } from "../visibility/tracking-visibility.server";
import { listDeliveryWorkspace } from "../delivery/delivery-control.server";
import { listFreightAuditQueue } from "../freight-audit/freight-audit.server";

export type WorkflowOverview = {
  planning: null | { needs_rate_or_selection: number; selected_for_procurement: number; booked_orders: number };
  tendering: null | { active: number; accepted_or_countered: number; booked: number };
  pickup: null | { unscheduled: number; requested: number; confirmed: number; missed: number; picked_up_today: number };
  visibility: null | { delayed: number; stale: number; customs: number; out_for_delivery: number };
  delivery: null | { failed_or_refused: number; pod_pending: number; active: number; verified: number };
  finance: null | { payment_blocked: number; review_required: number; disputed: number; approved_variance: number };
};

export async function loadWorkflowOverview(staff: KcplStaffContext): Promise<WorkflowOverview> {
  const [ordersResult, tendersResult, pickupResult, visibilityResult, deliveryResult, auditResult] = await Promise.allSettled([
    staff.permissions.canViewCommercial ? listTmsOrders(staff) : Promise.resolve(null),
    staff.permissions.canViewCommercial ? listTmsTenders(staff) : Promise.resolve(null),
    staff.permissions.canManageJobFile ? listPickupWorkspace(staff) : Promise.resolve(null),
    staff.permissions.canManageJobFile ? listTrackingVisibility(staff) : Promise.resolve(null),
    staff.permissions.canManageJobFile ? listDeliveryWorkspace(staff) : Promise.resolve(null),
    staff.permissions.canManageFinance ? listFreightAuditQueue(staff) : Promise.resolve(null),
  ]);

  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const tenders = tendersResult.status === "fulfilled" ? tendersResult.value : null;
  const pickups = pickupResult.status === "fulfilled" ? pickupResult.value : null;
  const visibility = visibilityResult.status === "fulfilled" ? visibilityResult.value : null;
  const delivery = deliveryResult.status === "fulfilled" ? deliveryResult.value : null;
  const audit = auditResult.status === "fulfilled" ? auditResult.value : null;

  return {
    planning: orders && orders.kind === "ready" ? {
      needs_rate_or_selection: orders.orders.filter((order) => order.status === "draft" || order.status === "rated").length,
      selected_for_procurement: orders.orders.filter((order) => order.status === "selected").length,
      booked_orders: orders.orders.filter((order) => order.status === "booked").length,
    } : null,
    tendering: tenders && tenders.kind === "ready" ? {
      active: tenders.tenders.filter((tender) => tenderIsActive(tender.status)).length,
      accepted_or_countered: tenders.tenders.filter((tender) => tender.status === "accepted" || tender.status === "countered").length,
      booked: tenders.tenders.filter((tender) => tender.status === "booked").length,
    } : null,
    pickup: pickups && pickups.kind === "ready" ? {
      unscheduled: pickups.summary.unscheduled,
      requested: pickups.summary.requested,
      confirmed: pickups.summary.confirmed + pickups.summary.driver_assigned,
      missed: pickups.summary.missed,
      picked_up_today: pickups.summary.picked_up_today,
    } : null,
    visibility: visibility && visibility.kind === "ready" ? {
      delayed: visibility.summary.delayed,
      stale: visibility.summary.stale,
      customs: visibility.summary.customs,
      out_for_delivery: visibility.summary.out_for_delivery,
    } : null,
    delivery: delivery && delivery.kind === "ready" ? {
      failed_or_refused: delivery.summary.failed_or_refused,
      pod_pending: delivery.summary.delivered_pod_pending,
      active: delivery.summary.out_for_delivery,
      verified: delivery.summary.pod_verified,
    } : null,
    finance: audit && audit.kind === "ready" ? {
      payment_blocked: audit.summary.blocked_from_payment,
      review_required: audit.summary.review_required,
      disputed: audit.summary.disputed,
      approved_variance: audit.summary.approved_variance,
    } : null,
  };
}
