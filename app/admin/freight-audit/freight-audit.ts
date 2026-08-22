import type { CrmCurrency, KcplBranch } from "../crm/crm-data";

export const freightAuditStatuses = ["pending", "matched", "review_required", "disputed", "approved_variance", "rejected", "not_applicable"] as const;
export type FreightAuditStatus = (typeof freightAuditStatuses)[number];

export const freightAuditStatusLabels: Record<FreightAuditStatus, string> = {
  pending: "Pending audit", matched: "Matched", review_required: "Review required", disputed: "Disputed",
  approved_variance: "Variance approved", rejected: "Rejected", not_applicable: "Not applicable",
};

export const freightAuditIssueCodes = [
  "amount_variance", "currency_mismatch", "supplier_mismatch", "duplicate_invoice", "missing_booking_cost",
  "missing_supplier_reference", "shipment_not_tms_booked", "ancillary_supplier_bill", "commercial_lineage_mismatch", "legacy_unversioned",
] as const;
export type FreightAuditIssueCode = (typeof freightAuditIssueCodes)[number];

export type FreightAuditIssue = { code: FreightAuditIssueCode; severity: "warning" | "blocking"; title: string; detail: string };

export type FreightAuditRecord = {
  payable_reference: string;
  shipment_reference: string | null;
  supplier_id: string | null;
  supplier_name: string;
  supplier_bill_reference: string | null;
  branch: KcplBranch;
  status: FreightAuditStatus;
  invoice_currency: CrmCurrency;
  invoice_subtotal: number;
  invoice_tax: number;
  invoice_total: number;
  booked_partner_id: string | null;
  booked_partner_name: string | null;
  booked_currency: CrmCurrency | null;
  booked_cost: number | null;
  booked_commercial_version_id: string | null;
  booked_commercial_fingerprint: string | null;
  commercial_lineage_status: "versioned" | "legacy_unversioned" | "commercial_review_required";
  expected_linehaul: number | null;
  expected_fuel_surcharge: number | null;
  expected_accessorials: number | null;
  expected_rate_unit: string | null;
  expected_quantity: number | null;
  minimum_applied: boolean | null;
  variance_amount: number | null;
  variance_percent: number | null;
  tolerance_amount: number;
  tolerance_percent: number;
  within_tolerance: boolean;
  duplicate_of: string | null;
  issues: FreightAuditIssue[];
  dispute_note: string | null;
  resolution_note: string | null;
  audited_at: string | null;
  audited_by_name: string | null;
  audited_by_email: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  approved_by_email: string | null;
  updated_at: string;
};

export type FreightAuditQueueRow = FreightAuditRecord & { payable_status: string; customer_name: string | null; carrier_reference: string | null };
export type FreightAuditSummary = { total: number; matched: number; review_required: number; disputed: number; approved_variance: number; blocked_from_payment: number };

export const DEFAULT_FREIGHT_AUDIT_TOLERANCE_PERCENT = 1;
export const DEFAULT_FREIGHT_AUDIT_TOLERANCE_AMOUNT = 1;

export function normalizeAuditReference(value: string | null | undefined) { return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function identityKey(value: string | null | undefined) { return (value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }

export function classifyFreightAuditSupplier(input: { tmsBooked: boolean; category: string; bookedPartnerId?: string | null; bookedPartnerName?: string | null; supplierId?: string | null; supplierName?: string | null }) {
  const partnerIdentityAvailable = Boolean(input.bookedPartnerId || input.bookedPartnerName);
  const providerMatches = input.bookedPartnerId && input.supplierId
    ? input.bookedPartnerId.trim().toUpperCase() === input.supplierId.trim().toUpperCase()
    : Boolean(input.bookedPartnerName && identityKey(input.bookedPartnerName) === identityKey(input.supplierName));
  const carrierLikeCategory = ["freight", "transport"].includes(input.category.trim().toLowerCase());
  return { partnerIdentityAvailable, providerMatches, carrierLikeCategory, ancillarySupplierBill: Boolean(input.tmsBooked && partnerIdentityAvailable && !providerMatches && !carrierLikeCategory) };
}

export function calculateFreightVariance(bookedCost: number | null, invoiceSubtotal: number, sameCurrency: boolean) {
  if (bookedCost === null || !Number.isFinite(bookedCost) || bookedCost < 0 || !sameCurrency) return { amount: null, percent: null };
  const amount = Math.round((invoiceSubtotal - bookedCost) * 100) / 100;
  const percent = bookedCost > 0 ? Math.round((amount / bookedCost) * 10_000) / 100 : invoiceSubtotal === 0 ? 0 : null;
  return { amount, percent };
}

export function freightVarianceWithinTolerance(input: { bookedCost: number | null; invoiceSubtotal: number; sameCurrency: boolean; toleranceAmount?: number; tolerancePercent?: number }) {
  if (input.bookedCost === null || !input.sameCurrency) return false;
  const toleranceAmount = Math.max(0, input.toleranceAmount ?? DEFAULT_FREIGHT_AUDIT_TOLERANCE_AMOUNT);
  const tolerancePercent = Math.max(0, input.tolerancePercent ?? DEFAULT_FREIGHT_AUDIT_TOLERANCE_PERCENT);
  const variance = Math.abs(input.invoiceSubtotal - input.bookedCost);
  const percentageLimit = Math.abs(input.bookedCost) * tolerancePercent / 100;
  return variance <= Math.max(toleranceAmount, percentageLimit) + 0.00001;
}

export function freightAuditPaymentAllowed(status: FreightAuditStatus) { return status === "matched" || status === "approved_variance" || status === "not_applicable"; }
export function freightAuditRequiresManagement(status: FreightAuditStatus) { return status === "review_required" || status === "disputed"; }
export function summarizeFreightAudits(rows: FreightAuditQueueRow[]): FreightAuditSummary {
  return {
    total: rows.length, matched: rows.filter((row) => row.status === "matched").length,
    review_required: rows.filter((row) => row.status === "review_required").length,
    disputed: rows.filter((row) => row.status === "disputed").length,
    approved_variance: rows.filter((row) => row.status === "approved_variance").length,
    blocked_from_payment: rows.filter((row) => !freightAuditPaymentAllowed(row.status)).length,
  };
}
