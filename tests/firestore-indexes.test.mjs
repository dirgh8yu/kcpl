import assert from "node:assert/strict";
import test from "node:test";
import { auditFirestoreIndexes } from "../scripts/firestore-index-audit.mjs";

const report = auditFirestoreIndexes();

test("every query that needs a composite index has one declared", () => {
  // Firestore refuses these with FAILED_PRECONDITION at any data volume, and
  // the callers here catch and degrade, so the failure shows up as a feature
  // that quietly does nothing rather than as an error anyone sees.
  assert.deepEqual(
    report.missing.map((entry) => `${entry.collection}(${entry.shape}) at ${entry.file}:${entry.line}`),
    [],
  );
});

test("the audit can actually see every query", () => {
  // A query assembled across statements is invisible to a scan of chained
  // expressions. If one appears, the gate above stops being trustworthy and
  // this is what says so.
  assert.deepEqual(report.unscannable, []);
});

test("declared indexes are all earned", () => {
  // An index nothing queries costs write latency and storage on every document
  // in the collection. Removing the query should remove the index.
  assert.deepEqual(report.unused, []);
});
