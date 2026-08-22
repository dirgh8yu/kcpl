import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canAccessBranchValue, strictBranchValue } from "../branch-access-policy";
import { canAccessPartnerOwner, isPartnerReference } from "../partners/partner-policy";
import { normalizeSupplierBillReference, supplierIdentityKey } from "../payables/payables-policy";
import type { KcplStaffContext } from "../staff-directory.server";
import { isDuplicateSupplierIdentityCandidate } from "../partners/reconciliation/supplier-reconciliation-policy";
import { supplierInvoiceUniquenessKey } from "./settlement-policy";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }

export async function reconcileSupplierBillWithSettlementIntegrity(input: {
  billReference: string;
  partnerId: string;
  expectedSupplierId: string | null;
  expectedSupplierName: string;
}, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const billReference = input.billReference.trim().toUpperCase();
  const partnerId = input.partnerId.trim().toUpperCase();
  if (!/^KCPL-B-[A-Z0-9-]+$/i.test(billReference)) return { kind: "invalid_bill" as const };
  if (!isPartnerReference(partnerId)) return { kind: "invalid_partner" as const };

  const db = firebaseAdminDb();
  const billRef = db.collection("payables").doc(billReference);
  const partnerRef = db.collection("partners").doc(partnerId);
  const auditRef = db.collection("freight_audits").doc(billReference);

  return db.runTransaction(async (transaction) => {
    const [bill, partner, audit, existingPayments] = await Promise.all([
      transaction.get(billRef),
      transaction.get(partnerRef),
      transaction.get(auditRef),
      transaction.get(billRef.collection("payments").limit(1)),
    ]);
    if (!bill.exists) return { kind: "missing_bill" as const };
    if (!partner.exists) return { kind: "missing_partner" as const };
    const billBranch = strictBranchValue(bill.get("branch"));
    if (!billBranch || !canAccessBranchValue(context, billBranch)) return { kind: "forbidden" as const };
    if (!canAccessPartnerOwner(context, partner.get("owner_branch"))) return { kind: "forbidden" as const };
    if (text(bill.get("status")) === "void") return { kind: "void_bill" as const };
    if (numberValue(bill.get("amount_paid")) > 0 || !existingPayments.empty || ["partially_paid", "paid"].includes(text(bill.get("payment_status")))) {
      return { kind: "financially_locked" as const };
    }

    const currentSupplierId = nullable(bill.get("supplier_id"));
    const currentSupplierName = text(bill.get("supplier_name"));
    if ((currentSupplierId ?? null) !== (input.expectedSupplierId ?? null) || currentSupplierName !== input.expectedSupplierName) return { kind: "stale" as const };
    if (currentSupplierId === partnerId) return { kind: "already_linked" as const };
    if (currentSupplierId && isPartnerReference(currentSupplierId)) {
      const currentPartner = await transaction.get(db.collection("partners").doc(currentSupplierId));
      if (currentPartner.exists) return { kind: "already_linked_other" as const };
    }

    const partnerName = text(partner.get("display_name"), partnerId);
    const supplierBillReference = nullable(bill.get("supplier_bill_reference"));
    const normalizedBillReference = supplierBillReference ? normalizeSupplierBillReference(supplierBillReference) : "";
    const targetSupplierKey = supplierIdentityKey(partnerId, partnerName);
    const targetUniqueKey = normalizedBillReference ? supplierInvoiceUniquenessKey(targetSupplierKey, normalizedBillReference) : "";
    const targetUniqueRef = targetUniqueKey ? db.collection("supplier_invoice_uniques").doc(targetUniqueKey) : null;
    const targetUnique = targetUniqueRef ? await transaction.get(targetUniqueRef) : null;
    if (targetUnique?.exists) {
      const existingReference = text(targetUnique.get("payable_reference"));
      if (existingReference && existingReference !== billReference) {
        const existingBill = await transaction.get(db.collection("payables").doc(existingReference));
        if (existingBill.exists && text(existingBill.get("status")) !== "void") return { kind: "duplicate_supplier_bill" as const };
      }
    }

    if (normalizedBillReference) {
      const normalizedQuery = db.collection("payables").where("normalized_supplier_bill_reference", "==", normalizedBillReference).limit(50);
      const supplierKeyQuery = db.collection("payables").where("supplier_key", "==", targetSupplierKey).limit(250);
      const [normalizedMatches, supplierMatches] = await Promise.all([transaction.get(normalizedQuery), transaction.get(supplierKeyQuery)]);
      const candidates = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const doc of [...normalizedMatches.docs, ...supplierMatches.docs]) candidates.set(doc.id, doc);
      for (const candidate of candidates.values()) {
        if (candidate.id === billReference || text(candidate.get("status")) === "void") continue;
        const candidateNormalized = text(candidate.get("normalized_supplier_bill_reference")) || normalizeSupplierBillReference(text(candidate.get("supplier_bill_reference")));
        if (candidateNormalized !== normalizedBillReference) continue;
        if (isDuplicateSupplierIdentityCandidate({
          candidateSupplierId: nullable(candidate.get("supplier_id")), candidateSupplierName: text(candidate.get("supplier_name")),
          targetPartnerId: partnerId, targetPartnerName: partnerName, originalSupplierName: currentSupplierName,
        })) return { kind: "duplicate_supplier_bill" as const };
      }
    }

    const shipmentReference = nullable(bill.get("shipment_reference"));
    const costRef = shipmentReference ? db.collection("shipments").doc(shipmentReference).collection("job_costs").doc(`payable_${billReference}`) : null;
    const cost = costRef ? await transaction.get(costRef) : null;
    const oldUniqueKey = text(bill.get("supplier_invoice_key"));
    const oldUniqueRef = oldUniqueKey && oldUniqueKey !== targetUniqueKey ? db.collection("supplier_invoice_uniques").doc(oldUniqueKey) : null;
    const oldUnique = oldUniqueRef ? await transaction.get(oldUniqueRef) : null;
    const now = new Date().toISOString();

    transaction.update(billRef, {
      supplier_id: partnerId, supplier_name: partnerName, supplier_key: targetSupplierKey,
      supplier_invoice_key: targetUniqueKey || null, normalized_supplier_bill_reference: normalizedBillReference || null,
      supplier_reconciled_at: now, supplier_reconciled_by_name: actor.name, supplier_reconciled_by_email: actor.email,
      supplier_reconciled_from_id: currentSupplierId, supplier_reconciled_from_name: currentSupplierName || null, updated_at: now,
    });
    if (targetUniqueRef) transaction.set(targetUniqueRef, {
      supplier_key: targetSupplierKey, normalized_supplier_bill_reference: normalizedBillReference,
      payable_reference: billReference, created_at: targetUnique?.exists ? text(targetUnique.get("created_at"), now) : now, updated_at: now,
    });
    if (oldUniqueRef && oldUnique?.exists && text(oldUnique.get("payable_reference")) === billReference) transaction.delete(oldUniqueRef);
    if (costRef && cost?.exists) transaction.update(costRef, { partner_id: partnerId, vendor: partnerName, updated_at: now });

    if (audit.exists) {
      transaction.update(auditRef, {
        status: "review_required", resolution_note: null, approved_at: null, approved_by_name: null, approved_by_email: null,
        invalidated_at: now, invalidated_by_name: actor.name, invalidated_by_email: actor.email,
        invalidation_reason: "supplier_identity_changed", updated_at: now,
      });
    }

    const detail = `${billReference} relinked from ${currentSupplierName || currentSupplierId || "unidentified supplier"} to ${partnerName}. Freight Audit approval, when present, was invalidated.`;
    transaction.set(partnerRef.collection("activity").doc(`reconcile-${billReference}`), {
      type: "supplier_reconciliation", title: "Legacy supplier bill reconciled", detail,
      actor_name: actor.name, actor_email: actor.email, created_at: now,
    }, { merge: true });
    transaction.set(billRef.collection("activity").doc(`reconcile-${now.replace(/[^0-9]/g, "")}`), {
      type: "supplier_reconciliation", title: "Supplier identity reconciled", detail, partner_id: partnerId, partner_name: partnerName,
      actor_name: actor.name, actor_email: actor.email, created_at: now,
    });
    return { kind: "reconciled" as const, partnerId, partnerName };
  });
}
