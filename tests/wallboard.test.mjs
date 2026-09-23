import assert from "node:assert/strict";
import test from "node:test";

// Coverage for the pure wallboard projection (app/admin/wallboard-data.ts):
// the API route and the TV client both render exactly what this builder
// computes, so the tests pin counts, blocker ranking, NPT bucketing and the
// zero/quiet behaviour.

import { buildWallboard } from "../app/admin/wallboard-data.ts";
import { nptDayStart } from "../app/admin/notifications/transition-metrics.ts";

function job(overrides = {}) {
  return {
    reference: "KCPL-S-0001",
    quote_reference: "",
    customer_id: null,
    customer_name: "Himalaya Textiles",
    origin: "Busan",
    destination: "Birgunj",
    mode: "ocean",
    status: "in_transit",
    primary_branch: "Birgunj",
    handling_branches: [],
    assigned_to_uid: "u1",
    assigned_to_name: "Sunita Shrestha",
    assigned_to_email: "sunita@kcpl.test",
    assigned_to_phone: null,
    priority: "standard",
    eta: null,
    current_location: null,
    carrier: "HMM",
    open_tasks: 0,
    overdue_tasks: 0,
    required_customs_open: 0,
    required_customs_total: 3,
    updated_at: "2026-09-21T04:00:00.000Z",
    latest_activity_at: null,
    ...overrides,
  };
}

function snapshot(jobs, overrides = {}) {
  return {
    partial: false,
    generated_at: "2026-09-21T04:00:00.000Z",
    operational_date: "2026-09-21",
    accessible_branches: ["Birgunj"],
    totals: {
      active_jobs: jobs.length,
      urgent_jobs: 0,
      overdue_tasks: 0,
      customs_blockers: 0,
      deliveries_today: 0,
      unassigned_jobs: 0,
      exception_jobs: 0,
    },
    jobs,
    branch_load: [],
    staff_load: [],
    ...overrides,
  };
}

function notification(overrides = {}) {
  return {
    id: "n1",
    source: "direct",
    source_id: "KCPL-S-0001:in_transit:customs_clearance",
    source_type: "register-transition",
    category: "activity",
    severity: "warning",
    title: "KCPL-S-0001 → Customs clearance",
    detail: "Status moved from In transit to Customs clearance.",
    action_path: "/admin/shipments?selected=KCPL-S-0001",
    branch: "Birgunj",
    created_at: "2026-09-21T04:00:00.000Z",
    resolved: false,
    read_at: null,
    ...overrides,
  };
}

test("pulse counts exclude delivered shipments and read statuses directly", () => {
  const data = snapshot([
    job({ reference: "A", status: "in_transit" }),
    job({ reference: "B", status: "out_for_delivery" }),
    job({ reference: "C", status: "customs_clearance" }),
    job({ reference: "D", status: "exception" }),
    job({ reference: "E", status: "delivered" }),
    job({ reference: "F", status: "preparing", assigned_to_uid: null, assigned_to_name: null, assigned_to_email: null }),
  ]);
  const board = buildWallboard(data, [], new Date("2026-09-21T04:00:00.000Z"));
  const pulse = Object.fromEntries(board.pulse.map((metric) => [metric.key, metric.value]));
  assert.equal(pulse.in_transit, 1);
  assert.equal(pulse.out_for_delivery, 1);
  assert.equal(pulse.customs_clearance, 1);
  assert.equal(pulse.attention, 1);
  assert.equal(pulse.delivered_today, 0);
  assert.equal(pulse.unassigned, 1);
  assert.equal(board.totals.active, 5);
});

test("blockers reuse the register next-action policy and cap at 10", () => {
  const jobs = Array.from({ length: 12 }, (_, index) =>
    job({ reference: `KCPL-S-${String(index + 1).padStart(4, "0")}`, status: "exception" }));
  const board = buildWallboard(snapshot(jobs), [], new Date("2026-09-21T04:00:00.000Z"));
  assert.equal(board.blockers.length, 10);
  for (const blocker of board.blockers) {
    assert.equal(blocker.label, "Exception");
    assert.equal(blocker.tone, "danger");
  }
});

test("calm board: no attention-needed shipments means an empty blocker list", () => {
  const board = buildWallboard(snapshot([job({ status: "in_transit" })]), [], new Date("2026-09-21T04:00:00.000Z"));
  assert.deepEqual(board.blockers, []);
});

test("today lists derive from ETA day and register work fields", () => {
  const now = new Date("2026-09-21T04:00:00.000Z");
  // 2026-09-21 NPT day start in UTC ms.
  const dayStart = nptDayStart(now.toISOString());
  const data = snapshot([
    job({ reference: "ARR", eta: new Date(dayStart + 3_600_000).toISOString() }),
    job({ reference: "DUE", overdue_tasks: 2 }),
    job({ reference: "CUS", required_customs_open: 1 }),
  ]);
  const board = buildWallboard(data, [], now);
  assert.deepEqual(board.arrivals.map((row) => row.reference), ["ARR"]);
  assert.deepEqual(board.dueToday.map((row) => row.reference).sort(), ["CUS", "DUE"]);
  assert.equal(board.dueToday.find((row) => row.reference === "DUE").label, "2 overdue tasks");
});
test("delivered-today derives from status + eta day, not just status", () => {
  const now = new Date("2026-09-21T04:00:00.000Z");
  const dayStart = nptDayStart(now.toISOString());
  const data = snapshot([
    job({ reference: "DONE", status: "delivered", eta: new Date(dayStart + 7_200_000).toISOString() }),
    job({ reference: "OLD", status: "delivered", eta: new Date(dayStart - 86_400_000).toISOString() }),
  ]);
  const board = buildWallboard(data, [], now);
  assert.deepEqual(board.deliveries.map((row) => row.reference), ["DONE"]);
  assert.equal(board.pulse.find((metric) => metric.key === "delivered_today").value, 1);
});

test("transition buckets follow NPT day boundaries across the 7-day window", () => {
  const now = new Date("2026-09-21T04:00:00.000Z");
  const dayStart = nptDayStart(now.toISOString());
  const notifications = [
    notification({ id: "t0", created_at: new Date(dayStart + 3_600_000).toISOString() }),      // today
    notification({ id: "t0b", created_at: new Date(dayStart + 7_200_000).toISOString() }),     // today
    notification({ id: "t1", created_at: new Date(dayStart - 86_400_000 + 3_600_000).toISOString() }), // yesterday
    notification({ id: "t6", created_at: new Date(dayStart - 6 * 86_400_000 + 3_600_000).toISOString() }), // 6 days ago
    notification({ id: "t7", created_at: new Date(dayStart - 7 * 86_400_000 + 3_600_000).toISOString() }), // out of window
    notification({ id: "other", source_type: "assignment", category: "assignments", created_at: new Date(dayStart + 3_600_000).toISOString() }), // not a transition
  ];
  const board = buildWallboard(snapshot([]), notifications, now);
  assert.deepEqual(board.transitions7d, [1, 0, 0, 0, 0, 1, 2]);
  assert.equal(board.transitionsToday.length, 2);
  assert.equal(board.transitionsToday[0].title, "KCPL-S-0001 → Customs clearance");
});

test("branch rows surface urgent/overdue load and skip quiet branches", () => {
  const data = snapshot([], {
    branch_load: [
      { branch: "Birgunj", active_jobs: 9, urgent_jobs: 2, overdue_tasks: 1, customs_blockers: 1, deliveries_today: 0 },
      { branch: "Kathmandu", active_jobs: 0, urgent_jobs: 0, overdue_tasks: 0, customs_blockers: 0, deliveries_today: 0 },
    ],
  });
  const board = buildWallboard(data, [], new Date("2026-09-21T04:00:00.000Z"));
  assert.deepEqual(board.branches.map((entry) => entry.branch), ["Birgunj"]);
  assert.equal(board.branches[0].urgent, 2);
});
