import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Flexible Overview contract. The command centre may restructure freely; these
// assertions guarantee it still answers the core operational questions from real
// server data with preserved authority and branch scope.

const overviewPath = new URL("../app/admin/command-centre/v4-operations-overview.tsx", import.meta.url);
const shellPath = new URL("../app/admin/operations-shell.tsx", import.meta.url);
const pagePath = new URL("../app/admin/command-centre/page.tsx", import.meta.url);
const workflowPath = new URL("../app/admin/command-centre/workflow-overview.server.ts", import.meta.url);
const financePath = new URL("../app/admin/command-centre/overview-finance.server.ts", import.meta.url);
const notesPath = new URL("../app/admin/command-centre/operational-notes.server.ts", import.meta.url);

// The operational questions the first screen must answer.
// The questions the Overview answers, in the words staff read on it.
const operationalCapabilities = [
  "Next steps",
  "At customs",
  "Overdue tasks",
  "Deliveries due today",
  "Shipments with no owner",
  "In transit",
  "Mine",
  "Everyone",
  "Today",
  "Proof of delivery overdue",
  "Documents missing",
  "Shipment workload",
  "Recent activity",
  "Finance snapshot",
  "Operational notes",
];

const workflowRoutes = [
  "/admin/shipments",
  "/admin/alerts",
  "/admin/customs",
  "/admin/delivery",
  "/admin/visibility",
  "/admin/freight-documents",
];

test("Overview answers the core operational control-tower questions", async () => {
  const overview = await readFile(overviewPath, "utf8");
  for (const label of operationalCapabilities) assert.match(overview, new RegExp(label), `missing operational capability: ${label}`);
  for (const href of workflowRoutes) assert.ok(overview.includes(href), `missing Overview workflow route ${href}`);
  // Finance answers real profitability, not decorative numbers.
  assert.match(overview, /Total revenue/);
  assert.match(overview, /Total cost/);
  assert.match(overview, /Gross margin/);
});

test("Overview reuses the shared operations shell with search, notifications and branch scope", async () => {
  const shell = await readFile(shellPath, "utf8");
  const page = await readFile(pagePath, "utf8");
  assert.match(shell, /OperationsCommandPalette/);
  assert.match(shell, /OperationsNotificationCentre/);
  assert.match(shell, /visibleHubs/);
  assert.match(shell, /visibleWorkspaces/);
  assert.match(shell, /WorkspaceIcon/);
  // Branch scoping is preserved by the shared shell, not a bespoke command-centre shell.
  assert.match(shell, /selectedBranch/);
  assert.match(page, /OperationsShell/);
  assert.match(page, /branches=\{accessibleBranches\}/);
});

test("Overview preserves server authority, branch scope and return context with no invented data", async () => {
  const overview = await readFile(overviewPath, "utf8");
  const page = await readFile(pagePath, "utf8");
  const workflow = await readFile(workflowPath, "utf8");
  const finance = await readFile(financePath, "utf8");
  const notes = await readFile(notesPath, "utf8");

  assert.match(overview, /shipmentNeedsAttention/);
  // Presentation order is the impact ranking (work-queue-impact) or the legacy
  // severity sort; both come from the shared queue policy, never invented here.
  assert.match(overview, /compareShipmentPriority|compareWorkQueueImpact/);
  assert.match(overview, /shipmentNextAction/);
  assert.match(overview, /returnTo/);
  assert.match(overview, /router\.refresh/);
  assert.doesNotMatch(overview, /fixture|mockData|sample shipment/i);

  assert.match(page, /scopedStaffContext/);
  assert.match(page, /includeDelivered:\s*true/);
  assert.match(page, /loadWorkflowOverview/);
  assert.match(page, /getOverviewFinanceSnapshot/);
  assert.match(page, /getLatestOperationalNote/);
  assert.match(workflow, /listTrackingVisibility/);
  assert.match(workflow, /listDeliveryWorkspace/);
  assert.match(workflow, /listAutomationAlerts/);
  assert.match(finance, /staffCanAccessBranch/);
  assert.match(notes, /staffCanAccessBranch/);
  assert.match(notes, /canManageJobFile/);
});

// Every "New shipment" opens the one form that starts one: the transport order
// form on Buy rates, which posts create_order. The Overview once had its own
// copy of that form in a dialog, and the Shipments page sent people to Carrier
// booking instead, so the same button did three different things. The form
// must also offer exactly the server's modes: a hand-rolled list once offered
// "ocean", which create_order has never accepted (sea freight is "sea").
test("every New shipment opens the one form, and it offers only modes create_order accepts", async () => {
  const overview = await readFile(overviewPath, "utf8");
  const shipments = await readFile(new URL("../app/admin/shipments/shipments-workspace.tsx", import.meta.url), "utf8");
  const form = await readFile(new URL("../app/admin/rating/v4-transport-orders-workspace.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/admin/rating/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/admin/rating/route.ts", import.meta.url), "utf8");
  const { tmsModes } = await import("../app/admin/rating/tms-rating.ts");

  for (const source of [overview, shipments]) assert.match(source, /href="\/admin\/rating\?create=1"[^>]*>\s*<Plus[^>]*\/> New shipment/);
  assert.doesNotMatch(overview, /create_order|NewShipmentLauncher/, "the Overview keeps no second copy of the form");
  assert.match(page, /initialCreate=\{create === "1"\}/);
  assert.match(form, /useState\(initialCreate\)/);
  assert.match(route, /tmsModes\.includes\(mode\)/, "create_order must validate mode against tmsModes");
  assert.match(form, /tmsModes\.map\(\(value\) => <option key=\{value\} value=\{value\}>/, "the form must offer tmsModes, not its own copy");
  assert.ok(tmsModes.includes("sea") && !tmsModes.includes("ocean"), "sea freight is 'sea' on the server");
});
