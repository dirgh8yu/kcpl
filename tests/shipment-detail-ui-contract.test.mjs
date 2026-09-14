import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const pagePath = new URL("../app/admin/jobs/[reference]/page.tsx", import.meta.url);
const overviewPath = new URL("../app/admin/jobs/[reference]/v4-shipment-detail-overview.tsx", import.meta.url);
const cssPath = new URL("../app/admin/shipment-detail-v2.css", import.meta.url);

test("shipment detail replaces duplicate lifecycle and document-intelligence surfaces", async () => {
  const page = await readFile(pagePath, "utf8");
  assert.doesNotMatch(page, /WorkflowSpine/);
  assert.doesNotMatch(page, /SmartDocumentIntelligence/);
  assert.doesNotMatch(page, /Deep operations/);
  assert.match(page, /<V4ShipmentDetailOverview job=\{result\.job\} readiness=\{workflow\.readiness\}>/);
  for (const id of ["shipment-work", "shipment-exceptions", "shipment-delivery", "shipment-activity"]) {
    assert.ok(page.includes(`id="${id}"`), `missing shipment section ${id}`);
  }
});

test("shipment detail navigation only exposes destinations that work", async () => {
  const overview = await readFile(overviewPath, "utf8");
  for (const href of ["#shipment-overview", "#shipment-work", "#shipment-exceptions", "#shipment-delivery", "#shipment-activity"]) {
    assert.ok(overview.includes(href), `missing real shipment destination ${href}`);
  }
  for (const dead of ["#commercial", "#routing", "#cargo", "#booking", "#finance", "#audit"]) {
    assert.ok(!overview.includes(dead), `dead shipment anchor must not return: ${dead}`);
  }
  assert.match(overview, /ShipmentWorkflowReadiness/);
  assert.match(overview, /Record customs release/);
  assert.match(overview, /Complete customs checklist/);
  assert.match(overview, /Verify required documents/);
  assert.match(overview, /Record proof of delivery/);
});

test("shipment detail keeps the record quiet, responsive and on Inter", async () => {
  const [layout, css] = await Promise.all([readFile(layoutPath, "utf8"), readFile(cssPath, "utf8")]);
  const shipmentCss = layout.indexOf('import "./admin/shipment-detail-v2.css";');
  const typographyCss = layout.indexOf('import "./admin/admin-typography.css";');
  assert.ok(shipmentCss >= 0, "shipment detail stylesheet must be loaded");
  assert.ok(typographyCss > shipmentCss, "Inter typography contract must remain final");
  assert.match(css, /\.shipment-record-nav/);
  assert.match(css, /scroll-margin-top/);
  assert.match(css, /\.shipment-job-file-embedded \.ops-page-header/);
  assert.match(css, /display: none !important/);
  assert.match(css, /font-family: var\(--font-inter\)/);
  assert.match(css, /#dc143c/i);
  assert.match(css, /#101010/i);
  assert.match(css, /#f6f6f3/i);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
