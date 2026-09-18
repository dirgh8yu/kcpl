import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  mockAutomationAlerts,
  mockCommandCentre,
  mockConsolidationLoads,
  mockCrmCustomers,
  mockCustomsDeskRows,
  mockDeliveryWorkspace,
  mockDocumentVault,
  mockFinanceDashboard,
  mockFinanceSnapshot,
  mockFreightAuditQueue,
  mockFreightDocumentWorkspace,
  mockManagementAnalytics,
  mockPartnerDashboard,
  mockPickupWorkspace,
  mockQuoteSummaries,
  mockTmsOrders,
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
    "app/admin/freight-documents/freight-documents.server.ts",
    "app/admin/delivery/delivery-control.server.ts",
    "app/admin/alerts/alert-engine.server.ts",
    "app/admin/freight-audit/freight-audit.server.ts",
    "app/admin/customs/customs-data.server.ts",
    "app/admin/documents/documents-data.server.ts",
    "app/admin/admin-data.server.ts",
    "app/admin/crm/crm-data.server.ts",
    "app/admin/partners/partners.server.ts",
    "app/admin/finance/finance.server.ts",
    "app/admin/staff-directory.server.ts",
    "app/admin/carrier-integrations/carrier-integrations.server.ts",
    "app/admin/migration/migration-batches.server.ts",
    "app/admin/payables/payables.server.ts",
    "app/admin/pricing/tms-pricing.server.ts",
    "app/admin/edi/edi-gateway.server.ts",
    "app/admin/tenders/tms-tendering.server.ts",
    "app/admin/rating/tms-rating.server.ts",
    "app/admin/consolidation/tms-consolidation.server.ts",
    "app/admin/management/management.server.ts",
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

  const documents = mockFreightDocumentWorkspace(staff, now);
  const delivery = mockDeliveryWorkspace(staff, now);
  assert.deepEqual(documents.rows.map((row) => row.reference), references);
  assert.deepEqual(delivery.rows.map((row) => row.reference), references);
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
  assert.deepEqual(mockFreightDocumentWorkspace(staff, now), mockFreightDocumentWorkspace(staff, now));
  assert.deepEqual(mockDeliveryWorkspace(staff, now), mockDeliveryWorkspace(staff, now));
});

test("the document and delivery fixtures exercise their queue states", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const staff = { can_access_all_branches: true, branches: [] };

  const documents = mockFreightDocumentWorkspace(staff, now);
  // The queue exists to surface files missing their primary carriage document;
  // a fixture where every file has one would always read zero.
  assert.ok(documents.summary.missing_primary > 0, "a file missing its primary document must appear");
  assert.ok(documents.summary.review_pending > 0, "a document awaiting review must appear");
  assert.equal(
    documents.summary.missing_primary,
    documents.rows.filter((row) => row.missing_primary_carriage_document).length,
  );
  assert.equal(
    documents.summary.generated_current,
    documents.rows.reduce((sum, row) => sum + row.current_generated_count, 0),
  );

  const delivery = mockDeliveryWorkspace(staff, now);
  const states = new Set(delivery.rows.map((row) => row.delivery_state));
  for (const state of ["delivery_active", "delivery_failed", "pod_verified"]) {
    assert.ok(states.has(state), `delivery fixture is missing the ${state} state`);
  }
  assert.ok(
    delivery.rows.some((row) => row.pod_status === "received"),
    "an outstanding POD must appear",
  );
});

test("the alert, audit and customs fixtures stay tied to the same shipments", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const staff = { can_access_all_branches: true, branches: [] };
  const references = new Set(mockCommandCentre(staff, now).jobs.map((job) => job.reference));

  const alerts = mockAutomationAlerts(staff, now);
  assert.ok(alerts.length > 0, "alerts must be raised");
  for (const alert of alerts) {
    assert.ok(references.has(alert.entity_id), `alert points at an unknown shipment: ${alert.entity_id}`);
  }
  // An alert list without a critical is not exercising the screen's worst case.
  assert.ok(alerts.some((alert) => alert.severity === "critical"), "a critical alert must appear");
  assert.ok(alerts.some((alert) => alert.type === "shipment_unassigned"), "an unassigned alert must appear");

  const audit = mockFreightAuditQueue(staff, now);
  for (const row of audit.rows) {
    assert.ok(references.has(row.shipment_reference), `audit row points at an unknown shipment: ${row.shipment_reference}`);
  }
  assert.ok(audit.summary.review_required > 0, "a bill needing review must appear");
  assert.equal(audit.summary.total, audit.rows.length);

  const customs = mockCustomsDeskRows(staff, now);
  for (const row of customs) {
    assert.ok(references.has(row.reference), `customs row points at an unknown shipment: ${row.reference}`);
    // The desk state is classified by customsDeskState, so open steps and a
    // blocked state must not contradict each other.
    assert.equal(row.customs_open, row.open_steps.length);
  }
  assert.ok(customs.some((row) => row.state === "blocked"), "a blocked customs file must appear");
});

test("the vault counts are tallied from its rows, and the pipeline spans its states", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const staff = { can_access_all_branches: true, branches: [] };

  const vault = mockDocumentVault(staff, now);
  assert.ok(vault.rows.length > 0);
  // The header counts must be a tally of the table, not numbers beside it.
  assert.equal(vault.verified_count, vault.rows.filter((row) => row.effective_status === "verified").length);
  assert.equal(vault.rejected_count, vault.rows.filter((row) => row.effective_status === "rejected").length);
  assert.equal(vault.expired_count, vault.rows.filter((row) => row.effective_status === "expired").length);
  assert.ok(vault.review_count > 0, "a document awaiting review must appear");
  assert.ok(vault.expired_count > 0, "an expired document must appear");

  const quotes = mockQuoteSummaries(staff, now);
  const statuses = new Set(quotes.map((quote) => quote.status));
  for (const status of ["new", "reviewing", "quoted", "won"]) {
    assert.ok(statuses.has(status), `enquiry pipeline is missing the ${status} state`);
  }
  // Every shipment came from an enquiry, so each job's quote reference is present.
  const quoteRefs = new Set(quotes.map((quote) => quote.reference));
  for (const job of mockCommandCentre(staff, now).jobs) {
    assert.ok(quoteRefs.has(job.quote_reference), `no enquiry for ${job.reference}`);
  }
});

test("the commercial and finance fixtures are tallied from their own rows", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const staff = { can_access_all_branches: true, branches: [] };
  const jobs = mockCommandCentre(staff, now).jobs;

  // Every company that ships must exist as an account, or the CRM and the
  // shipment register would name different customers.
  const accounts = new Set(mockCrmCustomers(staff, now).map((row) => row.display_name));
  for (const job of jobs) {
    assert.ok(accounts.has(job.customer_name), `no CRM account for ${job.customer_name}`);
  }
  const stages = new Set(mockCrmCustomers(staff, now).map((row) => row.lead_stage));
  assert.ok(stages.size > 1, "the lead pipeline must span more than one stage");

  // Same for carriers and the partner directory.
  const partners = mockPartnerDashboard(staff, now);
  const names = new Set(partners.partners.map((row) => row.display_name));
  for (const job of jobs) {
    if (job.carrier) assert.ok(names.has(job.carrier), `no partner record for ${job.carrier}`);
  }
  assert.equal(partners.active_count, partners.partners.filter((row) => row.status === "active").length);

  const finance = mockFinanceDashboard(staff, now);
  const [summary] = finance.currency_summaries;
  assert.equal(summary.invoiced, finance.invoices.reduce((sum, row) => sum + row.total, 0));
  assert.equal(summary.collected, finance.invoices.reduce((sum, row) => sum + row.amount_paid, 0));
  assert.equal(summary.outstanding, finance.invoices.reduce((sum, row) => sum + row.balance_due, 0));
  assert.equal(summary.invoice_count, finance.invoices.length);
  assert.ok(finance.overdue_count > 0, "an overdue receivable must appear");
  // Ageing buckets are what the screen is for; an all-zero ledger hides them.
  assert.ok(summary.aging_31_60 + summary.aging_61_90 + summary.aging_90_plus > 0, "an aged balance must appear");
});

test("management analytics roll up to the ledgers they came from", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const range = { key: "last_90_days", label: "Last 90 days", from: null, to: null };
  const analytics = mockManagementAnalytics(range, now);

  // Every roll-up is a reduction over analytics.jobs, so the branch, customer
  // and route views must each add back up to the same total.
  const total = analytics.jobs.reduce((sum, row) => sum + row.revenue, 0);
  assert.equal(analytics.branches.reduce((sum, row) => sum + row.revenue, 0), total);
  assert.equal(analytics.customers.reduce((sum, row) => sum + row.revenue, 0), total);
  assert.equal(analytics.routes.reduce((sum, row) => sum + row.revenue, 0), total);
  assert.equal(analytics.financials[0].revenue, total);

  assert.ok(analytics.customers.length > 1, "customer performance must have rows");
  assert.ok(analytics.staff_workload.length > 0, "staff workload must have rows");
  assert.equal(analytics.quote_decided, analytics.quote_won + analytics.quote_lost);
  assert.ok(analytics.exception_shipments > 0, "an exception must reach the management view");
});

test("the transport-order chain is one list, not four", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const staff = { can_access_all_branches: true, branches: [] };
  const references = new Set(mockCommandCentre(staff, now).jobs.map((job) => job.reference));

  const orders = mockTmsOrders(staff, now);
  assert.equal(orders.kind, "ready");
  for (const order of orders.orders) {
    assert.ok(references.has(order.id.replace("TO-", "KCPL-")), `order ${order.id} has no shipment`);
  }

  // Consolidation members must be real transport orders, or the load planner
  // would be planning work that does not exist.
  const orderIds = new Set(orders.orders.map((order) => order.id));
  const loads = mockConsolidationLoads(staff, now);
  assert.equal(loads.kind, "ready");
  assert.ok(loads.loads.length > 0, "a consolidation load must appear");
  for (const load of loads.loads) {
    assert.ok(load.members.length > 0, `load ${load.reference} has no members`);
    for (const member of load.members) {
      assert.ok(orderIds.has(member.order_id), `load member ${member.order_id} is not a real order`);
    }
  }
});
