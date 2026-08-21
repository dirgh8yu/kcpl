import assert from "node:assert/strict";
import test from "node:test";

import { customsDeskRisk, customsDeskState, validCustomsDateOnly } from "../app/admin/customs/customs-policy.ts";

test("missing customs documents block clearance even when checklist steps are complete", () => {
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 0, missingDocuments: 1, integrityIssues: 0, shipmentInCustoms: true }), "blocked");
});

test("open customs steps stay in progress when the document pack is complete", () => {
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 1, missingDocuments: 0, integrityIssues: 0, shipmentInCustoms: true }), "in_progress");
});

test("completed customs work is ready to advance and data integrity defects block it", () => {
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 0, missingDocuments: 0, integrityIssues: 0, shipmentInCustoms: true }), "ready");
  assert.equal(customsDeskState({ requiredSteps: 3, openSteps: 0, missingDocuments: 0, integrityIssues: 1, shipmentInCustoms: true }), "blocked");
});

test("customs risk escalates only when unresolved work is operationally urgent", () => {
  assert.equal(customsDeskRisk({ status: "customs_clearance", openSteps: 1, missingDocuments: 0, integrityIssues: 0, etaDays: 5 }), "warning");
  assert.equal(customsDeskRisk({ status: "in_transit", openSteps: 0, missingDocuments: 1, integrityIssues: 0, etaDays: 0 }), "critical");
  assert.equal(customsDeskRisk({ status: "out_for_delivery", openSteps: 0, missingDocuments: 0, integrityIssues: 1, etaDays: null }), "critical");
  assert.equal(customsDeskRisk({ status: "customs_clearance", openSteps: 0, missingDocuments: 0, integrityIssues: 0, etaDays: 0 }), "normal");
});

test("customs calendar dates reject impossible values", () => {
  assert.equal(validCustomsDateOnly("2026-02-31"), false);
  assert.equal(validCustomsDateOnly("2026-02-28"), true);
  assert.equal(validCustomsDateOnly("2026-13-01"), false);
});
