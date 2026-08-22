import { kcplStaffRoles, type KcplStaffRole } from "./staff-permissions";

export type StaffAuthorityProfile = {
  active: boolean;
  role: KcplStaffRole;
};

export type StaffAuthorityDecision =
  | { kind: "profile"; role: KcplStaffRole }
  | { kind: "bootstrap"; role: "management" }
  | { kind: "denied" };

export function validStaffRole(value: unknown): KcplStaffRole | null {
  return kcplStaffRoles.includes(value as KcplStaffRole) ? value as KcplStaffRole : null;
}

/**
 * Persisted staff state always wins over bootstrap configuration. An inactive
 * profile is denied, and an Operations/Commercial/Accounts profile keeps that
 * role even when the same email is present in KCPL_ADMIN_EMAILS.
 */
export function resolveStaffAuthority(
  profile: StaffAuthorityProfile | null,
  bootstrapEligible: boolean,
): StaffAuthorityDecision {
  if (profile) return profile.active ? { kind: "profile", role: profile.role } : { kind: "denied" };
  return bootstrapEligible ? { kind: "bootstrap", role: "management" } : { kind: "denied" };
}
