import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const overviewPath = new URL("../app/admin/command-centre/v4-operations-overview.tsx", import.meta.url);
const tremorUiPath = new URL("../app/admin/tremor/tremor-ui.tsx", import.meta.url);
const systemCssPath = new URL("../app/admin/operations-system.css", import.meta.url);
const typographyPath = new URL("../app/admin/admin-typography.css", import.meta.url);

const requiredOverviewLinks = [
  "/admin/shipments",
  "/admin/alerts",
  "/admin/customs",
  "/admin/delivery",
  "/admin/enquiries",
  "/admin/staff",
  "/admin/finance",
];

test("Operations Overview is an operational control tower", async () => {
  const overview = await readFile(overviewPath, "utf8");
  for (const href of requiredOverviewLinks) {
    assert.ok(overview.includes(href), `missing Overview workflow route ${href}`);
  }
  assert.match(overview, />Overview</);
  assert.match(overview, /Operational pulse/);
  assert.match(overview, /Attention required/);
  assert.match(overview, /Operations clear/);
  assert.match(overview, /No immediate blockers/);
  assert.match(overview, /Shipment workload/);
  assert.match(overview, /Recent operational activity/);
  assert.match(overview, /Finance snapshot/);
  assert.match(overview, /Ownership/);
  assert.doesNotMatch(overview, /Operational workstreams/);
  assert.doesNotMatch(overview, /Branch pressure/);
  assert.doesNotMatch(overview, /donut|pie chart/i);
});

test("Operations Overview preserves live policy and return context", async () => {
  const overview = await readFile(overviewPath, "utf8");
  assert.match(overview, /"use client"/);
  assert.match(overview, /shipmentNeedsAttention/);
  assert.match(overview, /compareShipmentPriority/);
  assert.match(overview, /shipmentNextAction/);
  assert.match(overview, /router\.refresh/);
  assert.match(overview, /returnTo/);
  assert.match(overview, /useWorkspaceQuery/);
  assert.doesNotMatch(overview, /Design prototype/);
  assert.doesNotMatch(overview, /fixture/i);
});

test("Operations Overview uses the Tremor Raw UI stack instead of ad hoc Ops dashboard primitives", async () => {
  const overview = await readFile(overviewPath, "utf8");
  const tremorUi = await readFile(tremorUiPath, "utf8");
  const layout = await readFile(layoutPath, "utf8");

  assert.match(overview, /from "\.\.\/tremor\/tremor-ui"/);
  for (const primitive of [
    "Workspace",
    "WorkspaceHeader",
    "MetricStrip",
    "MetricLink",
    "Panel",
    "Badge",
    "Button",
    "LinkButton",
    "Callout",
    "BarList",
    "TableRoot",
    "TableHeaderCell",
  ]) {
    assert.match(overview, new RegExp(`\\b${primitive}\\b`), `missing Tremor primitive ${primitive}`);
  }

  assert.doesNotMatch(overview, /OpsPageHeader|OpsSurface|OpsTableWrap|OpsProgress|OpsBadge|OpsEmptyState/);
  assert.doesNotMatch(overview, /before:hidden/);
  assert.match(tremorUi, /KCPL-adapted Tremor Raw primitives/);
  assert.match(tremorUi, /tremor-id="tremor-raw"/);
  assert.match(tremorUi, /data-ui-stack="tremor-raw"/);
  assert.match(tremorUi, /export const BarList/);
  assert.match(tremorUi, /export const Table/);
  assert.match(tremorUi, /export const Badge/);
  assert.match(tremorUi, /export const Button/);

  assert.doesNotMatch(layout, /operations-overview-refinement\.css/);
  assert.doesNotMatch(layout, /operations-overview-responsive\.css/);
  assert.doesNotMatch(layout, /operations-overview-interactive\.css/);
  assert.ok(layout.indexOf('import "./admin/operations-system.css";') > layout.indexOf('import "./admin/admin-typography.css";'), "operations-system.css must remain the final staff stylesheet");
});

test("Operations Overview keeps KCPL identity, Inter UI typography and responsive safeguards in the canonical system", async () => {
  const css = await readFile(systemCssPath, "utf8");
  const typography = await readFile(typographyPath, "utf8");
  assert.match(css, /--admin-crimson:\s*#DC143C/i, "KCPL crimson token is required");
  assert.match(css, /--admin-ink:\s*#101010/i, "KCPL black token is required");
  assert.match(css, /--admin-canvas:\s*#F6F6F3/i, "KCPL canvas token is required");
  assert.match(css, /--admin-danger/);
  assert.match(css, /--admin-warning/);
  assert.match(css, /--admin-success/);
  assert.match(css, /--admin-info/);
  assert.match(css, /@media/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(typography, /font-inter/, "KCPL internal software must use Inter");
  assert.match(typography, /--font-manrope: var\(--font-inter\)/, "legacy admin Manrope references must resolve to Inter");
});
