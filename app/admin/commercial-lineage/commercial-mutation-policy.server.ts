import { firebaseAdminDb } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { commercialMutationLockDecision } from "./commercial-mutation-policy";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function assertOrderCommercialMutationAllowed(orderId: string, staff: KcplStaffContext) {
  const id = orderId.trim().toUpperCase();
  if (!id) return { kind: "missing_order" as const };
  const snapshot = await firebaseAdminDb().collection("transport_orders").doc(id).get();
  if (!snapshot.exists) return { kind: "missing_order" as const };
  const data = snapshot.data() as Record<string, unknown>;
  const branch = text(data.branch);
  if (!kcplBranches.includes(branch as KcplBranch)) return { kind: "forbidden" as const };
  if (!staffCanAccessBranch(staff, branch as KcplBranch)) return { kind: "forbidden" as const };
  const decision = commercialMutationLockDecision(data);
  if (decision !== "allowed") {
    return {
      kind: "locked" as const,
      reason: decision,
      consolidationLoadId: text(data.consolidation_load_id) || null,
      consolidationMasterOrderId: text(data.consolidation_master_order_id) || null,
    };
  }
  return { kind: "allowed" as const };
}
