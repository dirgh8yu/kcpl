export type CommercialMutationLockDecision = "allowed" | "released_consolidation_locked";

export function commercialMutationLockDecision(data: Record<string, unknown>): CommercialMutationLockDecision {
  if (data.is_consolidation_master === true) return "allowed";
  if (data.procurement_locked_by_load === true) return "released_consolidation_locked";
  return "allowed";
}
