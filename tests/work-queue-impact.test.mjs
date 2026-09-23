import assert from "node:assert/strict";
import test from "node:test";

import {
  compareWorkQueueImpact,
  dwellStress,
  receivableExposureWeight,
  slaStress,
  workQueueImpact,
} from "../app/admin/command-centre/work-queue-impact.ts";

function job(overrides = {}) {
  return {
    reference: "KCPL-TEST-1",
    quote_reference: "",
    customer_id: "CUST-1",
    customer_name: "Test Customer",
    origin: "Kolkata",
    destination: "Birgunj",
    mode: "ocean",
    status: "customs_clearance",
    primary_branch: "Birgunj",
    handling_branches: ["Birgunj"],
    assigned_to_uid: "u1",
    assigned_to_name: "Owner",
    assigned_to_email: "owner@kcpl.test",
    assigned_to_phone: null,
    priority: "standard",
    eta: null,
    current_location: null,
    carrier: null,
    open_tasks: 0,
    overdue_tasks: 0,
    required_customs_open: 0,
    required_customs_total: 0,
    updated_at: "2026-09-01T06:00:00.000Z",
    latest_activity_at: "2026-09-01T06:00:00.000Z",
    ...overrides,
  };
}

const exposure = (npr) => ({ balances: { NPR: npr } });
const NOW = new Date("2026-09-15T06:00:00.000Z");
const TODAY = "2026-09-15";

test("a shipment that needs no attention has zero impact and never ranks", () => {
  const quiet = workQueueImpact({ job: job({ status: "in_transit", overdue_tasks: 0, required_customs_open: 0, priority: "standard" }), exposure: exposure(999999), operationalDate: TODAY, now: NOW });
  assert.equal(quiet.score, 0);
  assert.deepEqual(quiet.factors, []);
});

test("exposure weight scales with the largest single-currency balance and stays neutral at zero", () => {
  assert.equal(receivableExposureWeight(exposure(0)).weight, 1);
  assert.equal(receivableExposureWeight(exposure(40000)).weight, 1);
  assert.equal(receivableExposureWeight(exposure(60000)).weight, 1.15);
  assert.equal(receivableExposureWeight(exposure(300000)).weight, 1.3);
  assert.equal(receivableExposureWeight(exposure(2000000)).weight, 1.45);
  // No customer record and no invoices must never inflate or crash.
  assert.equal(receivableExposureWeight(null).weight, 1);
  // Two mid currencies must not sum into a top tier — no cross-currency arithmetic.
  assert.equal(receivableExposureWeight({ balances: { NPR: 40000, INR: 40000 } }).weight, 1);
});

test("SLA stress peaks when the ETA is already missed", () => {
  assert.equal(slaStress({ eta: null, operationalDate: TODAY }).weight, 1);
  assert.equal(slaStress({ eta: `${TODAY}T10:00:00.000Z`, operationalDate: TODAY }).weight, 1.3);
  assert.equal(slaStress({ eta: `${TODAY}T10:00:00.000Z`, operationalDate: "2026-09-13" }).weight, 1.15);
  assert.equal(slaStress({ eta: "2026-09-13T10:00:00.000Z", operationalDate: TODAY }).weight, 1.4);
  assert.equal(slaStress({ eta: "not-a-date", operationalDate: TODAY }).weight, 1);
});

test("dwell treats silence as staleness, including a missing timeline", () => {
  assert.equal(dwellStress({ latestActivityAt: null, now: NOW }).label, "Silent 30d");
  assert.equal(dwellStress({ latestActivityAt: "2026-09-01T06:00:00.000Z", now: NOW }).weight, 1.2);
  assert.equal(dwellStress({ latestActivityAt: "2026-09-12T06:00:00.000Z", now: NOW }).weight, 1.1);
  assert.equal(dwellStress({ latestActivityAt: `${TODAY}T06:00:00.000Z`, now: NOW }).weight, 1);
});

test("impact multiplies the severity ladder; heavy factors can promote, equal factors cannot", () => {
  // Same 600-rank exception, two exposure levels: higher money ranks first and scales exactly.
  const base = { status: "exception", overdue_tasks: 0, required_customs_open: 0 };
  const poor = workQueueImpact({ job: job({ ...base, customer_id: "CUST-1" }), exposure: exposure(10000), operationalDate: TODAY, now: NOW });
  const rich = workQueueImpact({ job: job({ ...base, customer_id: "CUST-1" }), exposure: exposure(2000000), operationalDate: TODAY, now: NOW });
  assert.ok(rich.score > poor.score);
  assert.equal(rich.tier, "critical");
  // With equal multipliers the severity ladder is the whole order.
  const exceptionCalm = workQueueImpact({ job: job({ ...base }), exposure: null, operationalDate: TODAY, now: NOW });
  const customsCalm = workQueueImpact({ job: job({ status: "customs_clearance", required_customs_open: 2, overdue_tasks: 0 }), exposure: null, operationalDate: TODAY, now: NOW });
  assert.ok(exceptionCalm.score > customsCalm.score);
  // A maximum-exposure customs blocker MAY rise above a neutrally-weighted
  // overdue task — that promotion is the point of impact ranking — while an
  // equally-weighted exception still stays above it.
  const customsRich = workQueueImpact({ job: job({ status: "customs_clearance", required_customs_open: 2, overdue_tasks: 0 }), exposure: exposure(2000000), operationalDate: TODAY, now: NOW });
  const overduePlain = workQueueImpact({ job: job({ status: "in_transit", overdue_tasks: 1, required_customs_open: 0 }), exposure: null, operationalDate: TODAY, now: NOW });
  assert.ok(customsRich.score > overduePlain.score);
  assert.ok(exceptionCalm.score > customsRich.score);
});

test("tier boundaries come from the score, and factors sort worst-first", () => {
  const result = workQueueImpact({ job: job({ overdue_tasks: 2 }), exposure: exposure(60000), operationalDate: TODAY, now: NOW });
  const weights = result.factors.map((factor) => factor.weight);
  assert.deepEqual(weights, [...weights].sort((a, b) => b - a));
  // Unassigned (rank 300) with a silent timeline lands in moderate; a mere
  // high-priority flag (rank 100) stays at monitor.
  const moderate = workQueueImpact({ job: job({ status: "in_transit", assigned_to_uid: null, assigned_to_name: null, assigned_to_email: null }), exposure: null, operationalDate: TODAY, now: NOW });
  assert.equal(moderate.tier, "moderate");
  const monitor = workQueueImpact({ job: job({ status: "in_transit", priority: "high" }), exposure: null, operationalDate: TODAY, now: NOW });
  assert.equal(monitor.tier, "monitor");
});

test("impact comparison orders the queue by score, then severity, then reference", () => {
  const context = {
    exposureByCustomer: new Map([["CUST-1", exposure(2000000)]]),
    operationalDate: TODAY,
    now: NOW,
  };
  const rich = job({ reference: "KCPL-B", customer_id: "CUST-1", overdue_tasks: 1 });
  const poor = job({ reference: "KCPL-A", customer_id: "CUST-2", overdue_tasks: 1 });
  const list = [poor, rich].sort((a, b) => compareWorkQueueImpact(a, b, context));
  assert.equal(list[0].reference, "KCPL-B");
  // Perfect tie falls back to severity then reference for stable output.
  const tie = [job({ reference: "KCPL-2", customer_id: "CUST-2" }), job({ reference: "KCPL-1", customer_id: "CUST-2" })].sort((a, b) => compareWorkQueueImpact(a, b, context));
  assert.equal(tie[0].reference, "KCPL-1");
});
