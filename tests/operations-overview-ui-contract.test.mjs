import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const overviewPath = new URL("../app/admin/command-centre/v4-operations-overview.tsx", import.meta.url);
const overviewCssPath = new URL("../app/admin/operations-overview-refinement.css", import.meta.url);
const overviewResponsivePath = new URL("../app/admin/operations-overview-responsive.css", import.meta.url);
const overviewInteractivePath = new URL("../app/admin/operations-overview-interactive.css", import.meta.url);
const typographyPath = new URL("../app/admin/admin-typography.css", import.meta.url);

const requiredOverviewLinks = [
  "/admin/shipments",
  "/admin/alerts",
  "/admin/customs",
  "/admin/delivery",
  "/admin/enquiries",
];

test("Operations Overview matches the Figma-led operational register anatomy", async () => {
  const overview = await readFile(overviewPath, "utf8");
  for (const href of requiredOverviewLinks) {
    assert.ok(overview.includes(href), `missing Overview workflow route ${href}`);
  }
  assert.match(overview, />Overview</);
  assert.match(overview, /Operational snapshot/);
  assert.match(overview, /Attention required/);
  assert.match(overview, /Active shipments/);
  assert.match(overview, /Critical alerts/);
  assert.match(overview, /New enquiries/);
  assert.doesNotMatch(overview, /Operational workstreams/);
  assert.doesNotMatch(overview, /Branch pressure/);
});

test("Operations Overview keeps live-data actions and no prototype fixtures", async () => {
  const overview = await readFile(overviewPath, "utf8");
  assert.match(overview, /"use client"/);
  assert.match(overview, /shipmentNeedsAttention/);
  assert.match(overview, /compareShipmentPriority/);
  assert.match(overview, /shipmentNextAction/);
  assert.match(overview, /router\.refresh/);
  assert.match(overview, /returnTo/);
  assert.match(overview, /enquiries/);
  assert.doesNotMatch(overview, /Design prototype/);
  assert.doesNotMatch(overview, /fixture/i);
});

test("Operations Overview refinement and typography load in the intended order", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const adminSystem = layout.indexOf('import "./admin/admin-design-system.css";');
  const overview = layout.indexOf('import "./admin/operations-overview-refinement.css";');
  const responsive = layout.indexOf('import "./admin/operations-overview-responsive.css";');
  const interactive = layout.indexOf('import "./admin/operations-overview-interactive.css";');
  const typography = layout.indexOf('import "./admin/admin-typography.css";');
  assert.ok(adminSystem >= 0, "shared admin design system must be loaded");
  assert.ok(overview > adminSystem, "Overview refinement must load after the shared admin design system");
  assert.ok(responsive > overview, "Overview responsive placement must load after the main Overview refinement");
  assert.ok(interactive > responsive, "interactive Overview safeguards must load after responsive placement");
  assert.ok(typography > interactive, "staff typography contract must load after all Overview refinements");
});

test("Operations Overview UI keeps KCPL identity, Inter UI typography, semantic status colors and responsive safeguards", async () => {
  const css = await readFile(overviewCssPath, "utf8");
  const responsive = await readFile(overviewResponsivePath, "utf8");
  const interactive = await readFile(overviewInteractivePath, "utf8");
  const typography = await readFile(typographyPath, "utf8");
  assert.match(css, /#DC143C/i, "KCPL crimson token is required");
  assert.match(css, /#101010/i, "KCPL black token is required");
  assert.match(css, /#F6F6F3/i, "KCPL canvas token is required");
  assert.match(typography, /font-inter/, "KCPL internal software must use Inter");
  assert.match(typography, /--font-manrope: var\(--font-inter\)/, "legacy admin Manrope references must resolve to Inter");
  assert.match(css, /@media \(max-width: 760px\)/, "mobile Overview layout rules are required");
  assert.match(css, /prefers-reduced-motion: reduce/, "reduced-motion handling is required");
  assert.match(css, /min-height: 40px/, "primary Overview actions must preserve practical touch targets");
  assert.match(responsive, /grid-row: 2/, "mobile workflow supporting detail must stay below the primary row");
  assert.match(interactive, /#C62828/i, "critical state red is required");
  assert.match(interactive, /#B7791F/i, "attention amber is required");
  assert.match(interactive, /#15803D/i, "healthy state green is required");
  assert.match(interactive, /#2563EB/i, "informational blue is required");
  assert.match(interactive, /#7C3AED/i, "supporting violet state is required");
  assert.match(interactive, /overview-inspector-shell/, "side-panel drilldown styling is required");
  assert.match(interactive, /overview-pressure-track/, "branch and workload pressure visualization is required");
  assert.match(interactive, /prefers-reduced-motion: reduce/, "interactive layer must respect reduced motion");
});
