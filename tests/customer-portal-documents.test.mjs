import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  customerUploadableDocumentTypes,
  portalCanUploadDocumentType,
  portalDocumentChecklist,
  portalDocumentVisibleToSender,
  portalOutstandingUploads,
} from "../app/portal/portal-access-policy.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

/** Assertions about what a module *does* must not be satisfied or broken by what
 * it explains, so comments are stripped before matching. */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ------------------------------------------------------------------ *
 * What a customer may send
 * ------------------------------------------------------------------ */

test("a customer may only send the papers a shipper originates", () => {
  for (const allowed of ["commercial_invoice", "packing_list", "certificate_of_origin", "insurance_certificate"]) {
    assert.equal(portalCanUploadDocumentType(allowed), true, allowed);
  }
  // Produced by KCPL, a carrier or an authority. Accepting a customer's copy
  // would put a document KCPL did not issue into the same vault as ones it did.
  for (const refused of ["bill_of_lading", "air_waybill", "delivery_order", "cargo_manifest", "customs_document", "proof_of_delivery", "pickup_order", "shipping_instruction"]) {
    assert.equal(portalCanUploadDocumentType(refused), false, refused);
  }
  assert.equal(portalCanUploadDocumentType("anything_else"), false);
  assert.equal(portalCanUploadDocumentType(undefined), false);
});

/* ------------------------------------------------------------------ *
 * Checklist derivation
 * ------------------------------------------------------------------ */

const requirement = (document_type, required = true) => ({ document_type, required, reason: "seeded" });

function checklistFor(documents, requirements = [requirement("commercial_invoice")]) {
  return portalDocumentChecklist({ requirements, documents, now: new Date("2026-09-19T00:00:00.000Z") });
}

test("a required line with nothing supplied reads as needed", () => {
  const [row] = checklistFor([]);
  assert.equal(row.state, "needed");
  assert.equal(row.required, true);
  assert.equal(row.uploadable, true);
  assert.equal(row.submitted_count, 0);
  assert.equal(row.last_submitted_at, null);
});

test("supplied paperwork waits with KCPL until it is verified", () => {
  assert.equal(checklistFor([{ document_type: "commercial_invoice", review_status: "received", uploaded_at: "2026-09-18T00:00:00.000Z" }])[0].state, "with_kcpl");
  assert.equal(checklistFor([{ document_type: "commercial_invoice", review_status: "under_review" }])[0].state, "with_kcpl");
});

test("verification confirms a line, and expiry un-confirms it", () => {
  assert.equal(checklistFor([{ document_type: "commercial_invoice", review_status: "verified" }])[0].state, "confirmed");
  assert.equal(checklistFor([{ document_type: "commercial_invoice", review_status: "verified", expires_on: "2026-09-19" }])[0].state, "confirmed");
  // Expired yesterday: no longer evidence, so the line is outstanding again.
  assert.equal(checklistFor([{ document_type: "commercial_invoice", review_status: "verified", expires_on: "2026-09-18" }])[0].state, "needed");
});

test("a rejected document asks the customer to send it again", () => {
  assert.equal(checklistFor([{ document_type: "commercial_invoice", review_status: "rejected" }])[0].state, "resend");
});

test("a fresh submission outranks an earlier rejection", () => {
  const row = checklistFor([
    { document_type: "commercial_invoice", review_status: "rejected", uploaded_at: "2026-09-10T00:00:00.000Z" },
    { document_type: "commercial_invoice", review_status: "received", uploaded_at: "2026-09-18T00:00:00.000Z" },
  ])[0];
  assert.equal(row.state, "with_kcpl");
  assert.equal(row.submitted_count, 2);
  assert.equal(row.last_submitted_at, "2026-09-18T00:00:00.000Z");
});

test("superseded and deleted copies are history, not evidence", () => {
  assert.equal(checklistFor([{ document_type: "commercial_invoice", review_status: "superseded" }])[0].state, "needed");
  assert.equal(checklistFor([{ document_type: "commercial_invoice", review_status: "verified", deleted_at: "2026-09-01T00:00:00.000Z" }])[0].state, "needed");
});

test("the checklist never carries the staff review note", () => {
  const [row] = checklistFor([{
    document_type: "commercial_invoice",
    review_status: "rejected",
    review_note: "Illegible scan — chase the branch manager about this account",
    reviewed_by_email: "ops@kcpl.test",
  }]);
  assert.equal(JSON.stringify(row).includes("chase the branch manager"), false);
  for (const leaked of ["review_note", "reviewed_by", "reviewed_by_email"]) {
    assert.equal(leaked in row, false, `${leaked} must not reach a customer`);
  }
});

test("lines KCPL produces itself are listed but not uploadable", () => {
  const [row] = checklistFor([], [requirement("bill_of_lading")]);
  assert.equal(row.state, "needed");
  assert.equal(row.uploadable, false, "a customer cannot satisfy a carriage document");
});

test("outstanding work sorts to the top", () => {
  const rows = portalDocumentChecklist({
    requirements: [requirement("insurance_certificate"), requirement("commercial_invoice"), requirement("packing_list")],
    documents: [
      { document_type: "insurance_certificate", review_status: "verified" },
      { document_type: "commercial_invoice", review_status: "rejected" },
    ],
    now: new Date("2026-09-19T00:00:00.000Z"),
  });
  assert.deepEqual(rows.map((row) => row.state), ["needed", "resend", "confirmed"]);
});

test("outstanding uploads are the required lines a customer can actually satisfy", () => {
  const rows = portalDocumentChecklist({
    requirements: [
      requirement("commercial_invoice"),
      requirement("bill_of_lading"),
      requirement("packing_list", false),
      requirement("insurance_certificate"),
    ],
    documents: [{ document_type: "insurance_certificate", review_status: "verified" }],
    now: new Date("2026-09-19T00:00:00.000Z"),
  });
  const outstanding = portalOutstandingUploads(rows).map((row) => row.document_type);
  assert.deepEqual(outstanding, ["commercial_invoice"], "not the carriage document, not the optional line, not the confirmed one");
});

/* ------------------------------------------------------------------ *
 * Visibility of a customer's own submission
 * ------------------------------------------------------------------ */

test("a customer sees the document they sent before KCPL releases it", () => {
  const sent = { uploaded_by_source: "customer_portal", review_status: "received", customer_safe: false };
  assert.equal(portalDocumentVisibleToSender(sent), true, "withholding it would hide their own paperwork from them");
  // A staff document with no release is still withheld.
  assert.equal(portalDocumentVisibleToSender({ uploaded_by_source: "staff", review_status: "verified", customer_safe: false }), false);
  assert.equal(portalDocumentVisibleToSender({ uploaded_by_source: "staff", review_status: "verified", customer_safe: true }), true);
});

test("a withdrawn submission stops being visible", () => {
  assert.equal(portalDocumentVisibleToSender({ uploaded_by_source: "customer_portal", review_status: "deleted" }), false);
  assert.equal(portalDocumentVisibleToSender({ uploaded_by_source: "customer_portal", deleted_at: "2026-09-01T00:00:00.000Z" }), false);
});

/* ------------------------------------------------------------------ *
 * Route wiring
 * ------------------------------------------------------------------ */

test("the upload route proves ownership and type before it stores anything", async () => {
  const source = await readFile(repo("app/api/portal/documents/[reference]/route.ts"), "utf8");
  const ownership = source.indexOf("portalOwnsShipment");
  const typeGate = source.indexOf("portalCanUploadDocumentType");
  const signature = source.indexOf("validateShipmentDocumentBytes");
  const store = source.indexOf("uploadShipmentDocument(");
  assert.ok(ownership > 0 && ownership < store, "ownership is checked before storing");
  assert.ok(typeGate > 0 && typeGate < store, "the document type is checked before storing");
  assert.ok(signature > 0 && signature < store, "the bytes are sniffed before storing");
  assert.match(source, /isTrustedSameOriginRequest/);
  assert.match(source, /capabilities\.canSubmitRequests/);
});

test("a customer upload is evidence awaiting review, never verified paperwork", async () => {
  const source = code(await readFile(repo("app/api/portal/documents/[reference]/route.ts"), "utf8"));
  assert.match(source, /source: "customer_portal"/);
  // The route must not be able to set its own review state or release itself.
  assert.doesNotMatch(source, /customerSafe|customer_safe/);
  assert.doesNotMatch(source, /review_status/);
  // Replacing KCPL's copy of a document is a staff decision.
  assert.doesNotMatch(source, /supersedes/i);
});

test("the shared uploader still files every upload as unreleased and unreviewed", async () => {
  const source = await readFile(repo("app/shipment-documents.server.ts"), "utf8");
  assert.match(source, /review_status: "received",\n\s*customer_safe: false,/);
  assert.match(source, /uploaded_by_source: source/);
});

test("the portal's own upload ceiling is narrower than the staff vault's", async () => {
  const [policy, staffRoute] = await Promise.all([
    readFile(repo("app/portal/portal-access-policy.ts"), "utf8"),
    readFile(repo("app/api/admin/shipments/[reference]/documents/route.ts"), "utf8"),
  ]);
  const portalMb = Number(/PORTAL_UPLOAD_MAX_BYTES = (\d+)/.exec(policy)?.[1]);
  const staffMb = Number(/MAX_FILE_BYTES = (\d+)/.exec(staffRoute)?.[1]);
  assert.ok(portalMb > 0 && staffMb > 0);
  assert.ok(portalMb < staffMb, "a customer sends a photo or a PDF, not a scan batch");
});

test("every uploadable type is a real shipment document type", async () => {
  const source = await readFile(repo("app/shipment-document-types.ts"), "utf8");
  for (const type of customerUploadableDocumentTypes) {
    assert.match(source, new RegExp(`"${type}"`), `${type} must exist in the shipment document vocabulary`);
  }
});
