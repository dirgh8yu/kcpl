import { firebaseAdminDb } from "../../firebase-admin.server";
import { listAutomationAlerts } from "../alerts/alert-engine.server";
import type { KcplStaffContext } from "../staff-directory.server";
import { listTmsOrders } from "../rating/tms-rating.server";
import { listTmsTenders } from "../tenders/tms-tendering.server";
import { tenderIsActive } from "../tenders/tms-tendering";
import { listPickupWorkspace } from "../pickups/pickup-appointments.server";
import { listFreightDocumentWorkspace } from "../freight-documents/freight-documents.server";
import { listTrackingVisibility } from "../visibility/tracking-visibility.server";
import { listDeliveryWorkspace } from "../delivery/delivery-control.server";
import { listFreightAuditQueue } from "../freight-audit/freight-audit.server";
import { mockWorkflowOverview, overviewMockEnabled } from "./overview-mock";

export type OverviewMovement = {
  reference: string;
  customer_name: string;
  origin: string;
  destination: string;
  mode: string;
  status: string;
  current_location: string | null;
  eta: string | null;
  last_milestone: string | null;
  last_event_at: string | null;
};

export type OverviewActivity = {
  id: string;
  reference: string;
  title: string;
  detail: string | null;
  occurred_at: string;
  actor_name: string | null;
  type: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

export type WorkflowOverview = {
  planning: null | { needs_rate_or_selection: number; selected_for_procurement: number; booked_orders: number };
  tendering: null | { active: number; accepted_or_countered: number; booked: number };
  pickup: null | { unscheduled: number; requested: number; confirmed: number; missed: number; picked_up_today: number };
  documents: null | { missing_primary: number; review_pending: number; generated_current: number };
  visibility: null | {
    active: number;
    delayed: number;
    stale: number;
    customs: number;
    out_for_delivery: number;
    departing_today: number;
    delivered_today: number;
  };
  delivery: null | { failed_or_refused: number; pod_pending: number; pod_overdue: number; active: number; verified: number };
  finance: null | { payment_blocked: number; review_required: number; disputed: number; approved_variance: number };
  critical_blockers: number | null;
  movements: OverviewMovement[];
  recent_activity: OverviewActivity[];
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function activityTone(type: string, title: string): OverviewActivity["tone"] {
  const value = `${type} ${title}`.toLowerCase();
  if (value.includes("exception") || value.includes("failed") || value.includes("refused") || value.includes("rejected")) return "danger";
  if (value.includes("overdue") || value.includes("blocked") || value.includes("delay")) return "warning";
  if (value.includes("complete") || value.includes("cleared") || value.includes("delivered") || value.includes("uploaded") || value.includes("received") || value.includes("verified")) return "success";
  if (value.includes("track") || value.includes("depart") || value.includes("arriv") || value.includes("customs")) return "info";
  return "neutral";
}

async function loadRecentActivity(visibleReferences: Set<string>, staff: KcplStaffContext) {
  if (!visibleReferences.size) return [] as OverviewActivity[];
  const snapshot = await firebaseAdminDb().collectionGroup("job_activity").orderBy("created_at", "desc").limit(350).get();
  const items: OverviewActivity[] = [];
  for (const doc of snapshot.docs) {
    const reference = doc.ref.parent.parent?.id ?? "";
    if (!reference || !visibleReferences.has(reference)) continue;
    const data = doc.data() as Record<string, unknown>;
    const type = text(data.type, "job_activity");
    if ((type.includes("finance") || type.includes("invoice") || type.includes("payment")) && !staff.permissions.canManageFinance && !staff.permissions.canManageJobCosts) continue;
    const occurredAt = text(data.created_at);
    if (!occurredAt) continue;
    const title = text(data.title, "Operational update");
    items.push({
      id: doc.id,
      reference,
      title,
      detail: nullable(data.detail),
      occurred_at: occurredAt,
      actor_name: nullable(data.actor_name),
      type,
      tone: activityTone(type, title),
    });
    if (items.length >= 12) break;
  }
  return items;
}

export async function loadWorkflowOverview(staff: KcplStaffContext): Promise<WorkflowOverview> {
  if (overviewMockEnabled()) return mockWorkflowOverview();
  const [ordersResult, tendersResult, pickupResult, documentResult, visibilityResult, deliveryResult, auditResult, alertsResult] = await Promise.allSettled([
    staff.permissions.canViewCommercial ? listTmsOrders(staff) : Promise.resolve(null),
    staff.permissions.canViewCommercial ? listTmsTenders(staff) : Promise.resolve(null),
    staff.permissions.canManageJobFile ? listPickupWorkspace(staff) : Promise.resolve(null),
    staff.permissions.canManageJobFile ? listFreightDocumentWorkspace(staff) : Promise.resolve(null),
    staff.permissions.canManageJobFile ? listTrackingVisibility(staff) : Promise.resolve(null),
    staff.permissions.canManageJobFile ? listDeliveryWorkspace(staff) : Promise.resolve(null),
    staff.permissions.canManageFinance ? listFreightAuditQueue(staff) : Promise.resolve(null),
    listAutomationAlerts(staff, staff.profile.email, false),
  ]);

  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const tenders = tendersResult.status === "fulfilled" ? tendersResult.value : null;
  const pickups = pickupResult.status === "fulfilled" ? pickupResult.value : null;
  const documents = documentResult.status === "fulfilled" ? documentResult.value : null;
  const visibility = visibilityResult.status === "fulfilled" ? visibilityResult.value : null;
  const delivery = deliveryResult.status === "fulfilled" ? deliveryResult.value : null;
  const audit = auditResult.status === "fulfilled" ? auditResult.value : null;
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : null;
  const today = operationalDate();
  const now = Date.now();

  const visibilityRows = visibility && visibility.kind === "ready" ? visibility.rows : [];
  const visibleReferences = new Set(visibilityRows.map((row) => row.reference));
  let recentActivity: OverviewActivity[] = [];
  try {
    recentActivity = await loadRecentActivity(visibleReferences, staff);
  } catch (error) {
    console.error("Failed to load KCPL Overview activity", error);
  }

  const movements: OverviewMovement[] = visibilityRows
    .filter((row) => row.status !== "delivered")
    .sort((a, b) => Number(b.stale) - Number(a.stale) || (b.eta_delta_hours ?? 0) - (a.eta_delta_hours ?? 0) || b.updated_at.localeCompare(a.updated_at))
    .slice(0, 18)
    .map((row) => ({
      reference: row.reference,
      customer_name: row.customer_name,
      origin: row.origin,
      destination: row.destination,
      mode: row.mode,
      status: row.status,
      current_location: row.current_location,
      eta: row.eta,
      last_milestone: row.last_milestone,
      last_event_at: row.last_event_at,
    }));

  const podOverdue = delivery && delivery.kind === "ready"
    ? delivery.rows.filter((row) => {
      if (row.delivery_state !== "delivered_pod_pending") return false;
      const anchor = row.last_attempt_at || row.updated_at;
      const time = Date.parse(anchor);
      return Number.isFinite(time) && now - time >= 24 * 60 * 60 * 1000;
    }).length
    : 0;

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
    documents: documents && documents.kind === "ready" ? {
      missing_primary: documents.summary.missing_primary,
      review_pending: documents.summary.review_pending,
      generated_current: documents.summary.generated_current,
    } : null,
    visibility: visibility && visibility.kind === "ready" ? {
      active: visibility.summary.active,
      delayed: visibility.summary.delayed,
      stale: visibility.summary.stale,
      customs: visibility.summary.customs,
      out_for_delivery: visibility.summary.out_for_delivery,
      departing_today: visibility.rows.filter((row) => row.last_milestone === "departed" && row.last_event_at?.slice(0, 10) === today).length,
      delivered_today: visibility.summary.delivered_today,
    } : null,
    delivery: delivery && delivery.kind === "ready" ? {
      failed_or_refused: delivery.summary.failed_or_refused,
      pod_pending: delivery.summary.delivered_pod_pending,
      pod_overdue: podOverdue,
      active: delivery.summary.out_for_delivery,
      verified: delivery.summary.pod_verified,
    } : null,
    finance: audit && audit.kind === "ready" ? {
      payment_blocked: audit.summary.blocked_from_payment,
      review_required: audit.summary.review_required,
      disputed: audit.summary.disputed,
      approved_variance: audit.summary.approved_variance,
    } : null,
    critical_blockers: alerts ? alerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved").length : null,
    movements,
    recent_activity: recentActivity,
  };
}
