import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Flexible Shipment Detail contract. The workspace may reorganise freely; these
// assertions guarantee it stays a real, sectioned freight workspace backed by
// server authority — never a set of dead links or invented card layouts.

const pagePath = new URL("../app/admin/jobs/[reference]/page.tsx", import.meta.url);
const overviewPath = new URL("../app/admin/jobs/[reference]/v4-shipment-detail-overview.tsx", import.meta.url);
const workspacePath = new URL("../app/admin/jobs/[reference]/job-file-workspace.tsx", import.meta.url);
const cssPath = new URL("../app/admin/shipment-detail-v2.css", import.meta.url);

const sections = ["shipment-work", "shipment-exceptions", "shipment-delivery", "shipment-activity"];

test("shipment detail composes real operational sections with preserved server authority", async () => {
  const page = await readFile(pagePath, "utf8");
  for (const id of sections) assert.ok(page.includes(`id="${id}"`), `missing shipment section ${id}`);
  // Server authority for every operational surface.
  assert.match(page, /getDigitalJobFile/);
  assert.match(page, /checkShipmentBranchAccess/);
  assert.match(page, /getShipmentWorkflowReadiness/);
  assert.match(page, /getShipmentActivityTimeline/);
  assert.match(page, /getShipmentExceptions/);
  assert.match(page, /getDeliveryControl/);
  assert.match(page, /<V4ShipmentDetailOverview job=\{result\.job\} readiness=\{workflow\.readiness\}>/);
});

// The section bar used to be anchor links into one very long page; it is a
// real tablist now, and which panel each tab shows is decided by generated CSS
// keyed on [data-section]. The guarantee is unchanged and still worth holding:
// every destination the bar offers has to resolve to a section that exists. A
// tab whose panels were all renamed away would silently show an empty page.
test("shipment detail navigation only exposes destinations that resolve to real sections", async () => {
  const overview = await readFile(overviewPath, "utf8");
  const css = await readFile(cssPath, "utf8");
  const page = await readFile(pagePath, "utf8");
  const workspace = await readFile(workspacePath, "utf8");
  const markup = `${overview}\n${page}\n${workspace}`;

  const tabs = [...overview.matchAll(/\["[A-Za-z]+", "([a-z]+)"\]/g)].map((match) => match[1]);
  assert.ok(tabs.length >= 8, `expected the record tablist, found ${tabs.length} tabs`);

  // Every id the tab CSS speaks about, and per tab the ones it hides.
  const allIds = new Set([...css.matchAll(/\[data-section="[a-z]+"\] #([a-z-]+)/g)].map((m) => m[1]));
  assert.ok(allIds.size > 0, "tab visibility CSS is missing");

  for (const tab of tabs) {
    const hidden = new Set(
      [...css.matchAll(new RegExp(`\\[data-section="${tab}"\\] #([a-z-]+)`, "g"))].map((m) => m[1]),
    );
    const shown = [...allIds].filter((id) => !hidden.has(id));
    assert.ok(shown.length > 0, `tab "${tab}" hides every section, so it would render empty`);
    for (const id of shown) {
      assert.ok(markup.includes(`id="${id}"`), `tab "${tab}" shows #${id}, which no component renders`);
    }
  }

  for (const dead of ["#commercial", "#routing", "#cargo", "#booking", "#finance", "#audit"]) {
    assert.ok(!overview.includes(dead), `dead shipment anchor must not return: ${dead}`);
  }
  assert.match(overview, /ShipmentWorkflowReadiness/);
});

test("shipment detail surfaces truthful next actions from workflow readiness", async () => {
  const overview = await readFile(overviewPath, "utf8");
  assert.match(overview, /Record customs release|Complete customs checklist|Set customs requirements/);
  assert.match(overview, /Verify required documents|Record proof of delivery/);
});

// The overview advertises "Close shipment" and routes it to the #shipment-work section, so the live
// Job File workspace must actually offer closeout. The legacy workflow spine used to be the only
// caller of close_job/reopen_job, which left the advertised action unresolvable once it was dropped.
test("the advertised closeout action resolves inside the live Job File workspace", async () => {
  const workspace = await readFile(workspacePath, "utf8");
  assert.match(workspace, /action: "close_job"/);
  assert.match(workspace, /action: "reopen_job"/);
  assert.match(workspace, /id="shipment-closeout"/);

  const page = await readFile(pagePath, "utf8");
  assert.match(page, /initialReadiness=\{workflow\.readiness\}/);
  assert.match(page, /canOverride=\{staff\.permissions\.role === "management"\}/);
});
