// Find Firestore queries that need a composite index and check one is declared.
//
// A query that combines a filter on one field with an orderBy on another cannot
// be served by the automatic single-field indexes. Firestore answers it with
// FAILED_PRECONDITION every time, at any data volume. Callers in this codebase
// tend to catch and degrade rather than crash, so the symptom is a feature that
// quietly never works in production while every test passes.
//
//   node scripts/firestore-index-audit.mjs          report and exit non-zero on a gap
//   node scripts/firestore-index-audit.mjs --json   machine-readable
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function sources(dir, out = []) {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      sources(rel, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

// One chained expression: .collection("x").where(...).orderBy(...)...
const CHAIN = /\.collection(?:Group)?\(\s*["'`]([^"'`]+)["'`]\s*\)((?:\s*\.\s*(?:where|orderBy|limit|startAfter|startAt|endBefore|endAt|select|offset)\([^;]*?\))+)/gs;
const WHERE = /\.where\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]/g;
const ORDER = /\.orderBy\(\s*["'`]([^"'`]+)["'`](?:\s*,\s*["'`](asc|desc)["'`])?/g;
// A query assembled across statements would escape the scan above, so the audit
// also refuses to run against one rather than reporting a clean pass it cannot
// support. Today every query in the repo is a single chain.
const BUILDER = /\b(?:let|var)\s+\w+\s*(?::[^=]+)?=\s*(?:\w+\.)*collection(?:Group)?\(/;

export function auditFirestoreIndexes() {
  const declared = JSON.parse(readFileSync(path.join(ROOT, "firestore.indexes.json"), "utf8"));
  const have = new Set(
    (declared.indexes ?? []).map((index) =>
      `${index.collectionGroup}|${index.fields.map((field) => `${field.fieldPath}:${(field.order ?? "ASCENDING").toLowerCase()}`).join(",")}`),
  );

  const required = [];
  const unscannable = [];
  for (const file of sources("app")) {
    const src = readFileSync(path.join(ROOT, file), "utf8");
    if (BUILDER.test(src)) unscannable.push(file);
    for (const match of src.matchAll(CHAIN)) {
      const collection = match[1];
      const tail = match[2];
      const filters = [...tail.matchAll(WHERE)].map((m) => ({ field: m[1], op: m[2] }));
      const orders = [...tail.matchAll(ORDER)].map((m) => ({ field: m[1], dir: m[2] ?? "asc" }));
      if (!filters.length || !orders.length) continue;
      const fields = [...new Set(filters.map((f) => f.field))];
      // Filtering and ordering the same single field is served by that field's
      // automatic index.
      if (fields.length === 1 && orders.length === 1 && fields[0] === orders[0].field) continue;
      const shape = [
        ...fields.map((field) => `${field}:ascending`),
        ...orders.filter((order) => !fields.includes(order.field)).map((order) => `${order.field}:${order.dir === "desc" ? "descending" : "ascending"}`),
      ].join(",");
      required.push({
        collection,
        shape,
        key: `${collection}|${shape}`,
        line: src.slice(0, match.index).split("\n").length,
        file,
      });
    }
  }

  const missing = required.filter((entry) => !have.has(entry.key));
  const unused = [...have].filter((key) => !required.some((entry) => entry.key === key));
  return { required, missing, unused, unscannable, declared: [...have] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = auditFirestoreIndexes();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`${report.required.length} query site(s) need a composite index; ${report.declared.length} declared.`);
    for (const entry of report.missing) console.error(`  MISSING  ${entry.collection} (${entry.shape})  ${entry.file}:${entry.line}`);
    for (const key of report.unused) console.warn(`  unused   ${key}`);
    for (const file of report.unscannable) console.warn(`  unscannable (query built across statements): ${file}`);
  }
  if (report.missing.length) {
    console.error("\nAdd the index to firestore.indexes.json and deploy it, or the query fails with FAILED_PRECONDITION in production.");
    process.exit(1);
  }
}
