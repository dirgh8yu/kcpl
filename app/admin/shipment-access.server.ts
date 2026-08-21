import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { branchAccessSet, canAccessBranchSet, strictBranchArray, strictBranchValue } from "./branch-access-policy";
import { type KcplBranch } from "./crm/crm-data";
import { type KcplStaffContext } from "./staff-directory.server";

export async function checkShipmentBranchAccess(reference: string, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const normalized = reference.trim().toUpperCase();
  const shipment = await db.collection("shipments").doc(normalized).get();
  if (!shipment.exists) return { kind: "missing" as const };

  let primary = strictBranchValue(shipment.get("primary_branch"));
  const customerId = typeof shipment.get("customer_id") === "string" ? shipment.get("customer_id") as string : "";
  if (!primary && customerId) {
    const customer = await db.collection("customers").doc(customerId).get();
    if (customer.exists) primary = strictBranchValue(customer.get("primary_branch"));
  }

  const handling = strictBranchArray(shipment.get("handling_branches"));
  const accessBranches = branchAccessSet(primary, handling);
  const allowed = canAccessBranchSet(staff, primary, handling);

  if (!allowed) return { kind: "forbidden" as const };
  return {
    kind: "allowed" as const,
    primaryBranch: primary as KcplBranch | null,
    handlingBranches: handling,
    accessBranches,
    branchDataComplete: Boolean(primary || handling.length),
  };
}
