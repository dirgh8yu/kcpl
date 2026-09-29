import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { mapWithConcurrency, readAllDocuments } from "../app/admin/firestore-scan.ts";
import { openShipmentStatuses, RECENT_DELIVERED_WINDOW } from "../app/admin/operational-shipments.ts";
import { portalDocumentChecklist, portalDocumentReleased } from "../app/portal/portal-access-policy.ts";

/*
 * Firestore answers a query with no orderBy in document-id order, and KCPL's
 * references begin with their creation date. A bare `.limit(n)` on a whole
 * collection therefore kept the n OLDEST records: past a few thousand jobs the
 * Command Centre showed old work, alerts skipped new shipments and resolved
 * their alerts, and the Management totals dropped recent months.
 */

const repo = (path) => new URL(`../${path}`, import.meta.url);
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** A fake query over ids 0..n-1 that pages the way Firestore does. */
function fakeQuery(total, calls = []) {
  const make = (after, limit) => ({
    limit: (next) => make(after, next),
    startAfter: (doc) => make(doc, limit),
    async get() {
      calls.push({ after, limit });
      const start = after === null ? 0 : after + 1;
      const docs = [];
      for (let id = start; id < Math.min(total, start + limit); id += 1) docs.push(id);
      return { docs };
    },
  });
  return make(null, Infinity);
}

test("a complete read returns every record, newest included, a page at a time", async () => {
  const calls = [];
  const result = await readAllDocuments(fakeQuery(1234, calls), { pageSize: 500 });
  assert.equal(result.complete, true);
  assert.equal(result.docs.length, 1234);
  assert.equal(result.docs.at(-1), 1233, "the newest record is read");
  assert.deepEqual(calls.map((call) => call.after), [null, 499, 999]);
});

test("a read that ends exactly on a page boundary is still complete", async () => {
  const result = await readAllDocuments(fakeQuery(1000), { pageSize: 500 });
  assert.equal(result.complete, true);
  assert.equal(result.docs.length, 1000);
  assert.equal((await readAllDocuments(fakeQuery(0))).complete, true);
});

test("the backstop says when it stopped a read, and only then", async () => {
  const stopped = await readAllDocuments(fakeQuery(1001), { pageSize: 500, ceiling: 1000 });
  assert.equal(stopped.complete, false);
  assert.equal(stopped.docs.length, 1000);
  const exact = await readAllDocuments(fakeQuery(1000), { pageSize: 500, ceiling: 1000 });
  assert.equal(exact.complete, true, "a query that ends at the ceiling was read whole");
});

test("per-job reads keep their order and their concurrency bound", async () => {
  let inFlight = 0;
  let peak = 0;
  const out = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (value) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, value));
    inFlight -= 1;
    return value * 10;
  });
  assert.deepEqual(out, [50, 10, 40, 20, 30]);
  assert.equal(peak, 2);
  assert.deepEqual(await mapWithConcurrency([], 5, async (value) => value), []);
});

test("operational screens read every open job and a window of the newest delivered", async () => {
  assert.deepEqual(openShipmentStatuses, ["booking_confirmed", "preparing", "in_transit", "customs_clearance", "out_for_delivery", "exception"]);
  assert.equal(RECENT_DELIVERED_WINDOW, 500);
  const loader = code(await readFile(repo("app/admin/operational-shipments.server.ts"), "utf8"));
  assert.match(loader, /readAllDocuments\(db\.collection\("shipments"\)\.where\("status", "in", openShipmentStatuses\)(, \{ pageSize: \d+ \})?\)/);
  assert.match(loader, /cache\(async \(db: Firestore, includeDelivered: boolean\)/, "one read per request");
  assert.match(loader, /where\("status", "not-in", \[\.\.\.shipmentStatuses\]\)/, "a legacy status stays visible");
  assert.match(loader, /where\("status", "==", "delivered"\)\.orderBy\("updated_at", "desc"\)\.limit\(RECENT_DELIVERED_WINDOW\)/);
  for (const path of ["app/admin/command-centre/command-centre.server.ts", "app/admin/delivery/delivery-control.server.ts", "app/admin/visibility/tracking-visibility.server.ts"]) {
    assert.match(code(await readFile(repo(path), "utf8")), /loadOperationalShipments\(db, \{ includeDelivered: (true|false|Boolean\(options\.includeDelivered\)) \}\)/, path);
  }
  const register = await readFile(repo("app/admin/shipments/shipments-workspace.tsx"), "utf8");
  assert.match(register, /data\.delivered_window_full/, "the register says when older delivered jobs are not listed");
});

async function sourceFiles(dir) {
  const out = [];
  for (const entry of await readdir(repo(dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes("qa-fixtures")) out.push(path);
  }
  return out;
}

test("no whole collection is read with a bare limit", async () => {
  // Reads of one job's own subcollection (ref.collection("job_tasks")) are
  // bounded by that job and are fine. A top-level collection or a collection
  // group read this way silently keeps only the oldest records.
  const offenders = [];
  for (const path of await sourceFiles("app")) {
    const source = code(await readFile(repo(path), "utf8"));
    for (const match of source.matchAll(/(?:\bdb|firebaseAdminDb\(\))\s*\.\s*(collection|collectionGroup)\(\s*"([a-z_]+)"\s*\)\s*\.\s*limit\(\s*\d+\s*\)\s*\.\s*get\(\)/g)) {
      // A one-document existence probe is not a listing.
      if (/\.limit\(\s*1\s*\)/.test(match[0])) continue;
      offenders.push(`${path}: ${match[1]}("${match[2]}")`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("automation never resolves what a partial read could not see", async () => {
  for (const path of ["app/admin/alerts/alert-engine.server.ts", "app/admin/alerts/freight-automation.server.ts", "app/admin/payables/payables-alerts.server.ts"]) {
    const source = code(await readFile(repo(path), "utf8"));
    assert.match(source, /const scansComplete = /, path);
    const resolving = [...source.matchAll(/continue;/g)].length;
    assert.ok(resolving > 0);
    assert.match(source, /if \(!scansComplete \|\|/, `${path}: the resolve step checks the reads were whole`);
  }
  const freight = code(await readFile(repo("app/admin/alerts/freight-automation.server.ts"), "utf8"));
  assert.doesNotMatch(freight, /collectionGroup\("job_tasks"\)\.where/, "a collection-group filter needs an index none declares");
});

test("dashboards count every open invoice and bill, and say when figures are partial", async () => {
  const finance = code(await readFile(repo("app/admin/finance/finance.server.ts"), "utf8"));
  assert.match(finance, /collection\("invoices"\)\.where\("status", "in", \["draft", "issued", "partially_paid", "overdue"\]\)/);
  assert.match(finance, /index \+= 400/, "status write-backs go out in modest commits");
  const payables = code(await readFile(repo("app/admin/payables/payables.server.ts"), "utf8"));
  assert.match(payables, /collection\("payables"\)\.where\("status", "in", \["draft", "approved", "partially_paid", "overdue"\]\)/);
  const management = code(await readFile(repo("app/admin/management/management.server.ts"), "utf8"));
  assert.match(management, /complete,/);
  const view = await readFile(repo("app/admin/management/management-workspace.tsx"), "utf8");
  assert.match(view, /analytics\.complete \? null :/);
});

test("today means Nepal's day wherever a person sees or enters a date", async () => {
  const offenders = [];
  for (const path of await sourceFiles("app")) {
    const source = code(await readFile(repo(path), "utf8"));
    // Reference ids that embed a date (…replaceAll("-", "")) are identifiers, not days.
    for (const match of source.matchAll(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)(?!\.replace)/g)) offenders.push(`${path}:${source.slice(0, match.index).split("\n").length}`);
  }
  assert.deepEqual(offenders, []);
});

test("a document stays released through its expiry day in Nepal", () => {
  const document = { customer_safe: true, review_status: "verified", expires_on: "2026-09-29" };
  assert.equal(portalDocumentReleased(document, new Date("2026-09-29T18:14:00Z")), true, "23:59 in Kathmandu");
  assert.equal(portalDocumentReleased(document, new Date("2026-09-29T18:16:00Z")), false, "00:01 the next day");
  const rows = portalDocumentChecklist({
    requirements: [{ document_type: "import_permit", required: true }],
    documents: [{ document_type: "import_permit", review_status: "verified", expires_on: "2026-09-29", uploaded_by_source: "customer_portal", uploaded_at: "2026-09-01T00:00:00Z" }],
    now: new Date("2026-09-29T18:16:00Z"),
  });
  assert.notEqual(rows[0].state, "confirmed", "an expired permit is not confirmed");
});

test("each automation sweep resolves only the alerts it raises", async () => {
  const { automationAlertTypes, coreAutomationAlertTypes, freightAutomationAlertTypes, payablesAutomationAlertTypes } = await import("../app/admin/alerts/alert-data.ts");
  // The sweeps run side by side. The core engine used to resolve every alert
  // it had not raised, so freight alerts flipped closed and open on each run.
  const owned = [...coreAutomationAlertTypes, ...freightAutomationAlertTypes, ...payablesAutomationAlertTypes];
  assert.deepEqual([...owned].sort(), [...automationAlertTypes].sort(), "every type has exactly one owner");
  assert.equal(new Set(owned).size, owned.length);
  const core = code(await readFile(repo("app/admin/alerts/alert-engine.server.ts"), "utf8"));
  assert.match(core, /!\(coreAutomationAlertTypes as readonly string\[\]\)\.includes\(previous\.type\)/);
  const freight = code(await readFile(repo("app/admin/alerts/freight-automation.server.ts"), "utf8"));
  assert.match(freight, /const EXTRA_TYPES: AutomationAlertType\[\] = \[\.\.\.freightAutomationAlertTypes\]/);
  const payables = code(await readFile(repo("app/admin/payables/payables-alerts.server.ts"), "utf8"));
  assert.match(payables, /where\("type", "==", "payable_overdue"\)/);
});
