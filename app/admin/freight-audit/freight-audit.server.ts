import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canAccessBranchValue, compatibleRecordBranches, strictBranchValue } from "../branch-access-policy";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { freightAuditEconomicFingerprint, resolveBookedCommercialLineage } from "../financial-settlement/settlement-policy";
import type { KcplStaffContext } from "../staff-directory.server";
import {
  DEFAULT_FREIGHT_AUDIT_TOLERANCE_AMOUNT,
  DEFAULT_FREIGHT_AUDIT_TOLERANCE_PERCENT,
  calculateFreightVariance,
  classifyFreightAuditSupplier,
  freightAuditPaymentAllowed,
  freightVarianceWithinTolerance,
  normalizeAuditReference,
  summarizeFreightAudits,
  type FreightAuditIssue,
  type FreightAuditQueueRow,
  type FreightAuditRecord,
  type FreightAuditStatus,
} from "./freight-audit";

type Actor = { name: string; email: string };
type BillSource = {
  reference: string;
  data: Record<string, unknown>;
  shipment: FirebaseFirestore.DocumentSnapshot | null;
  order: FirebaseFirestore.DocumentSnapshot | null;
  duplicateOf: string | null;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function currencyValue(value: unknown): CrmCurrency { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : "NPR"; }
function nullableCurrency(value: unknown): CrmCurrency | null { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : null; }
function branchValue(value: unknown): KcplBranch { if (!kcplBranches.includes(value as KcplBranch)) throw new Error("Freight Audit requires a canonical KCPL branch"); return value as KcplBranch; }
function id(prefix: string) { return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`; }

function bookingBaseline(shipment: Record<string, unknown>) {
  const lineage = resolveBookedCommercialLineage(shipment);
  if (!lineage.ok) return null;
  const procurement = lineage.snapshot.procurement;
  return {
    linehaul: nullableNumber(procurement.base_charge),
    fuel: nullableNumber(procurement.fuel_surcharge),
    accessorials: nullableNumber(procurement.accessorials),
    unit: nullable(procurement.rating_unit),
    quantity: nullableNumber(procurement.rating_quantity),
    minimumApplied: typeof procurement.minimum_applied === "boolean" ? procurement.minimum_applied : null,
  };
}

function issue(code: FreightAuditIssue["code"], severity: FreightAuditIssue["severity"], title: string, detail: string): FreightAuditIssue { return { code, severity, title, detail }; }
function isTmsShipment(shipment: Record<string, unknown>) { return Boolean(nullable(shipment.transport_order_id) || nullable(shipment.tender_id) || nullable(shipment.procurement_rate_card_id)); }

function recordFromSource(source: BillSource, existing?: Record<string, unknown> | null): FreightAuditRecord & { fingerprint: string } {
  const bill = source.data;
  const shipment = source.shipment?.exists ? source.shipment.data() as Record<string, unknown> : {};
  const branch = branchValue(bill.branch);
  const invoiceCurrency = currencyValue(bill.currency);
  const invoiceSubtotal = numberValue(bill.subtotal);
  const invoiceTax = numberValue(bill.tax_total);
  const invoiceTotal = numberValue(bill.total);
  const lineage = resolveBookedCommercialLineage(shipment);
  const bookedCurrency = lineage.ok ? nullableCurrency(lineage.snapshot.procurement.currency) : nullableCurrency(shipment.procurement_currency);
  const bookedCost = lineage.ok ? lineage.snapshot.procurement.total : nullableNumber(shipment.procurement_cost);
  const bookedPartnerId = lineage.ok ? nullable(lineage.snapshot.procurement.partner_id) : nullable(shipment.partner_id);
  const bookedPartnerName = lineage.ok ? nullable(lineage.snapshot.procurement.partner_name) : nullable(shipment.carrier);
  const supplierId = nullable(bill.supplier_id);
  const supplierName = text(bill.supplier_name, "Supplier");
  const billCategory = text(bill.category, "other");
  const shipmentReference = nullable(bill.shipment_reference);
  const supplierBillReference = nullable(bill.supplier_bill_reference);
  const tmsBooked = source.shipment?.exists ? isTmsShipment(shipment) : false;
  const supplierScope = classifyFreightAuditSupplier({ tmsBooked, category: billCategory, bookedPartnerId, bookedPartnerName, supplierId, supplierName });
  const sameCurrency = Boolean(bookedCurrency && bookedCurrency === invoiceCurrency);
  const toleranceAmount = Math.max(0, nullableNumber(existing?.tolerance_amount) ?? DEFAULT_FREIGHT_AUDIT_TOLERANCE_AMOUNT);
  const tolerancePercent = Math.max(0, nullableNumber(existing?.tolerance_percent) ?? DEFAULT_FREIGHT_AUDIT_TOLERANCE_PERCENT);
  const variance = calculateFreightVariance(bookedCost, invoiceSubtotal, sameCurrency);
  const withinTolerance = freightVarianceWithinTolerance({ bookedCost, invoiceSubtotal, sameCurrency, toleranceAmount, tolerancePercent });
  const baseline = bookingBaseline(shipment);
  const issues: FreightAuditIssue[] = [];

  if (!shipmentReference || !source.shipment?.exists || !tmsBooked) {
    if (shipmentReference && source.shipment?.exists && !tmsBooked) issues.push(issue("shipment_not_tms_booked", "warning", "Legacy / non-TMS shipment", "This shipment has no TMS procurement booking snapshot, so automated Match-Pay is not enforced."));
  } else if (supplierScope.ancillarySupplierBill) {
    issues.push(issue("ancillary_supplier_bill", "warning", "Ancillary supplier bill", `${supplierName} is not the booked freight provider and this ${billCategory.replaceAll("_", " ")} bill is outside the carrier-rate Match-Pay comparison.`));
    if (source.duplicateOf) issues.push(issue("duplicate_invoice", "blocking", "Possible duplicate supplier invoice", `The same supplier invoice reference is already used by ${source.duplicateOf}.`));
  } else {
    if (!lineage.ok) {
      issues.push(issue(
        lineage.reason === "legacy_unversioned" ? "legacy_unversioned" : "commercial_lineage_mismatch",
        "blocking",
        lineage.reason === "legacy_unversioned" ? "Legacy booking needs commercial review" : "Booked commercial lineage failed integrity checks",
        lineage.reason === "legacy_unversioned"
          ? "This booked shipment predates immutable commercial versions. KCPL will not reconstruct historical economics from today’s rate card or FX."
          : "The shipment’s booked commercial snapshot, fingerprint or projected procurement fields disagree. Payment is blocked until reviewed.",
      ));
    }
    if (bookedCost === null || !bookedCurrency) issues.push(issue("missing_booking_cost", "blocking", "Booked procurement cost missing", "The TMS shipment does not contain a complete booked cost and currency snapshot."));
    if (!supplierBillReference) issues.push(issue("missing_supplier_reference", "blocking", "Supplier invoice reference missing", "Record the supplier invoice number before Match-Pay approval."));
    if (supplierScope.partnerIdentityAvailable && !supplierScope.providerMatches) issues.push(issue("supplier_mismatch", "blocking", "Supplier does not match booking", `Booked partner ${bookedPartnerName ?? bookedPartnerId}; bill is linked to ${supplierName}.`));
    if (bookedCurrency && bookedCurrency !== invoiceCurrency) issues.push(issue("currency_mismatch", "blocking", "Invoice currency differs from booking", `Booked in ${bookedCurrency}; supplier invoice is ${invoiceCurrency}. No hidden FX conversion is applied.`));
    if (source.duplicateOf) issues.push(issue("duplicate_invoice", "blocking", "Possible duplicate supplier invoice", `The same supplier invoice reference is already used by ${source.duplicateOf}.`));
    if (bookedCost !== null && sameCurrency && !withinTolerance) issues.push(issue("amount_variance", "blocking", "Supplier amount exceeds match tolerance", `Booked ${bookedCurrency} ${bookedCost.toFixed(2)} versus invoice subtotal ${invoiceCurrency} ${invoiceSubtotal.toFixed(2)}. Variance ${variance.amount === null ? "n/a" : `${variance.amount >= 0 ? "+" : ""}${variance.amount.toFixed(2)}`} (${variance.percent === null ? "n/a" : `${variance.percent.toFixed(2)}%`}).`));
  }

  const fingerprint = freightAuditEconomicFingerprint({ payableReference: source.reference, bill, shipment, duplicateOf: source.duplicateOf });
  const previousFingerprint = text(existing?.commercial_fingerprint);
  const previousStatus = text(existing?.status) as FreightAuditStatus;
  let status: FreightAuditStatus;
  if (!shipmentReference || !source.shipment?.exists || !tmsBooked) status = "not_applicable";
  else if (supplierScope.ancillarySupplierBill && !issues.some((item) => item.severity === "blocking")) status = "not_applicable";
  else if (!issues.some((item) => item.severity === "blocking")) status = "matched";
  else status = "review_required";
  if (previousFingerprint === fingerprint && ["disputed", "approved_variance", "rejected"].includes(previousStatus)) status = previousStatus;

  const now = new Date().toISOString();
  return {
    payable_reference: source.reference, shipment_reference: shipmentReference, supplier_id: supplierId, supplier_name: supplierName,
    supplier_bill_reference: supplierBillReference, branch, status, invoice_currency: invoiceCurrency, invoice_subtotal: invoiceSubtotal,
    invoice_tax: invoiceTax, invoice_total: invoiceTotal, booked_partner_id: bookedPartnerId, booked_partner_name: bookedPartnerName,
    booked_currency: bookedCurrency, booked_cost: bookedCost,
    booked_commercial_version_id: lineage.ok ? lineage.versionId : nullable(shipment.booked_commercial_version_id),
    booked_commercial_fingerprint: lineage.ok ? lineage.fingerprint : nullable(shipment.booked_commercial_fingerprint),
    commercial_lineage_status: lineage.ok ? "versioned" : lineage.reason,
    expected_linehaul: baseline?.linehaul ?? null, expected_fuel_surcharge: baseline?.fuel ?? null,
    expected_accessorials: baseline?.accessorials ?? null, expected_rate_unit: baseline?.unit ?? null,
    expected_quantity: baseline?.quantity ?? null, minimum_applied: baseline?.minimumApplied ?? null,
    variance_amount: variance.amount, variance_percent: variance.percent, tolerance_amount: toleranceAmount, tolerance_percent: tolerancePercent,
    within_tolerance: withinTolerance, duplicate_of: source.duplicateOf, issues,
    dispute_note: previousFingerprint === fingerprint ? nullable(existing?.dispute_note) : null,
    resolution_note: previousFingerprint === fingerprint ? nullable(existing?.resolution_note) : null,
    audited_at: previousFingerprint === fingerprint ? nullable(existing?.audited_at) : null,
    audited_by_name: previousFingerprint === fingerprint ? nullable(existing?.audited_by_name) : null,
    audited_by_email: previousFingerprint === fingerprint ? nullable(existing?.audited_by_email) : null,
    approved_at: previousFingerprint === fingerprint && status === "approved_variance" ? nullable(existing?.approved_at) : null,
    approved_by_name: previousFingerprint === fingerprint && status === "approved_variance" ? nullable(existing?.approved_by_name) : null,
    approved_by_email: previousFingerprint === fingerprint && status === "approved_variance" ? nullable(existing?.approved_by_email) : null,
    updated_at: now, fingerprint,
  };
}

async function duplicateForBill(reference: string, data: Record<string, unknown>) {
  const normalized = text(data.normalized_supplier_bill_reference) || normalizeAuditReference(nullable(data.supplier_bill_reference));
  if (!normalized) return null;
  const supplierId = nullable(data.supplier_id);
  const supplierName = text(data.supplier_name).trim().toLowerCase();
  const snapshot = await firebaseAdminDb().collection("payables").where("normalized_supplier_bill_reference", "==", normalized).limit(25).get();
  for (const doc of snapshot.docs) {
    if (doc.id === reference || text(doc.get("status")) === "void") continue;
    const sameSupplier = supplierId ? nullable(doc.get("supplier_id")) === supplierId : text(doc.get("supplier_name")).trim().toLowerCase() === supplierName;
    if (sameSupplier) return doc.id;
  }
  return null;
}

async function sourceForPayable(reference: string) {
  const normalized = reference.trim().toUpperCase();
  const db = firebaseAdminDb();
  const bill = await db.collection("payables").doc(normalized).get();
  if (!bill.exists) return null;
  const data = bill.data() as Record<string, unknown>;
  const shipmentReference = nullable(data.shipment_reference)?.toUpperCase() ?? null;
  const [shipment, duplicateOf] = await Promise.all([
    shipmentReference ? db.collection("shipments").doc(shipmentReference).get() : Promise.resolve(null),
    duplicateForBill(normalized, data),
  ]);
  const shipmentData = shipment?.exists ? shipment.data() as Record<string, unknown> : {};
  const orderId = normalizeCommercialReference(shipmentData.transport_order_id);
  const order = orderId ? await db.collection("transport_orders").doc(orderId).get() : null;
  return { reference: normalized, data, shipment, order, duplicateOf } satisfies BillSource;
}

function normalizeCommercialReference(value: unknown) { return text(value).trim().toUpperCase(); }

async function persistAudit(record: FreightAuditRecord & { fingerprint: string }, actor?: Actor) {
  const { fingerprint, ...publicRecord } = record;
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("freight_audits").doc(record.payable_reference).set({
    ...publicRecord, commercial_fingerprint: fingerprint,
    audited_at: publicRecord.audited_at ?? (actor ? now : null), audited_by_name: publicRecord.audited_by_name ?? actor?.name ?? null,
    audited_by_email: publicRecord.audited_by_email ?? actor?.email ?? null, updated_at: now,
  }, { merge: true });
}

export async function getFreightAudit(reference: string, context: KcplStaffContext, refresh = true) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const source = await sourceForPayable(reference);
  if (!source) return { kind: "missing" as const };
  const branch = strictBranchValue(source.data.branch);
  if (!branch || !canAccessBranchValue(context, branch)) return { kind: "forbidden" as const };
  if (source.shipment?.exists && !compatibleRecordBranches(branch, source.shipment.get("primary_branch"))) return { kind: "relationship_mismatch" as const };
  if (source.order?.exists && !compatibleRecordBranches(branch, source.order.get("branch"))) return { kind: "relationship_mismatch" as const };
  const stored = await firebaseAdminDb().collection("freight_audits").doc(source.reference).get();
  const record = recordFromSource(source, stored.exists ? stored.data() as Record<string, unknown> : null);
  if (refresh) await persistAudit(record);
  const { fingerprint, ...audit } = record;
  void fingerprint;
  return { kind: "ready" as const, audit };
}

export async function ensureFreightAuditForPayment(reference: string, context: KcplStaffContext) {
  const result = await getFreightAudit(reference, context, true);
  if (result.kind !== "ready") return result;
  return freightAuditPaymentAllowed(result.audit.status) ? { kind: "allowed" as const, audit: result.audit } : { kind: "blocked" as const, audit: result.audit };
}

export async function reviewFreightAudit(reference: string, action: "recheck" | "dispute" | "approve_variance" | "reject", note: string, actor: Actor, context: KcplStaffContext) {
  const result = await getFreightAudit(reference, context, true);
  if (result.kind !== "ready") return result;
  if (action === "recheck") return result;
  if ((action === "approve_variance" || action === "reject") && context.permissions.role !== "management") return { kind: "management_required" as const };
  if ((action === "dispute" || action === "approve_variance" || action === "reject") && note.trim().length < 8) return { kind: "note_required" as const };
  if (result.audit.status === "not_applicable" || result.audit.status === "matched") return { kind: "invalid_status" as const };
  if (result.audit.commercial_lineage_status !== "versioned" && action === "approve_variance") return { kind: "invalid_status" as const };

  const now = new Date().toISOString();
  const nextStatus: FreightAuditStatus = action === "dispute" ? "disputed" : action === "approve_variance" ? "approved_variance" : "rejected";
  await firebaseAdminDb().collection("freight_audits").doc(result.audit.payable_reference).set({
    status: nextStatus, dispute_note: action === "dispute" ? note.trim() : result.audit.dispute_note,
    resolution_note: action === "approve_variance" || action === "reject" ? note.trim() : result.audit.resolution_note,
    ...(action === "approve_variance" ? { approved_at: now, approved_by_name: actor.name, approved_by_email: actor.email } : {}), updated_at: now,
  }, { merge: true });

  const activity = {
    type: "freight_audit", title: action === "dispute" ? "Supplier invoice disputed" : action === "approve_variance" ? "Freight audit variance approved" : "Supplier invoice rejected",
    detail: `${result.audit.payable_reference} · ${note.trim()}`, commercial_version_id: result.audit.booked_commercial_version_id,
    commercial_fingerprint: result.audit.booked_commercial_fingerprint, actor_name: actor.name, actor_email: actor.email, created_at: now,
  };
  if (result.audit.shipment_reference) await firebaseAdminDb().collection("shipments").doc(result.audit.shipment_reference).collection("job_activity").doc(id("audit")).set(activity).catch(() => undefined);
  if (result.audit.supplier_id) await firebaseAdminDb().collection("partners").doc(result.audit.supplier_id).collection("activity").doc(id("audit")).set(activity).catch(() => undefined);
  return { kind: "updated" as const, status: nextStatus };
}

export async function listFreightAuditQueue(context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const snapshot = await firebaseAdminDb().collection("payables").orderBy("updated_at", "desc").limit(250).get();
  const rows: FreightAuditQueueRow[] = [];
  for (const doc of snapshot.docs) {
    if (!canAccessBranchValue(context, doc.get("branch"))) continue;
    if (text(doc.get("record_type")) === "opening_balance" || text(doc.get("status")) === "void") continue;
    const result = await getFreightAudit(doc.id, context, true);
    if (result.kind !== "ready") continue;
    const shipmentReference = result.audit.shipment_reference;
    const shipment = shipmentReference ? await firebaseAdminDb().collection("shipments").doc(shipmentReference).get() : null;
    rows.push({ ...result.audit, payable_status: text(doc.get("status"), "draft"), customer_name: nullable(doc.get("customer_name")), carrier_reference: shipment?.exists ? nullable(shipment.get("carrier_reference")) : null });
  }
  return { kind: "ready" as const, rows, summary: summarizeFreightAudits(rows), generated_at: new Date().toISOString() };
}
