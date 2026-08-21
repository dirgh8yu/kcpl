import assert from "node:assert/strict";
import test from "node:test";

import {
  canDeleteShipmentDocument,
  effectiveShipmentDocumentStatus,
  shipmentDocumentCountsAsReady,
  shipmentDocumentReviewStatusValue,
  shipmentDocumentTransitionError,
  validDateOnly,
  validateShipmentDocumentBytes,
} from "../app/shipment-document-policy.ts";

test("legacy documents default to received and never silently become verified", () => {
  assert.equal(shipmentDocumentReviewStatusValue(undefined), "received");
  assert.equal(shipmentDocumentCountsAsReady({ status: undefined, expiresOn: null, today: "2026-08-22" }), false);
});

test("only verified unexpired documents count toward readiness", () => {
  assert.equal(shipmentDocumentCountsAsReady({ status: "verified", expiresOn: null, today: "2026-08-22" }), true);
  assert.equal(shipmentDocumentCountsAsReady({ status: "verified", expiresOn: "2026-08-22", today: "2026-08-22" }), true);
  assert.equal(shipmentDocumentCountsAsReady({ status: "verified", expiresOn: "2026-08-21", today: "2026-08-22" }), false);
  assert.equal(effectiveShipmentDocumentStatus({ status: "verified", expiresOn: "2026-08-21", today: "2026-08-22" }), "expired");
  assert.equal(shipmentDocumentCountsAsReady({ status: "received", expiresOn: null, today: "2026-08-22" }), false);
  assert.equal(shipmentDocumentCountsAsReady({ status: "rejected", expiresOn: null, today: "2026-08-22" }), false);
  assert.equal(shipmentDocumentCountsAsReady({ status: "superseded", expiresOn: null, today: "2026-08-22" }), false);
  assert.equal(shipmentDocumentCountsAsReady({ status: "deleted", expiresOn: null, today: "2026-08-22" }), false);
});

test("operations cannot self-verify an upload and management can", () => {
  assert.match(shipmentDocumentTransitionError({
    from: "received",
    to: "verified",
    role: "operations",
    actorEmail: "ops@kcpl.test",
    uploadedByEmail: "ops@kcpl.test",
  }) ?? "", /cannot verify/i);

  assert.equal(shipmentDocumentTransitionError({
    from: "received",
    to: "verified",
    role: "operations",
    actorEmail: "reviewer@kcpl.test",
    uploadedByEmail: "uploader@kcpl.test",
  }), null);

  assert.equal(shipmentDocumentTransitionError({
    from: "received",
    to: "verified",
    role: "management",
    actorEmail: "manager@kcpl.test",
    uploadedByEmail: "manager@kcpl.test",
  }), null);
});

test("commercial and accounts roles cannot review operational shipment documents", () => {
  assert.match(shipmentDocumentTransitionError({ from: "received", to: "under_review", role: "commercial", actorEmail: "c@kcpl.test" }) ?? "", /Operations or Management/);
  assert.match(shipmentDocumentTransitionError({ from: "received", to: "verified", role: "accounts", actorEmail: "a@kcpl.test" }) ?? "", /Operations or Management/);
});

test("rejection requires a reason and impossible expiry dates fail", () => {
  assert.match(shipmentDocumentTransitionError({ from: "received", to: "rejected", role: "operations", actorEmail: "review@kcpl.test", uploadedByEmail: "upload@kcpl.test", reviewNote: "no" }) ?? "", /reason/i);
  assert.match(shipmentDocumentTransitionError({ from: "received", to: "under_review", role: "operations", actorEmail: "review@kcpl.test", expiresOn: "2026-02-31" }) ?? "", /expiry/i);
  assert.equal(validDateOnly("2028-02-29"), true);
  assert.equal(validDateOnly("2027-02-29"), false);
});

test("operations may delete only their own still-received upload", () => {
  assert.equal(canDeleteShipmentDocument({ role: "operations", actorEmail: "ops@kcpl.test", uploadedByEmail: "ops@kcpl.test", status: "received" }), true);
  assert.equal(canDeleteShipmentDocument({ role: "operations", actorEmail: "other@kcpl.test", uploadedByEmail: "ops@kcpl.test", status: "received" }), false);
  assert.equal(canDeleteShipmentDocument({ role: "operations", actorEmail: "ops@kcpl.test", uploadedByEmail: "ops@kcpl.test", status: "verified" }), false);
  assert.equal(canDeleteShipmentDocument({ role: "management", actorEmail: "manager@kcpl.test", uploadedByEmail: "ops@kcpl.test", status: "verified" }), true);
});

test("document signature checks reject extension spoofing", () => {
  assert.equal(validateShipmentDocumentBytes("pdf", new TextEncoder().encode("not a pdf")), "The file extension says PDF, but the file content is not a PDF.");
  assert.equal(validateShipmentDocumentBytes("pdf", new TextEncoder().encode("%PDF-1.7\n")), null);
  assert.equal(validateShipmentDocumentBytes("jpg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), null);
  assert.match(validateShipmentDocumentBytes("png", Uint8Array.from([1, 2, 3])) ?? "", /not a PNG/i);
  assert.match(validateShipmentDocumentBytes("txt", Uint8Array.from([65, 0, 66])) ?? "", /NUL/i);
});
