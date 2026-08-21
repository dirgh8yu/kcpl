import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { canAccessBranchValue, strictBranchValue } from "../../branch-access-policy";
import { crmCurrencies, type CrmCurrency } from "../../crm/crm-data";
import { payableStatuses, type PayableStatus } from "../../payables/payables-data";
import { normalizeSupplierBillReference, normalizeSupplierName, supplierIdentityKey } from "../../payables/payables-policy";
import type { KcplStaffContext } from "../../staff-directory.server";
import { canAccessPartnerOwner, isPartnerReference, partnerOwnerBranchValue } from "../partner-policy";
import { isDuplicateSupplierIdentityCandidate } from "./supplier-reconciliation-policy";
import type {
  SupplierLegacyIdentityKind,
  SupplierReconciliationBill,
  SupplierReconciliationPartner,
  SupplierReconciliationSnapshot,
} from "./supplier-reconciliation";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function payableStatus(value: unknown): PayableStatus {
  return payableStatuses.includes(value as PayableStatus) ? value as PayableStatus : "draft";
}

function currencyValue(value: unknown): CrmCurrency | null {
  const currency = text(value).trim().toUpperCase();
  return crmCurrencies.includes(currency as CrmCurrency) ? currency as CrmCurrency : null;
}

function identityKind(supplierId: string | null): SupplierLegacyIdentityKind {
  if (!supplierId) return "name_only";
  if (/^KCPL-C-/i.test(supplierId)) return "customer_reference";
  if (isPartnerReference(supplierId)) return "missing_partner";
  return "invalid_reference";
}

function activityId() {
  return `reconcile-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function partnerOption(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): SupplierReconciliationPartner {
  return {
    id: doc.id,
    name: text(doc.get("display_name"), doc.id),
    owner_branch: partnerOwnerBranchValue(doc.get("owner_branch")),
    status: text(doc.get("status"), "active"),
  };
}

export async function listSupplierReconciliation(context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };

  const db = firebaseAdminDb();
  const [partnersSnapshot, payablesSnapshot] = await Promise.all([
    db.collection("partners").orderBy("display_name", "asc").limit(2500).get(),
    db.collection("payables").orderBy("updated_at", "desc").limit(5000).get(),
  ]);

  const allPartnerIds = new Set(partnersSnapshot.docs.map((doc) => doc.id));
  const accessiblePartners = partnersSnapshot.docs.filter((doc) => canAccessPartnerOwner(context, doc.get("owner_branch")));
  const partners = accessiblePartners.map(partnerOption);
  const partnersByName = new Map<string, SupplierReconciliationPartner[]>();
  for (const partner of partners) {
    const key = normalizeSupplierName(partner.name);
    const items = partnersByName.get(key) ?? [];
    items.push(partner);
    partnersByName.set(key, items);
  }

  const bills: SupplierReconciliationBill[] = [];
  for (const doc of payablesSnapshot.docs) {
    if (payableStatus(doc.get("status")) === "void") continue;
    const branch = strictBranchValue(doc.get("branch"));
    if (!branch || !canAccessBranchValue(context, branch)) continue;
    const currency = currencyValue(doc.get("currency"));
    if (!currency) continue;

    const supplierId = nullable(doc.get("supplier_id"));
    if (supplierId && isPartnerReference(supplierId) && allPartnerIds.has(supplierId)) continue;

    const supplierName = text(doc.get("supplier_name"), "Unidentified supplier");
    const matches = partnersByName.get(normalizeSupplierName(supplierName)) ?? [];
    const suggestion = matches.length === 1 ? {
      partner_id: matches[0].id,
      partner_name: matches[0].name,
      owner_branch: matches[0].owner_branch,
      reason: "exact_name" as const,
    } : null;

    bills.push({
      reference: doc.id,
      supplier_bill_reference: nullable(doc.get("supplier_bill_reference")),
      supplier_name: supplierName,
      supplier_id: supplierId,
      identity_kind: identityKind(supplierId),
      branch,
      status: payableStatus(doc.get("status")),
      currency,
      total: Math.max(0, numberValue(doc.get("total"))),
      balance_due: Math.max(0, numberValue(doc.get("balance_due"))),
      bill_date: text(doc.get("bill_date")),
      due_date: text(doc.get("due_date")),
      shipment_reference: nullable(doc.get("shipment_reference")),
      updated_at: text(doc.get("updated_at"), text(doc.get("created_at"))),
      suggestion,
    });
  }

  const snapshot: SupplierReconciliationSnapshot = {
    generated_at: new Date().toISOString(),
    bills,
    partners,
    unresolved_count: bills.length,
    exact_match_count: bills.filter((bill) => bill.suggestion).length,
    customer_reference_count: bills.filter((bill) => bill.identity_kind === "customer_reference").length,
    no_suggestion_count: bills.filter((bill) => !bill.suggestion).length,
  };
  return { kind: "ready" as const, snapshot };
}

export async function reconcileSupplierBill(input: {
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

  return db.runTransaction(async (transaction) => {
    const bill = await transaction.get(billRef);
    const partner = await transaction.get(partnerRef);
    if (!bill.exists) return { kind: "missing_bill" as const };
    if (!partner.exists) return { kind: "missing_partner" as const };

    const billBranch = strictBranchValue(bill.get("branch"));
    if (!billBranch || !canAccessBranchValue(context, billBranch)) return { kind: "forbidden" as const };
    if (!canAccessPartnerOwner(context, partner.get("owner_branch"))) return { kind: "forbidden" as const };
    if (payableStatus(bill.get("status")) === "void") return { kind: "void_bill" as const };

    const currentSupplierId = nullable(bill.get("supplier_id"));
    const currentSupplierName = text(bill.get("supplier_name"));
    if ((currentSupplierId ?? null) !== (input.expectedSupplierId ?? null) || currentSupplierName !== input.expectedSupplierName) {
      return { kind: "stale" as const };
    }
    if (currentSupplierId === partnerId) return { kind: "already_linked" as const };

    if (currentSupplierId && isPartnerReference(currentSupplierId)) {
      const currentPartner = await transaction.get(db.collection("partners").doc(currentSupplierId));
      if (currentPartner.exists) return { kind: "already_linked_other" as const };
    }

    const partnerName = text(partner.get("display_name"), partnerId);
    const supplierBillReference = nullable(bill.get("supplier_bill_reference"));
    const normalizedBillReference = supplierBillReference ? normalizeSupplierBillReference(supplierBillReference) : "";
    if (normalizedBillReference) {
      const normalizedQuery = db.collection("payables").where("normalized_supplier_bill_reference", "==", normalizedBillReference).limit(50);
      const rawQuery = db.collection("payables").where("supplier_bill_reference", "==", supplierBillReference).limit(50);
      const [normalizedMatches, rawMatches] = await Promise.all([
        transaction.get(normalizedQuery),
        transaction.get(rawQuery),
      ]);
      const candidates = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const doc of [...normalizedMatches.docs, ...rawMatches.docs]) candidates.set(doc.id, doc);
      for (const candidate of candidates.values()) {
        if (candidate.id === billReference || payableStatus(candidate.get("status")) === "void") continue;
        if (isDuplicateSupplierIdentityCandidate({
          candidateSupplierId: nullable(candidate.get("supplier_id")),
          candidateSupplierName: text(candidate.get("supplier_name")),
          targetPartnerId: partnerId,
          targetPartnerName: partnerName,
          originalSupplierName: currentSupplierName,
        })) {
          return { kind: "duplicate_supplier_bill" as const };
        }
      }
    }

    const now = new Date().toISOString();
    const shipmentReference = nullable(bill.get("shipment_reference"));
    const costRef = shipmentReference
      ? db.collection("shipments").doc(shipmentReference).collection("job_costs").doc(`payable_${billReference}`)
      : null;
    const cost = costRef ? await transaction.get(costRef) : null;

    transaction.update(billRef, {
      supplier_id: partnerId,
      supplier_name: partnerName,
      supplier_key: supplierIdentityKey(partnerId, partnerName),
      normalized_supplier_bill_reference: normalizedBillReference || null,
      supplier_reconciled_at: now,
      supplier_reconciled_by_name: actor.name,
      supplier_reconciled_by_email: actor.email,
      supplier_reconciled_from_id: currentSupplierId,
      supplier_reconciled_from_name: currentSupplierName || null,
      updated_at: now,
    });
    if (costRef && cost?.exists) {
      transaction.update(costRef, { partner_id: partnerId, vendor: partnerName, updated_at: now });
    }

    const detail = `${billReference} relinked from ${currentSupplierName || currentSupplierId || "unidentified supplier"} to ${partnerName}.`;
    transaction.create(partnerRef.collection("activity").doc(activityId()), {
      type: "supplier_reconciliation",
      title: "Legacy supplier bill reconciled",
      detail,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
    });
    transaction.create(billRef.collection("activity").doc(activityId()), {
      type: "supplier_reconciliation",
      title: "Supplier identity reconciled",
      detail,
      partner_id: partnerId,
      partner_name: partnerName,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
    });

    return { kind: "reconciled" as const, partnerId, partnerName };
  });
}
