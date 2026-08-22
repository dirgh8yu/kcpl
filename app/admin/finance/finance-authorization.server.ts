import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canMutateBranchValue, compatibleRecordBranches, strictBranchValue } from "../branch-access-policy";
import type { KcplStaffContext } from "../staff-directory.server";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Authorizes finance customer-link mutations from canonical Firestore records.
 * Request-supplied branch values are intentionally ignored. Shipment, current
 * customer, target customer and quote relationships must resolve to one
 * compatible KCPL branch before any downstream helper is allowed to mutate.
 */
export async function authorizeFinanceCustomerLink(
  shipmentReference: string,
  customerId: string | null,
  context: KcplStaffContext,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const shipmentId = shipmentReference.trim().toUpperCase();
  if (!shipmentId) return { kind: "shipment_missing" as const };
  const shipment = await db.collection("shipments").doc(shipmentId).get();
  if (!shipment.exists) return { kind: "shipment_missing" as const };

  const branch = strictBranchValue(shipment.get("primary_branch"));
  if (!branch) return { kind: "invalid_branch" as const };
  if (!canMutateBranchValue(context, branch)) return { kind: "forbidden" as const };

  const currentCustomerId = text(shipment.get("customer_id")).toUpperCase();
  if (currentCustomerId) {
    const currentCustomer = await db.collection("customers").doc(currentCustomerId).get();
    if (!currentCustomer.exists) return { kind: "customer_missing" as const };
    if (!compatibleRecordBranches(branch, currentCustomer.get("primary_branch"))) {
      return { kind: "relationship_mismatch" as const };
    }
  }

  const quoteReference = text(shipment.get("quote_reference")).toUpperCase();
  if (quoteReference) {
    const quote = await db.collection("quotes").doc(quoteReference).get();
    if (!quote.exists) return { kind: "quote_missing" as const };
    const quoteShipment = text(quote.get("shipment_reference")).toUpperCase();
    if (quoteShipment && quoteShipment !== shipmentId) return { kind: "relationship_mismatch" as const };
    const quoteCustomerId = text(quote.get("customer_id")).toUpperCase();
    if (quoteCustomerId) {
      const quoteCustomer = await db.collection("customers").doc(quoteCustomerId).get();
      if (!quoteCustomer.exists) return { kind: "customer_missing" as const };
      if (!compatibleRecordBranches(branch, quoteCustomer.get("primary_branch"))) {
        return { kind: "relationship_mismatch" as const };
      }
    }
  }

  const targetCustomerId = customerId?.trim().toUpperCase() ?? "";
  if (targetCustomerId) {
    const customer = await db.collection("customers").doc(targetCustomerId).get();
    if (!customer.exists) return { kind: "customer_missing" as const };
    if (!compatibleRecordBranches(branch, customer.get("primary_branch"))) {
      return { kind: "relationship_mismatch" as const };
    }
  }

  return {
    kind: "authorized" as const,
    branch,
    shipmentId,
    quoteReference: quoteReference || null,
    currentCustomerId: currentCustomerId || null,
  };
}
