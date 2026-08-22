import {
  branchAccessSet,
  canAccessBranchSet,
  strictBranchArray,
  strictBranchValue,
  type BranchAccessScope,
} from "./branch-access-policy.ts";

export function resolveShipmentBranchAccess(scope: BranchAccessScope, primaryBranch: unknown, handlingBranches: unknown) {
  const primary = strictBranchValue(primaryBranch);
  if (!primary) return { kind: "forbidden" as const, reason: "invalid_primary_branch" as const };
  const handling = strictBranchArray(handlingBranches);
  const accessBranches = branchAccessSet(primary, handling);
  if (!canAccessBranchSet(scope, primary, handling)) return { kind: "forbidden" as const, reason: "outside_scope" as const };
  return {
    kind: "allowed" as const,
    primaryBranch: primary,
    handlingBranches: handling,
    accessBranches,
  };
}
