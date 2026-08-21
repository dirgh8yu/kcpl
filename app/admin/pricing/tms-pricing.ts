import type { CrmCurrency, KcplBranch } from "../crm/crm-data";
import type { TmsMode } from "../rating/tms-rating";

export const pricingRuleScopes = ["global", "branch", "lane", "customer", "customer_lane"] as const;
export type PricingRuleScope = (typeof pricingRuleScopes)[number];

export type PricingRule = {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  scope: PricingRuleScope;
  branch: KcplBranch | null;
  customer_id: string | null;
  origin: string | null;
  destination: string | null;
  mode: TmsMode | null;
  sell_currency: CrmCurrency | null;
  markup_percent: number | null;
  target_margin_percent: number | null;
  minimum_margin_percent: number;
  accessorial_markup_percent: number;
  fixed_markup: number;
  approval_below_margin_percent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingContext = {
  branch: KcplBranch;
  customer_id: string | null;
  origin: string;
  destination: string;
  mode: TmsMode;
};

export type PricingInput = {
  buy_cost: number;
  buy_currency: CrmCurrency;
  sell_currency: CrmCurrency;
  fx_rate: number;
  markup_percent: number;
  target_margin_percent?: number | null;
  minimum_margin_percent: number;
  approval_below_margin_percent: number;
  accessorial_cost: number;
  accessorial_markup_percent: number;
  fixed_markup: number;
  discount: number;
};

export type PricingResult = {
  converted_buy_cost: number;
  accessorial_sell: number;
  pre_discount_sell: number;
  sell_price: number;
  gross_profit: number;
  gross_margin_percent: number;
  effective_markup_percent: number;
  minimum_sell_price: number;
  approval_required: boolean;
  approval_reasons: string[];
};

function key(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function laneMatches(pattern: string | null, actual: string) {
  const wanted = key(pattern);
  if (!wanted || wanted === "*" || wanted === "any") return true;
  return wanted === key(actual);
}

export function pricingRuleMatches(rule: PricingRule, context: PricingContext) {
  if (!rule.active) return false;
  if (rule.branch && rule.branch !== context.branch) return false;
  if (rule.customer_id && rule.customer_id !== context.customer_id) return false;
  if (rule.mode && rule.mode !== context.mode) return false;
  if (!laneMatches(rule.origin, context.origin) || !laneMatches(rule.destination, context.destination)) return false;
  return true;
}

function specificity(rule: PricingRule) {
  return (rule.customer_id ? 40 : 0) + (rule.origin ? 20 : 0) + (rule.destination ? 20 : 0) + (rule.mode ? 10 : 0) + (rule.branch ? 5 : 0) + Math.max(0, rule.priority);
}

export function resolvePricingRule(rules: PricingRule[], context: PricingContext) {
  return rules
    .filter((rule) => pricingRuleMatches(rule, context))
    .sort((a, b) => specificity(b) - specificity(a) || b.updated_at.localeCompare(a.updated_at))[0] ?? null;
}

function moneyRound(value: number, currency: CrmCurrency) {
  const decimals = currency === "JPY" ? 0 : 2;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function sellForMargin(cost: number, marginPercent: number) {
  if (marginPercent <= 0) return cost;
  if (marginPercent >= 100) return Number.POSITIVE_INFINITY;
  return cost / (1 - marginPercent / 100);
}

export function calculateSellPrice(input: PricingInput): PricingResult {
  const buy = Math.max(0, Number(input.buy_cost) || 0);
  const fx = Math.max(0, Number(input.fx_rate) || 0);
  if (buy > 0 && fx <= 0) throw new Error("A positive FX rate is required to convert the buy cost.");

  const convertedBuy = moneyRound(buy * fx, input.sell_currency);
  const accessorialCost = Math.max(0, Number(input.accessorial_cost) || 0);
  const accessorialSell = moneyRound(accessorialCost * (1 + Math.max(0, input.accessorial_markup_percent) / 100), input.sell_currency);
  const baseCost = convertedBuy + accessorialCost;
  const markupSell = convertedBuy * (1 + Math.max(0, input.markup_percent) / 100) + accessorialSell + Math.max(0, input.fixed_markup);
  const targetMargin = input.target_margin_percent ?? null;
  const targetSell = targetMargin !== null ? sellForMargin(baseCost, Math.max(0, targetMargin)) + Math.max(0, input.fixed_markup) : 0;
  const preDiscount = moneyRound(Math.max(markupSell, targetSell), input.sell_currency);
  const sellPrice = moneyRound(Math.max(0, preDiscount - Math.max(0, input.discount)), input.sell_currency);
  const grossProfit = moneyRound(sellPrice - baseCost, input.sell_currency);
  const grossMargin = sellPrice > 0 ? grossProfit / sellPrice * 100 : 0;
  const effectiveMarkup = baseCost > 0 ? grossProfit / baseCost * 100 : 0;
  const minimumSell = moneyRound(sellForMargin(baseCost, Math.max(0, input.minimum_margin_percent)), input.sell_currency);

  const approvalReasons: string[] = [];
  if (sellPrice < minimumSell) approvalReasons.push(`Sell price is below the ${input.minimum_margin_percent.toFixed(1)}% minimum margin floor.`);
  if (grossMargin < input.approval_below_margin_percent) approvalReasons.push(`Gross margin is below the ${input.approval_below_margin_percent.toFixed(1)}% approval threshold.`);
  if (input.discount > 0 && sellPrice < preDiscount) approvalReasons.push("A manual discount reduces the calculated sell price.");

  return {
    converted_buy_cost: convertedBuy,
    accessorial_sell: accessorialSell,
    pre_discount_sell: preDiscount,
    sell_price: sellPrice,
    gross_profit: grossProfit,
    gross_margin_percent: grossMargin,
    effective_markup_percent: effectiveMarkup,
    minimum_sell_price: minimumSell,
    approval_required: approvalReasons.length > 0,
    approval_reasons: approvalReasons,
  };
}

export function rulePricingDefaults(rule: PricingRule | null, customerMarkupPercent: number | null) {
  return {
    markup_percent: rule?.markup_percent ?? customerMarkupPercent ?? 15,
    target_margin_percent: rule?.target_margin_percent ?? null,
    minimum_margin_percent: rule?.minimum_margin_percent ?? 10,
    accessorial_markup_percent: rule?.accessorial_markup_percent ?? 15,
    fixed_markup: rule?.fixed_markup ?? 0,
    approval_below_margin_percent: rule?.approval_below_margin_percent ?? 12,
  };
}
