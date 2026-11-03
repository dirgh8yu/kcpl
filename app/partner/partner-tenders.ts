import { crmCurrencies, type CrmCurrency } from "../admin/crm/crm-data";
import type { TmsTenderStatus } from "../admin/tenders/tms-tendering";

/*
 * The partner's view of a carrier tender.
 *
 * A partner is a commercial counterparty, not staff: they may see the lane,
 * the offered buying rate, the deadline and their own response. They never see
 * the customer, the sell price, KCPL's margin, the order's commercial snapshot
 * or another carrier's bid. This module is the allowlist between the tender
 * record and that view, and it is pure so the API and page cannot drift.
 */

export type PartnerTenderAction = "accept" | "reject" | "counter";

export function partnerTenderAction(value: unknown): PartnerTenderAction | null {
  return value === "accept" || value === "reject" || value === "counter" ? value : null;
}

export type PartnerTenderView = {
  id: string;
  reference: string;
  order_id: string;
  status: TmsTenderStatus;
  mode: string;
  service: string | null;
  equipment: string | null;
  origin: string;
  destination: string;
  pickup_date: string | null;
  currency: CrmCurrency;
  offered_cost: number;
  counter_cost: number | null;
  counter_currency: CrmCurrency | null;
  response_due_at: string;
  sent_at: string;
  responded_at: string | null;
  response_note: string | null;
  can_respond: boolean;
  can_counter: boolean;
  expired: boolean;
};

type TenderRecord = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function currency(value: unknown): CrmCurrency | null {
  return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : null;
}

const statuses: TmsTenderStatus[] = ["sent", "accepted", "rejected", "countered", "expired", "cancelled", "booked"];

export function partnerTenderExpired(status: TmsTenderStatus, dueAt: string, nowIso: string) {
  return status === "sent" && Boolean(dueAt) && dueAt <= nowIso;
}

export function partnerTenderActionAllowed(status: TmsTenderStatus, action: PartnerTenderAction, dueAt: string, nowIso: string) {
  if (status !== "sent" || partnerTenderExpired(status, dueAt, nowIso)) return false;
  return action === "accept" || action === "reject" || action === "counter";
}

/**
 * The tender as its partner may see it. Unknown currencies and statuses are
 * declined rather than guessed: a malformed tender should disappear from the
 * partner desk, not render a zero-cost offer.
 */
export function partnerTenderView(id: string, data: TenderRecord, nowIso: string): PartnerTenderView | null {
  const status = statuses.includes(data.status as TmsTenderStatus) ? data.status as TmsTenderStatus : null;
  const offeredCurrency = currency(data.currency);
  if (!status || !offeredCurrency) return null;
  const due = text(data.response_due_at);
  const expired = partnerTenderExpired(status, due, nowIso);
  const effectiveStatus = expired ? "expired" : status;
  return {
    id,
    reference: text(data.tender_reference) || id,
    order_id: text(data.order_id).toUpperCase(),
    status: effectiveStatus,
    mode: text(data.mode),
    service: nullable(data.service),
    equipment: nullable(data.equipment),
    origin: text(data.origin),
    destination: text(data.destination),
    pickup_date: nullable(data.pickup_date),
    currency: offeredCurrency,
    offered_cost: Math.max(0, numberValue(data.offered_cost)),
    counter_cost: nullableNumber(data.counter_cost),
    counter_currency: currency(data.counter_currency),
    response_due_at: due,
    sent_at: text(data.sent_at),
    responded_at: nullable(data.responded_at),
    response_note: nullable(data.response_note),
    can_respond: partnerTenderActionAllowed(status, "accept", due, nowIso),
    can_counter: partnerTenderActionAllowed(status, "counter", due, nowIso),
    expired,
  };
}

export function partnerTenderStatusLabel(status: TmsTenderStatus) {
  return {
    sent: "Awaiting your response",
    accepted: "Accepted",
    rejected: "Declined",
    countered: "Counter-offer sent",
    expired: "Deadline passed",
    cancelled: "Withdrawn by KCPL",
    booked: "Booked",
  }[status];
}

export function partnerTenderTone(status: TmsTenderStatus) {
  if (status === "booked" || status === "accepted") return "success" as const;
  if (status === "countered" || status === "sent") return "warning" as const;
  if (status === "rejected" || status === "expired") return "danger" as const;
  return "neutral" as const;
}

export function partnerCounterIsSane(amount: unknown, tenderCurrency: CrmCurrency, offeredCost: number) {
  const value = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(value) && value > 0 && value <= 100_000_000 && value !== offeredCost && Boolean(tenderCurrency);
}
