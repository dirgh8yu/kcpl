export type WorkspacePermission =
  | "all"
  | "commercial"
  | "job_file"
  | "finance"
  | "management"
  | "management_finance"
  | "staff";

export type WorkspaceIconName =
  | "Home"
  | "Truck"
  | "Calendar"
  | "FileText"
  | "Map"
  | "Shield"
  | "Folder"
  | "CheckSquare"
  | "Bell"
  | "BellRing"
  | "Monitor"
  | "MessageSquare"
  | "Users"
  | "TrendingUp"
  | "BarChart3"
  | "Tag"
  | "Layers"
  | "ClipboardList"
  | "Globe"
  | "Zap"
  | "Network"
  | "CreditCard"
  | "Receipt"
  | "Scale"
  | "BarChart2"
  | "Database"
  | "Users2";

/*
 * The sidebar shows a handful of hubs, not every page. Pages that serve one
 * job sit as tabs inside their hub (Shipments holds pickups, customs,
 * delivery, documents and tracking), so staff pick an area once and move
 * sideways from there. Every page keeps its own address, and search still
 * finds each one directly.
 */
export type WorkspaceHubId = "overview" | "inbox" | "shipments" | "sales" | "customers" | "partners" | "finance" | "reports" | "settings";

export type WorkspaceHub = {
  id: WorkspaceHubId;
  label: string;
  icon: WorkspaceIconName;
  hint: string;
  /** Day-to-day work first; reports and settings sit apart at the bottom. */
  section: "work" | "admin";
};

export const workspaceHubs: WorkspaceHub[] = [
  { id: "overview", label: "Overview", icon: "Home", hint: "Today's work, blockers and hand-offs", section: "work" },
  { id: "inbox", label: "Inbox", icon: "Bell", hint: "Alerts, tasks and notifications that need you", section: "work" },
  { id: "shipments", label: "Shipments", icon: "Truck", hint: "Jobs from pickup to proof of delivery", section: "work" },
  { id: "sales", label: "Sales & Pricing", icon: "Tag", hint: "Enquiries, prices, rates and bookings", section: "work" },
  { id: "customers", label: "Customers", icon: "Users", hint: "Customer accounts and their portal logins", section: "work" },
  { id: "partners", label: "Partners", icon: "Globe", hint: "Carriers, agents, vendors and their connections", section: "work" },
  { id: "finance", label: "Finance", icon: "CreditCard", hint: "Invoices, supplier bills and payments", section: "work" },
  { id: "reports", label: "Reports", icon: "BarChart2", hint: "Operational, commercial and branch performance", section: "admin" },
  { id: "settings", label: "Settings", icon: "Users2", hint: "People, branches, website and data migration", section: "admin" },
];

export type WorkflowWorkspace = {
  id: string;
  href: string;
  label: string;
  hub: WorkspaceHubId;
  /** The short name on the hub's tab strip, where the hub already gives context. */
  tab: string;
  group: "Operate" | "Plan & Sell" | "Network" | "Finance" | "Organisation";
  hint: string;
  keywords: string[];
  permission: WorkspacePermission;
  icon: WorkspaceIconName;
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
  { id: "home", href: "/admin/command-centre", label: "Overview", hub: "overview", tab: "Overview", group: "Operate", hint: "Today’s work, what’s stuck and what’s next", keywords: ["overview", "home", "command centre", "dashboard", "operations"], permission: "all", icon: "Home", prefixes: ["/admin/command-centre", "/admin/branches/", "/admin/workload/"] },
  { id: "wallboard", href: "/admin/wallboard", label: "Office wall screen", hub: "overview", tab: "Wall screen", group: "Operate", hint: "Full-screen view of today’s work for the office TV", keywords: ["wallboard", "ops wallboard", "tv", "display", "board", "office", "screen"], permission: "job_file", icon: "Monitor", prefixes: ["/admin/wallboard"] },

  { id: "alerts", href: "/admin/alerts", label: "Tasks & alerts", hub: "inbox", tab: "Tasks & alerts", group: "Operate", hint: "Problems and follow-ups that need someone", keywords: ["alerts", "tasks", "exceptions", "follow up"], permission: "all", icon: "Bell", prefixes: ["/admin/alerts"] },
  { id: "notifications", href: "/admin/notifications", label: "Notifications", hub: "inbox", tab: "Notifications", group: "Operate", hint: "Messages the system has sent you", keywords: ["notifications", "history", "automation"], permission: "all", icon: "BellRing", prefixes: ["/admin/notifications"] },

  { id: "shipments", href: "/admin/shipments", label: "Shipments", hub: "shipments", tab: "All shipments", group: "Operate", hint: "Every shipment and its checklist", keywords: ["shipment", "job", "job file", "movement", "cargo"], permission: "job_file", icon: "Truck", prefixes: ["/admin/shipments", "/admin/jobs/"] },
  { id: "pickups", href: "/admin/pickups", label: "Pickups", hub: "shipments", tab: "Pickups", group: "Operate", hint: "Book pickups, confirm times and assign drivers", keywords: ["pickup", "appointment", "collection", "vendor", "driver", "booking"], permission: "job_file", icon: "Calendar", prefixes: ["/admin/pickups"] },
  { id: "visibility", href: "/admin/visibility", label: "Tracking", hub: "shipments", tab: "Tracking", group: "Operate", hint: "Where shipments are and which have gone quiet", keywords: ["tracking", "visibility", "live visibility", "eta", "carrier events", "live"], permission: "job_file", icon: "Map", prefixes: ["/admin/visibility"] },
  { id: "customs", href: "/admin/customs", label: "Customs", hub: "shipments", tab: "Customs", group: "Operate", hint: "Shipments waiting on customs and their releases", keywords: ["customs", "clearance", "duty", "release"], permission: "job_file", icon: "Shield", prefixes: ["/admin/customs"] },
  { id: "documents", href: "/admin/documents", label: "Documents", hub: "shipments", tab: "Documents", group: "Operate", hint: "Every uploaded document and what still needs checking", keywords: ["documents", "vault", "document vault", "verification", "pod", "awb", "bol"], permission: "job_file", icon: "Folder", prefixes: ["/admin/documents"] },
  { id: "freight-documents", href: "/admin/freight-documents", label: "Freight documents", hub: "shipments", tab: "Freight documents", group: "Operate", hint: "Create BL, AWB, manifests and delivery orders", keywords: ["bol", "bl", "bill of lading", "awb", "air waybill", "manifest", "shipping instruction", "freight documents", "pickup order", "delivery order"], permission: "job_file", icon: "FileText", prefixes: ["/admin/freight-documents"] },
  { id: "delivery", href: "/admin/delivery", label: "Delivery & POD", hub: "shipments", tab: "Delivery & POD", group: "Operate", hint: "Deliveries, proof of delivery and redeliveries", keywords: ["delivery", "pod", "proof", "recipient", "redelivery"], permission: "job_file", icon: "CheckSquare", prefixes: ["/admin/delivery"] },

  { id: "enquiries", href: "/admin/enquiries", label: "Enquiries", hub: "sales", tab: "Enquiries", group: "Plan & Sell", hint: "New freight requests and quotes in progress", keywords: ["enquiry", "quote", "request", "lead"], permission: "all", icon: "MessageSquare", prefixes: ["/admin/enquiries"] },
  { id: "pricing", href: "/admin/pricing", label: "Pricing", hub: "sales", tab: "Pricing", group: "Plan & Sell", hint: "What we charge customers, and margin approvals", keywords: ["pricing", "pricing desk", "sell rate", "margin", "markup", "quote"], permission: "commercial", icon: "Tag", prefixes: ["/admin/pricing"] },
  { id: "rating", href: "/admin/rating", label: "Buy rates", hub: "sales", tab: "Buy rates", group: "Plan & Sell", hint: "What carriers charge us, and choosing one", keywords: ["order", "rate", "buy rate", "procurement", "rate desk", "orders & rate desk"], permission: "commercial", icon: "BarChart3", prefixes: ["/admin/rating"] },
  { id: "tenders", href: "/admin/tenders", label: "Carrier booking", hub: "sales", tab: "Carrier booking", group: "Plan & Sell", hint: "Offer loads to carriers and confirm bookings", keywords: ["tender", "tender & booking", "booking", "carrier", "counter offer"], permission: "commercial", icon: "ClipboardList", prefixes: ["/admin/tenders"] },
  { id: "consolidation", href: "/admin/consolidation", label: "Load planning", hub: "sales", tab: "Load planning", group: "Plan & Sell", hint: "Combine shipments into one load", keywords: ["load", "load planner", "consolidation", "multi stop", "master", "house"], permission: "commercial", icon: "Layers", prefixes: ["/admin/consolidation"] },
  { id: "market-estimate", href: "/admin/market-estimate", label: "Market rates", hub: "sales", tab: "Market rates", group: "Plan & Sell", hint: "Exchange rates and market price guides", keywords: ["market", "estimate", "market estimate", "fx", "nrb", "rates"], permission: "commercial", icon: "TrendingUp", prefixes: ["/admin/market-estimate"] },

  { id: "customers", href: "/admin/crm", label: "Customers", hub: "customers", tab: "Customers", group: "Plan & Sell", hint: "Customer accounts, contacts and history", keywords: ["customer", "crm", "account"], permission: "all", icon: "Users", prefixes: ["/admin/crm"] },
  { id: "portal-access", href: "/admin/portal-access", label: "Customer portal logins", hub: "customers", tab: "Portal logins", group: "Organisation", hint: "Who at each customer can sign in to the portal", keywords: ["portal", "customer login", "self service", "customer access", "invite"], permission: "staff", icon: "Users", prefixes: ["/admin/portal-access"] },

  { id: "partners", href: "/admin/partners", label: "Partners", hub: "partners", tab: "Partners", group: "Network", hint: "Carriers, agents and suppliers we work with", keywords: ["partner", "vendor", "carrier", "agent", "counterpart"], permission: "all", icon: "Globe", prefixes: ["/admin/partners"] },
  { id: "carrier-integrations", href: "/admin/carrier-integrations", label: "Carrier connections", hub: "partners", tab: "Carrier connections", group: "Network", hint: "Carrier systems that send us tracking automatically", keywords: ["carrier api", "carrier integrations", "integration", "maersk", "dhl", "dcsa", "webhook", "tracking sync", "schedule"], permission: "job_file", icon: "Zap", prefixes: ["/admin/carrier-integrations"] },
  { id: "edi", href: "/admin/edi", label: "EDI messages", hub: "partners", tab: "EDI", group: "Network", hint: "Electronic messages exchanged with carriers", keywords: ["edi", "edi gateway", "x12", "204", "990", "214", "load tender", "carrier response", "van", "transaction"], permission: "job_file", icon: "Network", prefixes: ["/admin/edi"] },

  { id: "receivables", href: "/admin/finance", label: "Receivables", hub: "finance", tab: "Receivables", group: "Finance", hint: "Customer invoices and who owes what", keywords: ["receivable", "invoice", "customer billing", "collections"], permission: "finance", icon: "CreditCard", prefixes: ["/admin/finance"] },
  { id: "payables", href: "/admin/payables", label: "Payables", hub: "finance", tab: "Payables", group: "Finance", hint: "Supplier bills and what we owe", keywords: ["payable", "supplier bill", "ap", "payment"], permission: "finance", icon: "Receipt", prefixes: ["/admin/payables"] },
  { id: "freight-audit", href: "/admin/freight-audit", label: "Supplier bill checks", hub: "finance", tab: "Bill checks", group: "Finance", hint: "Check supplier bills against what we booked before paying", keywords: ["freight audit", "match pay", "match-pay", "variance", "supplier invoice", "overcharge"], permission: "finance", icon: "Scale", prefixes: ["/admin/freight-audit"] },
  { id: "supplier-reconciliation", href: "/admin/partners/reconciliation", label: "Supplier records", hub: "finance", tab: "Supplier records", group: "Finance", hint: "Tidy supplier details and link old bills", keywords: ["supplier", "reconciliation", "supplier reconciliation", "legacy", "bills"], permission: "finance", icon: "Scale", prefixes: ["/admin/partners/reconciliation"] },

  { id: "management", href: "/admin/management", label: "Management", hub: "reports", tab: "Management", group: "Organisation", hint: "How the business and each branch is doing", keywords: ["management", "analytics", "performance"], permission: "management", icon: "BarChart2", prefixes: ["/admin/management"] },

  { id: "staff", href: "/admin/staff", label: "People & branches", hub: "settings", tab: "People & branches", group: "Organisation", hint: "Who can sign in, their role and branches", keywords: ["staff", "people", "branches", "permissions", "rbac"], permission: "staff", icon: "Users2", prefixes: ["/admin/staff"] },
  { id: "site-gallery", href: "/admin/gallery", label: "Website gallery", hub: "settings", tab: "Website gallery", group: "Organisation", hint: "Photos on the public website", keywords: ["gallery", "website", "photo", "image", "publish"], permission: "management", icon: "Folder", prefixes: ["/admin/gallery"] },
  { id: "migration", href: "/admin/migration", label: "Import old records", hub: "settings", tab: "Import old records", group: "Organisation", hint: "Bring paper and spreadsheet records into KCPL", keywords: ["migration", "migration hub", "paper", "import"], permission: "management", icon: "Database", prefixes: ["/admin/migration"] },
  { id: "paper-archive", href: "/admin/migration/archive", label: "Paper archive", hub: "settings", tab: "Paper archive", group: "Organisation", hint: "Scanned paper files linked to their records", keywords: ["archive", "paper", "history"], permission: "management", icon: "Folder", prefixes: ["/admin/migration/archive"] },
  { id: "migration-recovery", href: "/admin/migration/recovery", label: "Undo an import", hub: "settings", tab: "Undo an import", group: "Organisation", hint: "Preview and undo an import batch", keywords: ["migration", "recovery", "rollback", "migration recovery"], permission: "management_finance", icon: "Database", prefixes: ["/admin/migration/recovery"] },
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

/** The hubs this person can open, each with its visible pages in tab order. */
export function visibleHubs(capabilities: NavigationCapabilities) {
  const visible = visibleWorkspaces(capabilities);
  return workspaceHubs
    .map((hub) => ({ hub, items: visible.filter((workspace) => workspace.hub === hub.id) }))
    .filter((entry) => entry.items.length > 0)
    .map((entry) => ({ ...entry, href: entry.items[0].href }));
}

/** The hub the current page belongs to, with its tabs, or null outside every hub. */
export function activeHub(pathname: string, capabilities: NavigationCapabilities) {
  const workspace = activeWorkspace(pathname, capabilities);
  if (!workspace) return null;
  return visibleHubs(capabilities).find((entry) => entry.hub.id === workspace.hub) ?? null;
}

export function workspaceSearchText(workspace: WorkflowWorkspace) {
  return [workspace.label, workspace.group, workspace.hint, ...workspace.keywords].join(" ").toLowerCase();
}
