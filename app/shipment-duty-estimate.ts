/*
 * What customs is likely to charge on an import, worked out before the cargo
 * arrives so the customer can have the money ready at the border.
 *
 * Nepal assesses on the CIF value in rupees at the customs exchange rate:
 * customs duty on CIF at the tariff rate for the HS code, excise (where the
 * goods carry it) on CIF plus duty, and 13% VAT on CIF plus duty plus excise.
 * Other levies are added as staff enter them. The rates come from the tariff
 * book for each line; only VAT has a default. Customs' own assessment is the
 * figure that counts; this is an estimate and says so wherever it is shown.
 *
 * Pure: the Job File, the portal and the apps compute the same figures.
 */

export const DEFAULT_VAT_RATE = 13;
export const DUTY_ESTIMATE_MAX_LINES = 20;
export const DUTY_ESTIMATE_MAX_LEVIES = 8;

export type DutyEstimateLine = {
  hs_code: string;
  description: string;
  /** In the invoice currency. */
  value: number;
  duty_rate: number;
  excise_rate: number;
};

export type DutyEstimateLevy = {
  label: string;
  /** Percent of CIF plus duty plus excise; or a fixed amount in rupees. */
  kind: "percent" | "fixed";
  amount: number;
};

export type DutyEstimateInput = {
  currency: string;
  /** FOB: freight and insurance are added. CIF: the invoice value already includes them. */
  basis: "FOB" | "CIF";
  freight: number;
  insurance: number;
  /** Rupees per unit of the invoice currency, as customs will use it. */
  exchange_rate: number;
  vat_rate: number;
  lines: DutyEstimateLine[];
  levies: DutyEstimateLevy[];
  shared_with_customer: boolean;
};

export type DutyEstimateResult = {
  invoice_value: number;
  cif_value: number;
  cif_npr: number;
  lines: Array<DutyEstimateLine & { cif_npr: number; duty: number; excise: number; vat: number }>;
  duty: number;
  excise: number;
  vat: number;
  levies: Array<DutyEstimateLevy & { npr: number }>;
  levy_total: number;
  total: number;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** The estimate as entered, checked. Errors are sentences for the person entering it. */
export function dutyEstimateFromInput(raw: Record<string, unknown>): { ok: true; input: DutyEstimateInput } | { ok: false; error: string } {
  const currency = typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "Choose the invoice currency." };
  const basis = raw.basis === "CIF" ? "CIF" : "FOB";
  const freight = number(raw.freight);
  const insurance = number(raw.insurance);
  const exchangeRate = currency === "NPR" ? 1 : number(raw.exchangeRate);
  const vatRate = raw.vatRate === undefined || raw.vatRate === "" ? DEFAULT_VAT_RATE : number(raw.vatRate);
  if (![freight, insurance].every((value) => Number.isFinite(value) && value >= 0)) return { ok: false, error: "Freight and insurance must be zero or more." };
  if (!(exchangeRate > 0 && exchangeRate < 100_000)) return { ok: false, error: "Enter the customs exchange rate: rupees for one unit of the invoice currency." };
  if (!(vatRate >= 0 && vatRate <= 100)) return { ok: false, error: "VAT must be between 0 and 100%." };
  const rawLines = Array.isArray(raw.lines) ? raw.lines.slice(0, DUTY_ESTIMATE_MAX_LINES + 1) : [];
  if (!rawLines.length) return { ok: false, error: "Add at least one line with its HS code, value and duty rate." };
  if (rawLines.length > DUTY_ESTIMATE_MAX_LINES) return { ok: false, error: `Up to ${DUTY_ESTIMATE_MAX_LINES} lines.` };
  const lines: DutyEstimateLine[] = [];
  for (const [index, item] of rawLines.entries()) {
    const line = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const hs = typeof line.hsCode === "string" ? line.hsCode.replace(/[\s.]/g, "") : "";
    const value = number(line.value);
    const duty = number(line.dutyRate);
    const excise = number(line.exciseRate);
    if (!/^\d{4,10}$/.test(hs)) return { ok: false, error: `Line ${index + 1}: enter the HS code, 4 to 10 digits.` };
    if (!(value > 0)) return { ok: false, error: `Line ${index + 1}: enter the goods' value.` };
    if (!(duty >= 0 && duty <= 300)) return { ok: false, error: `Line ${index + 1}: the duty rate must be between 0 and 300%.` };
    if (!(excise >= 0 && excise <= 300)) return { ok: false, error: `Line ${index + 1}: the excise rate must be between 0 and 300%.` };
    lines.push({ hs_code: hs, description: typeof line.description === "string" ? line.description.trim().slice(0, 120) : "", value: round(value), duty_rate: duty, excise_rate: excise });
  }
  const rawLevies = Array.isArray(raw.levies) ? raw.levies.slice(0, DUTY_ESTIMATE_MAX_LEVIES) : [];
  const levies: DutyEstimateLevy[] = [];
  for (const item of rawLevies) {
    const levy = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const label = typeof levy.label === "string" ? levy.label.trim().slice(0, 60) : "";
    const amount = number(levy.amount);
    if (!label && !(amount > 0)) continue;
    if (!label) return { ok: false, error: "Name each extra levy." };
    if (!(amount >= 0) || (levy.kind === "percent" && amount > 100)) return { ok: false, error: `${label}: enter a rate up to 100%, or a fixed amount.` };
    levies.push({ label, kind: levy.kind === "fixed" ? "fixed" : "percent", amount });
  }
  return { ok: true, input: { currency, basis, freight: round(freight), insurance: round(insurance), exchange_rate: exchangeRate, vat_rate: vatRate, lines, levies, shared_with_customer: raw.sharedWithCustomer === true } };
}

/**
 * The figures. Freight and insurance are shared across the lines by value,
 * so each HS line is assessed on its own CIF; VAT is on CIF plus duty plus
 * excise; extra percentage levies are on the same base, outside VAT.
 */
export function computeDutyEstimate(input: DutyEstimateInput): DutyEstimateResult {
  const invoiceValue = round(input.lines.reduce((sum, line) => sum + line.value, 0));
  const extra = input.basis === "FOB" ? input.freight + input.insurance : 0;
  const lines = input.lines.map((line) => {
    const share = invoiceValue > 0 ? line.value / invoiceValue : 0;
    const cifNpr = round((line.value + extra * share) * input.exchange_rate);
    const duty = round(cifNpr * line.duty_rate / 100);
    const excise = round((cifNpr + duty) * line.excise_rate / 100);
    const vat = round((cifNpr + duty + excise) * input.vat_rate / 100);
    return { ...line, cif_npr: cifNpr, duty, excise, vat };
  });
  const sum = (pick: (line: (typeof lines)[number]) => number) => round(lines.reduce((total, line) => total + pick(line), 0));
  const cifNpr = sum((line) => line.cif_npr);
  const duty = sum((line) => line.duty);
  const excise = sum((line) => line.excise);
  const vat = sum((line) => line.vat);
  const base = cifNpr + duty + excise;
  const levies = input.levies.map((levy) => ({ ...levy, npr: round(levy.kind === "percent" ? base * levy.amount / 100 : levy.amount) }));
  const levyTotal = round(levies.reduce((total, levy) => total + levy.npr, 0));
  return {
    invoice_value: invoiceValue,
    cif_value: round(invoiceValue + extra),
    cif_npr: cifNpr,
    lines,
    duty,
    excise,
    vat,
    levies,
    levy_total: levyTotal,
    total: round(duty + excise + vat + levyTotal),
  };
}

export type StoredDutyEstimate = DutyEstimateInput & {
  result: DutyEstimateResult;
  rate_note: string | null;
  updated_at: string;
  updated_by_name: string;
};

export function storedDutyEstimate(value: unknown): StoredDutyEstimate | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const result = data.result as DutyEstimateResult | undefined;
  if (!result || typeof result.total !== "number" || !Array.isArray(data.lines)) return null;
  return data as unknown as StoredDutyEstimate;
}
