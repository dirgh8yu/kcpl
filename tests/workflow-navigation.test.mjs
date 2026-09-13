import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  activeWorkspace,
  groupedWorkspaces,
  visibleWorkspaces,
  workflowWorkspaces,
} from "../app/admin/workflow-navigation.ts";

const full = {
  canViewCommercial: true,
  canManageJobFile: true,
  canManageFinance: true,
  canManageStaff: true,
  isManagement: true,
};

function repoFile(path) {
  return fileURLToPath(new URL(`../${path}`, import.meta.url));
}

test("workflow navigation contains every current TMS handoff workspace", () => {
  const ids = new Set(workflowWorkspaces.map((workspace) => workspace.id));
  for (const required of ["rating", "pricing", "consolidation", "tenders", "pickups", "freight-documents", "shipments", "visibility", "carrier-integrations", "edi", "delivery", "freight-audit", "payables"]) {
    assert.equal(ids.has(required), true, `${required} should be globally discoverable`);
  }
});

test("operations-only staff see execution carrier and EDI tools but not commercial or finance workspaces", () => {
  const visible = new Set(visibleWorkspaces({ canViewCommercial: false, canManageJobFile: true, canManageFinance: false, canManageStaff: false, isManagement: false }).map((workspace) => workspace.id));
  assert.equal(visible.has("shipments"), true);
  assert.equal(visible.has("pickups"), true);
  assert.equal(visible.has("freight-documents"), true);
  assert.equal(visible.has("visibility"), true);
  assert.equal(visible.has("carrier-integrations"), true);
  assert.equal(visible.has("edi"), true);
  assert.equal(visible.has("delivery"), true);
  assert.equal(visible.has("rating"), false);
  assert.equal(visible.has("pricing"), false);
  assert.equal(visible.has("freight-audit"), false);
});

test("finance workspaces require finance capability", () => {
  const withoutFinance = new Set(visibleWorkspaces({ ...full, canManageFinance: false }).map((workspace) => workspace.id));
  assert.equal(withoutFinance.has("payables"), false);
  assert.equal(withoutFinance.has("freight-audit"), false);
  const withFinance = new Set(visibleWorkspaces(full).map((workspace) => workspace.id));
  assert.equal(withFinance.has("payables"), true);
  assert.equal(withFinance.has("freight-audit"), true);
});

test("active workspace picks the most specific nested route", () => {
  assert.equal(activeWorkspace("/admin/jobs/KCPL-S-20260822-X", full)?.id, "shipments");
  assert.equal(activeWorkspace("/admin/pickups", full)?.id, "pickups");
  assert.equal(activeWorkspace("/admin/freight-documents", full)?.id, "freight-documents");
  assert.equal(activeWorkspace("/admin/carrier-integrations", full)?.id, "carrier-integrations");
  assert.equal(activeWorkspace("/admin/edi", full)?.id, "edi");
  assert.equal(activeWorkspace("/admin/partners/reconciliation", full)?.id, "supplier-reconciliation");
  assert.equal(activeWorkspace("/admin/migration/archive", full)?.id, "paper-archive");
});

test("menu groups follow operational pipeline order", () => {
  assert.deepEqual(groupedWorkspaces(full).map((group) => group.group), ["Operate", "Plan & Sell", "Network", "Finance", "Organisation"]);
});

test("every registered workspace href resolves to a real App Router page", () => {
  for (const workspace of workflowWorkspaces) {
    const pathname = workspace.href.split("?")[0];
    const relative = pathname.replace(/^\//, "");
    const page = repoFile(`app/${relative.replace(/^app\//, "")}/page.tsx`);
    assert.equal(existsSync(page), true, `${workspace.id} points to missing page ${workspace.href}`);
  }
});

test("admin root remains an authentication gateway and not a business workspace", () => {
  const source = readFileSync(repoFile("app/admin/page.tsx"), "utf8");
  assert.match(source, /redirect\("\/admin\/command-centre"\)/);
  assert.doesNotMatch(source, /<AdminDashboard/);
});

test("enquiries have a dedicated workspace route", () => {
  const enquiries = workflowWorkspaces.find((workspace) => workspace.id === "enquiries");
  assert.equal(enquiries?.href, "/admin/enquiries");
  assert.equal(activeWorkspace("/admin/enquiries", full)?.id, "enquiries");
});

test("primary admin navigation uses Overview and Shipments without ambiguous Home or Operations labels", () => {
  const overview = workflowWorkspaces.find((workspace) => workspace.id === "home");
  const shipments = workflowWorkspaces.find((workspace) => workspace.id === "shipments");
  assert.equal(overview?.label, "Overview");
  assert.equal(overview?.href, "/admin/command-centre");
  assert.equal(shipments?.label, "Shipments");
  assert.equal(shipments?.href, "/admin/shipments");

  const shell = readFileSync(repoFile("app/admin/operations-shell.tsx"), "utf8");
  assert.match(shell, /label: "Overview", href: "\/admin\/command-centre"/);
  assert.match(shell, /label: "Shipments", href: "\/admin\/shipments"/);
  assert.doesNotMatch(shell, /label: "Home", href: "\/admin\/command-centre"/);
  assert.doesNotMatch(shell, /label: "Operations", href: "\/admin\/shipments"/);
  assert.match(shell, /pathname\.startsWith\("\/admin\/enquiries"\)/);
});

test("operations search deep-links quote results into the enquiries workspace", () => {
  const source = readFileSync(repoFile("app/api/admin/operations-search/route.ts"), "utf8");
  assert.match(source, /\/admin\/enquiries\?enquiry=/);
  assert.doesNotMatch(source, /href: `\/admin\?enquiry=/);
});

test("command palette only advertises quick actions with real destinations", () => {
  const source = readFileSync(repoFile("app/admin/operations-command-palette.tsx"), "utf8");
  assert.match(source, /href: "\/admin\/crm\/new"/);
  assert.match(source, /href: "\/admin\/payables\?create=1"/);
  assert.doesNotMatch(source, /title: "New enquiry \/ quote"/);
  assert.doesNotMatch(source, /title: "New transport order"/);
});

test("Overview does not advertise transport-order creation when it only opens the Rate Desk", () => {
  const source = readFileSync(repoFile("app/admin/command-centre/v4-operations-overview.tsx"), "utf8");
  assert.match(source, />Open Rate Desk<\/Link>/);
  assert.doesNotMatch(source, />New transport order<\/Link>/);
});
