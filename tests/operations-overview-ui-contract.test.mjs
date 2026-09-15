import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const overviewPath = new URL("../app/admin/command-centre/v4-operations-overview.tsx", import.meta.url);
const shellPath = new URL("../app/admin/command-centre/overview-shell.tsx", import.meta.url);
const pagePath = new URL("../app/admin/command-centre/page.tsx", import.meta.url);
const cssPath = new URL("../app/admin/command-centre/overview-dashboard.module.css", import.meta.url);
const sidebarCssPath = new URL("../app/admin/command-centre/overview-sidebar.module.css", import.meta.url);
const workflowPath = new URL("../app/admin/command-centre/workflow-overview.server.ts", import.meta.url);
const financePath = new URL("../app/admin/command-centre/overview-finance.server.ts", import.meta.url);
const notesPath = new URL("../app/admin/command-centre/operational-notes.server.ts", import.meta.url);
const systemCssPath = new URL("../app/admin/operations-system.css", import.meta.url);
const typographyPath = new URL("../app/admin/admin-typography.css", import.meta.url);

const dashboardLabels = [
  "Requires attention",
  "Customs pending",
  "Overdue",
  "Due today",
  "Unassigned",
  "In transit",
  "Attention required",
  "Today",
  "Arriving today",
  "Departing today",
  "Customs clearance",
  "POD overdue",
  "Booking approvals",
  "Missing documents",
  "Unassigned shipments",
  "Shipment workload",
  "Live movement",
  "Recent activity",
  "Finance snapshot",
  "Operational notes",
];

const requiredWorkflowRoutes = [
  "/admin/shipments",
  "/admin/alerts",
  "/admin/customs",
  "/admin/delivery",
  "/admin/visibility",
  "/admin/tenders",
  "/admin/freight-documents",
];

test("Operations Overview matches the supplied freight control-tower capability", async () => {
  const overview = await readFile(overviewPath, "utf8");
  for (const label of dashboardLabels) assert.match(overview, new RegExp(label), `missing source-truth dashboard capability: ${label}`);
  for (const href of requiredWorkflowRoutes) assert.ok(overview.includes(href), `missing Overview workflow route ${href}`);
  assert.match(overview, /Good morning|greeting\(/);
  assert.match(overview, /New shipment/);
  assert.match(overview, /View calendar/);
  assert.match(overview, /critical blocker/);
  assert.match(overview, /Total revenue/);
  assert.match(overview, /Total cost/);
  assert.match(overview, /Gross margin/);
  assert.match(overview, /Margin %/);
  assert.match(overview, /Create transport order/);
});

test("Overview chrome provides left navigation, search, branch context, notifications and staff identity", async () => {
  const shell = await readFile(shellPath, "utf8");
  const sidebarCss = await readFile(sidebarCssPath, "utf8");

  assert.match(shell, /OperationsCommandPalette/);
  assert.match(shell, /OperationsNotificationCentre/);
  assert.match(shell, /groupedWorkspaces/);
  assert.match(shell, /WorkspaceIcon/);
  assert.match(shell, /Application navigation/);
  assert.match(shell, /KCPL workspaces/);
  assert.match(shell, /Find anything/);
  assert.match(shell, /Search shipments, customers, containers, documents/);
  assert.match(shell, /Operational branch/);
  assert.match(shell, /All branches/);
  assert.match(shell, /roleLabel/);
  assert.match(shell, /⌘ K/);
  assert.match(sidebarCss, /grid-template-columns:\s*220px minmax\(0, 1fr\)/);
  assert.match(sidebarCss, /\.navButton[\s\S]*background:\s*var\(--overview-action\)/);
  assert.match(sidebarCss, /\.searchButton[\s\S]*background:\s*var\(--overview-action\)/);
  assert.match(sidebarCss, /\.signOutButton[\s\S]*background:\s*var\(--overview-action\)/);
  assert.match(sidebarCss, /@media \(max-width:\s*1419px\)/);
});

test("Operations Overview preserves server authority, branch scope and return context", async () => {
  const overview = await readFile(overviewPath, "utf8");
  const page = await readFile(pagePath, "utf8");
  const workflow = await readFile(workflowPath, "utf8");
  const finance = await readFile(financePath, "utf8");
  const notes = await readFile(notesPath, "utf8");

  assert.match(overview, /shipmentNeedsAttention/);
  assert.match(overview, /compareShipmentPriority/);
  assert.match(overview, /shipmentNextAction/);
  assert.match(overview, /returnTo/);
  assert.match(overview, /useWorkspaceQuery/);
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
  assert.match(workflow, /job_activity/);
  assert.match(finance, /collection\("invoices"\)/);
  assert.match(finance, /collectionGroup\("job_costs"\)/);
  assert.match(finance, /staffCanAccessBranch/);
  assert.match(notes, /staffCanAccessBranch/);
  assert.match(notes, /canManageJobFile/);
});

test("Overview owns its source-truth visual system instead of Tremor dashboard primitives", async () => {
  const overview = await readFile(overviewPath, "utf8");
  const css = await readFile(cssPath, "utf8");
  const layout = await readFile(layoutPath, "utf8");

  assert.doesNotMatch(overview, /tremor-ui|OpsPageHeader|OpsSurface|OpsTableWrap|OpsProgress|OpsBadge|OpsEmptyState/);
  assert.match(overview, /overview-dashboard\.module\.css/);
  assert.match(css, /--overview-action:\s*#000000/i, "Overview actions must use Uber black");
  assert.match(css, /--overview-danger:\s*#d92d20/i, "errors and blockers need a dedicated semantic red");
  assert.match(css, /--overview-brand-crimson:\s*#dc143c/i, "KCPL crimson remains a distinct brand token");
  assert.doesNotMatch(css, /\.blackButton[^}]*#dc143c/is, "primary Overview actions must not use KCPL crimson");
  assert.match(css, /@media/);
  assert.match(css, /prefers-reduced-motion/);

  assert.doesNotMatch(layout, /operations-overview-refinement\.css/);
  assert.doesNotMatch(layout, /operations-overview-responsive\.css/);
  assert.doesNotMatch(layout, /operations-overview-interactive\.css/);
  assert.ok(layout.indexOf('import "./admin/operations-system.css";') > layout.indexOf('import "./admin/admin-typography.css";'), "operations-system.css must remain the final staff stylesheet");
});

test("KCPL staff typography remains Inter and global semantic tokens stay intact", async () => {
  const css = await readFile(systemCssPath, "utf8");
  const typography = await readFile(typographyPath, "utf8");
  assert.match(css, /--admin-crimson:\s*#DC143C/i);
  assert.match(css, /--admin-ink:\s*#101010/i);
  assert.match(css, /--admin-danger/);
  assert.match(css, /--admin-warning/);
  assert.match(css, /--admin-success/);
  assert.match(css, /--admin-info/);
  assert.match(typography, /font-inter/);
  assert.match(typography, /--font-manrope: var\(--font-inter\)/);
});
