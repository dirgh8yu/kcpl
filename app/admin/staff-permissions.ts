export const kcplStaffRoles = ["management", "accounts", "commercial", "operations"] as const;
export type KcplStaffRole = (typeof kcplStaffRoles)[number];

type RuntimeEnv = Record<string, string | undefined>;

export type StaffCapabilities = {
  role: KcplStaffRole;
  canViewCommercial: boolean;
  canEditCommercial: boolean;
  canManageRateCards: boolean;
  canManageCredit: boolean;
  canManageCustomerDocuments: boolean;
  canEditCustomer: boolean;
  canArchiveCustomer: boolean;
  canManageStaff: boolean;
  canManageJobCosts: boolean;
  canManageJobFile: boolean;
  canManageFinance: boolean;
};

export const staffRoleEnvironmentVariables: ReadonlyArray<readonly [KcplStaffRole, string]> = [
  ["management", "KCPL_MANAGEMENT_EMAILS"],
  ["accounts", "KCPL_ACCOUNTS_EMAILS"],
  ["commercial", "KCPL_COMMERCIAL_EMAILS"],
  ["operations", "KCPL_OPERATIONS_EMAILS"],
] as const;

function emailSet(name: string, env: RuntimeEnv = process.env) {
  return new Set(
    (env[name] ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function configuredStaffRoleForEmail(email: string, env: RuntimeEnv = process.env): KcplStaffRole | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const matches = staffRoleEnvironmentVariables
    .filter(([, variable]) => emailSet(variable, env).has(normalized))
    .map(([role]) => role);

  // Configuration conflicts deliberately fail closed instead of relying on
  // environment-variable ordering to decide a user's privilege level.
  return matches.length === 1 ? matches[0] : null;
}

export function staffRoleForEmail(email: string, env: RuntimeEnv = process.env): KcplStaffRole {
  // Firestore staff_profiles is the normal source of truth. Environment role
  // lists are an explicit fallback for bootstrap/recovery only. An authorised
  // user without either receives the least-privileged role, never Management.
  return configuredStaffRoleForEmail(email, env) ?? "operations";
}

export function staffCapabilitiesForRole(role: KcplStaffRole): StaffCapabilities {
  const management = role === "management";
  const accounts = role === "accounts";
  const commercial = role === "commercial";
  const operations = role === "operations";

  return {
    role,
    canViewCommercial: management || accounts || commercial,
    canEditCommercial: management || accounts || commercial,
    canManageRateCards: management || commercial,
    canManageCredit: management || accounts,
    canManageCustomerDocuments: management || accounts || operations,
    canEditCustomer: management || accounts || commercial || operations,
    canArchiveCustomer: management,
    canManageStaff: management,
    canManageJobCosts: management || accounts || commercial,
    canManageJobFile: management || accounts || commercial || operations,
    canManageFinance: management || accounts,
  };
}

export function staffCapabilitiesForEmail(email: string, env: RuntimeEnv = process.env): StaffCapabilities {
  return staffCapabilitiesForRole(staffRoleForEmail(email, env));
}

export const kcplStaffRoleLabels: Record<KcplStaffRole, string> = {
  management: "Management",
  accounts: "Accounts",
  commercial: "Commercial",
  operations: "Operations",
};
