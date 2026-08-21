import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { canAccessBranchValue } from "./branch-access-policy";
import { checkShipmentBranchAccess } from "./shipment-access.server";
import type { KcplStaffContext } from "./staff-directory.server";

function nullable(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function checkQuoteBranchAccess(reference: string, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const normalized = reference.trim().toUpperCase();
  const quote = await db.collection("quotes").doc(normalized).get();
  if (!quote.exists) return { kind: "missing" as const };

  const shipmentReference = nullable(quote.get("shipment_reference"));
  if (shipmentReference) {
    const shipmentAccess = await checkShipmentBranchAccess(shipmentReference, staff);
    if (shipmentAccess.kind === "unavailable") return { kind: "unavailable" as const };
    if (shipmentAccess.kind === "missing") {
      return staff.can_access_all_branches
        ? { kind: "allowed" as const, scope: "shipment_missing" as const }
        : { kind: "forbidden" as const };
    }
    if (shipmentAccess.kind === "forbidden") return { kind: "forbidden" as const };
    return { kind: "allowed" as const, scope: "shipment" as const };
  }

  const customerId = nullable(quote.get("customer_id"));
  if (customerId) {
    const customer = await db.collection("customers").doc(customerId).get();
    if (!customer.exists || customer.get("archived") === true) {
      return staff.can_access_all_branches
        ? { kind: "allowed" as const, scope: "customer_missing" as const }
        : { kind: "forbidden" as const };
    }
    if (!canAccessBranchValue(staff, customer.get("primary_branch"))) return { kind: "forbidden" as const };
    return { kind: "allowed" as const, scope: "customer" as const };
  }

  return { kind: "allowed" as const, scope: "unlinked" as const };
}
