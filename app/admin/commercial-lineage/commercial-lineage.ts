import { createHash } from "node:crypto";

export const COMMERCIAL_VERSION_SCHEMA = 1 as const;
export const COMMERCIAL_FX_PRECISION = 12;
export const COMMERCIAL_PERCENT_PRECISION = 6;

export type CommercialVersionReason =
  | "rate_selected"
  | "repriced"
  | "discount_changed"
  | "fx_refreshed"
  | "counteroffer"
  | "consolidation_allocation"
  | "legacy_selected_reconstructed";

export type CommercialFxSnapshot = {
  source_currency: string;
  target_currency: string;
  rate: number | null;
  source: string;
  effective_date: string | null;
  published_on: string | null;
  modified_on: string | null;
  source_npr_per_unit: number | null;
  target_npr_per_unit: number | null;
};

export type CommercialProcurementSnapshot = {
  rate_card_id: string | null;
  rate_card_updated_at: string | null;
  rate_card_valid_from: string | null;
  rate_card_valid_until: string | null;
  partner_id: string;
  partner_name: string | null;
  mode: string;
  service: string | null;
  equipment: string | null;
  rating_unit: string | null;
  rating_quantity: number | null;
  base_rate: number | null;
  base_charge: number | null;
  minimum_charge: number | null;
  minimum_applied: boolean | null;
  fuel_surcharge_percent: number | null;
  fuel_surcharge: number | null;
  accessorials: number | null;
  total: number;
  currency: string;
};

export type CommercialPricingSnapshot = {
  customer_id: string;
  pricing_rule_id: string | null;
  pricing_rule_scope: string | null;
  markup_percent: number;
  target_margin_percent: number | null;
  minimum_margin_percent: number;
  approval_below_margin_percent: number;
  accessorial_cost: number;
  accessorial_markup_percent: number;
  fixed_markup: number;
  discount: number;
  converted_buy_cost: number | null;
  accessorial_sell: number;
  pre_discount_sell: number;
  sell_amount: number;
  sell_currency: string;
  gross_profit: number | null;
  gross_margin_percent: number | null;
  effective_markup_percent: number | null;
  minimum_sell_price: number | null;
  approval_required: boolean;
  approval_reasons: string[];
};

export type CommercialNegotiationSnapshot = {
  offered_amount: number;
  offered_currency: string;
  counter_amount: number | null;
  counter_currency: string | null;
  final_amount: number;
  final_currency: string;
};

export type CommercialSnapshot = {
  schema_version: typeof COMMERCIAL_VERSION_SCHEMA;
  order_id: string;
  branch: string;
  customer_id: string | null;
  mode: string;
  procurement: CommercialProcurementSnapshot;
  pricing: CommercialPricingSnapshot | null;
  fx: CommercialFxSnapshot | null;
  negotiation: CommercialNegotiationSnapshot | null;
};

export type CommercialVersion = {
  id: string;
  fingerprint: string;
  snapshot: CommercialSnapshot;
  previous_version_id: string | null;
  reason: CommercialVersionReason;
  created_at: string;
  created_by_name: string;
  created_by_email: string;
  source_references: Record<string, string | null>;
};

export type CommercialApprovalAttestation = {
  commercial_version_id: string;
  commercial_fingerprint: string;
  order_id: string;
  status: "approved";
  approved_at: string;
  approved_by_name: string;
  approved_by_email: string;
  note: string | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCommercialId(value: unknown) {
  return text(value).toUpperCase();
}

export function normalizeCommercialCurrency(value: unknown) {
  return normalizeCommercialId(value);
}

function finite(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function commercialCurrencyDecimals(currency: string) {
  return normalizeCommercialCurrency(currency) === "JPY" ? 0 : 2;
}

export function commercialMoney(value: unknown, currency: string) {
  const parsed = finite(value);
  if (parsed === null) return null;
  const decimals = commercialCurrencyDecimals(currency);
  const factor = 10 ** decimals;
  return Math.round((parsed + Number.EPSILON) * factor) / factor;
}

export function sameCommercialMoney(left: unknown, right: unknown, currency: string) {
  const a = commercialMoney(left, currency);
  const b = commercialMoney(right, currency);
  return a !== null && b !== null && a === b;
}

function decimalText(value: unknown, precision: number) {
  const parsed = finite(value);
  if (parsed === null) return null;
  const fixed = parsed.toFixed(precision);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function moneyText(value: unknown, currency: string) {
  const parsed = commercialMoney(value, currency);
  if (parsed === null) return null;
  return parsed.toFixed(commercialCurrencyDecimals(currency));
}

function nullableText(value: unknown) {
  const output = text(value);
  return output || null;
}

function canonicalFx(fx: CommercialFxSnapshot | null) {
  if (!fx) return null;
  return [
    normalizeCommercialCurrency(fx.source_currency),
    normalizeCommercialCurrency(fx.target_currency),
    decimalText(fx.rate, COMMERCIAL_FX_PRECISION),
    text(fx.source).toLowerCase(),
    nullableText(fx.effective_date),
    nullableText(fx.published_on),
    nullableText(fx.modified_on),
    decimalText(fx.source_npr_per_unit, COMMERCIAL_FX_PRECISION),
    decimalText(fx.target_npr_per_unit, COMMERCIAL_FX_PRECISION),
  ];
}

/**
 * Canonical fingerprint payload. This is deliberately an ordered tuple rather
 * than arbitrary object serialization. Labels, notes, created/updated times,
 * actor metadata and activity history are intentionally excluded.
 */
export function commercialFingerprintPayload(snapshot: CommercialSnapshot) {
  const procurementCurrency = normalizeCommercialCurrency(snapshot.procurement.currency);
  const sellCurrency = snapshot.pricing ? normalizeCommercialCurrency(snapshot.pricing.sell_currency) : "";
  return [
    "kcpl-commercial-v1",
    [
      normalizeCommercialId(snapshot.order_id),
      text(snapshot.branch),
      snapshot.customer_id ? normalizeCommercialId(snapshot.customer_id) : null,
      text(snapshot.mode).toLowerCase(),
    ],
    [
      snapshot.procurement.rate_card_id ? normalizeCommercialId(snapshot.procurement.rate_card_id) : null,
      nullableText(snapshot.procurement.rate_card_updated_at),
      nullableText(snapshot.procurement.rate_card_valid_from),
      nullableText(snapshot.procurement.rate_card_valid_until),
      normalizeCommercialId(snapshot.procurement.partner_id),
      text(snapshot.procurement.mode).toLowerCase(),
      nullableText(snapshot.procurement.service),
      nullableText(snapshot.procurement.equipment),
      nullableText(snapshot.procurement.rating_unit),
      decimalText(snapshot.procurement.rating_quantity, 6),
      moneyText(snapshot.procurement.base_rate, procurementCurrency),
      moneyText(snapshot.procurement.base_charge, procurementCurrency),
      moneyText(snapshot.procurement.minimum_charge, procurementCurrency),
      snapshot.procurement.minimum_applied,
      decimalText(snapshot.procurement.fuel_surcharge_percent, COMMERCIAL_PERCENT_PRECISION),
      moneyText(snapshot.procurement.fuel_surcharge, procurementCurrency),
      moneyText(snapshot.procurement.accessorials, procurementCurrency),
      moneyText(snapshot.procurement.total, procurementCurrency),
      procurementCurrency,
    ],
    snapshot.pricing ? [
      normalizeCommercialId(snapshot.pricing.customer_id),
      snapshot.pricing.pricing_rule_id ? normalizeCommercialId(snapshot.pricing.pricing_rule_id) : null,
      nullableText(snapshot.pricing.pricing_rule_scope),
      decimalText(snapshot.pricing.markup_percent, COMMERCIAL_PERCENT_PRECISION),
      decimalText(snapshot.pricing.target_margin_percent, COMMERCIAL_PERCENT_PRECISION),
      decimalText(snapshot.pricing.minimum_margin_percent, COMMERCIAL_PERCENT_PRECISION),
      decimalText(snapshot.pricing.approval_below_margin_percent, COMMERCIAL_PERCENT_PRECISION),
      moneyText(snapshot.pricing.accessorial_cost, sellCurrency),
      decimalText(snapshot.pricing.accessorial_markup_percent, COMMERCIAL_PERCENT_PRECISION),
      moneyText(snapshot.pricing.fixed_markup, sellCurrency),
      moneyText(snapshot.pricing.discount, sellCurrency),
      moneyText(snapshot.pricing.converted_buy_cost, sellCurrency),
      moneyText(snapshot.pricing.accessorial_sell, sellCurrency),
      moneyText(snapshot.pricing.pre_discount_sell, sellCurrency),
      moneyText(snapshot.pricing.sell_amount, sellCurrency),
      sellCurrency,
      moneyText(snapshot.pricing.gross_profit, sellCurrency),
      decimalText(snapshot.pricing.gross_margin_percent, COMMERCIAL_PERCENT_PRECISION),
      decimalText(snapshot.pricing.effective_markup_percent, COMMERCIAL_PERCENT_PRECISION),
      moneyText(snapshot.pricing.minimum_sell_price, sellCurrency),
      snapshot.pricing.approval_required,
    ] : null,
    canonicalFx(snapshot.fx),
    snapshot.negotiation ? [
      moneyText(snapshot.negotiation.offered_amount, snapshot.negotiation.offered_currency),
      normalizeCommercialCurrency(snapshot.negotiation.offered_currency),
      moneyText(snapshot.negotiation.counter_amount, snapshot.negotiation.counter_currency ?? snapshot.negotiation.offered_currency),
      snapshot.negotiation.counter_currency ? normalizeCommercialCurrency(snapshot.negotiation.counter_currency) : null,
      moneyText(snapshot.negotiation.final_amount, snapshot.negotiation.final_currency),
      normalizeCommercialCurrency(snapshot.negotiation.final_currency),
    ] : null,
  ];
}

export function commercialFingerprint(snapshot: CommercialSnapshot) {
  return createHash("sha256").update(JSON.stringify(commercialFingerprintPayload(snapshot))).digest("hex");
}

export function commercialSnapshotIntegrity(snapshot: CommercialSnapshot) {
  const errors: string[] = [];
  if (snapshot.schema_version !== COMMERCIAL_VERSION_SCHEMA) errors.push("unsupported_schema");
  if (!normalizeCommercialId(snapshot.order_id)) errors.push("missing_order");
  if (!text(snapshot.branch)) errors.push("missing_branch");
  if (!normalizeCommercialId(snapshot.procurement.partner_id)) errors.push("missing_partner");
  const procurementCurrency = normalizeCommercialCurrency(snapshot.procurement.currency);
  if (!procurementCurrency) errors.push("missing_procurement_currency");
  const procurementTotal = commercialMoney(snapshot.procurement.total, procurementCurrency);
  if (procurementTotal === null || procurementTotal < 0) errors.push("invalid_procurement_total");
  if (snapshot.pricing) {
    const sellCurrency = normalizeCommercialCurrency(snapshot.pricing.sell_currency);
    const sell = commercialMoney(snapshot.pricing.sell_amount, sellCurrency);
    if (!sellCurrency) errors.push("missing_sell_currency");
    if (sell === null || sell < 0) errors.push("invalid_sell_total");
    if (normalizeCommercialId(snapshot.pricing.customer_id) !== normalizeCommercialId(snapshot.customer_id)) errors.push("customer_mismatch");
    if (snapshot.fx) {
      if (normalizeCommercialCurrency(snapshot.fx.source_currency) !== procurementCurrency) errors.push("fx_source_mismatch");
      if (normalizeCommercialCurrency(snapshot.fx.target_currency) !== sellCurrency) errors.push("fx_target_mismatch");
      if (procurementCurrency !== sellCurrency && (!(snapshot.fx.rate && Number.isFinite(snapshot.fx.rate)) || snapshot.fx.rate <= 0)) errors.push("missing_fx_rate");
    } else if (procurementCurrency !== sellCurrency) errors.push("missing_fx");
  }
  return { ok: errors.length === 0, errors };
}

export function commercialApprovalSatisfied(version: Pick<CommercialVersion, "id" | "fingerprint" | "snapshot">, approval: CommercialApprovalAttestation | null) {
  if (!version.snapshot.pricing) return false;
  if (!version.snapshot.pricing.approval_required) return true;
  return Boolean(
    approval
    && approval.status === "approved"
    && normalizeCommercialId(approval.commercial_version_id) === normalizeCommercialId(version.id)
    && approval.commercial_fingerprint === version.fingerprint
    && normalizeCommercialId(approval.order_id) === normalizeCommercialId(version.snapshot.order_id),
  );
}

export function commercialVersionBookable(version: Pick<CommercialVersion, "id" | "fingerprint" | "snapshot">, approval: CommercialApprovalAttestation | null) {
  const integrity = commercialSnapshotIntegrity(version.snapshot);
  if (!integrity.ok) return { ok: false as const, reason: "commercial_review_required" as const, errors: integrity.errors };
  if (!version.snapshot.pricing) return { ok: false as const, reason: "pricing_required" as const, errors: [] as string[] };
  if (!commercialApprovalSatisfied(version, approval)) return { ok: false as const, reason: "approval_required" as const, errors: [] as string[] };
  return { ok: true as const };
}

function roundMoney(value: number, currency: string) {
  return commercialMoney(value, currency) ?? 0;
}

function minimumSellForMargin(cost: number, marginPercent: number) {
  if (marginPercent <= 0) return cost;
  if (marginPercent >= 100) return Number.POSITIVE_INFINITY;
  return cost / (1 - marginPercent / 100);
}

/**
 * A carrier counteroffer changes procurement truth but does not silently
 * rewrite an already-decided customer sell amount. Margin and approval policy
 * are re-evaluated against the preserved sell decision.
 */
export function deriveCounterofferSnapshot(base: CommercialSnapshot, amount: number, currency: string): CommercialSnapshot {
  const nextCurrency = normalizeCommercialCurrency(currency);
  const offered = base.negotiation ?? {
    offered_amount: base.procurement.total,
    offered_currency: base.procurement.currency,
    counter_amount: null,
    counter_currency: null,
    final_amount: base.procurement.total,
    final_currency: base.procurement.currency,
  };
  const procurement = { ...base.procurement, total: roundMoney(amount, nextCurrency), currency: nextCurrency };
  const negotiation: CommercialNegotiationSnapshot = {
    offered_amount: offered.offered_amount,
    offered_currency: offered.offered_currency,
    counter_amount: roundMoney(amount, nextCurrency),
    counter_currency: nextCurrency,
    final_amount: roundMoney(amount, nextCurrency),
    final_currency: nextCurrency,
  };
  if (!base.pricing) return { ...base, procurement, pricing: null, fx: null, negotiation };

  const sellCurrency = normalizeCommercialCurrency(base.pricing.sell_currency);
  let fx: CommercialFxSnapshot | null = null;
  if (nextCurrency === sellCurrency) {
    fx = {
      source_currency: nextCurrency,
      target_currency: sellCurrency,
      rate: 1,
      source: "same_currency",
      effective_date: null,
      published_on: null,
      modified_on: null,
      source_npr_per_unit: null,
      target_npr_per_unit: null,
    };
  } else if (base.fx && normalizeCommercialCurrency(base.fx.source_currency) === nextCurrency && normalizeCommercialCurrency(base.fx.target_currency) === sellCurrency && base.fx.rate && base.fx.rate > 0) {
    fx = { ...base.fx, source_currency: nextCurrency, target_currency: sellCurrency };
  }

  if (!fx?.rate) {
    return {
      ...base,
      procurement,
      fx: null,
      negotiation,
      pricing: {
        ...base.pricing,
        converted_buy_cost: null,
        gross_profit: null,
        gross_margin_percent: null,
        effective_markup_percent: null,
        minimum_sell_price: null,
        approval_required: true,
        approval_reasons: ["A new FX decision is required for the carrier counteroffer currency."],
      },
    };
  }

  const convertedBuy = roundMoney(procurement.total * fx.rate, sellCurrency);
  const cost = convertedBuy + Math.max(0, base.pricing.accessorial_cost);
  const sell = roundMoney(base.pricing.sell_amount, sellCurrency);
  const grossProfit = roundMoney(sell - cost, sellCurrency);
  const grossMargin = sell > 0 ? grossProfit / sell * 100 : 0;
  const effectiveMarkup = cost > 0 ? grossProfit / cost * 100 : 0;
  const minimumSell = roundMoney(minimumSellForMargin(cost, Math.max(0, base.pricing.minimum_margin_percent)), sellCurrency);
  const reasons: string[] = [];
  if (sell < minimumSell) reasons.push(`Sell price is below the ${base.pricing.minimum_margin_percent.toFixed(1)}% minimum margin floor.`);
  if (grossMargin < base.pricing.approval_below_margin_percent) reasons.push(`Gross margin is below the ${base.pricing.approval_below_margin_percent.toFixed(1)}% approval threshold.`);
  if (base.pricing.discount > 0) reasons.push("The preserved customer sell decision includes a manual discount.");
  return {
    ...base,
    procurement,
    fx,
    negotiation,
    pricing: {
      ...base.pricing,
      converted_buy_cost: convertedBuy,
      gross_profit: grossProfit,
      gross_margin_percent: grossMargin,
      effective_markup_percent: effectiveMarkup,
      minimum_sell_price: minimumSell,
      approval_required: reasons.length > 0,
      approval_reasons: reasons,
    },
  };
}

export function deriveConsolidationAllocationSnapshot(base: CommercialSnapshot, input: {
  amount: number;
  currency: string;
  partnerId: string;
  partnerName?: string | null;
  masterRateCardId?: string | null;
  mode?: string | null;
}): CommercialSnapshot {
  const currency = normalizeCommercialCurrency(input.currency);
  const next = {
    ...base,
    procurement: {
      ...base.procurement,
      rate_card_id: input.masterRateCardId ? normalizeCommercialId(input.masterRateCardId) : null,
      rate_card_updated_at: null,
      rate_card_valid_from: null,
      rate_card_valid_until: null,
      partner_id: normalizeCommercialId(input.partnerId),
      partner_name: input.partnerName?.trim() || null,
      mode: input.mode?.trim() || base.procurement.mode,
      service: "consolidation_allocation",
      rating_unit: "allocation",
      rating_quantity: 1,
      base_rate: roundMoney(input.amount, currency),
      base_charge: roundMoney(input.amount, currency),
      minimum_charge: null,
      minimum_applied: null,
      fuel_surcharge_percent: null,
      fuel_surcharge: null,
      accessorials: null,
      total: roundMoney(input.amount, currency),
      currency,
    },
    negotiation: {
      offered_amount: roundMoney(input.amount, currency),
      offered_currency: currency,
      counter_amount: null,
      counter_currency: null,
      final_amount: roundMoney(input.amount, currency),
      final_currency: currency,
    },
  } satisfies CommercialSnapshot;

  if (!base.pricing) return { ...next, pricing: null, fx: null };
  const sellCurrency = normalizeCommercialCurrency(base.pricing.sell_currency);
  if (sellCurrency === currency) {
    const fx: CommercialFxSnapshot = {
      source_currency: currency, target_currency: sellCurrency, rate: 1, source: "same_currency",
      effective_date: null, published_on: null, modified_on: null, source_npr_per_unit: null, target_npr_per_unit: null,
    };
    return deriveCounterofferSnapshot({ ...next, fx }, next.procurement.total, currency);
  }
  if (base.fx && normalizeCommercialCurrency(base.fx.source_currency) === currency && normalizeCommercialCurrency(base.fx.target_currency) === sellCurrency) {
    return deriveCounterofferSnapshot({ ...next, fx: base.fx }, next.procurement.total, currency);
  }
  return {
    ...next,
    fx: null,
    pricing: {
      ...base.pricing,
      converted_buy_cost: null,
      gross_profit: null,
      gross_margin_percent: null,
      effective_markup_percent: null,
      minimum_sell_price: null,
      approval_required: true,
      approval_reasons: ["A new FX decision is required for the consolidation allocation currency."],
    },
  };
}
