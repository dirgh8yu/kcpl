import assert from "node:assert/strict";
import test from "node:test";

import {
  configuredStaffRoleForEmail,
  staffCapabilitiesForRole,
  staffRoleForEmail,
} from "../app/admin/staff-permissions.ts";
import { adminSecurityConfigIssues } from "../app/admin/admin-security-config.ts";

const cleanEnv = () => ({ NODE_ENV: "production" });

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
