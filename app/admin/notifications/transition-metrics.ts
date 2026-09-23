import type { OperationsNotification } from "./notification-data";

/**
 * Pure NPT (UTC+5:45) day boundary used for "today" in operational history:
 * notification bucketing, CSV export, transitions views. Pure so tests can
 * pin the bucketing.
 */
export function nptDayStart(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.NEGATIVE_INFINITY;
  const npt = new Date(date.getTime() + 5.75 * 3_600_000);
  return Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate()) - 5.75 * 3_600_000;
}

/**
 * Register transitions emitted by the live register poll. They carry
 * source_type "register-transition" and land in the "activity" category.
 */
export const TRANSITION_SOURCE_TYPE = "register-transition";

export function isRegisterTransition(item: OperationsNotification): boolean {
  return item.source_type === TRANSITION_SOURCE_TYPE || (item.category === "activity" && item.source_id.startsWith("notification-"));
}

/**
 * Columns for the 7-day sparkline: NPT day boundaries, oldest → newest
 * (today last). Pure so tests can pin the bucketing.
 */
export function sparklineBuckets(items: OperationsNotification[], now: Date): number[] {
  const todayStart = nptDayStart(now.toISOString());
  const dayMs = 86_400_000;
  const buckets = new Array<number>(7).fill(0);
  for (const item of items) {
    if (!isRegisterTransition(item)) continue;
    const created = Date.parse(item.created_at);
    if (!Number.isFinite(created)) continue;
    const offset = Math.floor((todayStart - nptDayStart(item.created_at)) / dayMs);
    if (offset >= 0 && offset < 7) buckets[6 - offset] += 1;
  }
  return buckets;
}
