import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  mockCommandCentre,
  mockFinanceSnapshot,
  mockPickupWorkspace,
  mockVisibilityWorkspace,
  mockWorkflowOverview,
  qaMockDataEnabled,
} from "../app/admin/qa-fixtures.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");

const development = {
  KCPL_QA_MOCK_DATA: "true",
  KCPL_QA_AUTH_BYPASS: "true",
  NODE_ENV: "development",
};

// These fixtures put fabricated shipment counts, customer names and revenue on
// the Overview. That is fine for local design work and catastrophic in front of
// staff making operational decisions, so the negative cases are the point of
// this suite -- exactly as they are for the QA auth bypass it depends on.
test("mock data stays off unless its own flag is exactly \"true\"", () => {
  assert.equal(qaMockDataEnabled({}), false);
  assert.equal(qaMockDataEnabled({ NODE_ENV: "development" }), false);
  assert.equal(qaMockDataEnabled({ ...development, KCPL_QA_MOCK_DATA: undefined }), false);
  for (const value of ["1", "yes", "TRUE", "True", " true", "true "]) {
    assert.equal(
      qaMockDataEnabled({ ...development, KCPL_QA_MOCK_DATA: value }),
      false,
      `flag value ${JSON.stringify(value)} must not enable mock data`,
    );
  }
});

test("mock data can never activate in a production runtime", () => {
  assert.equal(qaMockDataEnabled({ ...development, NODE_ENV: "production" }), false);
  assert.equal(qaMockDataEnabled({ ...development, NODE_ENV: "test" }), false);
  assert.equal(qaMockDataEnabled({ ...development, NODE_ENV: undefined }), false);
  assert.equal(qaMockDataEnabled({ ...development, VERCEL_ENV: "production" }), false);
  assert.equal(
    qaMockDataEnabled({ KCPL_QA_MOCK_DATA: "true", VERCEL_ENV: "production" }),
    false,
  );
});

// The second switch is the load-bearing one: mock data must be a strict subset
// of QA-preview mode, so turning it on without the auth bypass does nothing.
test("mock data requires the QA auth bypass as well as its own flag", () => {
  assert.equal(
    qaMockDataEnabled({ KCPL_QA_MOCK_DATA: "true", NODE_ENV: "development" }),
    false,
    "the mock flag alone must not be enough",
  );
  assert.equal(qaMockDataEnabled(development), true);
  assert.equal(
    qaMockDataEnabled({ ...development, NODE_ENV: undefined, VERCEL_ENV: "preview" }),
    true,
  );
});

test("every loader gates its fixture behind qaMockDataEnabled", () => {
  const loaders = [
    "app/admin/command-centre/command-centre.server.ts",
    "app/admin/command-centre/workflow-overview.server.ts",
    "app/admin/command-centre/overview-finance.server.ts",
    "app/admin/command-centre/operational-notes.server.ts",
    "app/admin/pickups/pickup-appointments.server.ts",
    "app/admin/visibility/tracking-visibility.server.ts",
  ];
  for (const path of loaders) {
    const text = source(path);
    assert.match(text, /qaMockDataEnabled\(\)/, `${path}: fixture must be gated`);
    for (const line of text.split("\n")) {
      if (!/\bmock[A-Z]/.test(line)) continue;
      if (line.trimStart().startsWith("import")) continue;
      assert.match(
        line,
        /qaMockDataEnabled\(\)/,
        `${path}: a fixture is reachable without the gate: ${line.trim()}`,
      );
    }
  }
});

test("the fixtures are deterministic and carry no live randomness", () => {
  const text = source("app/admin/qa-fixtures.ts");
  // Matches a call, not a mention, so the file can document the rule it follows.
  assert.doesNotMatch(text, /Math\s*\.\s*random\s*\(/, "screenshots must be reproducible");

  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const staff = { can_access_all_branches: true, branches: [] };
  const first = mockCommandCentre(staff, now);
  const second = mockCommandCentre(staff, now);
  assert.deepEqual(first, second);

  // The totals are what the KPI row prints, so they must be derived from the
  // rows rather than typed in beside them.
  const active = first.jobs.filter((job) => job.status !== "delivered");
  assert.equal(first.totals.active_jobs, active.length);
  assert.equal(
    first.totals.unassigned_jobs,
    active.filter((job) => !job.assigned_to_email).length,
  );
  assert.equal(
    first.totals.overdue_tasks,
    active.reduce((total, job) => total + job.overdue_tasks, 0),
  );
});

test("the fixtures cover the states the Overview exists to surface", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const data = mockCommandCentre({ can_access_all_branches: true, branches: [] }, now);
  const statuses = new Set(data.jobs.map((job) => job.status));
  for (const status of ["in_transit", "customs_clearance", "out_for_delivery", "exception", "delivered"]) {
    assert.ok(statuses.has(status), `fixture is missing the ${status} state`);
  }
  assert.ok(data.totals.unassigned_jobs > 0, "an unassigned file must appear");
  assert.ok(data.totals.overdue_tasks > 0, "overdue work must appear");
  assert.ok(data.totals.customs_blockers > 0, "a customs blocker must appear");

  const workflow = mockWorkflowOverview(now);
  assert.ok(workflow.movements.length > 0);
  assert.ok(workflow.recent_activity.length > 0);

  // Finance totals drive the snapshot card; they must add up to the trend.
  for (const currency of mockFinanceSnapshot(now).currencies) {
    assert.equal(
      currency.revenue,
      currency.trend.reduce((total, point) => total + point.revenue, 0),
    );
    assert.equal(currency.profit, currency.revenue - currency.cost);
  }
});

// A QA environment whose pages disagree about the same shipment is worse than no
// fixture at all, so the workspaces must be derived from the same jobs.
test("the workspace fixtures describe the same shipments as the Overview", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const staff = { can_access_all_branches: true, branches: [] };
  const references = mockCommandCentre(staff, now).jobs.map((job) => job.reference);

  const pickups = mockPickupWorkspace(staff, now);
  const visibility = mockVisibilityWorkspace(staff, now);
  assert.equal(pickups.kind, "ready");
  assert.equal(visibility.kind, "ready");
  assert.deepEqual(pickups.rows.map((row) => row.shipment_reference), references);
  assert.deepEqual(visibility.rows.map((row) => row.reference), references);
});

test("the workspace summaries are computed by the real summarize functions", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const staff = { can_access_all_branches: true, branches: [] };

  const pickups = mockPickupWorkspace(staff, now);
  // Counted off the rows, not typed in beside them.
  assert.equal(
    pickups.summary.unscheduled,
    pickups.rows.filter((row) => row.status === "unscheduled").length,
  );
  assert.ok(pickups.summary.unscheduled > 0, "an unscheduled pickup must appear");
  assert.ok(pickups.rows.some((row) => row.status === "missed"), "a missed pickup must appear");

  const visibility = mockVisibilityWorkspace(staff, now);
  assert.ok(visibility.summary.active > 0, "active shipments must appear");
  assert.ok(
    visibility.rows.some((row) => row.eta_delta_hours !== null),
    "a delayed shipment must appear so the delayed column is exercised",
  );
  assert.ok(
    visibility.rows.some((row) => row.stale),
    "a stale shipment must appear so the stale column is exercised",
  );
});

test("the workspace fixtures are deterministic", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const staff = { can_access_all_branches: true, branches: [] };
  assert.deepEqual(mockPickupWorkspace(staff, now), mockPickupWorkspace(staff, now));
  assert.deepEqual(mockVisibilityWorkspace(staff, now), mockVisibilityWorkspace(staff, now));
});
