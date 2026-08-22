import { kcplBranches, type KcplBranch } from "./crm/crm-data";
import { kcplStaffRoles, type KcplStaffRole } from "./staff-permissions";

export type StaffDirectoryState = "empty" | "nonempty" | "unavailable";

export type PersistedStaffAuthorityInput = {
  exists: boolean;
  active?: unknown;
  role?: unknown;
  branchScope?: unknown;
  branches?: unknown;
};

export type StaffAuthorityDecision =
  | { kind: "profile"; role: KcplStaffRole; branchScope: "all" | "selected"; branches: KcplBranch[] }
  | { kind: "bootstrap"; role: "management"; branchScope: "all"; branches: KcplBranch[] }
  | {
      kind: "denied";
      reason: "inactive" | "invalid_profile" | "not_configured" | "directory_not_empty" | "directory_unavailable";
    };

export function validStaffRole(value: unknown): KcplStaffRole | null {
  return kcplStaffRoles.includes(value as KcplStaffRole) ? value as KcplStaffRole : null;
}

export function validStaffBranchScope(value: unknown): "all" | "selected" | null {
  return value === "all" || value === "selected" ? value : null;
}

function strictPersistedBranches(value: unknown): KcplBranch[] | null {
  if (!Array.isArray(value)) return null;
  const branches: KcplBranch[] = [];
  for (const item of value) {
    if (!kcplBranches.includes(item as KcplBranch)) return null;
    if (!branches.includes(item as KcplBranch)) branches.push(item as KcplBranch);
  }
  return branches;
}

/**
 * One server-authoritative precedence rule for KCPL staff access.
 *
 * A persisted profile always wins over KCPL_ADMIN_EMAILS, including inactive
 * and malformed profiles. Bootstrap is only possible when no profile exists,
 * the email is configured, and Firestore has positively confirmed that the
 * staff directory is empty. A lookup failure is never interpreted as empty.
 */
export function resolveStaffAuthority(input: {
  profile: PersistedStaffAuthorityInput;
  configuredBootstrap: boolean;
  directoryState: StaffDirectoryState;
}): StaffAuthorityDecision {
  if (input.profile.exists) {
    const role = validStaffRole(input.profile.role);
    const branchScope = validStaffBranchScope(input.profile.branchScope);
    const branches = strictPersistedBranches(input.profile.branches);
    if (!role || !branchScope || typeof input.profile.active !== "boolean" || !branches) {
      return { kind: "denied", reason: "invalid_profile" };
    }
    if (branchScope === "selected" && branches.length === 0) {
      return { kind: "denied", reason: "invalid_profile" };
    }
    if (!input.profile.active) return { kind: "denied", reason: "inactive" };
    return { kind: "profile", role, branchScope, branches };
  }

  if (!input.configuredBootstrap) return { kind: "denied", reason: "not_configured" };
  if (input.directoryState === "unavailable") return { kind: "denied", reason: "directory_unavailable" };
  if (input.directoryState !== "empty") return { kind: "denied", reason: "directory_not_empty" };
  return { kind: "bootstrap", role: "management", branchScope: "all", branches: [...kcplBranches] };
}
