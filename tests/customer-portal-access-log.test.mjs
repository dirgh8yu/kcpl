import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  portalAccessEventId,
  portalAccessSummaries,
  portalUndownloadedDocuments,
} from "../app/portal/portal-access-log.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function event(overrides = {}) {
  return {
    id: "e",
    document_id: 1,
    document_type: "bill_of_lading",
    filename: "bl.pdf",
    account_email: "ops@acme.example",
    customer_id: "CUST-1",
    at: "2026-09-01T10:00:00.000Z",
    size_bytes: 1024,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * Event identity
 * ------------------------------------------------------------------ */

test("a repeated download in the same millisecond collapses to one event", () => {
  const first = portalAccessEventId({ documentId: 12, at: "2026-09-01T10:00:00.000Z", email: "Ops@Acme.example" });
  const second = portalAccessEventId({ documentId: 12, at: "2026-09-01T10:00:00.000Z", email: "ops@acme.example" });
  // A double click must not inflate the count a dispute is decided on.
  assert.equal(first, second);
});

test("a later download is a separate event", () => {
  const first = portalAccessEventId({ documentId: 12, at: "2026-09-01T10:00:00.000Z", email: "ops@acme.example" });
  const later = portalAccessEventId({ documentId: 12, at: "2026-09-01T10:00:01.000Z", email: "ops@acme.example" });
  assert.notEqual(first, later);
});

test("two people downloading the same document are separate events", () => {
  const one = portalAccessEventId({ documentId: 12, at: "2026-09-01T10:00:00.000Z", email: "ops@acme.example" });
  const two = portalAccessEventId({ documentId: 12, at: "2026-09-01T10:00:00.000Z", email: "finance@acme.example" });
  assert.notEqual(one, two);
});

test("an event id is safe as a Firestore document id", () => {
  const id = portalAccessEventId({ documentId: 7, at: "2026-09-01T10:00:00.000Z", email: "a.b+tag@sub.acme.example" });
  // Firestore rejects ids containing a slash, and silently resolves "." and "..".
  assert.doesNotMatch(id, /[/]/);
  assert.notEqual(id, ".");
  assert.notEqual(id, "..");
  assert.ok(id.length > 0 && id.length <= 1500);
});

test("an event id survives an address with no usable characters", () => {
  const id = portalAccessEventId({ documentId: 7, at: "2026-09-01T10:00:00.000Z", email: "!!!" });
  assert.match(id, /unknown$/);
});

/* ------------------------------------------------------------------ *
 * Per-document rollup
 * ------------------------------------------------------------------ */

test("repeat downloads by one person count once per person but many times in total", () => {
  const [summary] = portalAccessSummaries([
    event({ at: "2026-09-01T10:00:00.000Z" }),
    event({ at: "2026-09-02T10:00:00.000Z" }),
    event({ at: "2026-09-03T10:00:00.000Z" }),
  ]);
  assert.equal(summary.downloads, 3);
  // "One person fetched it three times" is not "three people have it".
  assert.deepEqual(summary.accounts, ["ops@acme.example"]);
  assert.equal(summary.first_at, "2026-09-01T10:00:00.000Z");
  assert.equal(summary.last_at, "2026-09-03T10:00:00.000Z");
});

test("distinct colleagues are listed separately", () => {
  const [summary] = portalAccessSummaries([
    event({ account_email: "ops@acme.example" }),
    event({ account_email: "finance@acme.example", at: "2026-09-02T10:00:00.000Z" }),
  ]);
  assert.equal(summary.downloads, 2);
  assert.deepEqual(summary.accounts.sort(), ["finance@acme.example", "ops@acme.example"]);
  assert.equal(summary.last_by, "finance@acme.example");
});

test("events arriving out of order still bound the range correctly", () => {
  const [summary] = portalAccessSummaries([
    event({ at: "2026-09-03T10:00:00.000Z", account_email: "late@acme.example" }),
    event({ at: "2026-09-01T10:00:00.000Z", account_email: "early@acme.example" }),
  ]);
  assert.equal(summary.first_at, "2026-09-01T10:00:00.000Z");
  assert.equal(summary.last_at, "2026-09-03T10:00:00.000Z");
  assert.equal(summary.last_by, "late@acme.example");
});

test("documents are rolled up separately and ordered by most recent activity", () => {
  const summaries = portalAccessSummaries([
    event({ document_id: 1, at: "2026-09-01T10:00:00.000Z" }),
    event({ document_id: 2, at: "2026-09-05T10:00:00.000Z" }),
  ]);
  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].document_id, 2);
});

test("an empty log rolls up to nothing rather than throwing", () => {
  assert.deepEqual(portalAccessSummaries([]), []);
});

/* ------------------------------------------------------------------ *
 * What has not been collected
 * ------------------------------------------------------------------ */

test("released documents nobody downloaded are the ones an operator can still chase", () => {
  const released = [
    { id: 1, document_type: "bill_of_lading", filename: "bl.pdf" },
    { id: 2, document_type: "commercial_invoice", filename: "inv.pdf" },
  ];
  const pending = portalUndownloadedDocuments(released, [event({ document_id: 1 })]);
  assert.deepEqual(pending.map((document) => document.id), [2]);
});

test("nothing released means nothing outstanding", () => {
  assert.deepEqual(portalUndownloadedDocuments([], [event()]), []);
});

/* ------------------------------------------------------------------ *
 * The log records, it never alters
 * ------------------------------------------------------------------ */

test("the access log writes only its own subcollection", async () => {
  const source = code(await readFile(repo("app/portal/portal-access-log.server.ts"), "utf8"));
  assert.match(source, /collection\(ACCESS_COLLECTION\)/);
  // Reading a file must not be able to change the file, the shipment, or the
  // review state of the document that was read.
  assert.doesNotMatch(source, /collection\("documents"\)\s*\.doc\([^)]*\)\.(?:update|set|create|delete)\(/);
  assert.doesNotMatch(source, /collection\("shipments"\)\.doc\([^)]*\)\.(?:update|set|create|delete)\(/);
  assert.doesNotMatch(source, /status:\s*"delivered"/);
});

test("a failed log write never fails the download", async () => {
  const source = code(await readFile(repo("app/portal/portal-access-log.server.ts"), "utf8"));
  // The customer has the bytes either way; a lost log line is the smaller harm.
  assert.match(source, /catch \(error\) \{[\s\S]{0,200}return false;/);
});

test("the download route logs only after the bytes are in hand", async () => {
  const source = code(await readFile(repo("app/api/portal/documents/[reference]/[id]/route.ts"), "utf8"));
  const fetched = source.indexOf("getShipmentDocumentFile");
  const logged = source.indexOf("recordPortalDocumentDownload");
  assert.ok(fetched > -1 && logged > fetched, "the log call must follow the file read");
  // Awaited, not fired and forgotten: the invocation can end with the response.
  assert.match(source, /await recordPortalDocumentDownload\(/);
  // The identity logged is the session's, never anything the caller supplied.
  assert.match(source, /accountEmail: access\.session\.email/);
  assert.match(source, /customerId: access\.session\.customerId/);
});

test("the log keeps identity, not location", async () => {
  const source = code(await readFile(repo("app/portal/portal-access-log.server.ts"), "utf8"));
  // An IP address or user agent would turn a dispute record into a
  // surveillance record, and answers no question the account address doesn't.
  assert.doesNotMatch(source, /ip_address|user_agent|x-forwarded-for/i);
});
