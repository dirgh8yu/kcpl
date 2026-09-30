import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildJobSteps, currentJobStep, jobStepSnapshotValue } from "../app/admin/jobs/[reference]/job-steps.ts";
import { shipmentNextAction } from "../app/admin/shipments/shipment-queue-policy.ts";
import { ownedBy } from "../app/admin/mine-filter-policy.ts";
import { portalNeeds } from "../app/portal/portal-needs.ts";

// One "what's next" everywhere, "Assigned to me" on the work lists, and one
// "What KCPL needs from you" list for customers.

const job = (overrides = {}) => ({
  reference: "KCPL-2609-0001", quote_reference: "QT-1", customer_id: "c1", customer_name: "Himal", origin: "A", destination: "B",
  mode: "road", status: "in_transit", primary_branch: "Kathmandu", handling_branches: ["Kathmandu"],
  assigned_to_uid: "u1", assigned_to_name: "Sita", assigned_to_email: "sita@kcpl.com.np", assigned_to_phone: null,
  priority: "standard", eta: null, current_location: null, carrier: null, open_tasks: 0, overdue_tasks: 0,
  required_customs_open: 0, required_customs_total: 0, updated_at: "2026-09-29T00:00:00Z", latest_activity_at: null,
  workflow_step: null, ...overrides,
});

test("the list says what the Job File says, and links to that step", () => {
  const next = shipmentNextAction(job({ workflow_step: { id: "documents", label: "Documents", state: "current", summary: "1 of 2 checked. Still needed: Packing list." } }));
  assert.equal(next.title, "Check documents");
  assert.equal(next.detail, "1 of 2 checked. Still needed: Packing list.");
  assert.equal(next.href, "/admin/jobs/KCPL-2609-0001?step=documents");
  assert.equal(next.rank, 400, "documents and customs still rank as needing attention");

  const quiet = shipmentNextAction(job({ workflow_step: { id: "pickup", label: "Pickup", state: "current", summary: "No pickup booked yet." } }));
  assert.equal(quiet.title, "Book the pickup");
  assert.equal(quiet.rank, 0, "an ordinary next step is not an alert");

  const stuck = shipmentNextAction(job({ workflow_step: { id: "customs", label: "Customs", state: "blocked", summary: "Held by customs." } }));
  assert.equal(stuck.rank, 450);
  assert.equal(stuck.tone, "danger");
});

test("real problems still come first, and old rows fall back sensibly", () => {
  const step = { id: "documents", label: "Documents", state: "current", summary: "x" };
  assert.equal(shipmentNextAction(job({ status: "exception", workflow_step: step })).href, "/admin/jobs/KCPL-2609-0001?step=problems");
  assert.equal(shipmentNextAction(job({ overdue_tasks: 2, workflow_step: step })).href, "/admin/jobs/KCPL-2609-0001?step=tasks");
  assert.equal(shipmentNextAction(job({ required_customs_open: 1 })).href, "/admin/jobs/KCPL-2609-0001?step=customs");
  assert.equal(shipmentNextAction(job({ assigned_to_uid: null, assigned_to_name: null, assigned_to_email: null })).title, "Give it an owner");
  assert.equal(shipmentNextAction(job({ status: "delivered", assigned_to_uid: null, assigned_to_name: null, assigned_to_email: null })).label, "Delivered", "a delivered job is never an ownership gap");
});

test("the stored step is exactly the Job File's current step", () => {
  const steps = buildJobSteps({
    status: "preparing", customerName: "Himal", currentLocation: null, pickupStatus: "picked_up",
    readiness: {
      customer_linked: true, documents: [{ document_type: "packing_list", label: "Packing list", required: true, present: false, uploaded_count: 0 }],
      document_pack_ready: false, customs_required: 0, customs_completed: 0, customs_checklist_ready: true, customs_release_required: false,
      customs_clearance_status: "not_started", customs_released: true, customs_ready: true, proof_of_delivery_present: false,
      invoice_count: 0, issued_invoice_count: 0, paid_invoice_count: 0, job_closed: false, close_blockers: ["x"], can_close: false,
    },
  });
  const current = currentJobStep(steps);
  assert.equal(current.id, "documents");
  assert.deepEqual(jobStepSnapshotValue({ ...current, computed_at: "x" }), current);
  assert.equal(jobStepSnapshotValue({ id: "nonsense", label: "x", state: "current", summary: "y" }), null);
});

test("the guard stores the step without touching status or updated_at", async () => {
  const guard = await readFile(new URL("../app/admin/workflow-guard.server.ts", import.meta.url), "utf8");
  const start = guard.indexOf("async function rememberWorkflowStep");
  const body = guard.slice(start, guard.indexOf("\n}\n", start));
  const writes = body.match(/\.update\([^;]*;/g) ?? [];
  assert.deepEqual(writes, [".update({ workflow_step: { ...step, computed_at: new Date().toISOString() } });"]);
});

test("Assigned to me matches by uid or email, case-insensitively", () => {
  assert.equal(ownedBy({ uid: "u1", email: null }, { uid: "u1" }), true);
  assert.equal(ownedBy({ uid: null, email: "Sita@KCPL.com.np" }, { email: "sita@kcpl.com.np " }), true);
  assert.equal(ownedBy({ uid: "u2", email: "ram@kcpl.com.np" }, { uid: "u1", email: "sita@kcpl.com.np" }), false);
  assert.equal(ownedBy({ uid: null, email: null }, { uid: null, email: null }), false, "an unknown viewer owns nothing");
});

test("customers see what KCPL needs from them, most pressing first", () => {
  const status = (state) => ({ state, deadline: "2026-10-01", daysRemaining: 1, daysOverdue: state === "expired" ? 2 : 0, projectedCharge: null });
  const needs = portalNeeds({
    outstanding: [{ reference: "KCPL-1", origin: "A", destination: "B", rows: [{ document_type: "packing_list" }] }],
    freeTime: [
      { reference: "KCPL-2", origin: "A", destination: "B", location: "ICD", status: status("warning") },
      { reference: "KCPL-3", origin: "A", destination: "B", location: "ICD", status: status("expired") },
    ],
    quotesAwaiting: [{ reference: "QT-9", origin: "A", destination: "B", quoted_amount: 1000, quote_currency: "NPR", valid_until: null }],
    finance: { openInvoices: 3, overdueInvoices: 1 },
  });
  assert.deepEqual(needs.map((need) => need.kind), ["documents", "pay_overdue", "free_time", "quote", "free_time", "pay_open"]);
  assert.equal(needs[2].reference, "KCPL-3", "an expired clock outranks a running one");
  const lastDay = portalNeeds({ outstanding: [], freeTime: [{ reference: "KCPL-4", origin: "", destination: "", location: null, status: status("last_day") }], quotesAwaiting: [{ reference: "QT-1", origin: "", destination: "", quoted_amount: 1, quote_currency: "NPR", valid_until: null }], finance: null });
  assert.deepEqual(lastDay.map((need) => need.kind), ["free_time", "quote"], "the last free day comes before a quote");
  assert.equal(needs.at(-1).count, 2, "open invoices exclude the overdue ones already listed");
  assert.equal(portalNeeds({ outstanding: [], freeTime: [], quotesAwaiting: [], finance: null }).length, 0);
});

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("pickup and movement are worked inside the Job File", async () => {
  const record = await source("app/admin/jobs/[reference]/job-record.tsx");
  assert.match(record, /<PickupControl reference=\{job\.reference\} pickup=\{pickup\}/);
  assert.match(record, /<MovementControl reference=\{job\.reference\}/);
  const pickup = await source("app/admin/jobs/[reference]/pickup-control.tsx");
  for (const action of ["schedule", "confirm", "assign_driver", "picked_up", "missed"]) assert.match(pickup, new RegExp(`"${action}"`), action);
  assert.match(pickup, /\/api\/admin\/pickups/);
  const movement = await source("app/admin/jobs/[reference]/movement-control.tsx");
  assert.match(movement, /send\("PATCH", \{\s*status,/, "details are saved with the status unchanged");
  assert.match(movement, /send\("POST", \{\s*title:/, "tracking updates use the existing publish route");
});

test("saving details never trips the final-delivery checks", async () => {
  const guard = await source("app/admin/workflow-guard.server.ts");
  assert.match(guard, /if \(readiness\.status !== nextStatus && \["out_for_delivery", "delivered"\]\.includes\(nextStatus\)\)/);
});

test("bulk owner changes go through the single-shipment checks, capped", async () => {
  const route = await source("app/api/admin/shipments/bulk-assign/route.ts");
  assert.match(route, /checkShipmentBranchAccess\(reference, staff\)/);
  assert.match(route, /reassignJob\(reference, \{ assignedToUid: body\.assignedToUid \}, access\.user, staff\)/);
  assert.match(route, /MAX_REFERENCES = 50/);
  assert.match(route, /isTrustedSameOriginRequest/);
  for (const path of ["app/admin/shipments/shipments-workspace.tsx", "app/admin/command-centre/v4-operations-overview.tsx"]) {
    assert.match(await source(path), /<BulkAssignBar references=/, path);
  }
  const alerts = await source("app/admin/alerts/alerts-workspace.tsx");
  assert.match(alerts, /bulk\("acknowledge"\)/);
  assert.match(alerts, /bulk\("resolve"\)/);
});

test("Send customer update opens the Job File's own Post update form", async () => {
  const record = await source("app/admin/jobs/[reference]/job-record.tsx");
  const movement = await source("app/admin/jobs/[reference]/movement-control.tsx");
  // The header button used to open the staff notification inbox, which cannot send anything.
  assert.doesNotMatch(record, /\/admin\/notifications\?shipment=/);
  assert.match(record, /show\("transit"\); window\.dispatchEvent\(new Event\(POST_UPDATE_EVENT\)\)/);
  assert.match(movement, /window\.addEventListener\(POST_UPDATE_EVENT, open\)/);
  assert.match(movement, /<input ref=\{updateTitle\} name="title"/);
});
