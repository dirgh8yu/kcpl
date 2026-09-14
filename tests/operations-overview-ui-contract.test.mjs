import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const overviewPath = new URL("../app/admin/command-centre/v4-operations-overview.tsx", import.meta.url);
const overviewCssPath = new URL("../app/admin/operations-overview-refinement.css", import.meta.url);
const overviewResponsivePath = new URL("../app/admin/operations-overview-responsive.css", import.meta.url);

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
  assert.match(overview, /Recent activity/);
});

test("Operations Overview refinement is loaded after shared admin styling", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const editorial = layout.indexOf('import "./admin/operations-editorial.css";');
  const commercial = layout.indexOf('import "./admin/commercial-detail-refinement.css";');
  const overview = layout.indexOf('import "./admin/operations-overview-refinement.css";');
  const responsive = layout.indexOf('import "./admin/operations-overview-responsive.css";');
  assert.ok(editorial >= 0, "Operations editorial stylesheet must be loaded");
  assert.ok(overview > editorial, "Overview refinement must load after Operations editorial styles");
  assert.ok(overview > commercial, "Overview refinement must load after other scoped admin refinements");
  assert.ok(responsive > overview, "Overview responsive placement must load after the main Overview refinement");
});

test("Operations Overview UI keeps KCPL brand and responsive safeguards", async () => {
  const css = await readFile(overviewCssPath, "utf8");
  const responsive = await readFile(overviewResponsivePath, "utf8");
  assert.match(css, /#DC143C/i, "KCPL crimson token is required");
  assert.match(css, /#101010/i, "KCPL black token is required");
  assert.match(css, /#F6F6F3/i, "KCPL canvas token is required");
  assert.match(css, /font-manrope/, "KCPL Overview must use the brand type system");
  assert.match(css, /@media \(max-width: 760px\)/, "mobile Overview layout rules are required");
  assert.match(css, /prefers-reduced-motion: reduce/, "reduced-motion handling is required");
  assert.match(css, /min-height: 40px/, "primary Overview actions must preserve practical touch targets");
  assert.match(responsive, /grid-row: 2/, "mobile workflow supporting detail must stay below the primary row");
});
