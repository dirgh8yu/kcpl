import { kcplBranches, type KcplBranch } from "./crm/crm-data";

export type BranchAccessScope = {
  can_access_all_branches: boolean;
  branches: readonly KcplBranch[];
};

export type QuoteLinkedAccessInput = {
  shipment_reference: string | null;
  customer_id: string | null;
  shipment_exists?: boolean;
  shipment_primary_branch?: unknown;
  shipment_handling_branches?: unknown;
  customer_exists?: boolean;
  customer_branch?: unknown;
};

export function strictBranchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

export function strictBranchArray(value: unknown): KcplBranch[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch)))];
}

export function branchAccessSet(primary: unknown, handling: unknown): KcplBranch[] {
  const parsedPrimary = strictBranchValue(primary);
  return [...new Set([...(parsedPrimary ? [parsedPrimary] : []), ...strictBranchArray(handling)])];
}

export function canAccessBranchValue(scope: BranchAccessScope, branch: unknown) {
  if (scope.can_access_all_branches) return true;
  const parsed = strictBranchValue(branch);
  return Boolean(parsed && scope.branches.includes(parsed));
}

export function canAccessBranchSet(scope: BranchAccessScope, primary: unknown, handling: unknown) {
  if (scope.can_access_all_branches) return true;
  return branchAccessSet(primary, handling).some((branch) => scope.branches.includes(branch));
}

export function canAccessQuoteLinkedRecords(scope: BranchAccessScope, input: QuoteLinkedAccessInput) {
  if (scope.can_access_all_branches) return true;
  if (input.shipment_reference) {
    if (!input.shipment_exists) return false;
    return canAccessBranchSet(scope, input.shipment_primary_branch, input.shipment_handling_branches);
  }
  if (input.customer_id) {
    if (!input.customer_exists) return false;
    return canAccessBranchValue(scope, input.customer_branch);
  }
  return true;
}
