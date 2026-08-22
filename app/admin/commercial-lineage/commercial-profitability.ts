import { commercialMoney, normalizeCommercialCurrency } from "./commercial-lineage.ts";

export type CommercialAmount = {
  amount: number | null;
  currency: string | null;
};

export type CommercialProfitabilityFacts = {
  expectedRevenue: CommercialAmount;
  expectedProcurement: CommercialAmount;
  actualProcurement: CommercialAmount;
};

function normalizedAmount(value: CommercialAmount) {
  const currency = normalizeCommercialCurrency(value.currency);
  if (!currency || value.amount === null) return { amount: null, currency: currency || null };
  const amount = commercialMoney(value.amount, currency);
  return { amount: amount !== null && amount >= 0 ? amount : null, currency };
}

function profit(revenue: number, cost: number, currency: string) {
  const amount = commercialMoney(revenue - cost, currency) ?? 0;
  const marginPercent = revenue > 0 ? (amount / revenue) * 100 : null;
  return { amount, marginPercent };
}

export function commercialProfitabilityFromFacts(input: CommercialProfitabilityFacts) {
  const expectedRevenue = normalizedAmount(input.expectedRevenue);
  const expectedProcurement = normalizedAmount(input.expectedProcurement);
  const actualProcurement = normalizedAmount(input.actualProcurement);

  const expectedComparable = expectedRevenue.amount !== null
    && expectedProcurement.amount !== null
    && expectedRevenue.currency === expectedProcurement.currency;
  const actualComparable = expectedRevenue.amount !== null
    && actualProcurement.amount !== null
    && expectedRevenue.currency === actualProcurement.currency;

  const expectedProfit = expectedComparable
    ? profit(expectedRevenue.amount!, expectedProcurement.amount!, expectedRevenue.currency!)
    : null;
  const actualProfit = actualComparable
    ? profit(expectedRevenue.amount!, actualProcurement.amount!, expectedRevenue.currency!)
    : null;

  return {
    expected_revenue_amount: expectedRevenue.amount,
    expected_revenue_currency: expectedRevenue.currency,
    expected_procurement_amount: expectedProcurement.amount,
    expected_procurement_currency: expectedProcurement.currency,
    expected_profit_amount: expectedProfit?.amount ?? null,
    expected_profit_currency: expectedProfit ? expectedRevenue.currency : null,
    expected_margin_percent: expectedProfit?.marginPercent ?? null,
    actual_procurement_amount: actualProcurement.amount,
    actual_procurement_currency: actualProcurement.currency,
    actual_profit_amount: actualProfit?.amount ?? null,
    actual_profit_currency: actualProfit ? expectedRevenue.currency : null,
    actual_margin_percent: actualProfit?.marginPercent ?? null,
    expected_comparable: expectedComparable,
    actual_comparable: actualComparable,
  };
}
