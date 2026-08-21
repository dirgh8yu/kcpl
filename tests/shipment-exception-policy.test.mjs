import assert from "node:assert/strict";
import test from "node:test";

import {
  shipmentExceptionIsOverdue,
  shipmentExceptionResolutionValid,
  shipmentExceptionSlaDue,
  shipmentExceptionTransitionAllowed,
  summarizeShipmentExceptions,
} from "../app/admin/shipment-exceptions.ts";

function exception(overrides = {}) {
  return {
    id: "EX-1",
    reference: "KCPL-TEST-1",
    category: "delay",
    severity: "medium",
    status: "open",
    title: "Connection missed",
    detail: "Container missed the planned connection.",
    operational_impact: null,
    branch: "Kathmandu",
    assigned_to_name: null,
    assigned_to_email: null,
    sla_due_at: "2026-08-22T10:00:00.000Z",
    opened_at: "2026-08-21T10:00:00.000Z",
    opened_by_name: "KCPL Staff",
    opened_by_email: "staff@example.com",
    updated_at: "2026-08-21T10:00:00.000Z",
    updated_by_name: "KCPL Staff",
    updated_by_email: "staff@example.com",
    resolved_at: null,
    resolved_by_name: null,
    resolved_by_email: null,
    resolution: null,
    ...overrides,
  };
}

test("exception severity produces fixed server-side SLA windows", () => {
  const opened = "2026-08-21T00:00:00.000Z";
  assert.equal(shipmentExceptionSlaDue(opened, "critical"), "2026-08-21T02:00:00.000Z");
  assert.equal(shipmentExceptionSlaDue(opened, "high"), "2026-08-21T06:00:00.000Z");
  assert.equal(shipmentExceptionSlaDue(opened, "medium"), "2026-08-22T00:00:00.000Z");
  assert.equal(shipmentExceptionSlaDue(opened, "low"), "2026-08-24T00:00:00.000Z");
  assert.equal(shipmentExceptionSlaDue("not-a-date", "critical"), null);
});

test("open and monitoring cases can progress but resolved cases are terminal", () => {
  assert.equal(shipmentExceptionTransitionAllowed("open", "monitoring"), true);
  assert.equal(shipmentExceptionTransitionAllowed("open", "resolved"), true);
  assert.equal(shipmentExceptionTransitionAllowed("monitoring", "open"), true);
  assert.equal(shipmentExceptionTransitionAllowed("monitoring", "resolved"), true);
  assert.equal(shipmentExceptionTransitionAllowed("resolved", "open"), false);
  assert.equal(shipmentExceptionTransitionAllowed("resolved", "monitoring"), false);
});

test("resolution evidence is required before a case can be resolved", () => {
  assert.equal(shipmentExceptionResolutionValid("open", ""), true);
  assert.equal(shipmentExceptionResolutionValid("monitoring", ""), true);
  assert.equal(shipmentExceptionResolutionValid("resolved", "too short"), false);
  assert.equal(shipmentExceptionResolutionValid("resolved", "Carrier rebooked cargo and confirmed uplift."), true);
});

test("resolved cases never remain SLA-overdue", () => {
  const now = "2026-08-23T00:00:00.000Z";
  assert.equal(shipmentExceptionIsOverdue(exception(), now), true);
  assert.equal(shipmentExceptionIsOverdue(exception({ status: "resolved" }), now), false);
});

test("exception summary separates active severity and SLA exposure", () => {
  const now = "2026-08-23T00:00:00.000Z";
  const cases = [
    exception({ id: "A", severity: "critical", status: "open" }),
    exception({ id: "B", severity: "high", status: "monitoring", sla_due_at: "2026-08-24T00:00:00.000Z" }),
    exception({ id: "C", severity: "critical", status: "resolved" }),
  ];
  const summary = summarizeShipmentExceptions(cases, now);
  assert.deepEqual(summary, {
    total: 3,
    open: 1,
    monitoring: 1,
    resolved: 1,
    critical_open: 1,
    high_open: 1,
    overdue_open: 1,
  });
});
