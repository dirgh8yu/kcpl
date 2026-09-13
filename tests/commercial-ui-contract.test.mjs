import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shellPath = new URL("../app/admin/operations-shell.tsx", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const commercialCssPath = new URL("../app/admin/commercial-detail-refinement.css", import.meta.url);

const commercialRoutes = [
  ["Enquiries", "/admin/enquiries"],
  ["Customers", "/admin/crm"],
  ["Orders & Rates", "/admin/rating"],
  ["Pricing", "/admin/pricing"],
  ["Load Planner", "/admin/consolidation"],
  ["Tender & Booking", "/admin/tenders"],
  ["Market Estimate", "/admin/market-estimate"],
];

test("Commercial workspace exposes the complete workflow navigation", async () => {
  const shell = await readFile(shellPath, "utf8");
  assert.match(shell, /const commercialWorkflow = \[/);
  assert.match(shell, /data-commercial-context=/);
  for (const [label, href] of commercialRoutes) {
    assert.ok(shell.includes(`label: "${label}"`), `missing Commercial nav label ${label}`);
    assert.ok(shell.includes(`href: "${href}"`), `missing Commercial nav route ${href}`);
  }
});

test("final Commercial refinement is loaded after the compatibility layer", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const compatibility = layout.indexOf('import "./admin/commercial-v4-compat.css";');
  const refinement = layout.indexOf('import "./admin/commercial-detail-refinement.css";');
  assert.ok(compatibility >= 0, "Commercial compatibility stylesheet must be loaded");
  assert.ok(refinement > compatibility, "Commercial detail refinement must load after compatibility styles");
});

test("Commercial UI contract keeps KCPL brand, accessibility and mobile safeguards", async () => {
  const css = await readFile(commercialCssPath, "utf8");
  assert.match(css, /#DC143C/i, "KCPL crimson token is required");
  assert.match(css, /#101010/i, "KCPL black token is required");
  assert.match(css, /#F6F6F3/i, "KCPL canvas token is required");
  assert.match(css, /:focus-visible/, "keyboard focus treatment is required");
  assert.match(css, /@media \(max-width: 760px\)/, "mobile Commercial layout rules are required");
  assert.match(css, /prefers-reduced-motion: reduce/, "reduced-motion handling is required");
  assert.match(css, /min-height: 44px !important/, "mobile touch targets must stay at least 44px");
});
