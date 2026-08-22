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

  const primary = strictBranchValue(shipment.get("primary_branch"));
  if (!primary) return { kind: "forbidden" as const };
  const handling = strictBranchArray(shipment.get("handling_branches"));
  const accessBranches = branchAccessSet(primary, handling);
  const allowed = canAccessBranchSet(staff, primary, handling);

  if (!allowed) return { kind: "forbidden" as const };
  return {
    kind: "allowed" as const,
    primaryBranch: primary as KcplBranch,
    handlingBranches: handling,
    accessBranches,
    branchDataComplete: true,
  };
}
