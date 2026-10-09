/*
 * Tax deducted at source (TDS), the rules only.
 *
 * Customers withhold TDS from what they pay KCPL and deposit it with the tax
 * office: the invoice is settled by it, though no cash arrives, and the
 * certificate they send is KCPL's claim against its own income tax. KCPL
 * withholds TDS from what it pays suppliers the same way, and owes it to the
 * tax office by the 25th of the next Nepali month.
 */

import { adToBs, bsToAd, nextBsMonth, nepalFiscalYear } from "../../nepali-calendar.ts";

export const withheldTaxDirections = ["by_customer", "by_kcpl"] as const;
export type WithheldTaxDirection = (typeof withheldTaxDirections)[number];

export const withheldTaxStatuses = ["certificate_pending", "certificate_received", "to_deposit", "deposited"] as const;
export type WithheldTaxStatus = (typeof withheldTaxStatuses)[number];

export const withheldTaxStatusLabels: Record<WithheldTaxStatus, string> = {
  certificate_pending: "Certificate to collect",
  certificate_received: "Certificate received",
  to_deposit: "To deposit",
  deposited: "Deposited",
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function amountOrZero(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const rounded = money(parsed);
  return Math.abs(parsed - rounded) < 0.005 ? rounded : null;
}

/**
 * Cash and TDS against what is owed. TDS never exceeds what is owed and is
 * never kept as credit: only cash can be more than owed, and only when
 * accounts keep the extra as the customer's credit.
 */
export function settlementWithTds(outstanding: number, cashRequested: unknown, tdsRequested: unknown, keepExcessAsCredit = false):
  | { ok: true; cash: number; tds: number; applied: number; excess: number }
  | { ok: false; reason: "invalid_amount" | "overpayment" } {
  const cash = amountOrZero(cashRequested);
  const tds = amountOrZero(tdsRequested);
  if (cash === null || tds === null || cash + tds <= 0) return { ok: false, reason: "invalid_amount" };
  const owed = money(Math.max(0, outstanding));
  if (tds - owed > 0.005) return { ok: false, reason: "overpayment" };
  const owedAfterTds = money(owed - tds);
  if (cash - owedAfterTds > 0.005 && !keepExcessAsCredit) return { ok: false, reason: "overpayment" };
  const cashApplied = money(Math.min(cash, owedAfterTds));
  return { ok: true, cash, tds, applied: money(cashApplied + tds), excess: money(cash - cashApplied) };
}

/** The date TDS withheld on a day must reach the tax office: the 25th of the next Nepali month. */
export function tdsDepositDue(withheldOn: string) {
  const bs = adToBs(withheldOn);
  if (!bs) return null;
  const next = nextBsMonth(bs.year, bs.month);
  return bsToAd(next.year, next.month, 25);
}

/** Where a withholding is filed: its fiscal year and Nepali month. */
export function withheldTaxPeriod(withheldOn: string) {
  const bs = adToBs(withheldOn);
  return bs ? { fiscal_year: nepalFiscalYear(withheldOn), bs_year: bs.year, bs_month: bs.month } : null;
}

export function withheldTaxInitialStatus(direction: WithheldTaxDirection, certificateNumber: string): WithheldTaxStatus {
  if (direction === "by_kcpl") return "to_deposit";
  return certificateNumber.trim() ? "certificate_received" : "certificate_pending";
}

/** TDS as a share of what it settled, for the record; null when nothing was settled. */
export function tdsRateOf(tds: number, settled: number) {
  return settled > 0 ? Math.round((tds / settled) * 10_000) / 100 : null;
}
