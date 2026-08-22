import type { CrmCurrency } from "../crm/crm-data";
import type { TmsMode } from "../rating/tms-rating";

export const tmsTenderChannels = ["manual", "email", "edi_204"] as const;
export type TmsTenderChannel = (typeof tmsTenderChannels)[number];

export const tmsTenderStatuses = [
  "sent",
  "accepted",
  "rejected",
  "countered",
  "expired",
  "cancelled",
  "booked",
] as const;
export type TmsTenderStatus = (typeof tmsTenderStatuses)[number];

export const tmsTenderStatusLabels: Record<TmsTenderStatus, string> = {
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  countered: "Counter-offer",
  expired: "Expired",
  cancelled: "Cancelled",
  booked: "Booked",
};

export type TmsTender = {
  id: string;
  order_id: string;
  tender_reference: string;
  status: TmsTenderStatus;
  channel: TmsTenderChannel;
  partner_id: string;
  partner_name: string;
  recipient_name: string | null;
  recipient_email: string | null;
  rate_card_id: string;
  mode: TmsMode;
  service: string | null;
  equipment: string | null;
  currency: CrmCurrency;
  offered_cost: number;
  counter_cost: number | null;
  counter_currency: CrmCurrency | null;
  final_cost: number | null;
  final_currency: CrmCurrency | null;
  origin: string;
  destination: string;
  pickup_date: string | null;
  response_due_at: string;
  sent_at: string;
  responded_at: string | null;
  response_note: string | null;
  booking_reference: string | null;
  pickup_confirmation: string | null;
  booked_at: string | null;
  shipment_reference: string | null;
  created_by_name: string;
  created_by_email: string;
  updated_at: string;
};

export type TenderAuthorityDecision = "authoritative" | "legacy_unique" | "stale" | "missing" | "ambiguous";

function normalizedId(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export function resolveTenderAuthority(activeTenderId: string | null | undefined, liveTenderIds: string[], candidateTenderId: string): TenderAuthorityDecision {
  const live = [...new Set(liveTenderIds.map(normalizedId).filter(Boolean))];
  const candidate = normalizedId(candidateTenderId);
  const pointer = normalizedId(activeTenderId);
  if (!candidate) return "missing";
  if (live.length > 1) return "ambiguous";
  if (live.length === 0) return "missing";
  if (live[0] !== candidate) return "stale";
  if (pointer === candidate) return "authoritative";
  if (!pointer || !live.includes(pointer)) return "legacy_unique";
  return "stale";
}

export type RepeatedRejectedTenderDecision = "idempotent" | "repair_clear" | "stale" | "state_conflict";

export function repeatedRejectedTenderDecision(input: {
  orderStatus: string;
  activeTenderId?: string | null;
  rejectedTenderId: string;
  liveTenderIds: string[];
}): RepeatedRejectedTenderDecision {
  const live = [...new Set(input.liveTenderIds.map(normalizedId).filter(Boolean))];
  const pointer = normalizedId(input.activeTenderId);
  const rejected = normalizedId(input.rejectedTenderId);
  if (live.length > 0) return "stale";
  if (pointer && pointer !== rejected) return "stale";
  if (input.orderStatus !== "selected" && input.orderStatus !== "tendering") return "state_conflict";
  if (input.orderStatus === "selected" && !pointer) return "idempotent";
  return "repair_clear";
}

export type BookingRetryDecision = "idempotent" | "booking_conflict" | "state_conflict";

export function bookingRetryDecision(input: {
  requestedBookingReference: string;
  tenderBookingReference?: string | null;
  orderBookingReference?: string | null;
  tenderShipmentReference?: string | null;
  orderShipmentReference?: string | null;
  shipmentExists: boolean;
  shipmentOrderId?: string | null;
  expectedOrderId: string;
  shipmentTenderId?: string | null;
  expectedTenderId: string;
  shipmentBookingReference?: string | null;
  shipmentBranch?: string | null;
  expectedBranch: string;
  shipmentCustomerId?: string | null;
  expectedCustomerId: string;
  shipmentConsolidationLoadId?: string | null;
}): BookingRetryDecision {
  const requested = input.requestedBookingReference.trim();
  const tenderBooking = (input.tenderBookingReference ?? "").trim();
  const orderBooking = (input.orderBookingReference ?? "").trim();
  if (!requested || tenderBooking !== requested || orderBooking !== requested) return "booking_conflict";
  const tenderShipment = normalizedId(input.tenderShipmentReference);
  const orderShipment = normalizedId(input.orderShipmentReference);
  if (!tenderShipment || tenderShipment !== orderShipment) return "state_conflict";
  if (!input.shipmentExists) return "state_conflict";
  if (normalizedId(input.shipmentOrderId) !== normalizedId(input.expectedOrderId)) return "state_conflict";
  if (normalizedId(input.shipmentTenderId) !== normalizedId(input.expectedTenderId)) return "state_conflict";
  if ((input.shipmentBookingReference ?? "").trim() !== requested) return "state_conflict";
  if ((input.shipmentBranch ?? "").trim() !== input.expectedBranch.trim()) return "state_conflict";
  if (normalizedId(input.shipmentCustomerId) !== normalizedId(input.expectedCustomerId)) return "state_conflict";
  if ((input.shipmentConsolidationLoadId ?? "").trim()) return "state_conflict";
  return "idempotent";
}

export function tenderIsTerminal(status: TmsTenderStatus) {
  return ["rejected", "expired", "cancelled", "booked"].includes(status);
}

export function tenderIsActive(status: TmsTenderStatus) {
  return ["sent", "accepted", "countered"].includes(status);
}

export function tenderResponseAllowed(current: TmsTenderStatus, next: TmsTenderStatus) {
  if (current === next) return true;
  if (current !== "sent") return false;
  return ["accepted", "rejected", "countered"].includes(next);
}

export function tenderCanBook(status: TmsTenderStatus) {
  return status === "accepted" || status === "countered";
}

export function tenderCanCancel(status: TmsTenderStatus) {
  return status === "sent" || status === "accepted" || status === "countered";
}

export function tenderIsExpired(tender: Pick<TmsTender, "status" | "response_due_at">, nowIso: string) {
  return tender.status === "sent" && Boolean(tender.response_due_at) && tender.response_due_at <= nowIso;
}

export function tenderFinalCommercials(tender: Pick<TmsTender, "status" | "currency" | "offered_cost" | "counter_cost" | "counter_currency">) {
  if (tender.status === "countered") {
    if (tender.counter_cost === null || !tender.counter_currency) return null;
    return { amount: tender.counter_cost, currency: tender.counter_currency };
  }
  if (tender.status === "accepted") return { amount: tender.offered_cost, currency: tender.currency };
  return null;
}
