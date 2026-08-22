import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { branchAccessSet, canAccessBranchSet, strictBranchArray, strictBranchValue, type BranchAccessScope } from "./branch-access-policy";
import { type KcplBranch } from "./crm/crm-data";
import { type KcplStaffContext } from "./staff-directory.server";

export function resolveShipmentBranchAccess(scope: BranchAccessScope, primaryBranch: unknown, handlingBranches: unknown) {
  const primary = strictBranchValue(primaryBranch);
  if (!primary) return { kind: "forbidden" as const, reason: "invalid_primary_branch" as const };
  const handling = strictBranchArray(handlingBranches);
  const accessBranches = branchAccessSet(primary, handling);
  if (!canAccessBranchSet(scope, primary, handling)) return { kind: "forbidden" as const, reason: "outside_scope" as const };
  return {
    kind: "allowed" as const,
    primaryBranch: primary as KcplBranch,
    handlingBranches: handling,
    accessBranches,
  };
}

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
