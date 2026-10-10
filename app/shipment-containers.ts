import { freeTimeBearers, freeTimeStatus, type FreeTimeBearer, type FreeTimeStatus } from "./shipment-free-time.ts";

/*
 * Containers on a shipment, and detention on each.
 *
 * Demurrage is the shipment's clock at the port or ICD (shipment-free-time).
 * Detention is each container's own clock once it leaves the port full: the
 * line gives so many free days to get the empty back to its depot, then
 * charges by the day. The count is the same arithmetic, so it reuses the same
 * countdown, started at gate-out and stopped when the empty is returned.
 *
 * Pure: the Job File, the portal and the apps compute the same figures.
 */

export const containerSizeTypes = ["20GP", "40GP", "40HC", "45HC", "20RF", "40RF", "20OT", "40OT", "20FR", "40FR", "20TK"] as const;
export type ContainerSizeType = (typeof containerSizeTypes)[number];

export const containerSizeTypeLabels: Record<ContainerSizeType, string> = {
  "20GP": "20′ standard",
  "40GP": "40′ standard",
  "40HC": "40′ high cube",
  "45HC": "45′ high cube",
  "20RF": "20′ reefer",
  "40RF": "40′ reefer",
  "20OT": "20′ open top",
  "40OT": "40′ open top",
  "20FR": "20′ flat rack",
  "40FR": "40′ flat rack",
  "20TK": "20′ tank",
};

export type ShipmentContainer = {
  id: string;
  number: string;
  size_type: ContainerSizeType;
  seal_number: string | null;
  /** Left the port or ICD full, onto the truck: detention starts. */
  gated_out_on: string | null;
  delivered_on: string | null;
  /** The empty went back to the line's depot: detention stops. */
  empty_returned_on: string | null;
  return_depot: string | null;
  detention_free_days: number | null;
  detention_daily_rate: number | null;
  detention_currency: string | null;
  detention_bearer: FreeTimeBearer;
  note: string | null;
  updated_at: string | null;
};

export type ContainerStage = "at_port" | "out" | "returned";

const LETTER_VALUES: Record<string, number> = (() => {
  // A is 10; values that are multiples of 11 are skipped (ISO 6346).
  const out: Record<string, number> = {};
  let value = 10;
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (value % 11 === 0) value += 1;
    out[letter] = value;
    value += 1;
  }
  return out;
})();

/** A container number as written on the box: four letters, six digits and a check digit. */
export function normalizeContainerNumber(input: unknown) {
  return typeof input === "string" ? input.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

/**
 * Whether the check digit agrees with the rest, as the line's systems check
 * it. A typo here means the line can't find the box, so it is caught on entry.
 */
export function containerNumberValid(input: unknown) {
  const number = normalizeContainerNumber(input);
  if (!/^[A-Z]{3}[UJZ][0-9]{7}$/.test(number)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const char = number[index];
    const value = index < 4 ? LETTER_VALUES[char] : Number(char);
    sum += value * 2 ** index;
  }
  return (sum % 11) % 10 === Number(number[10]);
}

/** Several numbers pasted at once: one per line, or separated by commas or spaces. */
export function parseContainerNumbers(input: unknown) {
  const raw = typeof input === "string" ? input : "";
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const piece of raw.split(/[\n,;]+/)) {
    // "MSKU 123456 7" is one number with spaces; several on one line run together into a multiple of eleven.
    const joined = normalizeContainerNumber(piece);
    const numbers = joined.length > 11 && joined.length % 11 === 0 ? joined.match(/.{11}/g) ?? [joined] : [joined];
    for (const number of numbers) {
      if (!number || seen.has(number)) continue;
      seen.add(number);
      (containerNumberValid(number) ? valid : invalid).push(number);
    }
  }
  return { valid, invalid };
}

function day(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function amount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function containerFromRecord(id: string, data: Record<string, unknown>): ShipmentContainer {
  const freeDays = amount(data.detention_free_days);
  return {
    id,
    number: normalizeContainerNumber(data.number),
    size_type: containerSizeTypes.includes(data.size_type as ContainerSizeType) ? data.size_type as ContainerSizeType : "40HC",
    seal_number: text(data.seal_number),
    gated_out_on: day(data.gated_out_on),
    delivered_on: day(data.delivered_on),
    empty_returned_on: day(data.empty_returned_on),
    return_depot: text(data.return_depot),
    detention_free_days: freeDays === null ? null : Math.trunc(freeDays),
    detention_daily_rate: amount(data.detention_daily_rate),
    detention_currency: text(data.detention_currency),
    detention_bearer: freeTimeBearers.includes(data.detention_bearer as FreeTimeBearer) ? data.detention_bearer as FreeTimeBearer : "undecided",
    note: text(data.note),
    updated_at: text(data.updated_at),
  };
}

export function containerStage(container: ShipmentContainer): ContainerStage {
  if (container.empty_returned_on) return "returned";
  if (container.gated_out_on) return "out";
  return "at_port";
}

/** The detention countdown for one container: from gate-out, stopped by the empty's return. */
export function containerDetention(container: ShipmentContainer, today: string): FreeTimeStatus {
  return freeTimeStatus({
    location: container.return_depot,
    days: container.detention_free_days,
    started_on: container.gated_out_on,
    daily_charge: container.detention_daily_rate,
    charge_currency: container.detention_currency,
    bearer: container.detention_bearer,
    note: null,
    updated_at: null,
    updated_by: null,
    ended_on: container.empty_returned_on,
  }, today);
}

/** The dates must run in order: out, delivered, empty back. */
export function containerDatesInOrder(container: Pick<ShipmentContainer, "gated_out_on" | "delivered_on" | "empty_returned_on">) {
  const dates = [container.gated_out_on, container.delivered_on, container.empty_returned_on];
  let last: string | null = null;
  for (const date of dates) {
    if (!date) continue;
    if (last && date < last) return false;
    last = date;
  }
  if (container.empty_returned_on && !container.gated_out_on) return false;
  return true;
}

/** One line for a shipment: how many boxes, how many still out, and detention running up. */
export function containersSummary(containers: ShipmentContainer[], today: string) {
  const out = containers.filter((container) => containerStage(container) === "out");
  const statuses = containers.map((container) => ({ container, detention: containerDetention(container, today) }));
  const overdue = statuses.filter((item) => item.detention.state === "expired");
  const dueSoon = statuses.filter((item) => item.container.empty_returned_on === null && (item.detention.state === "last_day" || (item.detention.state === "running" && item.detention.daysRemaining <= 2)));
  const charges = new Map<string, number>();
  for (const item of overdue) {
    if (item.detention.projectedCharge === null) continue;
    const currency = item.container.detention_currency ?? "USD";
    charges.set(currency, Number(((charges.get(currency) ?? 0) + item.detention.projectedCharge).toFixed(2)));
  }
  return {
    total: containers.length,
    out: out.length,
    returned: containers.filter((container) => containerStage(container) === "returned").length,
    overdue: overdue.length,
    dueSoon: dueSoon.length,
    charges: [...charges.entries()].map(([currency, total]) => ({ currency, total })),
  };
}

export const containerMovements = ["gated_out", "delivered", "empty_returned"] as const;
export type ContainerMovement = (typeof containerMovements)[number];
const movementField: Record<ContainerMovement, "gated_out_on" | "delivered_on" | "empty_returned_on"> = {
  gated_out: "gated_out_on", delivered: "delivered_on", empty_returned: "empty_returned_on",
};

/**
 * One date recorded from the field (the Ops app): out of the port, delivered,
 * or the empty back at the depot. Only that date changes; it must not be in
 * the future and must keep the three in order.
 */
export function containerMovementUpdate(container: Pick<ShipmentContainer, "gated_out_on" | "delivered_on" | "empty_returned_on">, movement: unknown, on: unknown, today: string):
  { ok: true; field: "gated_out_on" | "delivered_on" | "empty_returned_on"; value: string } | { ok: false; error: "movement" | "date" | "order" } {
  if (!containerMovements.includes(movement as ContainerMovement)) return { ok: false, error: "movement" };
  const value = typeof on === "string" && on.trim() ? on.trim() : today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || value > today) return { ok: false, error: "date" };
  const field = movementField[movement as ContainerMovement];
  const next = { gated_out_on: container.gated_out_on, delivered_on: container.delivered_on, empty_returned_on: container.empty_returned_on, [field]: value };
  if (!containerDatesInOrder(next)) return { ok: false, error: "order" };
  return { ok: true, field, value };
}
