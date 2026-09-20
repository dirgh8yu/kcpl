import { portalText, type PortalLocale, type PortalTextKey } from "./portal/portal-i18n.ts";
/*
 * Free time, demurrage and detention.
 *
 * For a landlocked lane the clock at the port or the ICD is where money leaks:
 * a container that sits past its free days accrues a daily charge that nobody
 * notices until the invoice arrives. KCPL records what the carrier granted;
 * this module turns that into a countdown both sides can act on.
 *
 * Pure by design -- no Firebase, no clock of its own beyond the `today` it is
 * handed -- so the staff product, the portal and the notification sweep all
 * compute the same number from the same record, and the arithmetic is testable
 * without a runtime.
 *
 * Dates are calendar days, not timestamps. A free-time allowance is counted in
 * days by the carrier, and mixing a time zone into it would make the last day
 * ambiguous exactly when it matters most.
 */

export const freeTimeBearers = ["customer", "kcpl", "undecided"] as const;
export type FreeTimeBearer = (typeof freeTimeBearers)[number];

export const freeTimeBearerLabels: Record<FreeTimeBearer, string> = {
  customer: "Customer",
  kcpl: "KCPL",
  undecided: "Not yet agreed",
};

export const freeTimeStates = ["not_set", "running", "last_day", "expired"] as const;
export type FreeTimeState = (typeof freeTimeStates)[number];

export type ShipmentFreeTime = {
  location: string | null;
  /** Free days granted by the carrier or terminal. */
  days: number | null;
  /** Calendar day the clock started: discharge, gate-in or as agreed. */
  started_on: string | null;
  daily_charge: number | null;
  charge_currency: string | null;
  bearer: FreeTimeBearer;
  note: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export type FreeTimeStatus = {
  state: FreeTimeState;
  /** Last day inside the allowance, inclusive. */
  deadline: string | null;
  /** Days left including today. Zero on the last day, negative once past it. */
  daysRemaining: number;
  daysOverdue: number;
  /** Only once overdue, and only when a daily rate is on record. */
  projectedCharge: number | null;
};

function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayNumber(day: string) {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

function addDays(day: string, count: number) {
  return new Date((dayNumber(day) + count) * 86_400_000).toISOString().slice(0, 10);
}

export function shipmentFreeTimeFromRecord(data: Record<string, unknown>): ShipmentFreeTime {
  const days = typeof data.free_time_days === "number" && Number.isFinite(data.free_time_days)
    ? Math.trunc(data.free_time_days)
    : null;
  const charge = typeof data.free_time_daily_charge === "number" && Number.isFinite(data.free_time_daily_charge)
    ? data.free_time_daily_charge
    : null;
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    location: text(data.free_time_location),
    days: days !== null && days >= 0 ? days : null,
    started_on: validDay(data.free_time_started_on) ? data.free_time_started_on : null,
    daily_charge: charge !== null && charge >= 0 ? charge : null,
    charge_currency: text(data.free_time_charge_currency),
    bearer: freeTimeBearers.includes(data.free_time_bearer as FreeTimeBearer)
      ? data.free_time_bearer as FreeTimeBearer
      : "undecided",
    note: text(data.free_time_note),
    updated_at: text(data.free_time_updated_at),
    updated_by: text(data.free_time_updated_by),
  };
}

/**
 * Where the clock stands on a given day.
 *
 * `daysRemaining` counts today as remaining, so an allowance of 1 day starting
 * today expires at the end of today: that is the "last day" state, not an
 * expired one. Getting this off by one would either panic a customer a day
 * early or tell them they are safe on the day a charge starts.
 */
export function freeTimeStatus(freeTime: ShipmentFreeTime, today: string): FreeTimeStatus {
  if (freeTime.days === null || !freeTime.started_on || !validDay(today)) {
    return { state: "not_set", deadline: null, daysRemaining: 0, daysOverdue: 0, projectedCharge: null };
  }

  // A 3-day allowance beginning on the 1st covers the 1st, 2nd and 3rd.
  const deadline = addDays(freeTime.started_on, Math.max(0, freeTime.days - 1));
  const daysRemaining = dayNumber(deadline) - dayNumber(today);
  const daysOverdue = daysRemaining < 0 ? Math.abs(daysRemaining) : 0;

  const state: FreeTimeState = daysRemaining < 0 ? "expired" : daysRemaining === 0 ? "last_day" : "running";
  const projectedCharge = daysOverdue > 0 && freeTime.daily_charge !== null
    ? Number((freeTime.daily_charge * daysOverdue).toFixed(2))
    : null;

  return { state, deadline, daysRemaining, daysOverdue, projectedCharge };
}

/** Whether this shipment is worth putting in front of someone today. */
export function freeTimeNeedsAttention(status: FreeTimeStatus, warnWithinDays = 3) {
  if (status.state === "not_set") return false;
  return status.state === "expired" || status.state === "last_day" || status.daysRemaining <= warnWithinDays;
}

/**
 * The reminder thresholds a customer is notified at.
 *
 * Deliberately few. A daily countdown email is a countdown people stop reading,
 * and the point of the warning is that it still lands when it matters.
 */
export const freeTimeReminderThresholds = [3, 1, 0] as const;

export function freeTimeReminderThreshold(status: FreeTimeStatus): number | null {
  if (status.state === "not_set") return null;
  if (status.state === "expired") return null;
  return freeTimeReminderThresholds.find((threshold) => status.daysRemaining === threshold) ?? null;
}

export function freeTimeSummary(
  freeTime: ShipmentFreeTime,
  status: FreeTimeStatus,
  locale: PortalLocale = "en",
) {
  const location = freeTime.location ?? "";
  // Each case has a with- and without-location template rather than one
  // sentence plus a glued-on phrase: Nepali puts the place first, so a
  // sentence assembled in English word order reads as broken Nepali.
  const say = (key: string, vars: Record<string, string | number> = {}) =>
    portalText(locale, (location ? `${key}_at` : key) as PortalTextKey, { ...vars, location });

  if (status.state === "not_set") return portalText(locale, "fts.not_set");
  if (status.state === "expired") {
    return status.daysOverdue === 1
      ? say("fts.expired_yesterday")
      : say("fts.expired_days", { days: status.daysOverdue });
  }
  if (status.state === "last_day") return say("fts.last_day");
  return status.daysRemaining === 1
    ? say("fts.one_day")
    : say("fts.days", { days: status.daysRemaining });
}
