import type { KcplBranch } from "../crm/crm-data";

export const pickupAppointmentStatuses = [
  "unscheduled",
  "requested",
  "confirmed",
  "driver_assigned",
  "picked_up",
  "missed",
  "cancelled",
] as const;
export type PickupAppointmentStatus = (typeof pickupAppointmentStatuses)[number];

export const pickupAppointmentStatusLabels: Record<PickupAppointmentStatus, string> = {
  unscheduled: "Not scheduled",
  requested: "Pickup requested",
  confirmed: "Appointment confirmed",
  driver_assigned: "Driver assigned",
  picked_up: "Picked up",
  missed: "Pickup missed",
  cancelled: "Cancelled",
};

export const pickupChannels = ["manual", "email", "carrier_api", "vendor_portal", "edi"] as const;
export type PickupChannel = (typeof pickupChannels)[number];

export type PickupAppointment = {
  id: string;
  shipment_reference: string;
  transport_order_id: string | null;
  tender_id: string | null;
  booking_reference: string | null;
  branch: KcplBranch;
  customer_id: string | null;
  customer_name: string;
  partner_id: string | null;
  partner_name: string | null;
  origin: string;
  destination: string;
  status: PickupAppointmentStatus;
  channel: PickupChannel;
  requested_window_start: string | null;
  requested_window_end: string | null;
  confirmed_window_start: string | null;
  confirmed_window_end: string | null;
  pickup_location: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  provider_reference: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_reference: string | null;
  attempt_count: number;
  picked_up_at: string | null;
  missed_at: string | null;
  missed_reason: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string;
};

export type PickupQueueRow = PickupAppointment & {
  shipment_status: string;
  current_location: string | null;
};

export type PickupSummary = {
  unscheduled: number;
  requested: number;
  confirmed: number;
  driver_assigned: number;
  missed: number;
  picked_up_today: number;
};

export function validAppointmentWindow(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return false;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
}

export function pickupTransitionAllowed(from: PickupAppointmentStatus, to: PickupAppointmentStatus) {
  if (from === to) return true;
  if (from === "unscheduled") return to === "requested" || to === "confirmed" || to === "cancelled";
  if (from === "requested") return ["confirmed", "driver_assigned", "picked_up", "missed", "cancelled"].includes(to);
  if (from === "confirmed") return ["driver_assigned", "picked_up", "missed", "cancelled"].includes(to);
  if (from === "driver_assigned") return ["picked_up", "missed", "cancelled"].includes(to);
  if (from === "missed") return ["requested", "confirmed", "driver_assigned", "cancelled"].includes(to);
  return false;
}

export function pickupNeedsAttention(row: PickupQueueRow, nowIso: string) {
  if (row.status === "missed") return true;
  if (row.status === "picked_up" || row.status === "cancelled") return false;
  const appointment = row.confirmed_window_end ?? row.requested_window_end;
  if (!appointment) return row.status === "unscheduled";
  const due = Date.parse(appointment);
  const now = Date.parse(nowIso);
  return Number.isFinite(due) && Number.isFinite(now) && due < now;
}

export function pickupWindowOverdue(row: PickupQueueRow, nowIso: string) {
  if (!["requested", "confirmed", "driver_assigned"].includes(row.status)) return false;
  const appointment = row.confirmed_window_end ?? row.requested_window_end;
  if (!appointment) return false;
  const due = Date.parse(appointment);
  const now = Date.parse(nowIso);
  return Number.isFinite(due) && Number.isFinite(now) && due < now;
}

export function summarizePickups(rows: PickupQueueRow[], nowIso: string): PickupSummary {
  const today = nowIso.slice(0, 10);
  return {
    unscheduled: rows.filter((row) => row.status === "unscheduled").length,
    requested: rows.filter((row) => row.status === "requested").length,
    confirmed: rows.filter((row) => row.status === "confirmed").length,
    driver_assigned: rows.filter((row) => row.status === "driver_assigned").length,
    missed: rows.filter((row) => row.status === "missed" || pickupWindowOverdue(row, nowIso)).length,
    picked_up_today: rows.filter((row) => row.status === "picked_up" && row.picked_up_at?.slice(0, 10) === today).length,
  };
}
