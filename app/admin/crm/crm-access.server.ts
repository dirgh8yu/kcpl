import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "./crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";

export function crmBranchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

export function staffCanUseCrmBranch(context: KcplStaffContext, branch: string | null | undefined) {
  const parsed = crmBranchValue(branch);
  return Boolean(parsed && staffCanAccessBranch(context, parsed));
}

export async function checkCrmCustomerAccess(customerId: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const id = customerId.trim().toUpperCase();
  const snapshot = await firebaseAdminDb().collection("customers").doc(id).get();
  if (!snapshot.exists || snapshot.get("archived") === true) return { kind: "missing" as const };

  const branch = crmBranchValue(snapshot.get("primary_branch"));
  if (!branch || !staffCanAccessBranch(context, branch)) return { kind: "forbidden" as const };

  return { kind: "ready" as const, branch, id, snapshot };
}
