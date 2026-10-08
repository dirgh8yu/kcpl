/*
 * Bikram Sambat (BS), Nepal's calendar, and its fiscal year.
 *
 * Nepal's tax invoices are dated and numbered in BS, and the fiscal year runs
 * from 1 Shrawan to the end of Ashadh (mid-July to mid-July). BS months have
 * no formula: their lengths are published year by year, so they are a table.
 * The table is taken from nepali_utils (MIT, (c) 2020 Sarbagya Dhaubanjar),
 * the library the KCPL apps already use, for BS 2070-2100 (AD 2013-2044).
 *
 * Pure: no clock of its own. Dates are calendar days (YYYY-MM-DD in AD).
 */

/** Days in each month, Baisakh to Chaitra, for each BS year. */
const BS_MONTH_DAYS = new Map<number, readonly number[]>([
  [2070, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30]],
  [2071, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2072, [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2073, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2074, [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2075, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2076, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30]],
  [2077, [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2078, [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2079, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2080, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30]],
  [2081, [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2082, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2083, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2084, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2085, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2086, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2087, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2088, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2089, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2090, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2091, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2092, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2093, [31, 31, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31]],
  [2094, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2095, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2096, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2097, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30]],
  [2098, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2099, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2100, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
]);

/** BS 2070-01-01 is AD 2013-04-14. */
const BS_ANCHOR = { year: 2070, ad: "2013-04-14" };

export const bsMonthNames = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"] as const;

export type BsDate = { year: number; month: number; day: number };

function dayNumber(ad: string) {
  return Math.floor(Date.parse(`${ad}T00:00:00Z`) / 86_400_000);
}

function validAd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

/** An AD calendar day as BS, or null outside the table's years. */
export function adToBs(ad: string): BsDate | null {
  const day = ad.slice(0, 10);
  if (!validAd(day)) return null;
  let remaining = dayNumber(day) - dayNumber(BS_ANCHOR.ad);
  if (remaining < 0) return null;
  let year = BS_ANCHOR.year;
  for (;;) {
    const months = BS_MONTH_DAYS.get(year);
    if (!months) return null;
    const length = months.reduce((sum, days) => sum + days, 0);
    if (remaining < length) {
      for (let month = 0; month < 12; month += 1) {
        if (remaining < months[month]) return { year, month: month + 1, day: remaining + 1 };
        remaining -= months[month];
      }
    }
    remaining -= length;
    year += 1;
  }
}

/** "22 Asoj 2083 BS", or "" outside the table. */
export function bsDateLabel(ad: string) {
  const bs = adToBs(ad);
  return bs ? `${bs.day} ${bsMonthNames[bs.month - 1]} ${bs.year} BS` : "";
}

/** "2083/10/22" (BS, month and day padded), as on Nepali paperwork. */
export function bsDateNumeric(ad: string) {
  const bs = adToBs(ad);
  return bs ? `${bs.year}/${String(bs.month).padStart(2, "0")}/${String(bs.day).padStart(2, "0")}` : "";
}

/**
 * The fiscal year a day falls in, as "2082-83": from 1 Shrawan (month 4) of
 * the first year to the end of Ashadh (month 3) of the next.
 */
export function nepalFiscalYear(ad: string) {
  const bs = adToBs(ad);
  if (!bs) return null;
  const start = bs.month >= 4 ? bs.year : bs.year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
