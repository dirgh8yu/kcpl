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
  mockPartner360Snapshot,
  mockPartnerDashboard,
  mockPayablesDashboard,
  mockPickupWorkspace,
  mockQuoteSummaries,
  mockShipmentDocuments,
  mockShipmentMessages,
  mockShipmentWorkflowReadiness,
  mockTmsOrders,
  mockVisibilityWorkspace,
  mockWorkflowOverview,
  mockGalleryEntries,
  mockGalleryImagePath,
  mockOpenJobTasks,
  mockStaffProfiles,
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
    // Digital Job File
    "app/admin/shipment-access.server.ts",
    "app/admin/job-file.server.ts",
    "app/admin/workflow-guard.server.ts",
    "app/admin/shipment-activity.server.ts",
    "app/admin/shipment-exceptions.server.ts",
    "app/shipment-messages.server.ts",
    // Customer 360
    "app/admin/crm/crm-access.server.ts",
    "app/admin/crm/crm-quote-links.server.ts",
    "app/admin/crm/crm-operations-history.server.ts",
    "app/admin/crm/crm-rate-cards.server.ts",
    "app/admin/crm/crm-customer-documents.server.ts",
    "app/admin/crm/crm-customer-finance.server.ts",
    "app/admin/finance/finance-linking.server.ts",
    "app/admin/quote-access.server.ts",
    // Workload and Website gallery
    "app/admin/workload/[key]/page.tsx",
    "app/admin/gallery/page.tsx",
    "app/api/admin/gallery/[id]/image/route.ts",
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

test("the Job File conversation fixture belongs to a real mock job and stores nothing", () => {
  const staff = { can_access_all_branches: true, branches: [] };
  const now = Date.parse("2026-09-29T06:00:00Z");
  const reference = mockCommandCentre(staff, now).jobs[0].reference;
  const thread = mockShipmentMessages(reference, staff, now);
  assert.ok(thread && thread.length >= 2);
  assert.ok(thread.some((message) => message.from === "customer") && thread.some((message) => message.from === "kcpl"));
  assert.deepEqual(thread, mockShipmentMessages(reference, staff, now));
  assert.equal(mockShipmentMessages("KCPL-NOPE", staff, now), null);
  // A QA reply is echoed back before anything is written or anyone is told.
  const server = source("app/shipment-messages.server.ts");
  const post = server.slice(server.indexOf("export async function staffPostsMessage"));
  assert.ok(post.indexOf("qaMockDataEnabled()") < post.indexOf("await write("));
  assert.ok(post.indexOf("qaMockDataEnabled()") < post.indexOf("tellCustomer("));
});

test("QA preview: the Job File's documents agree with its checklist and nothing is uploaded", () => {
  const staff = { can_access_all_branches: true, branches: [] };
  const now = Date.parse("2026-09-29T06:00:00Z");
  const reference = mockCommandCentre(staff, now).jobs[0].reference;
  const documents = mockShipmentDocuments(reference, staff, now);
  const readiness = mockShipmentWorkflowReadiness(reference, staff, now);
  assert.equal(readiness.kind, "ready");
  const present = readiness.readiness.documents.filter((item) => item.present).map((item) => item.document_type).sort();
  assert.deepEqual(documents.map((document) => document.document_type).sort(), present);
  assert.ok(documents.every((document) => document.review_status === "verified" && document.shipment_reference === reference));
  assert.equal(mockShipmentDocuments("KCPL-NOPE", staff, now), null);
  // The route answers before it reads storage, and turns uploads off.
  const route = source("app/api/admin/shipments/[reference]/documents/route.ts");
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("async function handlePOST"));
  assert.ok(get.indexOf("qaMockDataEnabled()") < get.indexOf("listShipmentDocuments("));
  assert.match(get, /mockShipmentDocuments\(reference, auth\.staff\) \?\? \[\], storageAvailable: false/);
});

test("QA preview: partners open in Partner 360, invoices open, and jobs make money", () => {
  const staff = { can_access_all_branches: true, branches: [] };
  const now = Date.parse("2026-09-29T06:00:00Z");
  const partners = mockPartnerDashboard(staff, now).partners;
  // The page refuses anything but a real KCPL partner reference.
  assert.ok(partners.length && partners.every((partner) => /^KCPL-P-[A-Z0-9-]+$/.test(partner.id)));
  const snapshot = mockPartner360Snapshot(partners[0].id, staff, now);
  assert.equal(snapshot.partner.id, partners[0].id);
  assert.ok(snapshot.jobs.length && snapshot.jobs.every((job) => /^KCPL-/.test(job.reference)));
  assert.equal(mockPartner360Snapshot("KCPL-P-NOPE", staff, now), null);
  const page = source("app/admin/partners/[id]/page.tsx");
  assert.ok(page.indexOf("mockPartner360Snapshot(") < page.indexOf("await getPartner360Snapshot("));
  // The Receivables register's invoices are the ones the invoice page opens.
  assert.match(source("app/admin/finance/invoices/[reference]/page.tsx"), /mockFinanceDashboard\(staff\)\.invoices\.find/);
  assert.ok(mockFinanceDashboard(staff, now).invoices.length > 0);
  // A supplier bill is a fraction of what the shipment is invoiced for, so
  // Reports shows margins rather than losses on every job.
  const NPR_PER_USD = 133;
  const invoices = new Map(mockFinanceDashboard(staff, now).invoices.map((invoice) => [invoice.shipment_reference, invoice]));
  for (const bill of mockPayablesDashboard(staff, now).bills) {
    const invoice = invoices.get(bill.shipment_reference);
    if (invoice) assert.ok(bill.subtotal * NPR_PER_USD < invoice.subtotal, `${bill.reference} costs more than it earns`);
  }
});

test("QA preview: batch, supplier bill, Rate Desk and reconciliation pages open", () => {
  // A migration batch the preview lists opens; an unknown one stays inside the
  // staff workspace rather than falling through to the public website's 404.
  const batchPage = source("app/admin/migration/batches/[batchId]/page.tsx");
  assert.match(batchPage, /mockMigrationBatches\(\)\.batches\.find/);
  assert.doesNotMatch(batchPage, /notFound\(\)/);
  assert.match(batchPage, /title="Batch not found"/);
  assert.match(source("app/admin/payables/bills/[reference]/page.tsx"), /mockPayablesDashboard\(staff\)\.bills\.find/);
  const rates = source("app/admin/rating/tms-rating.server.ts");
  const list = rates.slice(rates.indexOf("export async function listPartnerBuyRateCards"));
  assert.ok(list.indexOf("qaMockDataEnabled()") < list.indexOf("firebaseRuntimeConfigured()"));
  const reconcile = source("app/admin/partners/reconciliation/supplier-reconciliation.server.ts");
  const read = reconcile.slice(reconcile.indexOf("export async function listSupplierReconciliation"));
  // The preview still refuses a role without Accounts Payable authority.
  assert.ok(read.indexOf("qaMockDataEnabled()") < read.indexOf("canManageFinance"));
  assert.ok(read.indexOf("canManageFinance") < read.indexOf('kind: "ready"'));
});

test("preview Workload tasks match the Overview's counts, and each owner's branches cover their shipments", () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0);
  const data = mockCommandCentre({ can_access_all_branches: true, branches: [] }, now);
  const tasks = mockOpenJobTasks(data.jobs, now);
  for (const job of data.jobs.filter((row) => row.status !== "delivered")) {
    const mine = tasks.filter((task) => task.shipment_reference === job.reference);
    assert.equal(mine.length, job.open_tasks, job.reference);
    assert.equal(mine.filter((task) => Date.parse(task.due_at) < now).length, job.overdue_tasks, job.reference);
  }
  const profiles = mockStaffProfiles(now);
  for (const load of data.staff_load) {
    const profile = profiles.find((row) => row.uid === load.key);
    assert.ok(profile, `${load.key} links to a profile`);
    if (profile.branch_scope === "all") continue;
    for (const job of data.jobs.filter((row) => row.assigned_to_uid === load.key && row.status !== "delivered")) {
      assert.ok(profile.branches.includes(job.primary_branch), `${profile.display_name} owns ${job.reference} at ${job.primary_branch}`);
    }
  }
});

test("preview gallery rows show photos the repo ships, and no other id resolves", () => {
  const entries = mockGalleryEntries(Date.UTC(2026, 8, 18));
  assert.ok(entries.some((entry) => entry.published) && entries.some((entry) => !entry.published));
  for (const entry of entries) {
    const path = mockGalleryImagePath(entry.id);
    assert.match(path, /^\/images\/[a-z-]+\.jpg$/);
    assert.ok(readFileSync(`${root}/public${path}`).length > 0, path);
  }
  for (const id of ["qa-gallery-0", "qa-gallery-99", "abc123", "../qa-gallery-1"]) assert.equal(mockGalleryImagePath(id), null, id);
});
