import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { type KcplStaffContext } from "./staff-directory.server";
import { resolveShipmentBranchAccess } from "./shipment-access-policy";

export { resolveShipmentBranchAccess } from "./shipment-access-policy";

export async function checkShipmentBranchAccess(reference: string, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const normalized = reference.trim().toUpperCase();
  const shipment = await db.collection("shipments").doc(normalized).get();
  if (!shipment.exists) return { kind: "missing" as const };

  const access = resolveShipmentBranchAccess(staff, shipment.get("primary_branch"), shipment.get("handling_branches"));
  if (access.kind !== "allowed") return { kind: "forbidden" as const };
  return {
    kind: "allowed" as const,
    primaryBranch: access.primaryBranch,
    handlingBranches: access.handlingBranches,
    accessBranches: access.accessBranches,
    branchDataComplete: true,
  };
}
