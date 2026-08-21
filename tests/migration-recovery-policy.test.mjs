import test from "node:test";
import assert from "node:assert/strict";
import {
  batchStatusCanRecover,
  confirmationMatches,
  migrationActivityOnly,
  migrationPaymentsOnly,
  migrationSeededChecklistOnly,
  recoveryConfirmationText,
  recoveryRecordKey,
  recordUntouched,
  sameMigrationBatch,
} from "../app/admin/migration/recovery/recovery-policy.ts";

test("recovery only accepts completed or failed migration states", () => {
  assert.equal(batchStatusCanRecover("completed"), true);
  assert.equal(batchStatusCanRecover("partial_failure"), true);
  assert.equal(batchStatusCanRecover("interrupted"), true);
  assert.equal(batchStatusCanRecover("running"), false);
  assert.equal(batchStatusCanRecover("unknown"), false);
});

test("destructive confirmation is batch specific", () => {
  assert.equal(recoveryConfirmationText("mig-ar-123"), "ROLLBACK MIG-AR-123");
  assert.equal(confirmationMatches("MIG-AR-123", "ROLLBACK MIG-AR-123"), true);
  assert.equal(confirmationMatches("MIG-AR-123", "ROLLBACK MIG-AR-124"), false);
});

test("migration ownership fails closed", () => {
  assert.equal(sameMigrationBatch("MIG-A", "mig-a"), true);
  assert.equal(sameMigrationBatch("MIG-A", "MIG-B"), false);
  assert.equal(sameMigrationBatch("MIG-A", null), false);
});

test("edited records are not considered untouched", () => {
  assert.equal(recordUntouched("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"), true);
  assert.equal(recordUntouched("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"), false);
});

test("only migration adjustments are safe payment history", () => {
  assert.equal(migrationPaymentsOnly([{ migration_batch_id: "MIG-A" }], "MIG-A"), true);
  assert.equal(migrationPaymentsOnly([{ migration_batch_id: "MIG-A" }, { migration_batch_id: "MIG-B" }], "MIG-A"), false);
});

test("workflow tasks and customs must remain migration-seeded and incomplete", () => {
  assert.equal(migrationSeededChecklistOnly([{ migration_seeded: true, completed: false }]), true);
  assert.equal(migrationSeededChecklistOnly([{ migration_seeded: true, completed: true }]), false);
  assert.equal(migrationSeededChecklistOnly([{ migration_seeded: false, completed: false }]), false);
});

test("Stage 2 shipment activity accepts only its original seed event", () => {
  assert.equal(migrationActivityOnly([{ type: "active_shipment_imported", detail: "Stage 2 migration batch MIG-SHIP-1 · source row 2." }], "MIG-SHIP-1"), true);
  assert.equal(migrationActivityOnly([{ type: "milestone_changed", detail: "Progressed by staff" }], "MIG-SHIP-1"), false);
  assert.equal(migrationActivityOnly([
    { type: "active_shipment_imported", detail: "Stage 2 migration batch MIG-SHIP-1 · source row 2." },
    { type: "milestone_changed", detail: "Progressed by staff" },
  ], "MIG-SHIP-1"), false);
});

test("recovery record keys are deterministic", () => {
  assert.equal(recoveryRecordKey("shipment", "KCPL-S-1"), "shipment:KCPL-S-1");
});
