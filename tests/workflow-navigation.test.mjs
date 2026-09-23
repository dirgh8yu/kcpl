import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  activeWorkspace,
  collapsedGroupIds,
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

test("context-first nav collapses every group except the active one", () => {
  const groups = groupedWorkspaces(full);
  // Deep link into a job file still opens the Shipments group only.
  const shipmentsActive = collapsedGroupIds(groups, activeWorkspace("/admin/jobs/KCPL-S-20260822-X", full)?.group);
  assert.equal(shipmentsActive.has("Operate"), false);
  assert.deepEqual([...shipmentsActive], ["Plan & Sell", "Network", "Finance", "Organisation"]);
  // Commercial users landing on Rate Desk get Plan & Sell, not Operate.
  const pricingActive = collapsedGroupIds(groups, "Plan & Sell");
  assert.equal(pricingActive.has("Plan & Sell"), false);
  assert.equal(pricingActive.has("Operate"), true);
});

test("context-first nav falls back to the first group when nothing is active", () => {
  const groups = groupedWorkspaces(full);
  assert.deepEqual([...collapsedGroupIds(groups, undefined)], ["Plan & Sell", "Network", "Finance", "Organisation"]);
  assert.deepEqual([...collapsedGroupIds(groups, "Unknown")], ["Plan & Sell", "Network", "Finance", "Organisation"]);
  // The operations-only role also sees the permission-"all" Plan & Sell rows;
  // landing in Operate collapses the other two groups.
  const operationsOnly = groupedWorkspaces({ canViewCommercial: false, canManageJobFile: true, canManageFinance: false, canManageStaff: false, isManagement: false });
  assert.deepEqual([...collapsedGroupIds(operationsOnly, "Operate")], ["Plan & Sell", "Network"]);
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

test("ops wallboard sits in Operate behind the same gate as the register", () => {
  const wallboard = workflowWorkspaces.find((workspace) => workspace.id === "wallboard");
  assert.equal(wallboard?.href, "/admin/wallboard");
  assert.equal(wallboard?.group, "Operate");
  assert.equal(wallboard?.permission, "job_file");
  assert.equal(activeWorkspace("/admin/wallboard", full)?.id, "wallboard");
  const operationsOnly = new Set(visibleWorkspaces({ canViewCommercial: false, canManageJobFile: true, canManageFinance: false, canManageStaff: false, isManagement: false }).map((workspace) => workspace.id));
  assert.equal(operationsOnly.has("wallboard"), true);
  const withoutJobFile = new Set(visibleWorkspaces({ ...full, canManageJobFile: false }).map((workspace) => workspace.id));
  assert.equal(withoutJobFile.has("wallboard"), false);
});

test("primary admin navigation uses Overview and Shipments without ambiguous Home or Operations labels", () => {
  const overview = workflowWorkspaces.find((workspace) => workspace.id === "home");
  const shipments = workflowWorkspaces.find((workspace) => workspace.id === "shipments");
  assert.equal(overview?.label, "Overview");
  assert.equal(overview?.href, "/admin/command-centre");
  assert.equal(shipments?.label, "Shipments");
  assert.equal(shipments?.href, "/admin/shipments");

  const shell = readFileSync(repoFile("app/admin/operations-shell.tsx"), "utf8");
  assert.match(shell, /groupedWorkspaces\(capabilities\)/);
  assert.match(shell, /href=\{workspace\.href\}/);
  assert.doesNotMatch(shell, /label: "Home", href: "\/admin\/command-centre"/);
  assert.doesNotMatch(shell, /label: "Operations", href: "\/admin\/shipments"/);
  assert.match(shell, /activeWorkspace\(pathname, capabilities\)/);
});

test("manual sidebar group toggles persist per device and never close the active group", () => {
  const shell = readFileSync(repoFile("app/admin/operations-shell.tsx"), "utf8");
  // Toggles are remembered per device (launcher state, same rationale as the palette recents).
  assert.match(shell, /writeManualCollapses\(\[...next\]\)/);
  // The active workspace's group is always re-opened, even for a remembered arrangement.
  assert.match(shell, /if \(activeGroup\) next\.delete\(activeGroup\)/);
  // Signing out forgets the device-local arrangement (shared machines).
  assert.match(shell, /onClick=\{\(\) => clearManualCollapses\(\)\}/);
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

test("command palette recents validate stored entries and re-check permission at render", () => {
  const recents = readFileSync(repoFile("app/admin/palette-recents.ts"), "utf8");
  // Only admin-local hrefs are ever adopted, and every field is type-checked on read.
  assert.match(recents, /startsWith\("\/admin"\)/);
  assert.match(recents, /MAX_RECENTS = 8/);
  const palette = readFileSync(repoFile("app/admin/operations-command-palette.tsx"), "utf8");
  // A stored entry must never advertise a workspace the role no longer has.
  assert.match(palette, /allowedIds\.has\(recent\.workspaceId\)/);
  // Quick actions are launchers, recent rows are already recorded — neither re-records.
  assert.match(palette, /entry\.kind !== "action" && !entry\.recent/);
});

test("Overview does not advertise transport-order creation", () => {
  const source = readFileSync(repoFile("app/admin/command-centre/v4-operations-overview.tsx"), "utf8");
  assert.equal(source.includes("New transport order"), false);
  assert.equal(source.includes("Open Rate Desk"), false);
});
