import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const securitySensitiveBranchFiles = [
  "app/admin/workflow-guard.server.ts",
  "app/admin/shipment-access.server.ts",
  "app/admin/finance/finance-linking.server.ts",
  "app/admin/finance/finance-authorization.server.ts",
  "app/admin/finance/finance.server.ts",
  "app/admin/crm/crm-quote-links.server.ts",
  "app/admin/edi/edi-trust-boundary.server.ts",
  "app/admin/edi/edi-tender.server.ts",
  "app/api/integrations/pickups/route.ts",
];

const fabricatedKathmandu = /(?:\|\||\?\?)\s*["']Kathmandu["']/;

test("authorization-sensitive branch helpers do not fabricate Kathmandu from missing canonical scope", () => {
  for (const file of securitySensitiveBranchFiles) {
    const source = readFileSync(resolve(file), "utf8");
    assert.doesNotMatch(source, fabricatedKathmandu, `${file} must fail closed instead of fabricating Kathmandu`);
  }
});

test("legacy paper archive Kathmandu fallback remains isolated to display parsing", () => {
  const source = readFileSync(resolve("app/admin/migration/archive/archive.server.ts"), "utf8");
  const fallback = /branch:\s*kcplBranches\.includes\(data\.branch as KcplBranch\)\s*\?\s*data\.branch as KcplBranch\s*:\s*"Kathmandu"/;
  assert.match(source, fallback);
  const resolverStart = source.indexOf("async function resolveEntity");
  const resolverEnd = source.indexOf("export function validatePaperArchiveInput");
  assert.ok(resolverStart >= 0 && resolverEnd > resolverStart);
  const resolver = source.slice(resolverStart, resolverEnd);
  assert.doesNotMatch(resolver, /"Kathmandu"/);
  assert.doesNotMatch(resolver, /recordFromSnapshot/);
});
