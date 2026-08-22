import assert from "node:assert/strict";
import test from "node:test";

import {
  configuredStaffRoleForEmail,
  staffCapabilitiesForRole,
  staffRoleForEmail,
} from "../app/admin/staff-permissions.ts";
import { adminSecurityConfigIssues } from "../app/admin/admin-security-config.ts";
import { crmAccountStatusChangeError, hasCustomerRelationship, normalizeNepalDateTimeInput, validCalendarDate } from "../app/admin/crm/crm-policy.ts";
import {
  canAccessBranchSet,
  canAccessBranchValue,
  canAccessQuoteLinkedRecords,
  strictBranchArray,
  strictBranchValue,
} from "../app/admin/branch-access-policy.ts";
import {
  canAccessPartnerOwner,
  canAssignPartnerOwner,
  canEditPartnerNetwork,
  canViewPartnerFinance,
  isPartnerReference,
  normalizePartnerIdentifier,
  partnerOwnerBranchValue,
  validPartnerCalendarDate,
} from "../app/admin/partners/partner-policy.ts";
import {
  isDuplicateSupplierIdentityCandidate,
  normalizeReconciliationSupplierName,
} from "../app/admin/partners/reconciliation/supplier-reconciliation-policy.ts";
import {
  normalizeSupplierBillReference,
  payableDateError,
  supplierIdentityKey,
  validPayableCalendarDate,
} from "../app/admin/payables/payables-policy.ts";

// Keep this suite self-contained so it can run before the Next.js production build.
const cleanEnv = () => ({ NODE_ENV: "production" });

const kathmanduScope = { can_access_all_branches: false, branches: ["Kathmandu"] };
const accountsKathmandu = { ...kathmanduScope, permissions: staffCapabilitiesForRole("accounts") };
const operationsKathmandu = { ...kathmanduScope, permissions: staffCapabilitiesForRole("operations") };
const commercialKathmandu = { ...kathmanduScope, permissions: staffCapabilitiesForRole("commercial") };
const managementScope = { can_access_all_branches: true, branches: ["Kathmandu", "Birgunj", "Surkhet", "Nepalgunj", "Raxaul", "Kolkata"], permissions: staffCapabilitiesForRole("management") };

test("unconfigured staff role defaults to Operations, never Management", () => {
  assert.equal(staffRoleForEmail("user@example.com", cleanEnv()), "operations");
});

test("an explicit unique Management fallback is honoured", () => {
  const env = { ...cleanEnv(), KCPL_MANAGEMENT_EMAILS: "owner@example.com" };
  assert.equal(configuredStaffRoleForEmail("owner@example.com", env), "management");
  assert.equal(staffRoleForEmail("owner@example.com", env), "management");
});

test("conflicting role fallback assignments fail closed", () => {
  const env = {
    ...cleanEnv(),
    KCPL_MANAGEMENT_EMAILS: "same@example.com",
    KCPL_ACCOUNTS_EMAILS: "same@example.com",
  };
  assert.equal(configuredStaffRoleForEmail("same@example.com", env), null);
  assert.equal(staffRoleForEmail("same@example.com", env), "operations");
});

test("Operations capability does not inherit commercial, finance or staff-management access", () => {
  const permissions = staffCapabilitiesForRole("operations");
  assert.equal(permissions.canViewCommercial, false);
  assert.equal(permissions.canEditCommercial, false);
  assert.equal(permissions.canManageFinance, false);
  assert.equal(permissions.canManageStaff, false);
  assert.equal(permissions.canArchiveCustomer, false);
});

test("branch parser never aliases malformed data to Kathmandu", () => {
  assert.equal(strictBranchValue("Kathmandu"), "Kathmandu");
  assert.equal(strictBranchValue("kathmandu"), null);
  assert.equal(strictBranchValue(""), null);
  assert.equal(strictBranchValue(undefined), null);
  assert.deepEqual(strictBranchArray(["Kathmandu", "Birgunj", "Kathmandu", "unknown"]), ["Kathmandu", "Birgunj"]);
});

test("restricted staff can access their primary or handling branch only", () => {
  assert.equal(canAccessBranchValue(kathmanduScope, "Kathmandu"), true);
  assert.equal(canAccessBranchValue(kathmanduScope, "Birgunj"), false);
  assert.equal(canAccessBranchValue(kathmanduScope, undefined), false);
  assert.equal(canAccessBranchSet(kathmanduScope, "Birgunj", ["Kathmandu"]), true);
  assert.equal(canAccessBranchSet(kathmanduScope, "Birgunj", ["Surkhet"]), false);
  assert.equal(canAccessBranchSet(kathmanduScope, "invalid", []), false);
});

test("Management is organization-wide only for valid canonical branches", () => {
  assert.equal(canAccessBranchValue(managementScope, "Birgunj"), true);
  assert.equal(canAccessBranchValue(managementScope, "Kolkata"), true);
  assert.equal(canAccessBranchValue(managementScope, undefined), false);
  assert.equal(canAccessBranchValue(managementScope, "Kathmandu "), false);
  assert.equal(canAccessBranchSet(managementScope, undefined, []), false);
});

test("linked enquiries inherit shipment or customer branch scope and fail closed when links are broken", () => {
  assert.equal(canAccessQuoteLinkedRecords(kathmanduScope, {
    shipment_reference: "KCPL-S-1",
    customer_id: "KCPL-C-1",
    shipment_exists: true,
    shipment_primary_branch: "Birgunj",
    shipment_handling_branches: ["Kathmandu"],
    customer_exists: true,
    customer_branch: "Birgunj",
  }), true);
  assert.equal(canAccessQuoteLinkedRecords(kathmanduScope, {
    shipment_reference: "KCPL-S-2",
    customer_id: "KCPL-C-2",
    shipment_exists: true,
    shipment_primary_branch: "Birgunj",
    shipment_handling_branches: [],
    customer_exists: true,
    customer_branch: "Birgunj",
  }), false);
  assert.equal(canAccessQuoteLinkedRecords(kathmanduScope, {
    shipment_reference: "KCPL-S-MISSING",
    customer_id: null,
    shipment_exists: false,
  }), false);
  assert.equal(canAccessQuoteLinkedRecords(kathmanduScope, {
    shipment_reference: null,
    customer_id: "KCPL-C-MISSING",
    customer_exists: false,
  }), false);
  assert.equal(canAccessQuoteLinkedRecords(kathmanduScope, {
    shipment_reference: null,
    customer_id: null,
  }), true);
  assert.equal(canAccessQuoteLinkedRecords(managementScope, {
    shipment_reference: "KCPL-S-MISSING",
    customer_id: null,
    shipment_exists: false,
  }), false);
});

test("role and branch matrix keeps finance privilege separate from location scope", () => {
  assert.equal(operationsKathmandu.permissions.canManageFinance, false);
  assert.equal(canAccessBranchValue(operationsKathmandu, "Kathmandu"), true);
  assert.equal(accountsKathmandu.permissions.canManageFinance, true);
  assert.equal(canAccessBranchValue(accountsKathmandu, "Kathmandu"), true);
  assert.equal(canAccessBranchValue(accountsKathmandu, "Birgunj"), false);
  assert.equal(managementScope.permissions.canManageFinance, true);
  assert.equal(canAccessBranchValue(managementScope, "Birgunj"), true);
});

test("invalid admin email configuration is a blocking configuration error", () => {
  const issues = adminSecurityConfigIssues({
    ...cleanEnv(),
    KCPL_ADMIN_EMAILS: "not-an-email",
  });
  assert.ok(issues.some((issue) => issue.severity === "error" && issue.key === "KCPL_ADMIN_EMAILS"));
});

test("duplicate role assignments are a blocking configuration error", () => {
  const issues = adminSecurityConfigIssues({
    ...cleanEnv(),
    KCPL_ADMIN_EMAILS: "same@example.com",
    KCPL_MANAGEMENT_EMAILS: "same@example.com",
    KCPL_COMMERCIAL_EMAILS: "same@example.com",
  });
  assert.ok(issues.some((issue) => issue.severity === "error" && issue.key === "KCPL_*_EMAILS"));
});

test("production origins must use HTTPS and contain no path", () => {
  const insecure = adminSecurityConfigIssues({
    ...cleanEnv(),
    NEXT_PUBLIC_SITE_URL: "http://example.com",
  });
  assert.ok(insecure.some((issue) => issue.severity === "error" && issue.key === "NEXT_PUBLIC_SITE_URL"));

  const pathOrigin = adminSecurityConfigIssues({
    ...cleanEnv(),
    NEXT_PUBLIC_SITE_URL: "https://example.com/admin",
  });
  assert.ok(pathOrigin.some((issue) => issue.severity === "error" && issue.key === "NEXT_PUBLIC_SITE_URL"));

  const valid = adminSecurityConfigIssues({
    ...cleanEnv(),
    NEXT_PUBLIC_SITE_URL: "https://example.com",
  });
  assert.equal(valid.some((issue) => issue.severity === "error" && issue.key === "NEXT_PUBLIC_SITE_URL"), false);
});

test("short automation secrets warn without disabling admin access", () => {
  const issues = adminSecurityConfigIssues({
    ...cleanEnv(),
    KCPL_AUTOMATION_SECRET: "too-short",
  });
  assert.ok(issues.some((issue) => issue.severity === "warning" && issue.key === "KCPL_AUTOMATION_SECRET"));
  assert.equal(issues.some((issue) => issue.severity === "error" && issue.key === "KCPL_AUTOMATION_SECRET"), false);
});

test("customer records cannot lose their buyer relationship", () => {
  assert.equal(hasCustomerRelationship(["customer"]), true);
  assert.equal(hasCustomerRelationship(["supplier"]), false);
});

test("credit holds require credit-control permission and blacklisting requires Management", () => {
  const operations = staffCapabilitiesForRole("operations");
  const accounts = staffCapabilitiesForRole("accounts");
  const management = staffCapabilitiesForRole("management");
  assert.ok(crmAccountStatusChangeError("active", "on_hold", operations));
  assert.equal(crmAccountStatusChangeError("active", "on_hold", accounts), null);
  assert.ok(crmAccountStatusChangeError("active", "blacklisted", accounts));
  assert.equal(crmAccountStatusChangeError("active", "blacklisted", management), null);
});

test("CRM date helpers reject impossible dates and normalize Nepal-local follow-ups", () => {
  assert.equal(validCalendarDate("2026-02-31"), false);
  assert.equal(validCalendarDate("2026-02-28"), true);
  assert.equal(normalizeNepalDateTimeInput("2026-08-21T10:30"), "2026-08-21T04:45:00.000Z");
  assert.equal(normalizeNepalDateTimeInput("2026-02-31T10:30"), null);
});

test("partner ownership is branch-scoped while Global remains operationally visible", () => {
  assert.equal(partnerOwnerBranchValue("Kathmandu"), "Kathmandu");
  assert.equal(partnerOwnerBranchValue("Global"), "Global");
  assert.equal(partnerOwnerBranchValue("kathmandu"), null);
  assert.equal(canAccessPartnerOwner(kathmanduScope, "Kathmandu"), true);
  assert.equal(canAccessPartnerOwner(kathmanduScope, "Birgunj"), false);
  assert.equal(canAccessPartnerOwner(kathmanduScope, "Global"), true);
  assert.equal(canAccessPartnerOwner(kathmanduScope, undefined), false);
  assert.equal(canAccessPartnerOwner(managementScope, undefined), false);
});

test("partner edit and finance privileges remain separate", () => {
  assert.equal(canEditPartnerNetwork(operationsKathmandu.permissions), false);
  assert.equal(canEditPartnerNetwork(commercialKathmandu.permissions), true);
  assert.equal(canViewPartnerFinance(commercialKathmandu.permissions), false);
  assert.equal(canViewPartnerFinance(accountsKathmandu.permissions), true);
});

test("restricted partner editors cannot assign Global or another branch", () => {
  assert.equal(canAssignPartnerOwner(commercialKathmandu, commercialKathmandu.permissions, "Kathmandu"), true);
  assert.equal(canAssignPartnerOwner(commercialKathmandu, commercialKathmandu.permissions, "Birgunj"), false);
  assert.equal(canAssignPartnerOwner(commercialKathmandu, commercialKathmandu.permissions, "Global"), false);
  assert.equal(canAssignPartnerOwner(managementScope, managementScope.permissions, "Global"), true);
  assert.equal(canAssignPartnerOwner(managementScope, managementScope.permissions, "Birgunj"), true);
});

test("partner identifiers and contract dates fail closed", () => {
  assert.equal(isPartnerReference("KCPL-P-20260822-ABC123"), true);
  assert.equal(isPartnerReference("KCPL-C-20260822-ABC123"), false);
  assert.equal(normalizePartnerIdentifier(" NP- 12 / ab "), "NP12AB");
  assert.equal(validPartnerCalendarDate("2026-02-31"), false);
  assert.equal(validPartnerCalendarDate("2026-02-28"), true);
});

test("payable dates reject impossible dates and due-before-bill", () => {
  assert.equal(validPayableCalendarDate("2026-02-31"), false);
  assert.equal(validPayableCalendarDate("2026-02-28"), true);
  assert.match(payableDateError("2026-02-31", "2026-03-30"), /bill date/i);
  assert.match(payableDateError("2026-03-20", "2026-03-19"), /cannot be before/i);
  assert.equal(payableDateError("2026-03-20", "2026-04-19"), null);
});

test("supplier bill identity prefers Partner references over name fallback", () => {
  assert.equal(supplierIdentityKey("KCPL-P-20260822-ABC123", "Example Carrier"), "KCPL-P-20260822-ABC123");
  assert.equal(supplierIdentityKey("", "  Example   Carrier "), "NAME:example carrier");
  assert.equal(normalizeSupplierBillReference(" inv  001 / a "), "INV001/A");
});

test("supplier reconciliation duplicate matching covers legacy and canonical names", () => {
  const base = {
    targetPartnerId: "KCPL-P-20260822-DHL",
    targetPartnerName: "DHL Express Nepal",
    originalSupplierName: "DHL Nepal Pvt Ltd",
  };
  assert.equal(normalizeReconciliationSupplierName("  DHL   Nepal Pvt Ltd  "), "dhl nepal pvt ltd");
  assert.equal(isDuplicateSupplierIdentityCandidate({ ...base, candidateSupplierId: "KCPL-P-20260822-DHL", candidateSupplierName: "Anything" }), true);
  assert.equal(isDuplicateSupplierIdentityCandidate({ ...base, candidateSupplierId: null, candidateSupplierName: "DHL Express Nepal" }), true);
  assert.equal(isDuplicateSupplierIdentityCandidate({ ...base, candidateSupplierId: "KCPL-C-OLD", candidateSupplierName: "DHL Nepal Pvt Ltd" }), true);
  assert.equal(isDuplicateSupplierIdentityCandidate({ ...base, candidateSupplierId: "KCPL-P-OTHER", candidateSupplierName: "DHL Nepal Pvt Ltd" }), false);
  assert.equal(isDuplicateSupplierIdentityCandidate({ ...base, candidateSupplierId: null, candidateSupplierName: "Unrelated Carrier" }), false);
});
