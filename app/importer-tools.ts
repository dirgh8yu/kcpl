/*
 * The sums behind the public site's free tools: what customs is likely to
 * charge on an import, what storage or demurrage costs past free time, and the
 * volume and chargeable weight of a consignment. Pure, so the pages and the
 * tests share one set of figures. Duty is the Job File's own calculation, and
 * free time counts days the way shipment-free-time.ts does (a test holds the
 * two together; that module is not imported because it brings the portal's
 * dictionary into a public page's JavaScript). Every result is an estimate:
 * customs' assessment and the carrier's invoice are the figures that count.
 */

import { computeDutyEstimate, DEFAULT_VAT_RATE, type DutyEstimateResult } from "./shipment-duty-estimate.ts";

function amount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/* ------------------------------------------------------------------ duty */

export type DutyToolError = "value" | "exchange" | "costs" | "rate";

/**
 * One line of goods: the invoice value, how it was quoted (FOB adds freight
 * and insurance; CIF already includes them), the customs exchange rate, and the
 * tariff's duty and excise rates. VAT is Nepal's 13% unless the reader changes it.
 */
export function dutyToolEstimate(raw: {
  value: unknown; currency: string; basis: unknown; freight: unknown; insurance: unknown; exchangeRate: unknown; dutyRate: unknown; exciseRate: unknown; vatRate?: unknown;
}): { ok: true; result: DutyEstimateResult } | { ok: false; error: DutyToolError } {
  const value = amount(raw.value);
  if (!(value > 0)) return { ok: false, error: "value" };
  const currency = /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : "USD";
  const exchangeRate = currency === "NPR" ? 1 : amount(raw.exchangeRate);
  if (!(exchangeRate > 0 && exchangeRate < 100_000)) return { ok: false, error: "exchange" };
  const basis = raw.basis === "CIF" ? "CIF" : "FOB";
  const freight = basis === "FOB" ? amount(raw.freight) : 0;
  const insurance = basis === "FOB" ? amount(raw.insurance) : 0;
  if (!(freight >= 0 && insurance >= 0)) return { ok: false, error: "costs" };
  const dutyRate = amount(raw.dutyRate);
  const exciseRate = amount(raw.exciseRate);
  const vatRate = raw.vatRate === undefined || raw.vatRate === "" ? DEFAULT_VAT_RATE : amount(raw.vatRate);
  if (!(dutyRate >= 0 && dutyRate <= 300 && exciseRate >= 0 && exciseRate <= 300 && vatRate >= 0 && vatRate <= 100)) return { ok: false, error: "rate" };
  return {
    ok: true,
    result: computeDutyEstimate({
      currency, basis, freight, insurance, exchange_rate: exchangeRate, vat_rate: vatRate,
      lines: [{ hs_code: "", description: "", value, duty_rate: dutyRate, excise_rate: exciseRate }],
      levies: [], shared_with_customer: false,
    }),
  };
}

/* --------------------------------------------------------------- storage */

export type StorageToolError = "dates" | "days" | "rate";

export type StorageToolResult = {
  /** Last day inside the allowance, inclusive; null when there are no free days. */
  lastFreeDay: string | null;
  chargeableDays: number;
  /** Each rate and the days it applies to, in order. */
  bands: Array<{ days: number; rate: number; amount: number }>;
  total: number;
};

function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
const dayFromNumber = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10);

/**
 * Days past free time between the day the clock started (discharge, gate-in)
 * and the day the cargo is collected, priced at a daily rate. Lines often raise
 * the rate after a number of chargeable days; a second rate covers that.
 * Free days count inclusively: three days from the 1st are the 1st, 2nd and
 * 3rd, and collecting on the 4th is one chargeable day.
 */
export function storageToolEstimate(raw: {
  startedOn: unknown; freeDays: unknown; collectOn: unknown; dailyRate: unknown; laterRate?: unknown; laterAfterDays?: unknown;
}): { ok: true; result: StorageToolResult } | { ok: false; error: StorageToolError } {
  if (!validDay(raw.startedOn) || !validDay(raw.collectOn) || raw.collectOn < raw.startedOn) return { ok: false, error: "dates" };
  const freeDays = amount(raw.freeDays);
  if (!(Number.isInteger(freeDays) && freeDays >= 0 && freeDays <= 365)) return { ok: false, error: "days" };
  const dailyRate = amount(raw.dailyRate);
  const laterRate = amount(raw.laterRate ?? "");
  const laterAfterDays = amount(raw.laterAfterDays ?? "");
  if (!(dailyRate >= 0) || !(laterRate >= 0) || !(Number.isInteger(laterAfterDays) && laterAfterDays >= 0)) return { ok: false, error: "rate" };

  // With no free days at all, the day the clock starts is already charged.
  const lastFree = dayNumber(raw.startedOn) + freeDays - 1;
  const chargeable = Math.max(0, dayNumber(raw.collectOn) - lastFree);
  const bands: StorageToolResult["bands"] = [];
  // The second rate applies only when both it and the day it starts from are given.
  const split = laterRate > 0 && laterAfterDays > 0 ? Math.min(chargeable, laterAfterDays) : chargeable;
  if (split > 0) bands.push({ days: split, rate: dailyRate, amount: round(split * dailyRate) });
  if (chargeable > split) bands.push({ days: chargeable - split, rate: laterRate, amount: round((chargeable - split) * laterRate) });
  return {
    ok: true,
    result: { lastFreeDay: freeDays > 0 ? dayFromNumber(lastFree) : null, chargeableDays: chargeable, bands, total: round(bands.reduce((sum, band) => sum + band.amount, 0)) },
  };
}

/* ---------------------------------------------------------------- volume */

/** Air freight's volumetric divisor: centimetres cubed per kilogram (IATA, 1:6). */
export const AIR_VOLUMETRIC_DIVISOR = 6000;

/** Nominal internal volume of the common boxes, in cubic metres. Cargo never fills one completely. */
export const containerVolumes = [
  { type: "20ft", cbm: 33.2 },
  { type: "40ft", cbm: 67.7 },
  { type: "40ft_hc", cbm: 76.3 },
] as const;

export type VolumePiece = { length: unknown; width: unknown; height: unknown; quantity: unknown; weight: unknown };

export type VolumeToolResult = {
  pieces: number;
  cbm: number;
  grossKg: number;
  /** Air: the greater of the gross weight and the volumetric weight. */
  volumetricKg: number;
  airChargeableKg: number;
  /** Sea LCL: weight or measure, whichever is greater (1 cubic metre = 1 tonne). */
  seaRevenueTonnes: number;
  containers: Array<{ type: (typeof containerVolumes)[number]["type"]; cbm: number; percent: number }>;
};

/**
 * The consignment's volume and chargeable weight from its pieces. Dimensions
 * in centimetres or inches, weight per piece in kilograms or pounds.
 */
export function volumeToolEstimate(pieces: VolumePiece[], units: { length: "cm" | "in"; weight: "kg" | "lb" }):
  { ok: true; result: VolumeToolResult } | { ok: false; error: "pieces" | "dimensions" } {
  const toCm = units.length === "in" ? 2.54 : 1;
  const toKg = units.weight === "lb" ? 0.45359237 : 1;
  let count = 0;
  let cubicCm = 0;
  let grossKg = 0;
  for (const piece of pieces) {
    const [length, width, height, quantity, weight] = [piece.length, piece.width, piece.height, piece.quantity, piece.weight].map(amount);
    // A row left blank is not a mistake: it's a row not used.
    if (!length && !width && !height && !weight) continue;
    if (!(length > 0 && width > 0 && height > 0) || !(quantity > 0 && Number.isInteger(quantity)) || !(weight >= 0)) return { ok: false, error: "dimensions" };
    count += quantity;
    cubicCm += length * toCm * width * toCm * height * toCm * quantity;
    grossKg += weight * toKg * quantity;
  }
  if (count === 0) return { ok: false, error: "pieces" };
  const cbm = cubicCm / 1_000_000;
  const volumetricKg = cubicCm / AIR_VOLUMETRIC_DIVISOR;
  return {
    ok: true,
    result: {
      pieces: count,
      cbm: Math.round(cbm * 1000) / 1000,
      grossKg: round(grossKg),
      volumetricKg: round(volumetricKg),
      airChargeableKg: round(Math.max(grossKg, volumetricKg)),
      seaRevenueTonnes: Math.round(Math.max(cbm, grossKg / 1000) * 1000) / 1000,
      containers: containerVolumes.map((box) => ({ type: box.type, cbm: box.cbm, percent: Math.round((cbm / box.cbm) * 100) })),
    },
  };
}
