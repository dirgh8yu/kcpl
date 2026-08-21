import assert from "node:assert/strict";
import test from "node:test";

import {
  customsClearanceValidationError,
  customsDeskRisk,
  customsDeskState,
  customsReleaseRequired,
  validCustomsDateOnly,
} from "../app/admin/customs/customs-policy.ts";

test("missing customs documents block clearance even when checklist steps are complete", () => {
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 0, missingDocuments: 1, integrityIssues: 0, shipmentInCustoms: true, releaseRequired: true, clearanceStatus: "released" }), "blocked");
});

test("open customs steps stay in progress when the document pack is complete", () => {
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 1, missingDocuments: 0, integrityIssues: 0, shipmentInCustoms: true, releaseRequired: true, clearanceStatus: "lodged" }), "in_progress");
});

test("international checklist readiness never masquerades as Customs release", () => {
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 0, missingDocuments: 0, integrityIssues: 0, shipmentInCustoms: true, releaseRequired: true, clearanceStatus: "lodged" }), "awaiting_release");
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 0, missingDocuments: 0, integrityIssues: 0, shipmentInCustoms: true, releaseRequired: true, clearanceStatus: "released" }), "released");
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 0, missingDocuments: 0, integrityIssues: 0, shipmentInCustoms: true, releaseRequired: false, clearanceStatus: "not_started" }), "ready");
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 0, missingDocuments: 0, integrityIssues: 1, shipmentInCustoms: true, releaseRequired: true, clearanceStatus: "released" }), "blocked");
});

test("held clearance is a blocker and pending international release carries urgency", () => {
  assert.equal(customsDeskRisk({ status: "customs_clearance", openSteps: 0, missingDocuments: 0, integrityIssues: 0, etaDays: 5, releaseRequired: true, clearanceStatus: "held" }), "critical");
  assert.equal(customsDeskRisk({ status: "customs_clearance", openSteps: 0, missingDocuments: 0, integrityIssues: 0, etaDays: 5, releaseRequired: true, clearanceStatus: "lodged" }), "warning");
  assert.equal(customsDeskRisk({ status: "in_transit", openSteps: 0, missingDocuments: 0, integrityIssues: 0, etaDays: 0, releaseRequired: true, clearanceStatus: "lodged" }), "critical");
  assert.equal(customsDeskRisk({ status: "customs_clearance", openSteps: 0, missingDocuments: 0, integrityIssues: 0, etaDays: 0, releaseRequired: true, clearanceStatus: "released" }), "normal");
});

test("international directions require explicit customs release", () => {
  assert.equal(customsReleaseRequired("import"), true);
  assert.equal(customsReleaseRequired("export"), true);
  assert.equal(customsReleaseRequired("cross_trade"), true);
  assert.equal(customsReleaseRequired("domestic"), false);
  assert.equal(customsReleaseRequired("unknown"), false);
});

test("release confirmation requires a point and evidence while holds require a reason", () => {
  assert.match(customsClearanceValidationError({ status: "held", entryPoint: "", declarationReference: "", holdReason: "", releaseEvidence: "" }) ?? "", /why Customs/i);
  assert.match(customsClearanceValidationError({ status: "released", entryPoint: "", declarationReference: "ENTRY-1", holdReason: "", releaseEvidence: "" }) ?? "", /customs or border point/i);
  assert.match(customsClearanceValidationError({ status: "released", entryPoint: "Birgunj ICP", declarationReference: "", holdReason: "", releaseEvidence: "short" }) ?? "", /release-evidence/i);
  assert.equal(customsClearanceValidationError({ status: "released", entryPoint: "Birgunj ICP", declarationReference: "ENTRY-1", holdReason: "", releaseEvidence: "" }), null);
  assert.equal(customsClearanceValidationError({ status: "released", entryPoint: "TIA Customs", declarationReference: "", holdReason: "", releaseEvidence: "Release confirmed in customs portal" }), null);
});

test("customs calendar dates reject impossible values", () => {
  assert.equal(validCustomsDateOnly("2026-02-31"), false);
  assert.equal(validCustomsDateOnly("2026-02-28"), true);
  assert.equal(validCustomsDateOnly("2026-13-01"), false);
});
