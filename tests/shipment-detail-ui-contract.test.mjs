import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { buildJobSteps, initialJobPanel, jobExtraPanels, jobStepIds } from "../app/admin/jobs/[reference]/job-steps.ts";
import { nextShipmentStatus, otherShipmentStatuses, workflowBlockerFix } from "../app/admin/workflow-guard.ts";

// The Job File is one guided checklist: the shipment's steps, the first
// unfinished one open, and each step's work in place. These assertions keep it
// a real, server-backed record whose every step shows something.

const dir = new URL("../app/admin/jobs/[reference]/", import.meta.url);
const pagePath = new URL("page.tsx", dir);
const recordPath = new URL("job-record.tsx", dir);
const workspacePath = new URL("job-file-workspace.tsx", dir);
const cssPath = new URL("../app/admin/shipment-detail-v2.css", import.meta.url);

const readiness = (overrides = {}) => ({
  customer_linked: true,
  documents: [
    { document_type: "commercial_invoice", label: "Commercial invoice", required: true, present: true, uploaded_count: 1 },
    { document_type: "packing_list", label: "Packing list", required: true, present: false, uploaded_count: 1 },
    { document_type: "proof_of_delivery", label: "Proof of delivery", required: true, present: false, uploaded_count: 0 },
  ],
  document_pack_ready: false,
  customs_required: 2,
  customs_completed: 1,
  customs_checklist_ready: false,
  customs_release_required: true,
  customs_clearance_status: "preparing",
  customs_released: false,
  customs_ready: false,
  proof_of_delivery_present: false,
  invoice_count: 0,
  issued_invoice_count: 0,
  paid_invoice_count: 0,
  job_closed: false,
  close_blockers: ["a", "b"],
  can_close: false,
  ...overrides,
});

const steps = (status, overrides = {}, pickupStatus = null) => buildJobSteps({
  status,
  customerName: "Himal Traders",
  currentLocation: null,
  readiness: readiness(overrides),
  pickupStatus,
});

test("shipment detail composes real operational sections with preserved server authority", async () => {
  const page = await readFile(pagePath, "utf8");
  for (const id of ["shipment-work", "shipment-exceptions", "shipment-delivery", "shipment-activity"]) {
    assert.ok(page.includes(`id="${id}"`), `missing shipment section ${id}`);
  }
  for (const loader of ["getDigitalJobFile", "checkShipmentBranchAccess", "getShipmentWorkflowReadiness", "getShipmentActivityTimeline", "getShipmentExceptions", "getDeliveryControl", "getJobStepContext"]) {
    assert.match(page, new RegExp(loader));
  }
  assert.match(page, /<JobRecord\s+job=\{result\.job\}\s+readiness=\{workflow\.readiness\}/);
});

// Every step and extra panel must show at least one surface, and every
// surface must belong to a panel that exists: a renamed panel would otherwise
// leave a step silently empty, or a surface stranded on no step.
test("every Job File step shows real surfaces and every surface belongs to a step", async () => {
  const markup = (await Promise.all([pagePath, recordPath, workspacePath].map((path) => readFile(path, "utf8")))).join("\n");
  const css = await readFile(cssPath, "utf8");
  const panels = [...jobStepIds, ...jobExtraPanels];
  const used = [...markup.matchAll(/data-panel="([a-z ]+)"/g)].flatMap((match) => match[1].split(" "));
  for (const panel of panels) {
    assert.ok(css.includes(`[data-panel-active="${panel}"] [data-panel]:not([data-panel~="${panel}"])`), `no visibility rule for ${panel}`);
    assert.ok(used.includes(panel), `step "${panel}" has no surface`);
  }
  for (const panel of used) assert.ok(panels.includes(panel), `surface marked for unknown step "${panel}"`);
});

test("the open step is the first unfinished one, and a real ?step= wins", () => {
  const list = steps("preparing");
  assert.deepEqual(list.map((step) => step.id), [...jobStepIds]);
  assert.equal(list.find((step) => step.id === "booking").state, "done");
  assert.equal(list.find((step) => step.id === "pickup").state, "current");
  assert.equal(initialJobPanel(list, null), "pickup");
  assert.equal(initialJobPanel(list, "history"), "history");
  assert.equal(initialJobPanel(list, "nonsense"), "pickup");
});

test("step summaries say what is needed in plain words", () => {
  const list = steps("in_transit");
  const documents = list.find((step) => step.id === "documents");
  assert.equal(documents.state, "current");
  assert.match(documents.summary, /1 of 2 checked/);
  assert.match(documents.summary, /Packing list \(uploaded, needs checking\)/);
  assert.doesNotMatch(documents.summary, /Proof of delivery/, "POD is its own step, not a document blocker");
  assert.match(list.find((step) => step.id === "customs").summary, /1 of 2 customs steps done/);
});

test("customs held is stuck, customs not needed is skipped", () => {
  const held = steps("customs_clearance", { document_pack_ready: true, customs_clearance_status: "held" }, "picked_up");
  assert.equal(held.find((step) => step.id === "customs").state, "blocked");
  assert.equal(initialJobPanel(held, null), "customs");

  const domestic = steps("in_transit", { document_pack_ready: true, customs_required: 0, customs_release_required: false, customs_checklist_ready: true, customs_ready: true });
  const customs = domestic.find((step) => step.id === "customs");
  assert.equal(customs.state, "done");
  assert.match(customs.summary, /Not needed/);
});

test("a finished job opens on Close", () => {
  const done = steps("delivered", {
    document_pack_ready: true, customs_checklist_ready: true, customs_released: true, customs_ready: true, customs_completed: 2,
    proof_of_delivery_present: true, invoice_count: 1, issued_invoice_count: 1, paid_invoice_count: 1, job_closed: true, close_blockers: [],
  }, "picked_up");
  assert.ok(done.every((step) => step.state === "done"));
  assert.equal(initialJobPanel(done, null), "close");
});

test("status moves offer the obvious next status and never Delivered", () => {
  assert.equal(nextShipmentStatus("booking_confirmed"), "preparing");
  assert.equal(nextShipmentStatus("in_transit"), "out_for_delivery");
  assert.equal(nextShipmentStatus("out_for_delivery"), null, "Delivered is recorded with proof on the Delivery step");
  assert.ok(!otherShipmentStatuses("out_for_delivery").includes("delivered"));
  assert.ok(otherShipmentStatuses("in_transit").includes("exception"));
});

test("every guard blocker sentence maps to the step that fixes it", async () => {
  const guard = await readFile(new URL("../app/admin/workflow-guard.server.ts", import.meta.url), "utf8");
  const sentences = [...guard.matchAll(/[bB]lockers\.push\("([^"$]+)"\)/g)].map((match) => match[1]);
  assert.ok(sentences.length >= 6, "expected the guard's blocker sentences");
  const unmapped = sentences.filter((sentence) => !workflowBlockerFix(sentence) && !/Out for delivery/.test(sentence));
  assert.deepEqual(unmapped, []);
  assert.equal(workflowBlockerFix("Record the customs release before final delivery.").step, "customs");
  assert.equal(workflowBlockerFix("Check the required documents before final delivery.").step, "documents");
  assert.equal(workflowBlockerFix("Upload the proof of delivery and have it checked.").step, "proof");
  assert.equal(workflowBlockerFix("Link a customer before final delivery.").step, "booking");
  assert.equal(workflowBlockerFix("Mark the shipment Delivered first.").step, "delivery");
  // Document names inside the sentence never redirect it to another step.
  assert.equal(workflowBlockerFix("Documents still needed: Customs declaration, Customer invoice (uploaded, needs checking).").step, "documents");
});

test("the closeout action resolves inside the live Job File workspace", async () => {
  const workspace = await readFile(workspacePath, "utf8");
  assert.match(workspace, /action: "close_job"/);
  assert.match(workspace, /action: "reopen_job"/);
  assert.match(workspace, /id="shipment-closeout"/);
  const page = await readFile(pagePath, "utf8");
  assert.match(page, /initialReadiness=\{workflow\.readiness\}/);
  assert.match(page, /canOverride=\{staff\.permissions\.role === "management"\}/);
});

// A blocked status change used to open a bare browser prompt. It is explained
// in place now, and no staff screen should fall back to one.
test("no staff screen asks for input through a browser prompt", async () => {
  const files = [];
  async function walk(url) {
    for (const entry of await readdir(url, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), url);
      if (entry.isDirectory()) await walk(child);
      else if (/\.tsx?$/.test(entry.name)) files.push(child);
    }
  }
  await walk(new URL("../app/admin/", import.meta.url));
  for (const file of files) {
    assert.doesNotMatch(await readFile(file, "utf8"), /window\.prompt\(/, file.pathname);
  }
  const panel = await readFile(new URL("../app/admin/admin-shipment-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /WorkflowBlockersPanel/);
});
