export type WorkspacePermission =
  | "all"
  | "commercial"
  | "job_file"
  | "finance"
  | "management"
  | "management_finance"
  | "staff";

export type WorkflowWorkspace = {
  id: string;
  href: string;
  label: string;
  group: "Operate" | "Plan & Sell" | "Network" | "Finance" | "Organisation";
  hint: string;
  keywords: string[];
  permission: WorkspacePermission;
  exact?: boolean;
  prefixes?: string[];
};

export type NavigationCapabilities = {
  canViewCommercial: boolean;
  canManageJobFile: boolean;
  canManageFinance: boolean;
  canManageStaff: boolean;
  isManagement: boolean;
};

export const workflowWorkspaces: WorkflowWorkspace[] = [
  { id: "home", href: "/admin/command-centre", label: "Home", group: "Operate", hint: "Operational day, blockers and workflow handoffs", keywords: ["home", "command centre", "dashboard", "operations"], permission: "all", prefixes: ["/admin/command-centre"] },
  { id: "shipments", href: "/admin/shipments", label: "Shipments", group: "Operate", hint: "Active movements and Digital Job Files", keywords: ["shipment", "job", "job file", "movement", "cargo"], permission: "job_file", prefixes: ["/admin/shipments", "/admin/jobs/"] },
  { id: "visibility", href: "/admin/visibility", label: "Live Visibility", group: "Operate", hint: "Tracking feeds, ETA movement and stale visibility", keywords: ["tracking", "visibility", "eta", "carrier events", "live"], permission: "job_file", prefixes: ["/admin/visibility"] },
  { id: "customs", href: "/admin/customs", label: "Customs", group: "Operate", hint: "Clearance queue, release controls and customs blockers", keywords: ["customs", "clearance", "duty", "release"], permission: "job_file", prefixes: ["/admin/customs"] },
  { id: "documents", href: "/admin/documents", label: "Documents", group: "Operate", hint: "Verified Document Vault and review queue", keywords: ["documents", "vault", "verification", "pod", "awb", "bol"], permission: "job_file", prefixes: ["/admin/documents"] },
  { id: "delivery", href: "/admin/delivery", label: "Delivery & POD", group: "Operate", hint: "Final-mile attempts, proof of delivery and redelivery", keywords: ["delivery", "pod", "proof", "recipient", "redelivery"], permission: "job_file", prefixes: ["/admin/delivery"] },
  { id: "alerts", href: "/admin/alerts", label: "Tasks & Alerts", group: "Operate", hint: "Exceptions, ownership and follow-up", keywords: ["alerts", "tasks", "exceptions", "follow up"], permission: "all", prefixes: ["/admin/alerts"] },
  { id: "notifications", href: "/admin/notifications", label: "Notifications", group: "Operate", hint: "Assignment and automation notification history", keywords: ["notifications", "history", "automation"], permission: "all", prefixes: ["/admin/notifications"] },

  { id: "enquiries", href: "/admin", label: "Enquiries", group: "Plan & Sell", hint: "Incoming freight requests and quote pipeline", keywords: ["enquiry", "quote", "request", "lead"], permission: "all", exact: true },
  { id: "customers", href: "/admin/crm", label: "Customers", group: "Plan & Sell", hint: "Customer accounts and Customer 360", keywords: ["customer", "crm", "account"], permission: "all", prefixes: ["/admin/crm"] },
  { id: "market-estimate", href: "/admin/market-estimate", label: "Market Estimate", group: "Plan & Sell", hint: "FX, market inputs and planning references", keywords: ["market", "estimate", "fx", "nrb", "rates"], permission: "commercial", prefixes: ["/admin/market-estimate"] },
  { id: "rating", href: "/admin/rating", label: "Orders & Rate Desk", group: "Plan & Sell", hint: "Transport orders, Partner buy rates and selection", keywords: ["order", "rate", "buy rate", "procurement", "rate desk"], permission: "commercial", prefixes: ["/admin/rating"] },
  { id: "pricing", href: "/admin/pricing", label: "Pricing Desk", group: "Plan & Sell", hint: "Customer sell price, margin floors and approvals", keywords: ["pricing", "sell rate", "margin", "markup", "quote"], permission: "commercial", prefixes: ["/admin/pricing"] },
  { id: "consolidation", href: "/admin/consolidation", label: "Load Planner", group: "Plan & Sell", hint: "Consolidation, capacity, stops and master loads", keywords: ["load", "consolidation", "multi stop", "master", "house"], permission: "commercial", prefixes: ["/admin/consolidation"] },
  { id: "tenders", href: "/admin/tenders", label: "Tender & Booking", group: "Plan & Sell", hint: "Carrier tendering, counter-offers and booking", keywords: ["tender", "booking", "carrier", "counter offer"], permission: "commercial", prefixes: ["/admin/tenders"] },

  { id: "partners", href: "/admin/partners", label: "Partners & Vendors", group: "Network", hint: "Carriers, agents, vendors and global counterparts", keywords: ["partner", "vendor", "carrier", "agent", "counterpart"], permission: "all", prefixes: ["/admin/partners"] },

  { id: "receivables", href: "/admin/finance", label: "Receivables", group: "Finance", hint: "Customer invoices, aging and collections", keywords: ["receivable", "invoice", "customer billing", "collections"], permission: "finance", prefixes: ["/admin/finance"] },
  { id: "payables", href: "/admin/payables", label: "Payables", group: "Finance", hint: "Supplier bills and payment obligations", keywords: ["payable", "supplier bill", "ap", "payment"], permission: "finance", prefixes: ["/admin/payables"] },
  { id: "freight-audit", href: "/admin/freight-audit", label: "Freight Audit & Match-Pay", group: "Finance", hint: "Match booked procurement to supplier invoices before payment", keywords: ["freight audit", "match pay", "variance", "supplier invoice", "overcharge"], permission: "finance", prefixes: ["/admin/freight-audit"] },
  { id: "supplier-reconciliation", href: "/admin/partners/reconciliation", label: "Supplier Reconciliation", group: "Finance", hint: "Resolve supplier records and legacy payable links", keywords: ["supplier", "reconciliation", "legacy", "bills"], permission: "finance", prefixes: ["/admin/partners/reconciliation"] },

  { id: "management", href: "/admin/management", label: "Management", group: "Organisation", hint: "Operational, commercial and branch analytics", keywords: ["management", "analytics", "performance"], permission: "management", prefixes: ["/admin/management"] },
  { id: "migration", href: "/admin/migration", label: "Migration Hub", group: "Organisation", hint: "Controlled paper-to-KCPL migration", keywords: ["migration", "paper", "import"], permission: "management", prefixes: ["/admin/migration"] },
  { id: "paper-archive", href: "/admin/migration/archive", label: "Paper Archive", group: "Organisation", hint: "Historical paper evidence and linked digital records", keywords: ["archive", "paper", "history"], permission: "management", prefixes: ["/admin/migration/archive"] },
  { id: "migration-recovery", href: "/admin/migration/recovery", label: "Migration Recovery", group: "Organisation", hint: "Dry-run and controlled rollback of migration batches", keywords: ["migration", "recovery", "rollback"], permission: "management_finance", prefixes: ["/admin/migration/recovery"] },
  { id: "staff", href: "/admin/staff", label: "People & Branches", group: "Organisation", hint: "Staff access, teams and branch ownership", keywords: ["staff", "people", "branches", "permissions", "rbac"], permission: "staff", prefixes: ["/admin/staff"] },
];

export const workflowGroupOrder: WorkflowWorkspace["group"][] = ["Operate", "Plan & Sell", "Network", "Finance", "Organisation"];

export function workspaceAllowed(workspace: WorkflowWorkspace, capabilities: NavigationCapabilities) {
  if (workspace.permission === "all") return true;
  if (workspace.permission === "commercial") return capabilities.canViewCommercial;
  if (workspace.permission === "job_file") return capabilities.canManageJobFile;
  if (workspace.permission === "finance") return capabilities.canManageFinance;
  if (workspace.permission === "management") return capabilities.isManagement;
  if (workspace.permission === "management_finance") return capabilities.isManagement && capabilities.canManageFinance;
  if (workspace.permission === "staff") return capabilities.canManageStaff;
  return false;
}

export function visibleWorkspaces(capabilities: NavigationCapabilities) {
  return workflowWorkspaces.filter((workspace) => workspaceAllowed(workspace, capabilities));
}

export function workspaceMatchesPath(workspace: WorkflowWorkspace, pathname: string) {
  if (workspace.exact) return pathname === workspace.href;
  const prefixes = workspace.prefixes?.length ? workspace.prefixes : [workspace.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

export function activeWorkspace(pathname: string, capabilities: NavigationCapabilities) {
  const candidates = visibleWorkspaces(capabilities).filter((workspace) => workspaceMatchesPath(workspace, pathname));
  return candidates.sort((a, b) => Math.max(...(b.prefixes ?? [b.href]).map((value) => value.length)) - Math.max(...(a.prefixes ?? [a.href]).map((value) => value.length)))[0] ?? null;
}

export function groupedWorkspaces(capabilities: NavigationCapabilities) {
  const visible = visibleWorkspaces(capabilities);
  return workflowGroupOrder
    .map((group) => ({ group, items: visible.filter((workspace) => workspace.group === group) }))
    .filter((entry) => entry.items.length > 0);
}

export function workspaceSearchText(workspace: WorkflowWorkspace) {
  return [workspace.label, workspace.group, workspace.hint, ...workspace.keywords].join(" ").toLowerCase();
}
