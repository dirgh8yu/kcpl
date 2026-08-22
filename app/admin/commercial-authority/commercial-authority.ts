import {
  normalizeCommercialCurrency,
  normalizeCommercialId,
  sameCommercialMoney,
  type CommercialSnapshot,
} from "../commercial-lineage/commercial-lineage";

export const COMMERCIAL_POLICY_ID = "kcpl-server-commercial-policy-v1";
export const COMMERCIAL_MINIMUM_MARGIN_PERCENT = 10;
export const COMMERCIAL_APPROVAL_BELOW_MARGIN_PERCENT = 12;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function tmsCustomerQuoteReference(orderId: string, versionId: string) {
  return `TMSSELL-${normalizeCommercialId(orderId)}-${normalizeCommercialId(versionId)}`
    .replace(/[^A-Z0-9-]/gi, "")
    .toUpperCase()
    .slice(0, 120);
}

export function quoteHasTmsAuthorityMarkers(data: Record<string, unknown>) {
  const source = text(data.source).toLowerCase();
  return Boolean(
    normalizeCommercialId(data.transport_order_id)
    || normalizeCommercialId(data.commercial_version_id)
    || text(data.commercial_fingerprint)
    || data.commercial_locked === true
    || source.startsWith("tms_"),
  );
}

export function customerSellEconomicsMatch(left: CommercialSnapshot, right: CommercialSnapshot) {
  const leftPricing = left.pricing;
  const rightPricing = right.pricing;
  if (!leftPricing || !rightPricing) return false;
  const currency = normalizeCommercialCurrency(leftPricing.sell_currency);
  return Boolean(
    normalizeCommercialId(left.order_id) === normalizeCommercialId(right.order_id)
    && left.branch === right.branch
    && normalizeCommercialId(left.customer_id) === normalizeCommercialId(right.customer_id)
    && normalizeCommercialId(leftPricing.customer_id) === normalizeCommercialId(rightPricing.customer_id)
    && currency
    && currency === normalizeCommercialCurrency(rightPricing.sell_currency)
    && sameCommercialMoney(leftPricing.sell_amount, rightPricing.sell_amount, currency),
  );
}
