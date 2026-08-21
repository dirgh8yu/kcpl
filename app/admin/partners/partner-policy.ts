import { canAccessBranchValue, strictBranchValue, type BranchAccessScope } from "../branch-access-policy.ts";
import type { StaffCapabilities } from "../staff-permissions";
import type { PartnerOwnerBranch } from "./partners-data";

export function partnerOwnerBranchValue(value: unknown): PartnerOwnerBranch | null {
  if (value === "Global") return "Global";
  return strictBranchValue(value);
}

export function canAccessPartnerOwner(scope: BranchAccessScope, ownerBranch: unknown) {
  if (ownerBranch === "Global") return true;
  return canAccessBranchValue(scope, ownerBranch);
}

export function canEditPartnerNetwork(permissions: StaffCapabilities) {
  return permissions.role !== "operations";
}

export function canAssignPartnerOwner(
  scope: BranchAccessScope,
  permissions: StaffCapabilities,
  ownerBranch: unknown,
) {
  if (!canEditPartnerNetwork(permissions)) return false;
  if (ownerBranch === "Global") return permissions.role === "management" || scope.can_access_all_branches;
  return canAccessBranchValue(scope, ownerBranch);
}

export function canViewPartnerFinance(permissions: StaffCapabilities) {
  return permissions.canManageFinance;
}

export function validPartnerCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizePartnerIdentifier(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isPartnerReference(value: unknown) {
  return typeof value === "string" && /^KCPL-P-[A-Z0-9-]+$/i.test(value.trim());
}
