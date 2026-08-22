import test from "node:test";
import assert from "node:assert/strict";
import {
  activeWorkspace,
  groupedWorkspaces,
  visibleWorkspaces,
  workflowWorkspaces,
} from "../app/admin/workflow-navigation.ts";

const full = {
  canViewCommercial: true,
  canManageJobFile: true,
  canManageFinance: true,
  canManageStaff: true,
  isManagement: true,
};

test("workflow navigation contains every current TMS handoff workspace", () => {
  const ids = new Set(workflowWorkspaces.map((workspace) => workspace.id));
  for (const required of ["rating", "pricing", "consolidation", "tenders", "shipments", "visibility", "delivery", "freight-audit", "payables"]) {
    assert.equal(ids.has(required), true, `${required} should be globally discoverable`);
  }
});

test("operations-only staff do not see commercial or finance workspaces", () => {
  const visible = new Set(visibleWorkspaces({ canViewCommercial: false, canManageJobFile: true, canManageFinance: false, canManageStaff: false, isManagement: false }).map((workspace) => workspace.id));
  assert.equal(visible.has("shipments"), true);
  assert.equal(visible.has("visibility"), true);
  assert.equal(visible.has("delivery"), true);
  assert.equal(visible.has("rating"), false);
  assert.equal(visible.has("pricing"), false);
  assert.equal(visible.has("freight-audit"), false);
});

test("finance workspaces require finance capability", () => {
  const withoutFinance = new Set(visibleWorkspaces({ ...full, canManageFinance: false }).map((workspace) => workspace.id));
  assert.equal(withoutFinance.has("payables"), false);
  assert.equal(withoutFinance.has("freight-audit"), false);
  const withFinance = new Set(visibleWorkspaces(full).map((workspace) => workspace.id));
  assert.equal(withFinance.has("payables"), true);
  assert.equal(withFinance.has("freight-audit"), true);
});

test("active workspace picks the most specific nested route", () => {
  assert.equal(activeWorkspace("/admin/jobs/KCPL-S-20260822-X", full)?.id, "shipments");
  assert.equal(activeWorkspace("/admin/partners/reconciliation", full)?.id, "supplier-reconciliation");
  assert.equal(activeWorkspace("/admin/migration/archive", full)?.id, "paper-archive");
});

test("menu groups follow operational pipeline order", () => {
  assert.deepEqual(groupedWorkspaces(full).map((group) => group.group), ["Operate", "Plan & Sell", "Network", "Finance", "Organisation"]);
});
