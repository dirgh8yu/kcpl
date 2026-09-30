import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  activeHub,
  activeWorkspace,
  groupedWorkspaces,
  visibleHubs,
  visibleWorkspaces,
  workflowWorkspaces,
  workspaceHubs,
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
  assert.deepEqual(visibleHubs(full).slice(0, 3).map((entry) => [entry.hub.label, entry.href]), [["Overview", "/admin/command-centre"], ["Inbox", "/admin/alerts"], ["Shipments", "/admin/shipments"]]);

  const shell = readFileSync(repoFile("app/admin/operations-shell.tsx"), "utf8");
  assert.match(shell, /visibleHubs\(capabilities\)/);
  assert.match(shell, /activeHub\(pathname, capabilities\)/);
  assert.match(shell, /activeWorkspace\(pathname, capabilities\)/);
  assert.doesNotMatch(shell, /label: "Home", href: "\/admin\/command-centre"/);
  assert.doesNotMatch(shell, /label: "Operations", href: "\/admin\/shipments"/);
});

/* Hubs: the sidebar names a few areas; each area's pages are tabs. ------- */

test("the sidebar shows a handful of hubs, not every page", () => {
  const hubs = visibleHubs(full);
  assert.ok(hubs.length <= 9, `${hubs.length} hubs`);
  assert.ok(workflowWorkspaces.length > hubs.length * 3, "most pages are tabs inside a hub");
  assert.deepEqual(hubs.map((entry) => entry.hub.id), ["overview", "inbox", "shipments", "sales", "customers", "partners", "finance", "reports", "settings"]);
  for (const workspace of workflowWorkspaces) {
    assert.ok(workspaceHubs.some((hub) => hub.id === workspace.hub), `${workspace.id} belongs to a hub`);
    assert.ok(workspace.tab.length <= 24, `${workspace.id}: a short tab name`);
  }
});

test("a hub opens on its first page the person may see, and hides when they may see none", () => {
  const operationsOnly = { canViewCommercial: false, canManageJobFile: true, canManageFinance: false, canManageStaff: false, isManagement: false };
  const ids = visibleHubs(operationsOnly).map((entry) => entry.hub.id);
  assert.equal(ids.includes("finance"), false);
  assert.equal(ids.includes("reports"), false);
  assert.equal(ids.includes("settings"), false);
  const sales = visibleHubs(operationsOnly).find((entry) => entry.hub.id === "sales");
  assert.deepEqual(sales?.items.map((workspace) => workspace.id), ["enquiries"], "no commercial desks without commercial access");
  assert.equal(sales?.href, "/admin/enquiries");
});

test("the Shipments hub holds the stages of a job, in the order work happens", () => {
  const shipments = activeHub("/admin/customs", full);
  assert.equal(shipments?.hub.id, "shipments");
  assert.deepEqual(shipments?.items.map((workspace) => workspace.tab), ["All shipments", "Pickups", "Tracking", "Customs", "Documents", "Freight documents", "Delivery & POD"]);
  assert.equal(activeHub("/admin/jobs/KCPL-S-1", full)?.hub.id, "shipments", "a Job File sits in Shipments");
  assert.equal(activeHub("/admin/partners/reconciliation", full)?.hub.id, "finance", "the most specific page decides the hub");
});

test("the shell draws a hub's tabs on its list pages, not on a record's own page", () => {
  const shell = readFileSync(repoFile("app/admin/operations-shell.tsx"), "utf8");
  assert.match(shell, /const hubTabs = currentHub && currentHub\.items\.length > 1 && !detail \? currentHub\.items : \[\];/);
  assert.match(shell, /className="app-hub-tabs"/);
  assert.match(shell, /aria-current=\{workspace\.id === activeItem\?\.id \? "page" : undefined\}/);
});

test("one refresh control: the top bar's reaches every workspace's own data", () => {
  const shell = readFileSync(repoFile("app/admin/operations-shell.tsx"), "utf8");
  assert.match(shell, /announceWorkspaceRefresh\(\); startRefresh\(\(\) => router\.refresh\(\)\)/);
  for (const path of ["app/admin/pickups/pickup-appointments-workspace.tsx", "app/admin/visibility/tracking-visibility-workspace.tsx", "app/admin/notifications/notifications-workspace.tsx", "app/admin/pricing/tms-pricing-workspace.tsx", "app/admin/rating/tms-rating-workspace.tsx", "app/admin/tenders/v4-tender-workspace.tsx", "app/admin/consolidation/tms-consolidation-workspace.tsx", "app/admin/carrier-integrations/carrier-integrations-workspace.tsx", "app/admin/edi/edi-workspace.tsx", "app/admin/freight-audit/freight-audit-workspace.tsx"]) {
    const source = readFileSync(repoFile(path), "utf8");
    assert.match(source, /useWorkspaceRefresh\(/, path);
    assert.doesNotMatch(source, />\s*Refresh\s*<\/OpsButton>|\/>Refresh<\/OpsButton>/, `${path}: no page-level Refresh button`);
  }
});

test("page headers carry actions, not links to their sibling pages", () => {
  // The hub's tabs are the way between sibling pages; header buttons that
  // only jumped to one used to crowd every register.
  const siblings = [
    ["app/admin/finance/finance-workspace.tsx", "/admin/payables"],
    ["app/admin/payables/payables-workspace.tsx", "/admin/finance\""],
    ["app/admin/customs/customs-workspace.tsx", "/admin/alerts"],
    ["app/admin/delivery/delivery-workspace.tsx", "/admin/visibility"],
    ["app/admin/market-estimate/page.tsx", "/admin/consolidation"],
    ["app/admin/consolidation/tms-consolidation-workspace.tsx", "/admin/tenders"],
    ["app/admin/migration/migration-workspace.tsx", "/admin/migration/archive"],
  ];
  for (const [path, href] of siblings) {
    const source = readFileSync(repoFile(path), "utf8");
    const header = source.slice(source.indexOf("<OpsPageHeader"), source.indexOf("/>", source.indexOf("<OpsPageHeader")) + 400);
    assert.doesNotMatch(header, new RegExp(`href="${href}`), `${path} links to ${href} from its header`);
  }
});

test("only the Overview is customisable; registers keep one standard layout", async () => {
  const { CUSTOMISABLE_WORKSPACES } = await import("../app/admin/operations-arrangeable.ts");
  assert.deepEqual([...CUSTOMISABLE_WORKSPACES], ["overview"]);
  const hook = readFileSync(repoFile("app/admin/use-staff-arrangement.ts"), "utf8");
  assert.match(hook, /if \(!customisable\) return;/);
  // Registers render their one layout directly: no drag grid, no hidden
  // "Move section" handles, no layout hook.
  for (const path of [
    "app/admin/shipments/shipments-workspace.tsx",
    "app/admin/pickups/pickup-appointments-workspace.tsx",
    "app/admin/customs/customs-workspace.tsx",
    "app/admin/delivery/delivery-workspace.tsx",
    "app/admin/freight-documents/freight-documents-workspace.tsx",
    "app/admin/alerts/alerts-workspace.tsx",
    "app/admin/finance/finance-workspace.tsx",
    "app/admin/payables/payables-workspace.tsx",
  ]) {
    const source = readFileSync(repoFile(path), "utf8");
    assert.doesNotMatch(source, /ArrangeableGrid|useStaffArrangement|CustomiseRow/, path);
  }
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
