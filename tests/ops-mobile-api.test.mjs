import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { bearerToken } from "../app/bearer-token.ts";
import { portalBearerToken } from "../app/portal/portal-mobile-auth.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function routeFiles(dir) {
  const found = [];
  for (const entry of await readdir(repo(dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...await routeFiles(path));
    else if (entry.name === "route.ts") found.push(path);
  }
  return found;
}

test("both apps parse the credential with the one parser", () => {
  const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1In0.c2ln";
  assert.equal(bearerToken(`Bearer ${jwt}`), jwt);
  assert.equal(bearerToken(`bearer ${jwt}`), null);
  assert.equal(bearerToken(null), null);
  assert.equal(portalBearerToken, bearerToken);
});

test("the staff bearer resolver verifies with revocation and decides with the web's own check", async () => {
  const source = code(await readFile(repo("app/admin/admin-auth.ts"), "utf8"));
  const start = source.indexOf("export async function getAdminAccessFromBearer");
  assert.ok(start > 0);
  const body = source.slice(start, source.indexOf("export function adminSessionCookie", start));
  assert.match(body, /verifyIdToken\(token, true\)/);
  assert.match(body, /isAuthorizedAdminUser\(decoded\.uid, decoded\.email\)/);
  assert.ok(body.indexOf("verifyIdToken") < body.indexOf("isAuthorizedAdminUser"));
  // The only other way in is the same fenced QA preview the cookie path has.
  assert.match(body, /const previewAccess = previewQaAccess\(\);\s*if \(previewAccess\) return previewAccess;/);
  assert.equal((body.match(/kind: "authorized"/g) ?? []).length, 1);
});

test("every staff route resolves the caller through the one wrapper", async () => {
  const routes = await routeFiles("app/api/mobile/ops/v1");
  assert.ok(routes.length >= 7, `found ${routes.length}`);
  for (const path of routes) {
    const source = code(await readFile(repo(path), "utf8"));
    assert.match(source, /withStaffSession\(request, async \(/, path);
    assert.doesNotMatch(source, /firebaseAdminDb|collection\(/, `${path} must not query Firestore itself`);
    assert.doesNotMatch(source, /getAdminAccess\(\)/, `${path} must not fall back to the cookie`);
  }
});

test("the staff app can write only what the phone needs, and only through shared functions", async () => {
  const routes = await routeFiles("app/api/mobile/ops/v1");
  const writers = [];
  for (const path of routes) {
    const source = code(await readFile(repo(path), "utf8"));
    if (/export async function (POST|PUT|PATCH|DELETE)/.test(source)) writers.push(path);
  }
  assert.deepEqual(writers.sort(), [
    "app/api/mobile/ops/v1/alerts/[id]/route.ts",
    "app/api/mobile/ops/v1/jobs/[reference]/customs/[id]/route.ts",
    "app/api/mobile/ops/v1/jobs/[reference]/tasks/[id]/route.ts",
  ]);
  for (const kind of ["tasks", "customs"]) {
    const source = code(await readFile(repo(`app/api/mobile/ops/v1/jobs/[reference]/${kind}/[id]/route.ts`), "utf8"));
    assert.match(source, /toggleJobChild\(/);
    assert.doesNotMatch(source, /toggleJobTask|toggleCustomsStep/);
  }
});

test("the web Job File ticks work through the same guarded function", async () => {
  const source = code(await readFile(repo("app/api/admin/jobs/[reference]/route.ts"), "utf8"));
  assert.equal((source.match(/toggleJobChild\(/g) ?? []).length, 2);
  assert.doesNotMatch(source, /toggleJobTask\(|toggleCustomsStep\(/);
});

test("ticking a work item checks the job's branch, then the item's, before writing", async () => {
  const source = code(await readFile(repo("app/admin/job-file-actions.server.ts"), "utf8"));
  const shipment = source.indexOf("checkShipmentBranchAccess(");
  const child = source.indexOf("staffCanAccessBranch(staff, branch)");
  const write = source.indexOf("toggleJobTask(");
  assert.ok(shipment > 0 && child > shipment && write > child);
});

test("the staff wrapper refuses an unresolvable profile rather than defaulting a role", async () => {
  const source = code(await readFile(repo("app/admin/ops-mobile-api.server.ts"), "utf8"));
  assert.match(source, /catch \{\s*return opsJson\([^)]*"denied"[^)]*\}, 403\);/);
  assert.match(source, /if \(!staff\.permissions\.canManageJobFile\)/);
  assert.equal((source.match(/handler\(/g) ?? []).length, 1);
  assert.match(source, /return handler\(\{ user: access\.user, staff \}\);/);
});

test("the job route checks branch access before loading the Job File", async () => {
  const source = code(await readFile(repo("app/api/mobile/ops/v1/jobs/[reference]/route.ts"), "utf8"));
  assert.ok(source.indexOf("checkShipmentBranchAccess(") < source.indexOf("getDigitalJobFile("));
});
