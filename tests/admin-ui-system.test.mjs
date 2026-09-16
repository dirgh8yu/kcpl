import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Flexible UI contract. These assertions lock durable architecture invariants
// (registry-driven navigation, shared Ops primitives, brand tokens, accessibility
// safeguards) rather than a specific legacy appearance. Structure, layout and copy
// are free to evolve as the product is redesigned.

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const shellPath = new URL("../app/admin/operations-shell.tsx", import.meta.url);
const uiPath = new URL("../app/admin/operations-ui.tsx", import.meta.url);
const systemCssPath = new URL("../app/admin/operations-system.css", import.meta.url);
const navigationPath = new URL("../app/admin/workflow-navigation.ts", import.meta.url);
const shipmentsPath = new URL("../app/admin/shipments/shipments-workspace.tsx", import.meta.url);

test("admin shell derives grouped navigation from the canonical workspace registry", async () => {
  const shell = await readFile(shellPath, "utf8");
  assert.match(shell, /groupedWorkspaces\(capabilities\)/);
  assert.match(shell, /data-workspace-group=/);
  assert.match(shell, /data-workspace-id=/);
  assert.match(shell, /app-workspaces/);
  // Navigation must not be re-hardcoded inside the shell; it flows from the registry.
  assert.doesNotMatch(shell, /const operationsWorkflow = \[/);
  assert.doesNotMatch(shell, /const commercialWorkflow = \[/);
  // Permissions must never default open.
  assert.doesNotMatch(shell, /can(?:ViewCommercial|ManageJobFile|ManageFinance|ManageStaff)\s*=\s*true/);
});

test("operations-system.css is the final staff stylesheet and keeps KCPL identity + accessibility", async () => {
  const [layout, css] = await Promise.all([readFile(layoutPath, "utf8"), readFile(systemCssPath, "utf8")]);
  const imports = [...layout.matchAll(/import\s+["'](\.\/admin\/[^"']+\.css)["']/g)].map((match) => match[1]);
  assert.equal(imports.at(-1), "./admin/operations-system.css", "operations-system.css must load last so it owns the final cascade");
  // Brand anchors.
  assert.match(css, /--admin-crimson:\s*#DC143C/i);
  assert.match(css, /--admin-ink:\s*#101010/i);
  // Full semantic token set.
  for (const token of ["--admin-danger", "--admin-warning", "--admin-success", "--admin-info"]) {
    assert.ok(css.includes(token), `missing semantic token ${token}`);
  }
  // Accessibility safeguards.
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height:\s*44px/);
  // The shared cascade must not fight itself with !important or substring selectors.
  assert.doesNotMatch(css, /!important/);
});

test("shared operations primitives expose the reusable component vocabulary", async () => {
  const ui = await readFile(uiPath, "utf8");
  for (const primitive of [
    "OpsPage",
    "OpsPageHeader",
    "OpsSurface",
    "OpsToolbar",
    "OpsTableWrap",
    "OpsBadge",
    "OpsEmptyState",
    "OpsErrorState",
    "OpsButton",
    "OpsMetricStrip",
    "OpsMetric",
    "OpsTimeline",
    "OpsDetailSection",
    "OpsDetailGrid",
    "OpsActionMenu",
    "OpsSkeleton",
  ]) {
    assert.match(ui, new RegExp(`export function ${primitive}\\b`), `missing shared primitive ${primitive}`);
  }
  assert.match(ui, /className="ops-error-state"/);
  assert.match(ui, /className="ops-metric-strip"/);
});

test("shipment register uses shared primitives and keyboard-accessible selection", async () => {
  const shipments = await readFile(shipmentsPath, "utf8");
  assert.match(shipments, /<OpsPage className="shipments-register">/);
  assert.match(shipments, /<OpsPageHeader/);
  assert.match(shipments, /<OpsSearch/);
  assert.match(shipments, /<OpsTableWrap/);
  assert.match(shipments, /<OpsBadge tone=\{statusTone\(job\.status\)\}/);
  assert.match(shipments, /shipmentNextAction\(job\)/);
  // Rows must be operable from the keyboard and must not rely on double-click.
  assert.match(shipments, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.doesNotMatch(shipments, /onDoubleClick=/);
});

test("navigation registry keeps every operational and commercial destination reachable", async () => {
  const navigation = await readFile(navigationPath, "utf8");
  for (const href of [
    "/admin/command-centre",
    "/admin/shipments",
    "/admin/pickups",
    "/admin/customs",
    "/admin/documents",
    "/admin/delivery",
    "/admin/alerts",
    "/admin/enquiries",
    "/admin/crm",
    "/admin/finance",
    "/admin/partners",
    "/admin/staff",
  ]) {
    assert.ok(navigation.includes(`href: "${href}"`), `missing registry destination ${href}`);
  }
});
