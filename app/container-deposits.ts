/*
 * Container deposits: money paid to a shipping line (or its agent) before it
 * releases boxes for inland transit, and owed back once the empties are
 * returned, less any detention or damage the line deducts. Each deposit
 * covers some of a shipment's containers.
 *
 * Pure: records in, stages and checks out.
 */

import { containerDetention, type ShipmentContainer } from "./shipment-containers.ts";

export const CONTAINER_DEPOSITS = "container_deposits";

export const depositStatuses = ["held", "claimed", "refunded", "written_off"] as const;
export type DepositStatus = (typeof depositStatuses)[number];

export const depositPayers = ["kcpl", "customer"] as const;
export type DepositPayer = (typeof depositPayers)[number];
export const depositPayerLabels: Record<DepositPayer, string> = { kcpl: "KCPL paid it", customer: "The customer paid it" };

export const depositDeductionReasons = ["detention", "damage", "cleaning", "other"] as const;
export type DepositDeductionReason = (typeof depositDeductionReasons)[number];
export const depositDeductionReasonLabels: Record<DepositDeductionReason, string> = { detention: "Detention", damage: "Damage or repair", cleaning: "Cleaning", other: "Other" };

/** After the empties are back, a claim not filed within this many days is late. */
export const DEPOSIT_CLAIM_DAYS = 7;
/** A refund not received this many days after the claim is overdue. */
export const DEPOSIT_REFUND_DAYS = 30;

export type ContainerDeposit = {
  id: string;
  shipment_reference: string;
  branch: string;
  customer_name: string | null;
  shipping_line: string;
  bl_number: string | null;
  container_numbers: string[];
  currency: string;
  amount: number;
  paid_on: string;
  paid_by: DepositPayer;
  payment_reference: string | null;
  status: DepositStatus;
  claimed_on: string | null;
  claim_reference: string | null;
  refunded_on: string | null;
  amount_refunded: number | null;
  deduction: number | null;
  deduction_reason: DepositDeductionReason | null;
  closed_note: string | null;
  written_off_on: string | null;
  note: string | null;
  created_by_name: string | null;
  updated_at: string | null;
};

function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function num(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function day(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function depositFromRecord(id: string, data: Record<string, unknown>): ContainerDeposit {
  const status = depositStatuses.includes(data.status as DepositStatus) ? data.status as DepositStatus : "held";
  return {
    id,
    shipment_reference: text(data.shipment_reference) ?? "",
    branch: text(data.branch) ?? "",
    customer_name: text(data.customer_name),
    shipping_line: text(data.shipping_line) ?? "Shipping line",
    bl_number: text(data.bl_number),
    container_numbers: Array.isArray(data.container_numbers) ? data.container_numbers.filter((item): item is string => typeof item === "string") : [],
    currency: text(data.currency) ?? "NPR",
    amount: round(num(data.amount)),
    paid_on: day(data.paid_on) ?? "",
    paid_by: data.paid_by === "customer" ? "customer" : "kcpl",
    payment_reference: text(data.payment_reference),
    status,
    claimed_on: day(data.claimed_on),
    claim_reference: text(data.claim_reference),
    refunded_on: day(data.refunded_on),
    amount_refunded: data.amount_refunded === null || data.amount_refunded === undefined ? null : round(num(data.amount_refunded)),
    deduction: data.deduction === null || data.deduction === undefined ? null : round(num(data.deduction)),
    deduction_reason: depositDeductionReasons.includes(data.deduction_reason as DepositDeductionReason) ? data.deduction_reason as DepositDeductionReason : null,
    closed_note: text(data.closed_note),
    written_off_on: day(data.written_off_on),
    note: text(data.note),
    created_by_name: text(data.created_by_name),
    updated_at: text(data.updated_at),
  };
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type DepositStage =
  | { stage: "boxes_out"; out: number; total: number }
  | { stage: "to_claim"; since: string; days: number; late: boolean }
  | { stage: "claimed"; days: number; overdue: boolean }
  | { stage: "refunded" }
  | { stage: "written_off" };

/**
 * Where a deposit is: boxes still out, empties back so the refund can be
 * claimed, claimed and waiting, or closed. A deposit with no containers
 * listed covers every container on the shipment.
 */
export function depositStage(deposit: ContainerDeposit, containers: ShipmentContainer[], today: string): DepositStage {
  if (deposit.status === "refunded") return { stage: "refunded" };
  if (deposit.status === "written_off") return { stage: "written_off" };
  if (deposit.status === "claimed") {
    const days = deposit.claimed_on ? Math.max(0, daysBetween(deposit.claimed_on, today)) : 0;
    return { stage: "claimed", days, overdue: days > DEPOSIT_REFUND_DAYS };
  }
  const covered = coveredContainers(deposit, containers);
  const out = covered.filter((container) => !container.empty_returned_on).length;
  if (!covered.length || out > 0) return { stage: "boxes_out", out: covered.length ? out : 0, total: covered.length };
  const since = covered.map((container) => container.empty_returned_on as string).sort().at(-1) as string;
  const days = Math.max(0, daysBetween(since, today));
  return { stage: "to_claim", since, days, late: days > DEPOSIT_CLAIM_DAYS };
}

export function coveredContainers(deposit: Pick<ContainerDeposit, "container_numbers">, containers: ShipmentContainer[]) {
  if (!deposit.container_numbers.length) return containers;
  const wanted = new Set(deposit.container_numbers);
  return containers.filter((container) => wanted.has(container.number));
}

/**
 * What the line is likely to keep: detention run up on the covered boxes.
 * Detention in the deposit's currency comes off it; detention in another
 * currency is listed separately, never converted.
 */
export function expectedDepositDeduction(deposit: ContainerDeposit, containers: ShipmentContainer[], today: string) {
  let same = 0;
  const other = new Map<string, number>();
  for (const container of coveredContainers(deposit, containers)) {
    const charge = containerDetention(container, today).projectedCharge;
    if (!charge) continue;
    const currency = (container.detention_currency ?? deposit.currency).toUpperCase();
    if (currency === deposit.currency.toUpperCase()) same += charge;
    else other.set(currency, (other.get(currency) ?? 0) + charge);
  }
  return {
    deduction: round(Math.min(same, deposit.amount)),
    expected_back: round(Math.max(0, deposit.amount - same)),
    other: [...other.entries()].map(([currency, amount]) => ({ currency, amount: round(amount) })),
  };
}

export type DepositInputError = "amount" | "date" | "line" | "containers" | "payer";

export function depositFromInput(input: Record<string, unknown>, shipmentContainers: string[], today: string):
  { ok: true; value: { shipping_line: string; bl_number: string | null; container_numbers: string[]; currency: string; amount: number; paid_on: string; paid_by: DepositPayer; payment_reference: string | null; note: string | null } } | { ok: false; error: DepositInputError } {
  const line = typeof input.shippingLine === "string" ? input.shippingLine.trim().slice(0, 120) : "";
  if (line.length < 2) return { ok: false, error: "line" };
  const amount = round(num(input.amount));
  if (!(amount > 0) || amount > 100_000_000) return { ok: false, error: "amount" };
  const paidOn = typeof input.paidOn === "string" && input.paidOn.trim() ? input.paidOn.trim() : today;
  if (!day(paidOn) || Number.isNaN(Date.parse(`${paidOn}T00:00:00Z`)) || paidOn > today) return { ok: false, error: "date" };
  const payer = typeof input.paidBy === "string" ? input.paidBy : "kcpl";
  if (!depositPayers.includes(payer as DepositPayer)) return { ok: false, error: "payer" };
  const raw = Array.isArray(input.containerNumbers) ? input.containerNumbers : [];
  const numbers = [...new Set(raw.filter((item): item is string => typeof item === "string").map((item) => item.trim().toUpperCase()).filter(Boolean))];
  if (numbers.some((number) => !shipmentContainers.includes(number))) return { ok: false, error: "containers" };
  // Every container on the shipment is the same as none listed: stored as none, so boxes added later are covered.
  const containerNumbers = numbers.length === shipmentContainers.length ? [] : numbers;
  const currency = typeof input.currency === "string" && /^[A-Za-z]{3}$/.test(input.currency.trim()) ? input.currency.trim().toUpperCase() : "NPR";
  const clean = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
  return { ok: true, value: {
    shipping_line: line, bl_number: clean(input.blNumber, 60), container_numbers: containerNumbers, currency, amount, paid_on: paidOn,
    paid_by: payer as DepositPayer, payment_reference: clean(input.paymentReference, 120), note: clean(input.note, 300),
  } };
}

/** The refund as received: never more than the deposit; anything kept back needs a reason. */
export function depositRefundFromInput(deposit: Pick<ContainerDeposit, "amount" | "claimed_on" | "paid_on">, input: Record<string, unknown>, today: string):
  { ok: true; value: { refunded_on: string; amount_refunded: number; deduction: number; deduction_reason: DepositDeductionReason | null; closed_note: string | null } } | { ok: false; error: "amount" | "date" | "reason" } {
  const received = round(num(input.amountReceived));
  if (received < 0 || received - deposit.amount > 0.005 || input.amountReceived === "" || input.amountReceived === null || input.amountReceived === undefined) return { ok: false, error: "amount" };
  const on = typeof input.receivedOn === "string" && input.receivedOn.trim() ? input.receivedOn.trim() : today;
  if (!day(on) || on > today || (deposit.paid_on && on < deposit.paid_on)) return { ok: false, error: "date" };
  const deduction = round(deposit.amount - received);
  const reason = typeof input.deductionReason === "string" && depositDeductionReasons.includes(input.deductionReason as DepositDeductionReason) ? input.deductionReason as DepositDeductionReason : null;
  if (deduction > 0.005 && !reason) return { ok: false, error: "reason" };
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 300) : null;
  if (deduction > 0.005 && reason === "other" && !note) return { ok: false, error: "reason" };
  return { ok: true, value: { refunded_on: on, amount_refunded: received, deduction: deduction > 0.005 ? deduction : 0, deduction_reason: deduction > 0.005 ? reason : null, closed_note: note } };
}

/**
 * For the cash-flow view: a deposit KCPL paid and has claimed back is money
 * due in, DEPOSIT_REFUND_DAYS after the claim, less the detention the line is
 * likely to keep. One the customer paid goes back to them, and a deposit
 * still out has no date yet, so neither is counted.
 */
export function depositRefundDue(deposit: ContainerDeposit, containers: ShipmentContainer[], today: string): { date: string; amount: number } | null {
  if (deposit.status !== "claimed" || deposit.paid_by !== "kcpl" || !deposit.claimed_on) return null;
  const due = new Date(`${deposit.claimed_on}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + DEPOSIT_REFUND_DAYS);
  const amount = expectedDepositDeduction(deposit, containers, today).expected_back;
  return amount > 0 ? { date: due.toISOString().slice(0, 10), amount } : null;
}

/** Totals still with the lines, by currency, for the deposits register. */
export function depositsOutstanding(deposits: ContainerDeposit[]) {
  const totals = new Map<string, number>();
  for (const deposit of deposits) {
    if (deposit.status === "refunded" || deposit.status === "written_off") continue;
    totals.set(deposit.currency, round((totals.get(deposit.currency) ?? 0) + deposit.amount));
  }
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount);
}

/** The badge for a deposit's stage, as the Job File and the register show it. */
export function depositStageBadge(stage: DepositStage): { tone: "neutral" | "info" | "warning" | "danger" | "success"; label: string } {
  switch (stage.stage) {
    case "boxes_out": return { tone: "neutral", label: stage.total ? `${stage.out} of ${stage.total} still out` : "No containers yet" };
    case "to_claim": return { tone: stage.late ? "danger" : "warning", label: stage.late ? `Unclaimed ${stage.days} days` : "Empties back: claim it" };
    case "claimed": return { tone: stage.overdue ? "danger" : "info", label: stage.overdue ? `Refund overdue: claimed ${stage.days} days ago` : `Claimed ${stage.days} day${stage.days === 1 ? "" : "s"} ago` };
    case "refunded": return { tone: "success", label: "Refunded" };
    default: return { tone: "neutral", label: "Written off" };
  }
}
