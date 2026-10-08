/*
 * The bases KCPL's money figures are worked out on, in one place so the Job
 * File, the customer page, Management and the credit check agree.
 *
 * Pure: no Firebase and no network. Exchange rates are handed in.
 */

function finite(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * What an invoice earns KCPL: the amount before tax. VAT on the invoice is
 * collected for the tax office, so counting it as revenue overstated every
 * margin by the tax rate. Adjustments and credits stay in.
 */
export function invoiceNetRevenue(data: Record<string, unknown>) {
  const total = finite(data.total);
  const tax = finite(data.tax_total);
  if (total !== null && tax !== null) return total - tax;
  const subtotal = finite(data.subtotal);
  if (subtotal !== null) return subtotal;
  return total ?? 0;
}

/** What a supplier bill costs the job: the amount before the VAT KCPL claims back. */
export function billNetCost(bill: { total: number; tax_total: number }) {
  return Math.round((bill.total - bill.tax_total) * 100) / 100;
}

/**
 * Whether a Job File cost counts toward the job. A cost typed in by hand and
 * later replaced by the supplier's approved bill is kept on record but no
 * longer counted, so the same trucking or handling charge is not added twice.
 */
export function jobCostCounts(data: Record<string, unknown>) {
  const superseded = data.superseded_by_payable;
  return !(typeof superseded === "string" && superseded.trim());
}

/** NPR for one unit of each currency, NPR itself being 1. */
export type NprRates = Readonly<Record<string, number>>;

export type RateTable = { rates: NprRates; date: string };

/** `amount` in `from` as `to`, through NPR. Null when either rate is missing. */
export function convertMoney(amount: number, from: string, to: string, rates: NprRates | null) {
  const source = from.trim().toUpperCase();
  const target = to.trim().toUpperCase();
  if (source === target) return amount;
  if (!rates) return null;
  const sourceRate = source === "NPR" ? 1 : rates[source];
  const targetRate = target === "NPR" ? 1 : rates[target];
  if (!sourceRate || !targetRate || !Number.isFinite(sourceRate) || !Number.isFinite(targetRate)) return null;
  return (amount * sourceRate) / targetRate;
}

/**
 * Amounts held in several currencies as one amount in `to`. Currencies with
 * no rate are left out and named, so a caller can say what is missing rather
 * than show a total that quietly drops them.
 */
export function sumInCurrency(amounts: Partial<Record<string, number>>, to: string, rates: NprRates | null) {
  let amount = 0;
  const missing: string[] = [];
  const converted: string[] = [];
  for (const [currency, value] of Object.entries(amounts)) {
    if (!value) continue;
    const inTarget = convertMoney(value, currency, to, rates);
    if (inTarget === null) {
      missing.push(currency);
      continue;
    }
    amount += inTarget;
    if (currency.toUpperCase() !== to.toUpperCase()) converted.push(currency);
  }
  return { amount: Math.round(amount * 100) / 100, missing: missing.sort(), converted: converted.sort() };
}

export type CombinedMargin =
  | { kind: "converted"; currency: string; revenue: number; cost: number; profit: number; margin_percent: number | null; rates_date: string }
  | { kind: "unconverted"; missing: string[] };

/**
 * A job's revenue and cost held in more than one currency, as one margin in
 * NPR. A USD invoice against NPR trucking and customs used to show the USD
 * revenue against no cost at all: a 100% margin.
 */
export function combinedMargin(
  revenue: Partial<Record<string, number>>,
  cost: Partial<Record<string, number>>,
  table: RateTable | null,
  currency = "NPR",
): CombinedMargin | null {
  const used = new Set([...Object.keys(revenue), ...Object.keys(cost)].filter((key) => revenue[key] || cost[key]));
  if (used.size <= 1) return null;
  const revenueTotal = sumInCurrency(revenue, currency, table?.rates ?? null);
  const costTotal = sumInCurrency(cost, currency, table?.rates ?? null);
  const missing = [...new Set([...revenueTotal.missing, ...costTotal.missing])].sort();
  if (!table || missing.length) return { kind: "unconverted", missing: missing.length ? missing : [...used].filter((key) => key !== currency).sort() };
  const profit = Math.round((revenueTotal.amount - costTotal.amount) * 100) / 100;
  return {
    kind: "converted",
    currency,
    revenue: revenueTotal.amount,
    cost: costTotal.amount,
    profit,
    margin_percent: revenueTotal.amount > 0 ? (profit / revenueTotal.amount) * 100 : null,
    rates_date: table.date,
  };
}
