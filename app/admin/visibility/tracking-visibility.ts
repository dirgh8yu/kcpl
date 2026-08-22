import type { KcplBranch } from "../crm/crm-data";
import type { ShipmentStatus } from "../../shipment-types";

export const trackingSources = ["manual", "carrier_api", "webhook", "edi_214", "gps", "counterpart"] as const;
export type TrackingSource = (typeof trackingSources)[number];

export const trackingMilestones = [
  "booked",
  "pickup_scheduled",
  "picked_up",
  "origin_terminal",
  "export_customs",
  "departed",
  "transshipment",
  "arrived_destination",
  "import_customs",
  "out_for_delivery",
  "delivery_attempted",
  "delivered",
  "delivery_refused",
  "exception",
  "unknown",
] as const;
export type TrackingMilestone = (typeof trackingMilestones)[number];

export const trackingMilestoneLabels: Record<TrackingMilestone, string> = {
  booked: "Booking confirmed",
  pickup_scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  origin_terminal: "Origin terminal",
  export_customs: "Export customs",
  departed: "Departed",
  transshipment: "Transshipment",
  arrived_destination: "Arrived destination",
  import_customs: "Import customs",
  out_for_delivery: "Out for delivery",
  delivery_attempted: "Delivery attempted",
  delivered: "Delivered",
  delivery_refused: "Delivery refused",
  exception: "Tracking exception",
  unknown: "Tracking update",
};

export type TrackingEvent = {
  id: string;
  shipment_reference: string;
  milestone: TrackingMilestone;
  title: string;
  raw_status: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  event_time: string;
  received_at: string;
  source: TrackingSource;
  provider: string | null;
  provider_event_id: string | null;
  details: string | null;
  eta: string | null;
  confidence: number | null;
  actor_name: string | null;
  actor_email: string | null;
};

export type VisibilityShipment = {
  reference: string;
  quote_reference: string;
  customer_id: string | null;
  customer_name: string;
  origin: string;
  destination: string;
  mode: string;
  primary_branch: KcplBranch;
  handling_branches: KcplBranch[];
  status: ShipmentStatus;
  carrier: string | null;
  carrier_reference: string | null;
  eta: string | null;
  original_eta: string | null;
  current_location: string | null;
  last_milestone: TrackingMilestone | null;
  last_event_at: string | null;
  last_received_at: string | null;
  last_source: TrackingSource | null;
  last_provider: string | null;
  observed_external_milestone: TrackingMilestone | null;
  observed_external_at: string | null;
  observed_external_provider: string | null;
  external_reconciliation_status: string | null;
  external_promotion_blocker: string | null;
  stale_after: string | null;
  stale: boolean;
  eta_delta_hours: number | null;
  updated_at: string;
};

export type VisibilitySummary = {
  active: number;
  delayed: number;
  stale: number;
  customs: number;
  out_for_delivery: number;
  delivered_today: number;
};

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-/]+/g, " ");
}

const milestonePatterns: Array<{ milestone: TrackingMilestone; patterns: RegExp[] }> = [
  { milestone: "delivery_refused", patterns: [/delivery refused/, /consignee refused/, /recipient refused/, /refused delivery/] },
  { milestone: "delivered", patterns: [/\bdelivered\b/, /proof of delivery/, /pod complete/, /received by consignee/] },
  { milestone: "out_for_delivery", patterns: [/out for delivery/, /with courier/, /last mile/, /delivery vehicle/] },
  { milestone: "delivery_attempted", patterns: [/delivery attempted/, /attempted delivery/, /consignee unavailable/, /recipient unavailable/] },
  { milestone: "import_customs", patterns: [/import customs/, /destination customs/, /customs clearance destination/, /held at customs/] },
  { milestone: "arrived_destination", patterns: [/arrived destination/, /arrival at destination/, /vessel arrived/, /flight arrived/, /arrived port/, /arrived terminal/] },
  { milestone: "transshipment", patterns: [/transship/, /transfer hub/, /connection port/, /connecting flight/] },
  { milestone: "departed", patterns: [/\bdeparted\b/, /vessel sailed/, /flight departed/, /dispatched/, /in transit/, /linehaul departure/] },
  { milestone: "export_customs", patterns: [/export customs/, /origin customs/, /customs cleared origin/, /export clearance/] },
  { milestone: "origin_terminal", patterns: [/origin terminal/, /received at terminal/, /gate in/, /warehouse received/, /cargo received/] },
  { milestone: "picked_up", patterns: [/picked up/, /pickup complete/, /collected from shipper/, /cargo collected/] },
  { milestone: "pickup_scheduled", patterns: [/pickup scheduled/, /collection scheduled/, /pickup booked/] },
  { milestone: "booked", patterns: [/booking confirmed/, /booked/, /reservation confirmed/] },
  { milestone: "exception", patterns: [/exception/, /delay/, /damaged/, /lost/, /shortage/, /hold/, /failed/] },
];

export function normalizeTrackingMilestone(rawStatus: string, explicit?: string | null): TrackingMilestone {
  if (explicit && trackingMilestones.includes(explicit as TrackingMilestone)) return explicit as TrackingMilestone;
  const value = normalized(rawStatus);
  if (!value) return "unknown";
  for (const candidate of milestonePatterns) if (candidate.patterns.some((pattern) => pattern.test(value))) return candidate.milestone;
  return "unknown";
}

export function milestoneShipmentStatus(milestone: TrackingMilestone, current: ShipmentStatus): ShipmentStatus {
  if (current === "delivered") return "delivered";
  if (milestone === "delivered") return "delivered";
  if (milestone === "delivery_refused" || milestone === "exception") return "exception";
  if (milestone === "out_for_delivery" || milestone === "delivery_attempted") return "out_for_delivery";
  if (milestone === "import_customs" || milestone === "export_customs") return "customs_clearance";
  if (["departed", "transshipment", "arrived_destination", "origin_terminal", "picked_up"].includes(milestone)) return "in_transit";
  if (milestone === "pickup_scheduled") return "preparing";
  return current;
}

export function trackingStaleHours(status: ShipmentStatus, mode: string) {
  if (status === "delivered") return Number.POSITIVE_INFINITY;
  const normalizedMode = mode.trim().toLowerCase();
  if (normalizedMode.includes("sea") || normalizedMode.includes("ocean")) return 72;
  if (normalizedMode.includes("air") || normalizedMode.includes("courier")) return 24;
  return 36;
}

export function trackingStaleAfter(eventTime: string, status: ShipmentStatus, mode: string) {
  const time = Date.parse(eventTime);
  const hours = trackingStaleHours(status, mode);
  if (!Number.isFinite(time) || !Number.isFinite(hours)) return null;
  return new Date(time + hours * 3_600_000).toISOString();
}

export function isTrackingStale(lastEventAt: string | null, status: ShipmentStatus, mode: string, nowIso: string) {
  if (status === "delivered") return false;
  if (!lastEventAt) return true;
  const staleAfter = trackingStaleAfter(lastEventAt, status, mode);
  if (!staleAfter) return false;
  return Date.parse(staleAfter) < Date.parse(nowIso);
}

export function etaDeltaHours(originalEta: string | null, currentEta: string | null) {
  if (!originalEta || !currentEta) return null;
  const original = Date.parse(originalEta);
  const current = Date.parse(currentEta);
  if (!Number.isFinite(original) || !Number.isFinite(current)) return null;
  return (current - original) / 3_600_000;
}

export function shouldOpenEtaDelayException(previousEta: string | null, nextEta: string | null, thresholdHours = 24) {
  const delta = etaDeltaHours(previousEta, nextEta);
  return delta !== null && delta >= thresholdHours;
}

export function confidenceValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

export function summarizeVisibility(rows: VisibilityShipment[], nowIso: string): VisibilitySummary {
  const today = nowIso.slice(0, 10);
  return {
    active: rows.filter((row) => row.status !== "delivered").length,
    delayed: rows.filter((row) => (row.eta_delta_hours ?? 0) >= 24 && row.status !== "delivered").length,
    stale: rows.filter((row) => row.stale && row.status !== "delivered").length,
    customs: rows.filter((row) => row.status === "customs_clearance").length,
    out_for_delivery: rows.filter((row) => row.status === "out_for_delivery").length,
    delivered_today: rows.filter((row) => row.status === "delivered" && row.last_event_at?.slice(0, 10) === today).length,
  };
}
