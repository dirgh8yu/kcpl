import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { bearerToken } from "../app/bearer-token.ts";
import { portalBearerToken } from "../app/portal/portal-mobile-auth.ts";
import { opsFieldDocumentType, opsLookupKey, opsLookupScore, opsLookupUsable } from "../app/admin/ops-field.ts";

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
    "app/api/mobile/ops/v1/jobs/[reference]/actions/route.ts",
    "app/api/mobile/ops/v1/jobs/[reference]/customs/[id]/route.ts",
    "app/api/mobile/ops/v1/jobs/[reference]/delivery/evidence/route.ts",
    "app/api/mobile/ops/v1/jobs/[reference]/delivery/route.ts",
    "app/api/mobile/ops/v1/jobs/[reference]/notes/route.ts",
    "app/api/mobile/ops/v1/jobs/[reference]/tasks/[id]/route.ts",
    "app/api/mobile/ops/v1/push/route.ts",
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

test("a field note checks the job's branch before it reads the photo or writes anything", async () => {
  const route = code(await readFile(repo("app/api/mobile/ops/v1/jobs/[reference]/notes/route.ts"), "utf8"));
  assert.match(route, /withStaffSession\(request, async \(session\)/);
  assert.match(route, /addOpsFieldNote\(reference, form, session\)/);
  const source = code(await readFile(repo("app/admin/ops-field.server.ts"), "utf8"));
  const body = source.slice(source.indexOf("export async function addOpsFieldNote"), source.indexOf("export async function listOpsFieldNotes"));
  const access = body.indexOf("checkShipmentBranchAccess(");
  assert.ok(access > 0, "branch access is checked");
  for (const later of ["arrayBuffer()", "validateShipmentDocumentBytes(", "uploadShipmentDocument(", ".create({"]) {
    assert.ok(body.indexOf(later) > access, `${later} comes after the branch check`);
  }
  // A note is activity and a photo is an ordinary upload: neither moves the job.
  assert.match(body, /type: "field_note"/);
  assert.doesNotMatch(body, /status:\s*"|\.update\(|supersedes/);
});

test("a scan only ever finds jobs in the caller's branches", async () => {
  const source = code(await readFile(repo("app/admin/ops-field.server.ts"), "utf8"));
  const body = source.slice(source.indexOf("export async function lookupOpsJobs"));
  const filter = body.indexOf("canAccessBranchSet(staff, data.primary_branch, data.handling_branches)");
  assert.ok(filter > 0 && filter < body.indexOf("scored.push("), "out-of-branch jobs are dropped before anything is reported");
});

test("a scanned identifier compares on letters and digits", () => {
  assert.equal(opsLookupKey("mscu 123456-7"), "MSCU1234567");
  assert.equal(opsLookupKey(null), "");
  assert.equal(opsLookupUsable("MSC"), false);
  assert.equal(opsLookupUsable("MSCU"), true);
  const job = { reference: "KCPL-2609-0142", carrierReference: "MSCU 123456-7", internalReference: null };
  assert.ok(opsLookupScore("KCPL26090142", job) > opsLookupScore("MSCU1234567", job), "the job's own reference ranks first");
  assert.ok(opsLookupScore("MSCU1234567", job) > 0, "a container number stored with spaces still matches");
  assert.ok(opsLookupScore("26090142", job) > 0, "a long fragment matches");
  assert.equal(opsLookupScore("0142", job), 0, "a short fragment does not");
  assert.equal(opsLookupScore("ABCD9999999", job), 0);
});

test("a field photo is filed as other unless its type is named, and never as an unknown type", () => {
  assert.equal(opsFieldDocumentType(""), "other");
  assert.equal(opsFieldDocumentType(null), "other");
  assert.equal(opsFieldDocumentType("proof_of_delivery"), "proof_of_delivery");
  assert.equal(opsFieldDocumentType("passport"), null);
});

test("job actions from the phone are the web Job File's own, after the same branch check", async () => {
  const route = code(await readFile(repo("app/api/mobile/ops/v1/jobs/[reference]/actions/route.ts"), "utf8"));
  const check = route.indexOf("checkShipmentBranchAccess(");
  assert.ok(check > 0 && check < route.indexOf("request.json()"), "access is decided before the body is read");
  for (const shared of ["addJobTaskFromRequest(", "closeJobFromRequest(", "reassignJob("]) assert.ok(route.includes(shared), shared);
  const web = code(await readFile(repo("app/api/admin/jobs/[reference]/route.ts"), "utf8"));
  for (const shared of ["addJobTaskFromRequest(", "closeJobFromRequest("]) assert.ok(web.includes(shared), `the web route shares ${shared}`);
});

test("a job can only be given to someone the assigner may choose, and nothing else on the file changes", async () => {
  const source = code(await readFile(repo("app/admin/job-file-requests.server.ts"), "utf8"));
  const body = source.slice(source.indexOf("export async function reassignJob"));
  assert.ok(body.indexOf("staffAssignmentOptions(staff)") < body.indexOf("updateDigitalJobFile("));
  assert.match(body, /options\.find\(\(option\) => option\.uid === uid\)/);
  assert.match(body, /priority: job\.priority/);
  assert.match(body, /internalNotes: job\.internal_notes/);
  assert.doesNotMatch(body, /primaryBranch|handlingBranches/, "branches are not the field's to move");
});

test("the field records deliveries and attaches POD through Delivery Control, and never verifies POD", async () => {
  const routes = await Promise.all([
    readFile(repo("app/api/mobile/ops/v1/jobs/[reference]/delivery/route.ts"), "utf8"),
    readFile(repo("app/api/mobile/ops/v1/jobs/[reference]/delivery/evidence/route.ts"), "utf8"),
  ]);
  const both = routes.map(code).join("\n");
  assert.match(both, /scheduleDeliveryFromRequest\(/);
  assert.match(both, /updateDeliveryFromRequest\(/);
  assert.match(both, /podEvidenceFromForm\(/);
  assert.doesNotMatch(both, /reviewPod|review_pod|reconcileCanonicalDelivery|adoptTrackedDelivery/);
  const shared = code(await readFile(repo("app/admin/delivery/delivery-requests.server.ts"), "utf8"));
  assert.doesNotMatch(shared, /reviewPod\(|firebaseAdminDb/, "the shared module only calls Delivery Control");
});

