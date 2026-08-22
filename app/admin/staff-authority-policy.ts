import { kcplBranches, type KcplBranch } from "./crm/crm-data.ts";
import { kcplStaffRoles, type KcplStaffRole } from "./staff-permissions.ts";

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
  | { kind: "denied"; reason: "inactive" | "invalid_profile" | "not_bootstrap" | "directory_not_empty" | "directory_unavailable" };

export function validStaffRole(value: unknown): KcplStaffRole | null {
  return kcplStaffRoles.includes(value as KcplStaffRole) ? value as KcplStaffRole : null;
}

function validBranches(value: unknown): KcplBranch[] | null {
  if (!Array.isArray(value)) return null;
  if (value.some((item) => !kcplBranches.includes(item as KcplBranch))) return null;
  return [...new Set(value as KcplBranch[])];
}

export function resolveStaffAuthority(input: {
  profile: PersistedStaffAuthorityInput;
  configuredBootstrap: boolean;
  directoryState: StaffDirectoryState;
}): StaffAuthorityDecision {
  if (input.profile.exists) {
    if (input.profile.active !== true) return { kind: "denied", reason: input.profile.active === false ? "inactive" : "invalid_profile" };
    const role = validStaffRole(input.profile.role);
    const scope = input.profile.branchScope;
    const branches = validBranches(input.profile.branches);
    if (!role || (scope !== "all" && scope !== "selected") || !branches || (scope === "selected" && branches.length === 0)) {
      return { kind: "denied", reason: "invalid_profile" };
    }
    return { kind: "profile", role, branchScope: scope, branches: scope === "all" || role === "management" ? [...kcplBranches] : branches };
  }

  if (!input.configuredBootstrap) return { kind: "denied", reason: "not_bootstrap" };
  if (input.directoryState === "unavailable") return { kind: "denied", reason: "directory_unavailable" };
  if (input.directoryState !== "empty") return { kind: "denied", reason: "directory_not_empty" };
  return { kind: "bootstrap", role: "management", branchScope: "all", branches: [...kcplBranches] };
}
