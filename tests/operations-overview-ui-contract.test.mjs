import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const overviewPath = new URL("../app/admin/command-centre/v4-operations-overview.tsx", import.meta.url);
const overviewCssPath = new URL("../app/admin/operations-overview-refinement.css", import.meta.url);
const overviewResponsivePath = new URL("../app/admin/operations-overview-responsive.css", import.meta.url);
const overviewInteractivePath = new URL("../app/admin/operations-overview-interactive.css", import.meta.url);

const requiredOverviewLinks = [
  "/admin/shipments",
  "/admin/alerts",
  "/admin/customs",
  "/admin/pickups",
  "/admin/visibility",
  "/admin/freight-documents",
  "/admin/delivery",
];

test("Operations Overview exposes operational control surfaces", async () => {
  const overview = await readFile(overviewPath, "utf8");
  for (const href of requiredOverviewLinks) {
    assert.ok(overview.includes(href), `missing Overview workflow route ${href}`);
  }
  assert.match(overview, /Branch pressure/);
  assert.match(overview, /Workload/);
  assert.match(overview, /Operational workstreams/);
  assert.match(overview, /Recent shipment activity/);
  assert.match(overview, /Needs attention now/);
});

test("Operations Overview provides interactive dashboard controls", async () => {
  const overview = await readFile(overviewPath, "utf8");
  assert.match(overview, /"use client"/);
  assert.match(overview, /Focus window/);
  assert.match(overview, /All branches/);
  assert.match(overview, /aria-pressed/);
  assert.match(overview, /aria-expanded/);
  assert.match(overview, /overview-inspector/);
  assert.match(overview, /Quick desk access/);
  assert.match(overview, /setInspector/);
  assert.match(overview, /Escape/);
});

test("Operations Overview refinement loads after the shared admin system", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const adminSystem = layout.indexOf('import "./admin/admin-design-system.css";');
  const overview = layout.indexOf('import "./admin/operations-overview-refinement.css";');
  const responsive = layout.indexOf('import "./admin/operations-overview-responsive.css";');
  const interactive = layout.indexOf('import "./admin/operations-overview-interactive.css";');
  assert.ok(adminSystem >= 0, "shared admin design system must be loaded");
  assert.ok(overview > adminSystem, "Overview refinement must load after the shared admin design system");
  assert.ok(responsive > overview, "Overview responsive placement must load after the main Overview refinement");
  assert.ok(interactive > responsive, "interactive Overview safeguards must load last");
});

test("Operations Overview UI keeps KCPL identity, semantic status colors and responsive safeguards", async () => {
  const css = await readFile(overviewCssPath, "utf8");
  const responsive = await readFile(overviewResponsivePath, "utf8");
  const interactive = await readFile(overviewInteractivePath, "utf8");
  assert.match(css, /#DC143C/i, "KCPL crimson token is required");
  assert.match(css, /#101010/i, "KCPL black token is required");
  assert.match(css, /#F6F6F3/i, "KCPL canvas token is required");
  assert.match(css, /font-manrope/, "KCPL Overview must use the brand type system");
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
