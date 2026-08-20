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

  // The admin allowlist still controls who can sign in. Once explicit roles are
  // enabled, an allowlisted staff member without a role gets least-privilege
  // operational access rather than accidental access to rates or credit data.
  return "operations";
}

export function staffCapabilitiesForEmail(email: string): StaffCapabilities {
  const role = staffRoleForEmail(email);
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
  };
}

export const kcplStaffRoleLabels: Record<KcplStaffRole, string> = {
  management: "Management",
  accounts: "Accounts",
  commercial: "Commercial",
  operations: "Operations",
};
