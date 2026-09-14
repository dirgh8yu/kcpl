import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const shellPath = new URL("../app/admin/operations-shell.tsx", import.meta.url);
const uiPath = new URL("../app/admin/operations-ui.tsx", import.meta.url);
const cssPath = new URL("../app/admin/admin-design-system.css", import.meta.url);
const typographyPath = new URL("../app/admin/admin-typography.css", import.meta.url);
const shipmentsPath = new URL("../app/admin/shipments/shipments-workspace.tsx", import.meta.url);
const gatePath = new URL("../app/admin/v4-workspace-gate.tsx", import.meta.url);

test("admin shell derives secondary navigation from the canonical workspace registry", async () => {
  const shell = await readFile(shellPath, "utf8");
  assert.match(shell, /workspace\.group === activeItem\.group/);
  assert.match(shell, /data-workspace-group=/);
  assert.match(shell, /data-workspace-id=/);
  assert.match(shell, /workspace-secondary-nav/);
  assert.doesNotMatch(shell, /const operationsWorkflow = \[/);
  assert.doesNotMatch(shell, /const commercialWorkflow = \[/);
});

test("shared admin design system keeps the KCPL identity tokens and accessibility safeguards", async () => {
  const [layout, css] = await Promise.all([readFile(layoutPath, "utf8"), readFile(cssPath, "utf8")]);
  const systemImport = layout.indexOf('import "./admin/admin-design-system.css";');
  const commercialImport = layout.indexOf('import "./admin/commercial-detail-refinement.css";');
  assert.ok(systemImport >= 0, "admin design system must be loaded");
  assert.ok(systemImport > commercialImport, "admin design system must load after Commercial refinements");
  assert.match(css, /#DC143C/i);
  assert.match(css, /#101010/i);
  assert.match(css, /#F6F6F3/i);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height: 44px/);
});

test("KCPL staff typography uses Inter while preserving Manrope for the brand lockup", async () => {
  const [layout, typography] = await Promise.all([readFile(layoutPath, "utf8"), readFile(typographyPath, "utf8")]);
  const interactiveImport = layout.indexOf('import "./admin/operations-overview-interactive.css";');
  const typographyImport = layout.indexOf('import "./admin/admin-typography.css";');
  assert.match(layout, /\bInter\b/);
  assert.match(layout, /--font-inter/);
  assert.ok(typographyImport > interactiveImport, "staff typography contract must load after all admin UI refinements");
  assert.match(typography, /font-family: var\(--font-inter\)/);
  assert.match(typography, /--font-manrope: var\(--font-inter\)/);
  assert.match(typography, /KCPL Operations overview/);
  assert.match(typography, /font-family: var\(--font-manrope\), sans-serif/);
});

test("shared operations primitives expose semantic toolbar, table and state classes", async () => {
  const ui = await readFile(uiPath, "utf8");
  assert.match(ui, /export function OpsToolbar/);
  assert.match(ui, /export function OpsTableWrap/);
  assert.match(ui, /className="ops-error-state"/);
  assert.match(ui, /className="ops-metric-strip"/);
  assert.match(ui, /className="ops-metric"/);
});

test("shipment register uses shared primitives and keyboard-accessible selection", async () => {
  const shipments = await readFile(shipmentsPath, "utf8");
  assert.match(shipments, /<OpsPage className="shipments-register">/);
  assert.match(shipments, /<OpsPageHeader/);
  assert.match(shipments, /<OpsStatStrip/);
  assert.match(shipments, /<OpsSearch/);
  assert.match(shipments, /<OpsTableWrap/);
  assert.match(shipments, /<OpsBadge tone=\{statusTone\(job\.status\)\}/);
  assert.match(shipments, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.doesNotMatch(shipments, /onDoubleClick=/);
});

test("workspace gate uses the same semantic action hierarchy", async () => {
  const gate = await readFile(gatePath, "utf8");
  assert.match(gate, /className="workspace-gate"/);
  assert.match(gate, /className="workspace-gate-panel"/);
  assert.match(gate, /className="ops-button"/);
});
