import { createHash } from "node:crypto";
import {
  commercialFingerprint,
  commercialSnapshotIntegrity,
  normalizeCommercialCurrency,
  normalizeCommercialId,
  sameCommercialMoney,
  type CommercialSnapshot,
} from "../commercial-lineage/commercial-lineage.ts";

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

function finite(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : Number.NaN; }
export function money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
export function sameMoney(left: number, right: number) { return Math.abs(money(left) - money(right)) < 0.005; }
export function normalizeSettlementCurrency(value: unknown) { return typeof value === "string" ? value.trim().toUpperCase() : ""; }
export function settlementCurrenciesMatch(left: unknown, right: unknown) { const a = normalizeSettlementCurrency(left); const b = normalizeSettlementCurrency(right); return Boolean(a && b && a === b); }

/** Authoritative supplier settlement basis. Freight comparison may use the untaxed subtotal; settlement never does. */
export function resolveSettlementBasis(input: {
  subtotal: unknown; taxes: unknown; adjustments?: unknown; credits?: unknown; storedTotal: unknown; amountAlreadyPaid: unknown; storedOutstanding: unknown;
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
  if (invoiceSubtotal <= 0 || taxes < 0 || credits < 0 || amountAlreadyPaid < 0 || storedOutstanding < 0) return { ok: false, reason: "invalid_amount" };
  const totalPayable = money(invoiceSubtotal + taxes + adjustments - credits);
  if (totalPayable <= 0 || storedTotal <= 0) return { ok: false, reason: "invalid_amount" };
  if (!sameMoney(totalPayable, storedTotal)) return { ok: false, reason: "inconsistent_total" };
  if (amountAlreadyPaid - totalPayable > 0.005) return { ok: false, reason: "inconsistent_balance" };
  const outstandingAmount = money(totalPayable - amountAlreadyPaid);
  if (!sameMoney(outstandingAmount, storedOutstanding)) return { ok: false, reason: "inconsistent_balance" };
  return { ok: true, basis: { invoiceSubtotal: money(invoiceSubtotal), taxes: money(taxes), adjustments: money(adjustments), credits: money(credits), totalPayable, amountAlreadyPaid: money(amountAlreadyPaid), outstandingAmount } };
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

export function settlementRequestFingerprint(input: { accountReference: string; amount: number; currency: string; paymentDate: string; method: string; externalReference?: string | null }) {
  return createHash("sha256").update(JSON.stringify({ accountReference: input.accountReference.trim().toUpperCase(), amount: money(input.amount), currency: normalizeSettlementCurrency(input.currency), paymentDate: input.paymentDate, method: input.method, externalReference: input.externalReference?.trim() || null })).digest("hex");
}

export function paymentDocumentId(accountReference: string, idempotencyKey: string, requestFingerprint: string) {
  const key = idempotencyKey.trim() || requestFingerprint;
  return `payment-${createHash("sha256").update(`${accountReference.trim().toUpperCase()}|${key}`).digest("hex").slice(0, 40)}`;
}

function nullableText(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function numberOrNull(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function numberOrZero(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function normalizedAuditReference(value: unknown) { return (typeof value === "string" ? value : "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }

export type BookedCommercialLineage =
  | { ok: true; versionId: string; fingerprint: string; snapshot: CommercialSnapshot }
  | { ok: false; reason: "legacy_unversioned" | "commercial_review_required" };

/**
 * Booked history is authoritative only when the shipment embeds the exact
 * immutable snapshot and its ID/fingerprint agree with the stored procurement
 * projection. No current rate card, pricing rule or FX table is consulted.
 */
export function resolveBookedCommercialLineage(shipment: Record<string, unknown> | null | undefined): BookedCommercialLineage {
  if (!shipment) return { ok: false, reason: "legacy_unversioned" };
  const versionId = normalizeCommercialId(shipment.booked_commercial_version_id);
  const fingerprint = typeof shipment.booked_commercial_fingerprint === "string" ? shipment.booked_commercial_fingerprint.trim() : "";
  const embedded = shipment.booked_commercial_snapshot;
  if (!versionId || !fingerprint || !embedded || typeof embedded !== "object") return { ok: false, reason: "legacy_unversioned" };
  const snapshot = embedded as CommercialSnapshot;
  if (!commercialSnapshotIntegrity(snapshot).ok || commercialFingerprint(snapshot) !== fingerprint) return { ok: false, reason: "commercial_review_required" };
  const procurement = snapshot.procurement;
  if (normalizeCommercialId(shipment.transport_order_id) !== normalizeCommercialId(snapshot.order_id)
    || normalizeCommercialId(shipment.partner_id) !== normalizeCommercialId(procurement.partner_id)
    || normalizeCommercialCurrency(shipment.procurement_currency) !== normalizeCommercialCurrency(procurement.currency)
    || !sameCommercialMoney(shipment.procurement_cost, procurement.total, procurement.currency)) return { ok: false, reason: "commercial_review_required" };
  return { ok: true, versionId, fingerprint, snapshot };
}

/**
 * Freight Audit economic identity after commercial-lineage remediation.
 * Mutable live order quantities/rate cards are intentionally ignored.
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
  const lineage = resolveBookedCommercialLineage(shipment);
  const procurement = lineage.ok ? lineage.snapshot.procurement : null;
  const payload = [
    "kcpl-freight-audit-v3",
    input.payableReference.trim().toUpperCase(),
    [
      nullableText(bill.supplier_id), nullableText(bill.supplier_name), nullableText(bill.category), normalizedAuditReference(bill.supplier_bill_reference),
      nullableText(bill.shipment_reference), normalizeSettlementCurrency(bill.currency) || "NPR",
      numberOrZero(bill.subtotal), numberOrZero(bill.total), numberOrZero(bill.tax_total),
    ],
    lineage.ok ? [
      lineage.versionId, lineage.fingerprint,
      normalizeCommercialId(lineage.snapshot.order_id), normalizeCommercialId(procurement!.partner_id), normalizeCommercialCurrency(procurement!.currency),
      numberOrNull(procurement!.total), normalizeCommercialId(procurement!.rate_card_id),
      numberOrNull(procurement!.base_charge), numberOrNull(procurement!.fuel_surcharge), numberOrNull(procurement!.accessorials),
      normalizeCommercialId(shipment.tender_id),
    ] : ["commercial_review_required", normalizeCommercialId(shipment.booked_commercial_version_id), nullableText(shipment.booked_commercial_fingerprint)],
    input.duplicateOf ?? null,
  ];
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
