export const kcplStaffRoles = ["management", "accounts", "commercial", "operations"] as const;
export type KcplStaffRole = (typeof kcplStaffRoles)[number];

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

function emailSet(name: string) {
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function explicitRoleConfigPresent() {
  return [
    "KCPL_MANAGEMENT_EMAILS",
    "KCPL_ACCOUNTS_EMAILS",
    "KCPL_COMMERCIAL_EMAILS",
    "KCPL_OPERATIONS_EMAILS",
  ].some((name) => Boolean((process.env[name] ?? "").trim()));
}

export function staffRoleForEmail(email: string): KcplStaffRole {
  const normalized = email.trim().toLowerCase();

  // Backwards compatibility: before explicit role lists are configured, all
  // existing KCPL admins keep the same full access they already had.
  if (!explicitRoleConfigPresent()) return "management";

  if (emailSet("KCPL_MANAGEMENT_EMAILS").has(normalized)) return "management";
  if (emailSet("KCPL_ACCOUNTS_EMAILS").has(normalized)) return "accounts";
  if (emailSet("KCPL_COMMERCIAL_EMAILS").has(normalized)) return "commercial";
  if (emailSet("KCPL_OPERATIONS_EMAILS").has(normalized)) return "operations";

  return "operations";
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

export function staffCapabilitiesForEmail(email: string): StaffCapabilities {
  return staffCapabilitiesForRole(staffRoleForEmail(email));
}

export const kcplStaffRoleLabels: Record<KcplStaffRole, string> = {
  management: "Management",
  accounts: "Accounts",
  commercial: "Commercial",
  operations: "Operations",
};
