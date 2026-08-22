import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { compatibleRecordBranches } from "../app/admin/branch-access-policy.ts";
import { resolveCanonicalRecordCandidates } from "../app/admin/canonical-record-match.ts";
import {
  archiveLinkedRecordAllowed,
  archiveRelationshipScope,
  canManagePaperArchive,
} from "../app/admin/migration/archive/archive-scope-policy.ts";
import { partnerOwnerCompatibleWithBranch } from "../app/admin/partners/partner-policy.ts";
import { resolveShipmentBranchAccess } from "../app/admin/shipment-access-policy.ts";
import { resolveStaffAuthority } from "../app/admin/staff-authority-policy.ts";
import { staffCapabilitiesForRole } from "../app/admin/staff-permissions.ts";
import { resolveEdi990TenderTarget, validateEdi990CanonicalChain } from "../app/admin/edi/edi-match-policy.ts";

const management = {
  can_access_all_branches: true,
  branches: ["Kathmandu", "Birgunj", "Surkhet", "Nepalgunj", "Raxaul", "Kolkata"],
};
const kathmandu = { can_access_all_branches: false, branches: ["Kathmandu"] };
const birgunj = { can_access_all_branches: false, branches: ["Birgunj"] };

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

test("final staff precedence remains persisted-profile first and bootstrap fails closed", () => {
  for (const role of ["operations", "commercial", "accounts"]) {
    const decision = resolveStaffAuthority({ profile: persisted(role), configuredBootstrap: true, directoryState: "empty" });
    assert.equal(decision.kind, "profile");
    assert.equal(decision.role, role);
  }
  assert.deepEqual(
    resolveStaffAuthority({ profile: persisted("operations", { active: false }), configuredBootstrap: true, directoryState: "empty" }),
    { kind: "denied", reason: "inactive" },
  );
  assert.deepEqual(
    resolveStaffAuthority({ profile: persisted("owner"), configuredBootstrap: true, directoryState: "empty" }),
    { kind: "denied", reason: "invalid_profile" },
  );
  assert.deepEqual(
    resolveStaffAuthority({ profile: persisted("operations", { branchScope: "selected", branches: ["Unknown"] }), configuredBootstrap: true, directoryState: "empty" }),
    { kind: "denied", reason: "invalid_profile" },
  );
  assert.equal(resolveStaffAuthority({ profile: { exists: false }, configuredBootstrap: true, directoryState: "empty" }).kind, "bootstrap");
  assert.deepEqual(
    resolveStaffAuthority({ profile: { exists: false }, configuredBootstrap: true, directoryState: "nonempty" }),
    { kind: "denied", reason: "directory_not_empty" },
  );
  assert.deepEqual(
    resolveStaffAuthority({ profile: { exists: false }, configuredBootstrap: true, directoryState: "unavailable" }),
    { kind: "denied", reason: "directory_unavailable" },
  );
});

test("canonical shipment scope requires primary branch while retaining valid handling access", () => {
  assert.deepEqual(resolveShipmentBranchAccess(kathmandu, null, ["Kathmandu"]), {
    kind: "forbidden",
    reason: "invalid_primary_branch",
  });
  assert.deepEqual(resolveShipmentBranchAccess(kathmandu, "invalid", ["Kathmandu"]), {
    kind: "forbidden",
    reason: "invalid_primary_branch",
  });
  const primary = resolveShipmentBranchAccess(kathmandu, "Kathmandu", ["Birgunj", "Kathmandu"]);
  assert.equal(primary.kind, "allowed");
  assert.equal(primary.primaryBranch, "Kathmandu");
  assert.deepEqual(primary.handlingBranches, ["Birgunj", "Kathmandu"]);
  const viaHandling = resolveShipmentBranchAccess(birgunj, "Kathmandu", ["Birgunj"]);
  assert.equal(viaHandling.kind, "allowed", "a valid handling branch supplements access only after canonical primary branch exists");
  assert.deepEqual(resolveShipmentBranchAccess(kathmandu, "Kolkata", []), {
    kind: "forbidden",
    reason: "outside_scope",
  });
  assert.deepEqual(resolveShipmentBranchAccess(management, undefined, ["Kathmandu"]), {
    kind: "forbidden",
    reason: "invalid_primary_branch",
  });
});

test("shipment mutation route keeps explicit capability and real staff branch context", () => {
  const route = readFileSync(resolve("app/api/admin/shipments/[reference]/route.ts"), "utf8");
  const workflow = readFileSync(resolve("app/admin/workflow-guard.server.ts"), "utf8");
  assert.match(route, /permissions\.canManageJobFile/);
  assert.doesNotMatch(route, /can_access_all_branches\s*:\s*true/);
  assert.match(workflow, /strictBranchValue\(data\.primary_branch\)/);
  assert.match(workflow, /canAccessBranchSet\(context, branch, handlingBranches\)/);
  assert.doesNotMatch(workflow, /"Kathmandu"/);
});

test("paper archive migration batches are the only linked organization-scoped archive entity", () => {
  assert.equal(archiveRelationshipScope("migration_batch"), "organization");
  for (const entityType of ["customer", "shipment", "partner", "receivable", "payable"]) {
    assert.equal(archiveRelationshipScope(entityType), "branch", `${entityType} stays branch-scoped`);
  }
  assert.equal(archiveRelationshipScope("general"), "none");
  assert.equal(archiveLinkedRecordAllowed({ entityType: "migration_batch", canonicalRecordExists: true }), true);
  assert.equal(archiveLinkedRecordAllowed({ entityType: "migration_batch", canonicalRecordExists: false }), false, "a fabricated/missing migration batch cannot be linked");
  for (const entityType of ["customer", "shipment", "partner", "receivable", "payable"]) {
    assert.equal(archiveLinkedRecordAllowed({ entityType, canonicalRecordExists: true, branchCompatible: true }), true);
    assert.equal(archiveLinkedRecordAllowed({ entityType, canonicalRecordExists: true, branchCompatible: false }), false);
    assert.equal(archiveLinkedRecordAllowed({ entityType, canonicalRecordExists: true }), false, "missing branch evidence never becomes organization scope");
  }
});

test("paper archive authority remains Management-only", () => {
  assert.equal(canManagePaperArchive("management"), true);
  for (const role of ["operations", "commercial", "accounts"]) assert.equal(canManagePaperArchive(role), false);
});

test("archive legacy Kathmandu parser is presentation-only and relationship authorization uses raw canonical data", () => {
  const archive = readFileSync(resolve("app/admin/migration/archive/archive.server.ts"), "utf8");
  assert.match(archive, /Legacy presentation fallback only/);
  const resolverStart = archive.indexOf("async function resolveEntity");
  const resolverEnd = archive.indexOf("export function validatePaperArchiveInput");
  const resolver = archive.slice(resolverStart, resolverEnd);
  assert.ok(resolverStart >= 0 && resolverEnd > resolverStart);
  assert.doesNotMatch(resolver, /recordFromSnapshot/);
  assert.match(resolver, /snapshot\.data\(\) \?\? \{\}/);
  assert.match(resolver, /archiveRelationshipScope\(entityTypeValue\)/);
  assert.match(resolver, /compatibleRecordBranches\(archiveBranch, data\.primary_branch\)/);
  assert.match(resolver, /compatibleRecordBranches\(archiveBranch, data\.branch\)/);
});

test("EDI 990 authority rejects ambiguity reference conflicts and branch conflicts", () => {
  const tender = { id: "T-1", orderId: "ORD-1", branch: "Kathmandu", status: "sent" };
  assert.deepEqual(resolveEdi990TenderTarget({ hasTenderReference: true, suppliedOrderReference: "ORD-1", candidates: [tender] }), { kind: "ready", tender });
  assert.deepEqual(resolveEdi990TenderTarget({ hasTenderReference: true, suppliedOrderReference: "ORD-2", candidates: [tender] }), { kind: "reject", reason: "reference_conflict" });
  assert.deepEqual(resolveEdi990TenderTarget({ hasTenderReference: false, suppliedOrderReference: "ORD-1", candidates: [tender, { ...tender, id: "T-2" }] }), { kind: "reject", reason: "order_not_unique" });
  assert.deepEqual(validateEdi990CanonicalChain({ tender, orderExists: true, orderBranch: "Kathmandu" }), { kind: "ready", branch: "Kathmandu" });
  assert.deepEqual(validateEdi990CanonicalChain({ tender, orderExists: true, orderBranch: "Kolkata" }), { kind: "reject", reason: "branch_mismatch", branch: "Kathmandu" });
  assert.deepEqual(validateEdi990CanonicalChain({ tender: { ...tender, branch: "invalid" }, orderExists: true, orderBranch: "Kathmandu" }), { kind: "reject", reason: "invalid_tender_scope", branch: null });
  assert.deepEqual(validateEdi990CanonicalChain({ tender, orderExists: true, orderBranch: "Kathmandu", claimedBranch: "Kolkata" }), { kind: "reject", reason: "claimed_branch_conflict", branch: "Kathmandu" });
});

test("EDI 214 and Maersk remain set-based rather than first-match", () => {
  assert.deepEqual(resolveCanonicalRecordCandidates([{ id: "S-1", branch: "Kathmandu" }]), { kind: "ready", id: "S-1", branch: "Kathmandu" });
  assert.deepEqual(resolveCanonicalRecordCandidates([{ id: "S-1", branch: "Kathmandu" }, { id: "S-1", branch: "Kathmandu" }]), { kind: "ready", id: "S-1", branch: "Kathmandu" });
  assert.deepEqual(resolveCanonicalRecordCandidates([{ id: "S-1", branch: "Kathmandu" }, { id: "S-2", branch: "Kathmandu" }]), { kind: "ambiguous", ids: ["S-1", "S-2"] });
  assert.deepEqual(resolveCanonicalRecordCandidates([{ id: "S-1", branch: null }]), { kind: "invalid_branch", id: "S-1" });
  assert.deepEqual(resolveCanonicalRecordCandidates([]), { kind: "missing" });

  const gateway = readFileSync(resolve("app/admin/edi/edi-gateway.server.ts"), "utf8");
  assert.match(gateway, /where\("booking_reference",\s*"==",\s*parsed\.bookingReference\)/);
  assert.match(gateway, /where\("carrier_reference",\s*"==",\s*parsed\.carrierReference\)/);
  const maersk = readFileSync(resolve("app/admin/carrier-integrations/maersk-webhook.server.ts"), "utf8");
  assert.match(maersk, /resolveCanonicalRecordCandidates/);
});

test("EDI 204 dispatch requires canonical tender/order scope and compatible explicit partner scope", () => {
  assert.equal(partnerOwnerCompatibleWithBranch("Global", "Kathmandu"), true);
  assert.equal(partnerOwnerCompatibleWithBranch("Kathmandu", "Kathmandu"), true);
  assert.equal(partnerOwnerCompatibleWithBranch("Kolkata", "Kathmandu"), false);
  assert.equal(partnerOwnerCompatibleWithBranch(undefined, "Kathmandu"), false);
  assert.equal(compatibleRecordBranches("Kathmandu", "Kathmandu"), true);
  assert.equal(compatibleRecordBranches("Kathmandu", "Kolkata"), false);
  assert.equal(compatibleRecordBranches("Kathmandu", undefined), false);

  const route = readFileSync(resolve("app/api/admin/tenders/route.ts"), "utf8");
  const edi = readFileSync(resolve("app/admin/edi/edi-tender.server.ts"), "utf8");
  assert.match(route, /queueTenderAsEdi204\([^;]*access\.staff\)/s);
  assert.match(edi, /compatibleRecordBranches\(tenderBranch, order\.get\("branch"\)\)/);
  assert.match(edi, /partnerOwnerCompatibleWithBranch/);
});

test("CRM and finance relationship guards remain branch compatible before mutation", () => {
  const customer = readFileSync(resolve("app/admin/crm/crm-customer-management.server.ts"), "utf8");
  assert.match(customer, /branch_conflict/);
  assert.match(customer, /transaction\.get\(db\.collection\("shipments"\)\.where\("customer_id", "==", id\)\)/);
  assert.match(customer, /transaction\.get\(db\.collection\("invoices"\)\.where\("customer_id", "==", id\)\)/);
  assert.match(customer, /transaction\.get\(db\.collection\("payables"\)\.where\("customer_id", "==", id\)\)/);
  assert.ok(customer.indexOf("branch_conflict") < customer.indexOf("transaction.update(customerRef"));

  const ap = readFileSync(resolve("app/admin/financial-settlement/payables-settlement.server.ts"), "utf8");
  const ar = readFileSync(resolve("app/admin/financial-settlement/receivables-settlement.server.ts"), "utf8");
  const audit = readFileSync(resolve("app/admin/freight-audit/freight-audit.server.ts"), "utf8");
  assert.doesNotMatch(ap, /\|\|\s*"Kathmandu"|\?\?\s*"Kathmandu"/);
  assert.doesNotMatch(ar, /\|\|\s*"Kathmandu"|\?\?\s*"Kathmandu"/);
  assert.doesNotMatch(audit, /\|\|\s*"Kathmandu"|\?\?\s*"Kathmandu"/);
});

test("PR 126 settlement and PR 127 tender concurrency guards remain present", () => {
  const ap = readFileSync(resolve("app/admin/financial-settlement/payables-settlement.server.ts"), "utf8");
  const ar = readFileSync(resolve("app/admin/financial-settlement/receivables-settlement.server.ts"), "utf8");
  const tender = readFileSync(resolve("app/admin/tenders/tms-tendering.server.ts"), "utf8");
  assert.match(ap, /runTransaction/);
  assert.match(ar, /runTransaction/);
  assert.match(tender, /resolveTenderAuthority/);
  assert.match(tender, /bookingRetryDecision/);
  assert.match(tender, /runTransaction/);
  assert.match(tender, /edi_990_transaction_id/);
});

test("current role capability map is explicit and shipment route does not trust UI hiding", () => {
  for (const role of ["management", "accounts", "commercial", "operations"]) {
    assert.equal(staffCapabilitiesForRole(role).canManageJobFile, true);
  }
  const route = readFileSync(resolve("app/api/admin/shipments/[reference]/route.ts"), "utf8");
  const capabilityCheck = route.indexOf("permissions.canManageJobFile");
  const mutationCall = Math.min(
    ...[route.indexOf("updateShipment("), route.indexOf("addShipmentEvent(")].filter((index) => index >= 0),
  );
  assert.ok(capabilityCheck >= 0 && capabilityCheck < mutationCall, "server capability check must precede shipment business mutation calls");
});
