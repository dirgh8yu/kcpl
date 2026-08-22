import { createHash } from "node:crypto";

export type SettlementBasis = {
  invoiceSubtotal: number;
  taxes: number;
  adjustments: number;
  credits: number;
  totalPayable: number;
  amountAlreadyPaid: number;
  outstandingAmount: number;
};

export type SettlementBasisResult =
  | { ok: true; basis: SettlementBasis }
  | { ok: false; reason: "invalid_amount" | "inconsistent_total" | "inconsistent_balance" };

function finite(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sameMoney(left: number, right: number) {
  return Math.abs(money(left) - money(right)) < 0.005;
}

export function normalizeSettlementCurrency(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function settlementCurrenciesMatch(left: unknown, right: unknown) {
  const a = normalizeSettlementCurrency(left);
  const b = normalizeSettlementCurrency(right);
  return Boolean(a && b && a === b);
}

/**
 * Authoritative supplier settlement basis.
 *
 * Freight comparison may deliberately use the untaxed invoice subtotal, but
 * cash settlement always uses this payable basis:
 * subtotal + taxes + signed adjustments - credits.
 * Existing records without adjustment/credit fields are safe only when their
 * stored total and balance reconcile exactly to the zero-default calculation.
 */
export function resolveSettlementBasis(input: {
  subtotal: unknown;
  taxes: unknown;
  adjustments?: unknown;
  credits?: unknown;
  storedTotal: unknown;
  amountAlreadyPaid: unknown;
  storedOutstanding: unknown;
}): SettlementBasisResult {
  const invoiceSubtotal = finite(input.subtotal);
  const taxes = finite(input.taxes);
  const adjustments = input.adjustments === undefined || input.adjustments === null ? 0 : finite(input.adjustments);
  const credits = input.credits === undefined || input.credits === null ? 0 : finite(input.credits);
  const storedTotal = finite(input.storedTotal);
  const amountAlreadyPaid = finite(input.amountAlreadyPaid);
  const storedOutstanding = finite(input.storedOutstanding);
  const all = [invoiceSubtotal, taxes, adjustments, credits, storedTotal, amountAlreadyPaid, storedOutstanding];
  if (all.some((value) => !Number.isFinite(value))) return { ok: false, reason: "invalid_amount" };
  if (invoiceSubtotal <= 0 || taxes < 0 || credits < 0 || amountAlreadyPaid < 0 || storedOutstanding < 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  const totalPayable = money(invoiceSubtotal + taxes + adjustments - credits);
  if (totalPayable <= 0 || storedTotal <= 0) return { ok: false, reason: "invalid_amount" };
  if (!sameMoney(totalPayable, storedTotal)) return { ok: false, reason: "inconsistent_total" };
  if (amountAlreadyPaid - totalPayable > 0.005) return { ok: false, reason: "inconsistent_balance" };
  const outstandingAmount = money(totalPayable - amountAlreadyPaid);
  if (!sameMoney(outstandingAmount, storedOutstanding)) return { ok: false, reason: "inconsistent_balance" };
  return {
    ok: true,
    basis: {
      invoiceSubtotal: money(invoiceSubtotal),
      taxes: money(taxes),
      adjustments: money(adjustments),
      credits: money(credits),
      totalPayable,
      amountAlreadyPaid: money(amountAlreadyPaid),
      outstandingAmount,
    },
  };
}

export function applySettlementPayment(basis: SettlementBasis, requestedAmount: unknown) {
  const raw = finite(requestedAmount);
  if (!Number.isFinite(raw) || raw <= 0) return { ok: false as const, reason: "invalid_amount" as const };
  const amount = money(raw);
  if (amount <= 0 || Math.abs(raw - amount) >= 0.005) return { ok: false as const, reason: "invalid_amount" as const };
  if (amount - basis.outstandingAmount > 0.005) return { ok: false as const, reason: "overpayment" as const };
  const nextPaid = money(basis.amountAlreadyPaid + amount);
  const nextOutstanding = money(basis.totalPayable - nextPaid);
  if (nextOutstanding < 0 || nextPaid - basis.totalPayable > 0.005) return { ok: false as const, reason: "overpayment" as const };
  return { ok: true as const, amount, nextPaid, nextOutstanding };
}

export function supplierInvoiceUniquenessKey(supplierKey: string, normalizedInvoiceReference: string) {
  const supplier = supplierKey.trim().toLowerCase();
  const invoice = normalizedInvoiceReference.trim().toUpperCase();
  if (!supplier || !invoice) return "";
  return createHash("sha256").update(`${supplier}|${invoice}`).digest("hex");
}

export function settlementRequestFingerprint(input: {
  accountReference: string;
  amount: number;
  currency: string;
  paymentDate: string;
  method: string;
  externalReference?: string | null;
}) {
  return createHash("sha256").update(JSON.stringify({
    accountReference: input.accountReference.trim().toUpperCase(),
    amount: money(input.amount),
    currency: normalizeSettlementCurrency(input.currency),
    paymentDate: input.paymentDate,
    method: input.method,
    externalReference: input.externalReference?.trim() || null,
  })).digest("hex");
}

export function paymentDocumentId(accountReference: string, idempotencyKey: string, requestFingerprint: string) {
  const key = idempotencyKey.trim() || requestFingerprint;
  return `payment-${createHash("sha256").update(`${accountReference.trim().toUpperCase()}|${key}`).digest("hex").slice(0, 40)}`;
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedAuditReference(value: unknown) {
  return (typeof value === "string" ? value : "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Matches the current Freight Audit commercial fingerprint payload exactly,
 * while also binding settlement-only adjustment/credit facts introduced by
 * this remediation. Old audit fingerprints therefore fail closed and require
 * a re-audit before payment.
 */
export function freightAuditEconomicFingerprint(input: {
  payableReference: string;
  bill: Record<string, unknown>;
  shipment?: Record<string, unknown> | null;
  order?: Record<string, unknown> | null;
  rateCard?: Record<string, unknown> | null;
  duplicateOf?: string | null;
}) {
  const bill = input.bill;
  const shipment = input.shipment ?? {};
  const order = input.order ?? {};
  const rateCard = input.rateCard ?? {};
  const payload = {
    payable: input.payableReference.trim().toUpperCase(),
    supplier: nullableText(bill.supplier_id),
    supplierName: nullableText(bill.supplier_name),
    category: nullableText(bill.category),
    supplierBill: normalizedAuditReference(bill.supplier_bill_reference),
    shipment: nullableText(bill.shipment_reference),
    currency: normalizeSettlementCurrency(bill.currency) || "NPR",
    subtotal: numberOrZero(bill.subtotal),
    total: numberOrZero(bill.total),
    tax: numberOrZero(bill.tax_total),
    adjustments: numberOrZero(bill.adjustment_total),
    credits: numberOrZero(bill.credit_total),
    bookedPartner: nullableText(shipment.partner_id),
    bookedPartnerName: nullableText(shipment.carrier),
    bookedCurrency: normalizeSettlementCurrency(shipment.procurement_currency) || null,
    bookedCost: numberOrNull(shipment.procurement_cost),
    transportOrder: nullableText(shipment.transport_order_id),
    tender: nullableText(shipment.tender_id),
    rateCard: nullableText(shipment.procurement_rate_card_id),
    orderQuantities: [order.weight_kg, order.volume_cbm, order.pieces, order.container_count],
    rateEconomics: [rateCard.currency, rateCard.rate, rateCard.unit, rateCard.minimum_charge, rateCard.fuel_surcharge_percent, rateCard.accessorial_flat],
    duplicateOf: input.duplicateOf ?? null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
