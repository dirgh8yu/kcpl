/*
 * Cargo claims: damage, shortage, loss or delay, reported by the customer or
 * by KCPL, followed up with whoever is liable (the carrier, the insurer, a
 * partner) and settled with a credit note, a refund, money recovered, or a
 * reasoned no.
 *
 * Notice has to reach the liable party within a time limit set by the
 * contract of carriage or the insurance policy. The limits here are the
 * usual ones for each mode, a starting point staff can change on the claim,
 * not legal advice.
 *
 * Pure: the portal, the app and the Job File read the same rules.
 */

export const CARGO_CLAIMS = "cargo_claims";

export const claimKinds = ["damage", "shortage", "loss", "delay", "other"] as const;
export type ClaimKind = (typeof claimKinds)[number];
export const claimKindLabels: Record<ClaimKind, string> = { damage: "Damage", shortage: "Shortage", loss: "Loss", delay: "Delay", other: "Other" };

export const claimStatuses = ["reported", "filed", "settled", "rejected", "withdrawn"] as const;
export type ClaimStatus = (typeof claimStatuses)[number];
export const claimStatusLabels: Record<ClaimStatus, string> = { reported: "Reported", filed: "Filed", settled: "Settled", rejected: "Not accepted", withdrawn: "Withdrawn" };

export const claimParties = ["carrier", "insurer", "partner", "kcpl"] as const;
export type ClaimParty = (typeof claimParties)[number];
export const claimPartyLabels: Record<ClaimParty, string> = { carrier: "Carrier or shipping line", insurer: "Insurer", partner: "Partner or agent", kcpl: "KCPL itself" };

export const claimCompensationMethods = ["credit_note", "refund", "insurer_paid", "none"] as const;
export type ClaimCompensationMethod = (typeof claimCompensationMethods)[number];
export const claimCompensationLabels: Record<ClaimCompensationMethod, string> = {
  credit_note: "Credit note on the customer's invoice",
  refund: "Refund to the customer",
  insurer_paid: "Insurer paid the customer directly",
  none: "Nothing to the customer",
};

export const CLAIM_MAX_PHOTOS = 6;

export type CargoClaim = {
  id: string;
  number: string;
  shipment_reference: string;
  branch: string;
  customer_id: string | null;
  customer_name: string | null;
  mode: string;
  kind: ClaimKind;
  description: string;
  noticed_on: string;
  /** What the customer puts the loss at, if they said. */
  claimed_amount: number | null;
  currency: string;
  status: ClaimStatus;
  /** The day notice has to reach the liable party by. */
  notice_due: string | null;
  against: ClaimParty | null;
  against_name: string | null;
  filed_on: string | null;
  filed_reference: string | null;
  recovered_amount: number | null;
  compensation_amount: number | null;
  compensation_method: ClaimCompensationMethod | null;
  outcome_note: string | null;
  reported_by_name: string;
  reported_source: "customer" | "staff";
  photo_document_ids: number[];
  created_at: string;
  updated_at: string;
};

function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function day(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null; }
function amount(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null; }

export function claimFromRecord(id: string, data: Record<string, unknown>): CargoClaim {
  return {
    id,
    number: text(data.number) ?? id,
    shipment_reference: text(data.shipment_reference) ?? "",
    branch: text(data.branch) ?? "",
    customer_id: text(data.customer_id),
    customer_name: text(data.customer_name),
    mode: text(data.mode) ?? "",
    kind: claimKinds.includes(data.kind as ClaimKind) ? data.kind as ClaimKind : "other",
    description: text(data.description) ?? "",
    noticed_on: day(data.noticed_on) ?? "",
    claimed_amount: data.claimed_amount === null || data.claimed_amount === undefined ? null : amount(data.claimed_amount),
    currency: text(data.currency) ?? "NPR",
    status: claimStatuses.includes(data.status as ClaimStatus) ? data.status as ClaimStatus : "reported",
    notice_due: day(data.notice_due),
    against: claimParties.includes(data.against as ClaimParty) ? data.against as ClaimParty : null,
    against_name: text(data.against_name),
    filed_on: day(data.filed_on),
    filed_reference: text(data.filed_reference),
    recovered_amount: data.recovered_amount === null || data.recovered_amount === undefined ? null : amount(data.recovered_amount),
    compensation_amount: data.compensation_amount === null || data.compensation_amount === undefined ? null : amount(data.compensation_amount),
    compensation_method: claimCompensationMethods.includes(data.compensation_method as ClaimCompensationMethod) ? data.compensation_method as ClaimCompensationMethod : null,
    outcome_note: text(data.outcome_note),
    reported_by_name: text(data.reported_by_name) ?? "",
    reported_source: data.reported_source === "customer" ? "customer" : "staff",
    photo_document_ids: Array.isArray(data.photo_document_ids) ? data.photo_document_ids.filter((item): item is number => typeof item === "number") : [],
    created_at: text(data.created_at) ?? "",
    updated_at: text(data.updated_at) ?? "",
  };
}

/**
 * The usual notice limit in days, counted from the day the problem was
 * found (normally delivery). Sea carriage gives three days for damage that
 * wasn't apparent at delivery; air gives 14 for damage and 21 for delay;
 * road carriage usually seven. A loss on air cargo is usually claimed within
 * 120 days of the air waybill.
 */
export function claimNoticeDays(mode: string, kind: ClaimKind) {
  const m = mode.toLowerCase();
  if (m === "air") return kind === "delay" ? 21 : kind === "loss" ? 120 : 14;
  if (m === "sea" || m === "ocean" || m === "multimodal") return 3;
  return 7;
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function claimNoticeDue(mode: string, kind: ClaimKind, noticedOn: string) {
  return addDays(noticedOn, claimNoticeDays(mode, kind));
}

/** Days left to give notice, while it hasn't been filed. Negative once past. */
export function claimNoticeDaysLeft(claim: Pick<CargoClaim, "status" | "notice_due">, today: string) {
  if (claim.status !== "reported" || !claim.notice_due) return null;
  return Math.round((Date.parse(`${claim.notice_due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function claimOpen(claim: Pick<CargoClaim, "status">) {
  return claim.status === "reported" || claim.status === "filed";
}

export type ClaimInputError = "kind" | "description" | "date" | "amount";

/** What the customer (or staff for them) reports. */
export function claimReportFromInput(input: Record<string, unknown>, today: string):
  { ok: true; value: { kind: ClaimKind; description: string; noticed_on: string; claimed_amount: number | null; currency: string } } | { ok: false; error: ClaimInputError } {
  const kind = typeof input.kind === "string" ? input.kind : "";
  if (!claimKinds.includes(kind as ClaimKind)) return { ok: false, error: "kind" };
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 2000) : "";
  if (description.length < 10) return { ok: false, error: "description" };
  const noticedOn = typeof input.noticedOn === "string" && input.noticedOn.trim() ? input.noticedOn.trim() : today;
  if (!day(noticedOn) || noticedOn > today) return { ok: false, error: "date" };
  const raw = input.claimedAmount;
  let claimed: number | null = null;
  if (raw !== undefined && raw !== null && raw !== "") {
    claimed = amount(raw);
    if (claimed === null || claimed > 1_000_000_000) return { ok: false, error: "amount" };
  }
  const currency = typeof input.currency === "string" && /^[A-Za-z]{3}$/.test(input.currency.trim()) ? input.currency.trim().toUpperCase() : "NPR";
  return { ok: true, value: { kind: kind as ClaimKind, description, noticed_on: noticedOn, claimed_amount: claimed, currency } };
}

export function claimFilingFromInput(input: Record<string, unknown>, claim: Pick<CargoClaim, "noticed_on">, today: string):
  { ok: true; value: { against: ClaimParty; against_name: string | null; filed_on: string; filed_reference: string | null } } | { ok: false; error: "party" | "date" } {
  const against = typeof input.against === "string" ? input.against : "";
  if (!claimParties.includes(against as ClaimParty)) return { ok: false, error: "party" };
  const filedOn = typeof input.filedOn === "string" && input.filedOn.trim() ? input.filedOn.trim() : today;
  if (!day(filedOn) || filedOn > today || (claim.noticed_on && filedOn < claim.noticed_on)) return { ok: false, error: "date" };
  const clean = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
  return { ok: true, value: { against: against as ClaimParty, against_name: clean(input.againstName, 120), filed_on: filedOn, filed_reference: clean(input.filedReference, 120) } };
}

export function claimSettlementFromInput(input: Record<string, unknown>):
  { ok: true; value: { recovered_amount: number; compensation_amount: number; compensation_method: ClaimCompensationMethod; outcome_note: string | null } } | { ok: false; error: "amount" | "method" | "note" } {
  const recovered = input.recoveredAmount === "" || input.recoveredAmount === undefined || input.recoveredAmount === null ? 0 : amount(input.recoveredAmount);
  const compensation = input.compensationAmount === "" || input.compensationAmount === undefined || input.compensationAmount === null ? 0 : amount(input.compensationAmount);
  if (recovered === null || compensation === null) return { ok: false, error: "amount" };
  const method = typeof input.compensationMethod === "string" ? input.compensationMethod : "";
  if (!claimCompensationMethods.includes(method as ClaimCompensationMethod)) return { ok: false, error: "method" };
  if (method === "none" && compensation > 0) return { ok: false, error: "method" };
  if (method !== "none" && method !== "insurer_paid" && compensation <= 0) return { ok: false, error: "amount" };
  const note = typeof input.outcomeNote === "string" && input.outcomeNote.trim() ? input.outcomeNote.trim().slice(0, 500) : null;
  return { ok: true, value: { recovered_amount: recovered, compensation_amount: compensation, compensation_method: method as ClaimCompensationMethod, outcome_note: note } };
}

/** A readable claim number: CLM, the year and month, and a short random tail. */
export function claimNumber(now: Date, random: string) {
  return `CLM-${now.toISOString().slice(0, 7).replace("-", "")}-${random.slice(0, 4).toUpperCase()}`;
}

/** What the customer sees: where it stands, never KCPL's internal note on who pays what. */
export type PortalClaimView = {
  id: string; number: string; kind: ClaimKind; description: string; noticed_on: string; status: ClaimStatus;
  claimed_amount: number | null; currency: string; compensation_amount: number | null; compensation_method: ClaimCompensationMethod | null;
  created_at: string; can_withdraw: boolean;
};

export function portalClaimView(claim: CargoClaim): PortalClaimView {
  return {
    id: claim.id, number: claim.number, kind: claim.kind, description: claim.description, noticed_on: claim.noticed_on, status: claim.status,
    claimed_amount: claim.claimed_amount, currency: claim.currency,
    compensation_amount: claim.status === "settled" ? claim.compensation_amount : null,
    compensation_method: claim.status === "settled" ? claim.compensation_method : null,
    created_at: claim.created_at, can_withdraw: claim.status === "reported",
  };
}

/** The badge for a claim on the Job File and the claims list: the notice countdown while it is unfiled. */
export function claimBadge(claim: CargoClaim, today: string): { tone: "neutral" | "info" | "warning" | "danger" | "success"; label: string } {
  const left = claimNoticeDaysLeft(claim, today);
  if (left !== null) {
    if (left < 0) return { tone: "danger", label: `Notice ${-left} day${left === -1 ? "" : "s"} late` };
    if (left === 0) return { tone: "danger", label: "Give notice today" };
    return { tone: left <= 2 ? "warning" : "info", label: `Notice in ${left} day${left === 1 ? "" : "s"}` };
  }
  if (claim.status === "filed") return { tone: "info", label: "Filed" };
  if (claim.status === "settled") return { tone: "success", label: "Settled" };
  if (claim.status === "rejected") return { tone: "danger", label: claimStatusLabels.rejected };
  return { tone: "neutral", label: claimStatusLabels[claim.status] };
}
