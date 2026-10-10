/*
 * Filed VAT months. Once Accounts records that a Nepali month's VAT return is
 * filed, the documents dated in that month are closed: nothing new can be
 * dated into it and nothing in it can be voided. A correction is made in an
 * open month (a credit note, a later payment), as the tax office expects.
 * Management can reopen a month, with a reason that stays on the record.
 *
 * Pure: dates in, decisions out. The server module reads and writes the
 * records.
 */

import { adToBs, bsMonthNames, bsMonthRange } from "../../nepali-calendar.ts";

export const VAT_PERIODS = "vat_periods";

export type VatPeriodRef = { year: number; month: number; id: string; label: string };

export function vatPeriodId(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** The Nepali month an AD date falls in, or null outside the calendar. */
export function vatPeriodOfDate(date: string): VatPeriodRef | null {
  const bs = adToBs(date);
  if (!bs) return null;
  return { year: bs.year, month: bs.month, id: vatPeriodId(bs.year, bs.month), label: `${bsMonthNames[bs.month - 1]} ${bs.year}` };
}

/** The distinct months a set of dates falls in. */
export function vatPeriodsOfDates(dates: Array<string | null | undefined>) {
  const out = new Map<string, VatPeriodRef>();
  for (const date of dates) {
    const period = date ? vatPeriodOfDate(date) : null;
    if (period) out.set(period.id, period);
  }
  return [...out.values()];
}

/** A month can be marked filed only once it is over: the return covers the whole month. */
export function vatPeriodFileable(year: number, month: number, today: string) {
  const range = bsMonthRange(year, month);
  return Boolean(range && range.end < today);
}

export type VatFilingInput = { filedOn: string; reference: string };

/** The day the return was filed (after the month ended, not in the future) and the tax office's reference. */
export function vatFilingFromInput(year: number, month: number, input: { filedOn?: unknown; reference?: unknown }, today: string):
  { ok: true; filedOn: string; reference: string | null } | { ok: false; error: "not_ended" | "invalid_date" } {
  const range = bsMonthRange(year, month);
  if (!range || !(range.end < today)) return { ok: false, error: "not_ended" };
  const filedOn = typeof input.filedOn === "string" && input.filedOn.trim() ? input.filedOn.trim() : today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filedOn) || Number.isNaN(Date.parse(`${filedOn}T00:00:00Z`)) || filedOn <= range.end || filedOn > today) return { ok: false, error: "invalid_date" };
  const reference = typeof input.reference === "string" ? input.reference.trim().slice(0, 120) : "";
  return { ok: true, filedOn, reference: reference || null };
}

export function vatReopenReasonValid(reason: unknown) {
  return typeof reason === "string" && reason.trim().length >= 10;
}

/** What staff read when a date falls in a filed month. */
export function vatPeriodLockedMessage(label: string) {
  return `${label} is filed with the tax office, so its books are closed. Use a date in an open month, or ask Management to reopen ${label}.`;
}

/** The day a supplier bill counts in the purchase book: its own date, unless it came in after that month was filed. */
export function payableBookDate(data: { bill_date?: unknown; vat_booked_on?: unknown }) {
  const booked = typeof data.vat_booked_on === "string" ? data.vat_booked_on : "";
  return booked || (typeof data.bill_date === "string" ? data.bill_date : "");
}

export type VatPeriodSummary = { output_vat: number; input_vat: number; net_vat: number; sales: number; purchases: number };

/** Whether the books still show what was filed. Small rounding differences don't count. */
export function vatBooksChangedSinceFiling(filed: VatPeriodSummary | null, now: VatPeriodSummary) {
  if (!filed) return false;
  const differs = (a: number, b: number) => Math.abs(a - b) > 0.005;
  return differs(filed.output_vat, now.output_vat) || differs(filed.input_vat, now.input_vat) || filed.sales !== now.sales || filed.purchases !== now.purchases;
}
