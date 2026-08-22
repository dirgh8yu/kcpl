import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canAccessBranchValue, compatibleRecordBranches, strictBranchValue } from "../branch-access-policy";
import { commercialVersionFromDocument } from "../commercial-lineage/commercial-lineage.server";
import { normalizeCommercialId } from "../commercial-lineage/commercial-lineage";
import { crmCurrencies, kcplBranches, type KcplBranch } from "../crm/crm-data";
import { financePaymentMethods, type FinancePaymentMethod } from "../finance/finance-data";
import { freightAuditPaymentAllowed, freightAuditStatuses, normalizeAuditReference, type FreightAuditStatus } from "../freight-audit/freight-audit";
import { jobCostCategories } from "../job-file";
import { canAccessPartnerOwner, isPartnerReference, partnerOwnerCompatibleWithBranch } from "../partners/partner-policy";
import type { CreatePayableInput } from "../payables/payables-data";
import { normalizeSupplierBillReference, payableDateError, supplierIdentityKey, validPayableCalendarDate } from "../payables/payables-policy";
import type { KcplStaffContext } from "../staff-directory.server";
import {
  applySettlementPayment,
  freightAuditEconomicFingerprint,
  normalizeSettlementCurrency,
  paymentDocumentId,
  resolveBookedCommercialLineage,
  resolveSettlementBasis,
  sameMoney,
  settlementCurrenciesMatch,
  settlementRequestFingerprint,
  supplierInvoiceUniquenessKey,
} from "./settlement-policy";

type Actor = { name: string; email: string };
type PaymentInput = {
  amount: number;
  paymentDate: string;
  method: FinancePaymentMethod;
  reference: string;
  notes: string;
  currency?: string | null;
  idempotencyKey?: string | null;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function payableReference() { const date = new Date().toISOString().slice(0, 10).replaceAll("-", ""); return `KCPL-B-${date}-${randomBytes(5).toString("hex").toUpperCase()}`; }
function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function addDays(date: string, days: number) { const parsed = new Date(`${date}T00:00:00Z`); parsed.setUTCDate(parsed.getUTCDate() + Math.max(0, days)); return parsed.toISOString().slice(0, 10); }
function canAccess(context: KcplStaffContext, branch: unknown) { return context.permissions.canManageFinance && canAccessBranchValue(context, branch); }
function status(value: unknown) { return text(value).trim(); }
function isTmsShipment(data: Record<string, unknown>) { return Boolean(nullable(data.transport_order_id) || nullable(data.tender_id) || nullable(data.procurement_rate_card_id)); }

async function writePayablePaymentActivity(input: {
  paymentId: string; billReference: string; shipmentReference: string | null; supplierId: string | null;
  currency: string; amount: number; remaining: number; actor: Actor; commercialVersionId?: string | null; commercialFingerprint?: string | null;
}) {
  const db = firebaseAdminDb();
  const now = new Date().toISOString();
  const detail = `${input.currency} ${input.amount.toFixed(2)} paid · ${input.currency} ${input.remaining.toFixed(2)} remaining`;
  const activity = {
    type: "payables_activity", title: `Supplier payment recorded: ${input.billReference}`, detail,
    commercial_version_id: input.commercialVersionId ?? null, commercial_fingerprint: input.commercialFingerprint ?? null,
    actor_name: input.actor.name, actor_email: input.actor.email, created_at: now,
  };
  const writes: Promise<unknown>[] = [];
  if (input.shipmentReference) writes.push(db.collection("shipments").doc(input.shipmentReference).collection("job_activity").doc(`payable-${input.paymentId}`).set(activity, { merge: true }));
  if (input.supplierId && isPartnerReference(input.supplierId)) writes.push(db.collection("partners").doc(input.supplierId).collection("activity").doc(`payable-${input.paymentId}`).set(activity, { merge: true }));
  await Promise.all(writes.map((write) => write.catch(() => undefined)));
}

async function legacyDuplicateInTransaction(transaction: FirebaseFirestore.Transaction, supplierKey: string, supplierId: string, supplierName: string, normalizedReference: string) {
  const db = firebaseAdminDb();
  const queries: FirebaseFirestore.Query[] = [
    db.collection("payables").where("normalized_supplier_bill_reference", "==", normalizedReference).limit(50),
    db.collection("payables").where("supplier_key", "==", supplierKey).limit(250),
  ];
  if (supplierId) queries.push(db.collection("payables").where("supplier_id", "==", supplierId).limit(250));
  else queries.push(db.collection("payables").where("supplier_name", "==", supplierName).limit(250));
  const snapshots = await Promise.all(queries.map((query) => transaction.get(query)));
  const candidates = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const snapshot of snapshots) for (const doc of snapshot.docs) candidates.set(doc.id, doc);
  for (const doc of candidates.values()) {
    if (status(doc.get("status")) === "void") continue;
    const existingSupplierKey = text(doc.get("supplier_key")) || supplierIdentityKey(text(doc.get("supplier_id")), text(doc.get("supplier_name")));
    const existingReference = text(doc.get("normalized_supplier_bill_reference")) || normalizeSupplierBillReference(text(doc.get("supplier_bill_reference")));
    if (existingSupplierKey === supplierKey && existingReference === normalizedReference) return doc.id;
  }
  return null;
}

export async function createPayableWithSettlementIntegrity(input: CreatePayableInput, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  if (!crmCurrencies.includes(input.currency)) return { kind: "invalid_currency" as const };
  if (!jobCostCategories.includes(input.category)) return { kind: "invalid_category" as const };
  const amount = Number(input.amount);
  const taxRate = Number(input.taxRate);
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "invalid_amount" as const };
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return { kind: "invalid_tax" as const };
  const supplierBillReference = input.supplierBillReference.trim();
  const normalizedSupplierBillReference = normalizeSupplierBillReference(supplierBillReference);
  if (!normalizedSupplierBillReference) return { kind: "supplier_bill_reference_required" as const };

  const shipmentId = input.shipmentReference.trim().toUpperCase();
  const supplierId = input.supplierId.trim().toUpperCase();
  if (supplierId && !isPartnerReference(supplierId)) return { kind: "supplier_missing" as const };
  const billDate = input.billDate.trim() || operationalDate();
  if (!validPayableCalendarDate(billDate)) return { kind: "invalid_bill_date" as const };
  const db = firebaseAdminDb();
  const reference = payableReference();
  const billRef = db.collection("payables").doc(reference);

  return db.runTransaction(async (transaction) => {
    const shipmentRef = shipmentId ? db.collection("shipments").doc(shipmentId) : null;
    const supplierRef = supplierId ? db.collection("partners").doc(supplierId) : null;
    const [shipment, supplier] = await Promise.all([shipmentRef ? transaction.get(shipmentRef) : Promise.resolve(null), supplierRef ? transaction.get(supplierRef) : Promise.resolve(null)]);
    if (shipmentId && !shipment?.exists) return { kind: "shipment_missing" as const };
    if (supplierId && !supplier?.exists) return { kind: "supplier_missing" as const };
    if (supplier?.exists && !canAccessPartnerOwner(context, supplier.get("owner_branch"))) return { kind: "supplier_forbidden" as const };
    const shipmentData = shipment?.exists ? shipment.data() as Record<string, unknown> : {};
    const rawBranch = shipment?.exists ? shipment.get("primary_branch") : input.branch;
    if (!kcplBranches.includes(rawBranch as KcplBranch)) return { kind: "invalid_branch" as const };
    if (!canAccess(context, rawBranch)) return { kind: "forbidden" as const };
    const branch = rawBranch as KcplBranch;
    if (supplier?.exists && !partnerOwnerCompatibleWithBranch(supplier.get("owner_branch"), branch)) return { kind: "supplier_scope_mismatch" as const };
    const supplierName = supplier?.exists ? text(supplier.get("display_name"), supplierId) : input.supplierName.trim();
    if (!supplierName) return { kind: "supplier_required" as const };
    const supplierKey = supplierIdentityKey(supplier?.exists ? supplierId : "", supplierName);
    if (!supplierKey) return { kind: "supplier_required" as const };
    const termsDays = supplier?.exists ? Math.max(0, Math.round(numberValue(supplier.get("payment_terms_days")))) : 30;
    const dueDate = input.dueDate.trim() || addDays(billDate, termsDays);
    const dateError = payableDateError(billDate, dueDate);
    if (dateError) return { kind: dueDate < billDate ? "due_before_bill_date" as const : "invalid_due_date" as const };

    const customerId = nullable(shipmentData.customer_id);
    const customerRef = customerId ? db.collection("customers").doc(customerId) : null;
    const customer = customerRef ? await transaction.get(customerRef) : null;
    if (customerId && !customer?.exists) return { kind: "customer_missing" as const };
    if (customer?.exists && !compatibleRecordBranches(branch, customer.get("primary_branch"))) return { kind: "customer_scope_mismatch" as const };
    const uniqueKey = supplierInvoiceUniquenessKey(supplierKey, normalizedSupplierBillReference);
    const uniqueRef = db.collection("supplier_invoice_uniques").doc(uniqueKey);
    const unique = await transaction.get(uniqueRef);
    if (unique.exists) {
      const existingReference = text(unique.get("payable_reference"));
      if (existingReference) {
        const existing = await transaction.get(db.collection("payables").doc(existingReference));
        if (existing.exists && status(existing.get("status")) !== "void") return { kind: "duplicate_bill" as const, reference: existingReference };
      }
    }
    const legacyDuplicate = await legacyDuplicateInTransaction(transaction, supplierKey, supplierId, supplierName, normalizedSupplierBillReference);
    if (legacyDuplicate) return { kind: "duplicate_bill" as const, reference: legacyDuplicate };

    const subtotal = Math.round(amount * 100) / 100;
    const taxTotal = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxTotal) * 100) / 100;
    const now = new Date().toISOString();
    transaction.set(uniqueRef, { supplier_key: supplierKey, normalized_supplier_bill_reference: normalizedSupplierBillReference, payable_reference: reference, created_at: now, updated_at: now });
    transaction.create(billRef, {
      reference, record_type: "bill", supplier_id: supplier?.exists ? supplierId : null, supplier_key: supplierKey,
      supplier_invoice_key: uniqueKey, supplier_name: supplierName, supplier_bill_reference: supplierBillReference,
      normalized_supplier_bill_reference: normalizedSupplierBillReference, shipment_reference: shipment?.exists ? shipmentId : null,
      customer_id: customerId, customer_name: customer?.exists ? text(customer.get("display_name"), customerId ?? "") : null,
      branch, category: input.category, status: "draft", payment_status: "unpaid", bill_date: billDate, due_date: dueDate,
      currency: input.currency, description: input.description.trim() || "Supplier / carrier cost", subtotal, tax_rate: taxRate,
      tax_total: taxTotal, adjustment_total: 0, credit_total: 0, total, amount_paid: 0, balance_due: total,
      settlement_basis_version: 1, notes: input.notes.trim() || null, created_by_name: actor.name, created_by_email: actor.email,
      created_at: now, updated_at: now,
    });
    transaction.create(billRef.collection("activity").doc("created"), { type: "payable_created", title: "Supplier bill created", detail: `${input.currency} ${total.toFixed(2)} · ${supplierName}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
    return { kind: "created" as const, reference };
  });
}

async function duplicateForFingerprint(transaction: FirebaseFirestore.Transaction, reference: string, bill: Record<string, unknown>) {
  const normalized = text(bill.normalized_supplier_bill_reference) || normalizeAuditReference(nullable(bill.supplier_bill_reference));
  if (!normalized) return null;
  const snapshot = await transaction.get(firebaseAdminDb().collection("payables").where("normalized_supplier_bill_reference", "==", normalized).limit(25));
  const supplierId = nullable(bill.supplier_id);
  const supplierName = text(bill.supplier_name).trim().toLowerCase();
  for (const doc of snapshot.docs) {
    if (doc.id === reference || status(doc.get("status")) === "void") continue;
    const sameSupplier = supplierId ? nullable(doc.get("supplier_id")) === supplierId : text(doc.get("supplier_name")).trim().toLowerCase() === supplierName;
    if (sameSupplier) return doc.id;
  }
  return null;
}

export async function recordPayablePaymentWithSettlementIntegrity(reference: string, input: PaymentInput, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const normalizedReference = reference.trim().toUpperCase();
  if (!/^KCPL-B-[A-Z0-9-]+$/i.test(normalizedReference)) return { kind: "missing" as const };
  if (!financePaymentMethods.includes(input.method)) return { kind: "invalid_method" as const };
  const paymentDate = input.paymentDate.trim() || operationalDate();
  if (!validPayableCalendarDate(paymentDate)) return { kind: "invalid_payment_date" as const };
  const requestCurrency = input.currency ? normalizeSettlementCurrency(input.currency) : null;
  if (requestCurrency && !crmCurrencies.includes(requestCurrency as (typeof crmCurrencies)[number])) return { kind: "invalid_currency" as const };

  const db = firebaseAdminDb();
  const billRef = db.collection("payables").doc(normalizedReference);
  const outcome = await db.runTransaction(async (transaction) => {
    const billSnapshot = await transaction.get(billRef);
    if (!billSnapshot.exists) return { kind: "missing" as const };
    const bill = billSnapshot.data() as Record<string, unknown>;
    const billBranch = strictBranchValue(bill.branch);
    if (!billBranch || !canAccess(context, billBranch)) return { kind: "forbidden" as const };
    const supplierId = nullable(bill.supplier_id)?.toUpperCase() ?? null;
    if (supplierId && isPartnerReference(supplierId)) {
      const supplier = await transaction.get(db.collection("partners").doc(supplierId));
      if (!supplier.exists || !partnerOwnerCompatibleWithBranch(supplier.get("owner_branch"), billBranch)) return { kind: "relationship_mismatch" as const };
    }
    const currentStatus = status(bill.status);
    if (currentStatus === "paid" || numberValue(bill.balance_due) <= 0) return { kind: "already_paid" as const };
    if (!["approved", "partially_paid", "overdue"].includes(currentStatus)) return { kind: "invalid_status" as const };

    const billCurrency = normalizeSettlementCurrency(bill.currency);
    if (!billCurrency || !crmCurrencies.includes(billCurrency as (typeof crmCurrencies)[number])) return { kind: "invalid_financial_state" as const, reason: "invalid_currency" as const };
    if (requestCurrency && !settlementCurrenciesMatch(requestCurrency, billCurrency)) return { kind: "currency_mismatch" as const };
    const basisResult = resolveSettlementBasis({ subtotal: bill.subtotal, taxes: bill.tax_total, adjustments: bill.adjustment_total, credits: bill.credit_total, storedTotal: bill.total, amountAlreadyPaid: bill.amount_paid, storedOutstanding: bill.balance_due });
    if (!basisResult.ok) return { kind: "invalid_financial_state" as const, reason: basisResult.reason };
    const applied = applySettlementPayment(basisResult.basis, input.amount);
    if (!applied.ok) return { kind: applied.reason === "overpayment" ? "overpayment" as const : "invalid_amount" as const };

    const requestFingerprint = settlementRequestFingerprint({ accountReference: normalizedReference, amount: applied.amount, currency: billCurrency, paymentDate, method: input.method, externalReference: input.reference });
    const paymentId = paymentDocumentId(normalizedReference, input.idempotencyKey?.trim() ?? "", requestFingerprint);
    const paymentRef = billRef.collection("payments").doc(paymentId);
    const existingPayment = await transaction.get(paymentRef);
    if (existingPayment.exists) {
      if (text(existingPayment.get("request_fingerprint")) === requestFingerprint) return {
        kind: "idempotent" as const, paymentId, currency: billCurrency, amount: numberValue(existingPayment.get("amount")),
        remaining: numberValue(existingPayment.get("balance_after")), shipmentReference: nullable(bill.shipment_reference), supplierId,
        commercialVersionId: nullable(existingPayment.get("booked_commercial_version_id")), commercialFingerprint: nullable(existingPayment.get("booked_commercial_fingerprint")),
      };
      return { kind: "idempotency_conflict" as const };
    }

    const audit = await transaction.get(db.collection("freight_audits").doc(normalizedReference));
    if (!audit.exists) return { kind: "audit_missing" as const };
    const auditStatus = text(audit.get("status")) as FreightAuditStatus;
    if (!freightAuditStatuses.includes(auditStatus) || !freightAuditPaymentAllowed(auditStatus)) return { kind: "audit_blocked" as const, auditStatus };

    const shipmentReference = nullable(bill.shipment_reference)?.toUpperCase() ?? null;
    const shipment = shipmentReference ? await transaction.get(db.collection("shipments").doc(shipmentReference)) : null;
    if (shipmentReference && (!shipment?.exists || !compatibleRecordBranches(billBranch, shipment.get("primary_branch")))) return { kind: "relationship_mismatch" as const };
    const shipmentData = shipment?.exists ? shipment.data() as Record<string, unknown> : {};
    const orderId = normalizeCommercialId(shipmentData.transport_order_id);
    const order = orderId ? await transaction.get(db.collection("transport_orders").doc(orderId)) : null;
    if (orderId && (!order?.exists || !compatibleRecordBranches(billBranch, order.get("branch")))) return { kind: "relationship_mismatch" as const };
    const duplicateOf = await duplicateForFingerprint(transaction, normalizedReference, bill);
    const currentFingerprint = freightAuditEconomicFingerprint({ payableReference: normalizedReference, bill, shipment: shipment?.exists ? shipmentData : null, duplicateOf });
    const auditFingerprint = text(audit.get("commercial_fingerprint"));
    const auditEconomicStateMatches = auditFingerprint === currentFingerprint
      && settlementCurrenciesMatch(audit.get("invoice_currency"), billCurrency)
      && sameMoney(numberValue(audit.get("invoice_subtotal")), basisResult.basis.invoiceSubtotal)
      && sameMoney(numberValue(audit.get("invoice_tax")), basisResult.basis.taxes)
      && sameMoney(numberValue(audit.get("invoice_total")), basisResult.basis.totalPayable);
    if (!auditEconomicStateMatches) return { kind: "audit_stale" as const };

    const issues = Array.isArray(audit.get("issues")) ? audit.get("issues") as Array<Record<string, unknown>> : [];
    const ancillary = issues.some((item) => item.code === "ancillary_supplier_bill");
    let commercialVersionId: string | null = null;
    let commercialFingerprint: string | null = null;
    if (shipment?.exists && isTmsShipment(shipmentData)) {
      if (auditStatus === "not_applicable") {
        if (!ancillary) return { kind: "audit_stale" as const };
      } else {
        const lineage = resolveBookedCommercialLineage(shipmentData);
        if (!lineage.ok) return { kind: "audit_stale" as const };
        commercialVersionId = lineage.versionId;
        commercialFingerprint = lineage.fingerprint;
        if (normalizeCommercialId(audit.get("booked_commercial_version_id")) !== lineage.versionId || text(audit.get("booked_commercial_fingerprint")) !== lineage.fingerprint) return { kind: "audit_stale" as const };
        if (!order?.exists || normalizeCommercialId(order.get("booked_commercial_version_id")) !== lineage.versionId || text(order.get("booked_commercial_fingerprint")) !== lineage.fingerprint) return { kind: "audit_stale" as const };
        const versionDoc = await transaction.get(db.collection("commercial_versions").doc(lineage.versionId));
        if (!versionDoc.exists) return { kind: "audit_stale" as const };
        const storedVersion = commercialVersionFromDocument(versionDoc.id, versionDoc.data() as Record<string, unknown>);
        if (!storedVersion || storedVersion.fingerprint !== lineage.fingerprint || normalizeCommercialId(storedVersion.snapshot.order_id) !== orderId) return { kind: "audit_stale" as const };
      }
    }

    const now = new Date().toISOString();
    const nextStatus = applied.nextOutstanding <= 0.00001 ? "paid" : text(bill.due_date) < operationalDate() ? "overdue" : "partially_paid";
    transaction.create(paymentRef, {
      payable_reference: normalizedReference, amount: applied.amount, currency: billCurrency, payment_date: paymentDate, method: input.method,
      reference: input.reference.trim() || null, notes: input.notes.trim() || null, request_fingerprint: requestFingerprint,
      idempotency_key: input.idempotencyKey?.trim() || requestFingerprint, approved_settlement_amount: basisResult.basis.totalPayable,
      approved_settlement_currency: billCurrency, settlement_basis_version: 1, balance_before: basisResult.basis.outstandingAmount,
      balance_after: applied.nextOutstanding, freight_audit_status: auditStatus, freight_audit_fingerprint: auditFingerprint,
      booked_commercial_version_id: commercialVersionId, booked_commercial_fingerprint: commercialFingerprint,
      recorded_by_name: actor.name, recorded_by_email: actor.email, created_at: now,
    });
    transaction.update(billRef, {
      amount_paid: applied.nextPaid, balance_due: applied.nextOutstanding, status: nextStatus,
      payment_status: applied.nextOutstanding <= 0.00001 ? "paid" : "partially_paid", last_payment_id: paymentId,
      last_payment_at: now, last_payment_by_name: actor.name, last_payment_by_email: actor.email,
      approved_settlement_amount: basisResult.basis.totalPayable, approved_settlement_currency: billCurrency,
      settlement_basis_version: 1, last_payment_audit_fingerprint: auditFingerprint,
      last_payment_commercial_version_id: commercialVersionId, last_payment_commercial_fingerprint: commercialFingerprint,
      updated_at: now,
    });
    return { kind: "updated" as const, paymentId, currency: billCurrency, amount: applied.amount, remaining: applied.nextOutstanding, shipmentReference, supplierId, commercialVersionId, commercialFingerprint };
  });

  if (outcome.kind === "updated") {
    await writePayablePaymentActivity({
      paymentId: outcome.paymentId, billReference: normalizedReference, shipmentReference: outcome.shipmentReference,
      supplierId: outcome.supplierId, currency: outcome.currency, amount: outcome.amount, remaining: outcome.remaining, actor,
      commercialVersionId: outcome.commercialVersionId, commercialFingerprint: outcome.commercialFingerprint,
    });
  }
  return outcome;
}
