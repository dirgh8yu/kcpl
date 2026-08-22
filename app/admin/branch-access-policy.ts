const branchValues = ["Kathmandu", "Birgunj", "Surkhet", "Nepalgunj", "Raxaul", "Kolkata"] as const;
export type AccessBranch = (typeof branchValues)[number];

export type BranchAccessScope = {
  can_access_all_branches: boolean;
  branches: readonly AccessBranch[];
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

export function strictBranchValue(value: unknown): AccessBranch | null {
  return branchValues.includes(value as AccessBranch) ? value as AccessBranch : null;
}

export function strictBranchArray(value: unknown): AccessBranch[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is AccessBranch => branchValues.includes(item as AccessBranch)))];
}

export function branchAccessSet(primary: unknown, handling: unknown): AccessBranch[] {
  const parsedPrimary = strictBranchValue(primary);
  return [...new Set([...(parsedPrimary ? [parsedPrimary] : []), ...strictBranchArray(handling)])];
}

/**
 * Read/list compatibility policy. Management and explicitly all-branch staff may
 * review legacy records whose branch metadata is incomplete so those records can
 * be identified and repaired. Mutation code must use canMutateBranchValue instead.
 */
export function canAccessBranchValue(scope: BranchAccessScope, branch: unknown) {
  if (scope.can_access_all_branches) return true;
  const parsed = strictBranchValue(branch);
  return Boolean(parsed && scope.branches.includes(parsed));
}

/**
 * Server-authoritative mutation policy. A canonical record must carry a valid KCPL
 * branch before anyone, including Management, may mutate it. This keeps legacy
 * branchless records reviewable but never accidentally globally writable.
 */
export function canMutateBranchValue(scope: BranchAccessScope, branch: unknown) {
  const parsed = strictBranchValue(branch);
  if (!parsed) return false;
  return scope.can_access_all_branches || scope.branches.includes(parsed);
}

export function compatibleRecordBranches(...branches: unknown[]) {
  if (branches.length === 0) return false;
  const parsed = branches.map(strictBranchValue);
  if (parsed.some((branch) => branch === null)) return false;
  return parsed.every((branch) => branch === parsed[0]);
}

export function canAccessBranchSet(scope: BranchAccessScope, primary: unknown, handling: unknown) {
  if (scope.can_access_all_branches) return true;
  return branchAccessSet(primary, handling).some((branch) => scope.branches.includes(branch));
}

export function canMutateBranchSet(scope: BranchAccessScope, primary: unknown, handling: unknown) {
  const branches = branchAccessSet(primary, handling);
  if (branches.length === 0) return false;
  return scope.can_access_all_branches || branches.some((branch) => scope.branches.includes(branch));
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
