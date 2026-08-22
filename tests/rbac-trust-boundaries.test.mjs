import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  canAccessBranchValue,
  canMutateBranchValue,
  compatibleRecordBranches,
  strictBranchValue,
} from "../app/admin/branch-access-policy.ts";
import { resolveCanonicalRecordCandidates } from "../app/admin/canonical-record-match.ts";
import { partnerOwnerCompatibleWithBranch } from "../app/admin/partners/partner-policy.ts";
import { resolveStaffAuthority } from "../app/admin/staff-authority-policy.ts";
import { staffCapabilitiesForRole } from "../app/admin/staff-permissions.ts";
import {
  authorizeGptAction,
  gptActionJson,
  gptTrustPolicy,
  sanitizeGptResponse,
} from "../app/gpt-action-auth.server.ts";
import { ediIntegrationAuthorized } from "../app/api/integrations/edi/route.ts";
import { trackingIntegrationAuthorized } from "../app/api/integrations/tracking/route.ts";
import { pickupIntegrationAuthorized } from "../app/api/integrations/pickups/route.ts";
import { maerskWebhookAuthorized } from "../app/api/integrations/carriers/maersk/route.ts";
import { automationIntegrationAuthorized } from "../app/api/internal/automation/route.ts";

const management = {
  can_access_all_branches: true,
  branches: ["Kathmandu", "Birgunj", "Surkhet", "Nepalgunj", "Raxaul", "Kolkata"],
  permissions: staffCapabilitiesForRole("management"),
};
const accountsKathmandu = {
  can_access_all_branches: false,
  branches: ["Kathmandu"],
  permissions: staffCapabilitiesForRole("accounts"),
};
const operationsKathmandu = {
  can_access_all_branches: false,
  branches: ["Kathmandu"],
  permissions: staffCapabilitiesForRole("operations"),
};

function persisted(role, overrides = {}) {
  return {
    exists: true,
    active: true,
    role,
    branchScope: "selected",
    branches: ["Kathmandu"],
    ...overrides,
  };
}

function bearer(secret) {
  return new Request("https://kcpl.example/internal", { headers: { authorization: `Bearer ${secret}` } });
}

function apiKey(secret) {
  return new Request("https://kcpl.example/api/gpt/health", { headers: { "x-api-key": secret } });
}

function withSecrets(values, fn) {
  const keys = Object.keys(values);
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  }
}

const secrets = {
  gpt: "gpt_0123456789abcdef0123456789abcdef0123",
  edi: "edi_0123456789abcdef0123456789abcdef0123",
  tracking: "trk_0123456789abcdef0123456789abcdef0123",
  pickup: "pik_0123456789abcdef0123456789abcdef0123",
  automation: "aut_0123456789abcdef0123456789abcdef0123",
  maersk: "msk_0123456789abcdef0123456789abcdef0123",
};

const secretEnv = {
  KCPL_GPT_ACTION_SECRET: secrets.gpt,
  KCPL_EDI_SECRET: secrets.edi,
  KCPL_TRACKING_INGEST_SECRET: secrets.tracking,
  KCPL_PICKUP_INTEGRATION_SECRET: secrets.pickup,
  KCPL_AUTOMATION_SECRET: secrets.automation,
  MAERSK_WEBHOOK_SECRET: secrets.maersk,
};

test("persisted staff profile is authoritative over bootstrap configuration", () => {
  for (const role of ["operations", "commercial", "accounts"]) {
    const decision = resolveStaffAuthority({
      profile: persisted(role),
      configuredBootstrap: true,
      directoryState: "empty",
    });
    assert.equal(decision.kind, "profile");
    assert.equal(decision.role, role);
  }
});

test("inactive and malformed persisted profiles cannot bootstrap or fall back", () => {
  assert.deepEqual(resolveStaffAuthority({
    profile: persisted("operations", { active: false }),
    configuredBootstrap: true,
    directoryState: "empty",
  }), { kind: "denied", reason: "inactive" });

  assert.deepEqual(resolveStaffAuthority({
    profile: persisted("owner"),
    configuredBootstrap: true,
    directoryState: "empty",
  }), { kind: "denied", reason: "invalid_profile" });

  assert.deepEqual(resolveStaffAuthority({
    profile: persisted("operations", { branchScope: "all-ish" }),
    configuredBootstrap: true,
    directoryState: "empty",
  }), { kind: "denied", reason: "invalid_profile" });

  assert.deepEqual(resolveStaffAuthority({
    profile: persisted("operations", { branches: ["Kathmandu", "Unknown"] }),
    configuredBootstrap: true,
    directoryState: "empty",
  }), { kind: "denied", reason: "invalid_profile" });
});

test("bootstrap requires an allowlisted missing profile and positively confirmed empty directory", () => {
  const allowed = resolveStaffAuthority({
    profile: { exists: false },
    configuredBootstrap: true,
    directoryState: "empty",
  });
  assert.equal(allowed.kind, "bootstrap");
  assert.equal(allowed.role, "management");
  assert.equal(allowed.branchScope, "all");

  assert.deepEqual(resolveStaffAuthority({
    profile: { exists: false },
    configuredBootstrap: true,
    directoryState: "nonempty",
  }), { kind: "denied", reason: "directory_not_empty" });

  assert.deepEqual(resolveStaffAuthority({
    profile: { exists: false },
    configuredBootstrap: true,
    directoryState: "unavailable",
  }), { kind: "denied", reason: "directory_unavailable" });

  assert.deepEqual(resolveStaffAuthority({
    profile: { exists: false },
    configuredBootstrap: false,
    directoryState: "empty",
  }), { kind: "denied", reason: "not_configured" });
});

test("Management is organization-wide for valid branches but cannot invent malformed scope", () => {
  assert.equal(canMutateBranchValue(management, "Kathmandu"), true);
  assert.equal(canMutateBranchValue(management, "Kolkata"), true);
  for (const branch of [null, undefined, "", "random", "Kathmandu "]) {
    assert.equal(canMutateBranchValue(management, branch), false);
  }
  assert.equal(canMutateBranchValue(accountsKathmandu, "Kolkata"), false);
  assert.equal(canMutateBranchValue(operationsKathmandu, "Birgunj"), false);
});

test("finance scope decisions use canonical record branch and fail closed", () => {
  assert.equal(accountsKathmandu.permissions.canManageFinance, true);
  assert.equal(canAccessBranchValue(accountsKathmandu, "Kolkata"), false, "Kathmandu Accounts cannot settle a Kolkata supplier bill");
  assert.equal(canAccessBranchValue(accountsKathmandu, "Kolkata"), false, "Kathmandu Accounts cannot collect a Kolkata AR invoice");
  assert.equal(canAccessBranchValue(accountsKathmandu, null), false, "branchless supplier bills fail closed");
  assert.equal(canAccessBranchValue(management, "Kolkata"), true, "Management can handle a valid Kolkata financial record");
  assert.equal(compatibleRecordBranches("Kathmandu", "Kolkata"), false, "bill and shipment mismatch is blocked");
  assert.equal(compatibleRecordBranches("Kathmandu", "Kolkata"), false, "invoice and customer mismatch is blocked");
  assert.equal(compatibleRecordBranches("Kathmandu", undefined), false, "missing related branch is blocked");
});

test("related-record graph compatibility never becomes valid merely because the actor is Management", () => {
  const relations = [
    "Tender↔Order",
    "Shipment↔Order",
    "Shipment↔Customer",
    "Shipment↔Tender",
    "Supplier Bill↔Shipment",
    "Quote↔Customer",
    "Quote↔Shipment",
    "Consolidation↔House Order",
    "POD↔Shipment",
    "Document↔Shipment",
    "EDI↔Tender/Shipment",
  ];
  for (const relation of relations) {
    assert.equal(compatibleRecordBranches("Kathmandu", "Kathmandu"), true, `${relation} same branch`);
    assert.equal(compatibleRecordBranches("Kathmandu", "Kolkata"), false, `${relation} cross branch`);
    assert.equal(compatibleRecordBranches("Kathmandu", null), false, `${relation} missing branch`);
  }
  assert.equal(partnerOwnerCompatibleWithBranch("Kathmandu", "Kathmandu"), true);
  assert.equal(partnerOwnerCompatibleWithBranch("Kolkata", "Kathmandu"), false);
  assert.equal(partnerOwnerCompatibleWithBranch("Global", "Kathmandu"), true);
  assert.equal(partnerOwnerCompatibleWithBranch(undefined, "Kathmandu"), false);
});

test("canonical candidate resolution is set-based for EDI and Maersk evidence", () => {
  assert.deepEqual(resolveCanonicalRecordCandidates([]), { kind: "missing" });
  assert.deepEqual(resolveCanonicalRecordCandidates([
    { id: "KCPL-S-1", branch: "Kathmandu" },
    { id: "KCPL-S-1", branch: "Kathmandu" },
  ]), { kind: "ready", id: "KCPL-S-1", branch: "Kathmandu" });
  assert.deepEqual(resolveCanonicalRecordCandidates([
    { id: "KCPL-S-1", branch: "Kathmandu" },
    { id: "KCPL-S-2", branch: "Kolkata" },
  ]), { kind: "ambiguous", ids: ["KCPL-S-1", "KCPL-S-2"] });
  assert.deepEqual(resolveCanonicalRecordCandidates([
    { id: "KCPL-S-1", branch: "invalid" },
  ]), { kind: "invalid_branch", id: "KCPL-S-1" });
});

test("machine secrets authenticate only their own trust domain", () => withSecrets(secretEnv, () => {
  assert.equal(authorizeGptAction(apiKey(secrets.gpt)).ok, true);
  assert.equal(ediIntegrationAuthorized(bearer(secrets.edi)).ok, true);
  assert.equal(trackingIntegrationAuthorized(bearer(secrets.tracking)).ok, true);
  assert.equal(pickupIntegrationAuthorized(bearer(secrets.pickup)).ok, true);
  assert.equal(automationIntegrationAuthorized(bearer(secrets.automation)).ok, true);
  assert.equal(maerskWebhookAuthorized(bearer(secrets.maersk)).ok, true);

  const unrelated = [secrets.gpt, secrets.edi, secrets.tracking, secrets.pickup, secrets.automation, secrets.maersk];
  for (const value of unrelated.filter((value) => value !== secrets.gpt)) assert.equal(authorizeGptAction(apiKey(value)).ok, false);
  for (const value of unrelated.filter((value) => value !== secrets.edi)) assert.equal(ediIntegrationAuthorized(bearer(value)).ok, false);
  for (const value of unrelated.filter((value) => value !== secrets.tracking)) assert.equal(trackingIntegrationAuthorized(bearer(value)).ok, false);
  for (const value of unrelated.filter((value) => value !== secrets.pickup)) assert.equal(pickupIntegrationAuthorized(bearer(value)).ok, false);
  for (const value of unrelated.filter((value) => value !== secrets.automation)) assert.equal(automationIntegrationAuthorized(bearer(value)).ok, false);
  for (const value of unrelated.filter((value) => value !== secrets.maersk)) assert.equal(maerskWebhookAuthorized(bearer(value)).ok, false);
}));

test("tracking and pickup integrations fail safely when their dedicated secret is absent", () => {
  withSecrets({ KCPL_TRACKING_INGEST_SECRET: undefined }, () => {
    const result = trackingIntegrationAuthorized(bearer(secrets.tracking));
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
  });
  withSecrets({ KCPL_PICKUP_INTEGRATION_SECRET: undefined }, () => {
    const result = pickupIntegrationAuthorized(bearer(secrets.pickup));
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
  });
});

test("GPT principal is explicitly organization-wide Management-level read-only", () => {
  assert.equal(gptTrustPolicy.scope, "organization-wide");
  assert.equal(gptTrustPolicy.roleEquivalent, "management-read-only");
  assert.equal(gptTrustPolicy.readOnly, true);
});

test("GPT sanitizer recursively removes secrets, raw EDI and private URLs without corrupting normal business data", () => {
  const input = {
    customer: { secretary_name: "Maya", reference: "KCPL-C-1" },
    provider: {
      api_key: "hide",
      token: "ordinary-token-field-is-not-whitelisted",
      access_token: "hide",
      credentials: { password: "hide", username: "provider-user" },
      carrier_name: "Carrier One",
    },
    edi: { raw_x12: "ISA*...", raw_edi_payload: "ST*214...", transaction_reference: "EDI-1" },
    file: {
      storage_path: "private/docs/a.pdf",
      signed_url: "https://storage.googleapis.com/bucket/a?X-Goog-Signature=abc",
      public_label: "POD",
    },
    financial: { currency: "USD", total: 123.45 },
    arrays: [{ api_key: "hide" }, null, "plain"],
  };
  const output = sanitizeGptResponse(input);
  assert.deepEqual(output, {
    customer: { secretary_name: "Maya", reference: "KCPL-C-1" },
    provider: {
      token: "ordinary-token-field-is-not-whitelisted",
      carrier_name: "Carrier One",
    },
    edi: { transaction_reference: "EDI-1" },
    file: { public_label: "POD" },
    financial: { currency: "USD", total: 123.45 },
    arrays: [{}, null, "plain"],
  });
});

test("GPT response wrapper is private no-store and sanitizes data", async () => {
  const response = gptActionJson({ api_key: "hide", ok: true });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-kcpl-machine-scope"), "management-read-only");
  assert.deepEqual(await response.json(), { ok: true });
});

function routeFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(path));
    else if (entry.isFile() && entry.name === "route.ts") files.push(path);
  }
  return files.sort();
}

test("every GPT route uses central auth and sanitized response boundary and exposes no mutation method", () => {
  const root = resolve("app/api/gpt");
  const files = routeFiles(root);
  assert.ok(files.length >= 10, "expected the full GPT route inventory");
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /\brequireGptAction\s*\(/, `${file} must use central GPT auth`);
    assert.match(source, /\bgptActionJson\s*\(/, `${file} must use central sanitizing response wrapper`);
    assert.doesNotMatch(source, /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/, `${file} must remain operationally read-only`);
    assert.doesNotMatch(source, /\.(?:create|update|delete|set)\s*\(/, `${file} must not write Firestore/Storage/business state directly`);
  }
});

test("EDI and Maersk matching source keeps booking/carrier evidence separate and never first-match-wins", () => {
  const gateway = readFileSync(resolve("app/admin/edi/edi-gateway.server.ts"), "utf8");
  const preflight = readFileSync(resolve("app/admin/edi/edi-trust-boundary.server.ts"), "utf8");
  const maersk = readFileSync(resolve("app/admin/carrier-integrations/maersk-webhook.server.ts"), "utf8");
  assert.match(gateway, /where\("booking_reference",\s*"==",\s*parsed\.bookingReference\)/);
  assert.match(gateway, /where\("carrier_reference",\s*"==",\s*parsed\.carrierReference\)/);
  assert.match(preflight, /resolveCanonicalRecordCandidates/);
  assert.match(preflight, /\["booking_reference",\s*parsed\.bookingReference\]/);
  assert.match(maersk, /resolveCanonicalRecordCandidates/);
  assert.match(maersk, /\["booking_reference",\s*event\.carrierBookingReference\]/);
});

test("pickup provider cannot fabricate branch from handling order or request metadata", () => {
  const source = readFileSync(resolve("app/api/integrations/pickups/route.ts"), "utf8");
  assert.match(source, /branchValue\(shipment\.primary_branch\)/);
  assert.doesNotMatch(source, /handling_branches\s*\[\s*0\s*\]/);
  assert.doesNotMatch(source, /branchValue\(body\.branch\)/);
  assert.equal(strictBranchValue("Kathmandu"), "Kathmandu");
  assert.equal(strictBranchValue(undefined), null);
  assert.equal(strictBranchValue("invalid"), null);
});

test("finance mutations keep canonical branch checks before settlement writes", () => {
  const ap = readFileSync(resolve("app/admin/financial-settlement/payables-settlement.server.ts"), "utf8");
  const ar = readFileSync(resolve("app/admin/financial-settlement/receivables-settlement.server.ts"), "utf8");
  const linking = readFileSync(resolve("app/admin/finance/finance-linking.server.ts"), "utf8");
  assert.ok(ap.indexOf("if (!canAccess(context, bill.branch))") < ap.indexOf("transaction.create(paymentRef"));
  assert.ok(ar.indexOf("canAccessBranchValue(context, invoice.branch)") < ar.indexOf("transaction.create(paymentRef"));
  assert.doesNotMatch(linking, /:\s*"Kathmandu"/);
});
