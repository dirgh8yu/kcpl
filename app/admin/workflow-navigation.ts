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
  { id: "home", href: "/admin/command-centre", label: "Overview", hub: "overview", tab: "Overview", group: "Operate", hint: "Operational overview, blockers and workflow handoffs", keywords: ["overview", "home", "command centre", "dashboard", "operations"], permission: "all", icon: "Home", prefixes: ["/admin/command-centre"] },
  { id: "wallboard", href: "/admin/wallboard", label: "Ops Wallboard", hub: "overview", tab: "Wallboard", group: "Operate", hint: "Fullscreen live display for the office wall — pulse, today, blockers, transitions", keywords: ["wallboard", "tv", "display", "board", "office", "screen"], permission: "job_file", icon: "Monitor", prefixes: ["/admin/wallboard"] },

  { id: "alerts", href: "/admin/alerts", label: "Tasks & Alerts", hub: "inbox", tab: "Tasks & alerts", group: "Operate", hint: "Exceptions, ownership and follow-up", keywords: ["alerts", "tasks", "exceptions", "follow up"], permission: "all", icon: "Bell", prefixes: ["/admin/alerts"] },
  { id: "notifications", href: "/admin/notifications", label: "Notifications", hub: "inbox", tab: "Notifications", group: "Operate", hint: "Assignment and automation notification history", keywords: ["notifications", "history", "automation"], permission: "all", icon: "BellRing", prefixes: ["/admin/notifications"] },

  { id: "shipments", href: "/admin/shipments", label: "Shipments", hub: "shipments", tab: "All shipments", group: "Operate", hint: "Active movements and Digital Job Files", keywords: ["shipment", "job", "job file", "movement", "cargo"], permission: "job_file", icon: "Truck", prefixes: ["/admin/shipments", "/admin/jobs/"] },
  { id: "pickups", href: "/admin/pickups", label: "Pickup Scheduling", hub: "shipments", tab: "Pickups", group: "Operate", hint: "Booking handoff, pickup windows, carrier confirmation and driver assignment", keywords: ["pickup", "appointment", "collection", "vendor", "driver", "booking"], permission: "job_file", icon: "Calendar", prefixes: ["/admin/pickups"] },
  { id: "visibility", href: "/admin/visibility", label: "Live Visibility", hub: "shipments", tab: "Tracking", group: "Operate", hint: "Tracking feeds, ETA movement and stale visibility", keywords: ["tracking", "visibility", "eta", "carrier events", "live"], permission: "job_file", icon: "Map", prefixes: ["/admin/visibility"] },
  { id: "customs", href: "/admin/customs", label: "Customs", hub: "shipments", tab: "Customs", group: "Operate", hint: "Clearance queue, release controls and customs blockers", keywords: ["customs", "clearance", "duty", "release"], permission: "job_file", icon: "Shield", prefixes: ["/admin/customs"] },
  { id: "documents", href: "/admin/documents", label: "Documents", hub: "shipments", tab: "Documents", group: "Operate", hint: "Verified Document Vault and review queue", keywords: ["documents", "vault", "verification", "pod", "awb", "bol"], permission: "job_file", icon: "Folder", prefixes: ["/admin/documents"] },
  { id: "freight-documents", href: "/admin/freight-documents", label: "Freight Documents", hub: "shipments", tab: "Freight documents", group: "Operate", hint: "Generate controlled BL, AWB, consignment, manifest and execution documents", keywords: ["bol", "bl", "bill of lading", "awb", "air waybill", "manifest", "shipping instruction", "freight documents", "pickup order", "delivery order"], permission: "job_file", icon: "FileText", prefixes: ["/admin/freight-documents"] },
  { id: "delivery", href: "/admin/delivery", label: "Delivery & POD", hub: "shipments", tab: "Delivery & POD", group: "Operate", hint: "Final-mile attempts, proof of delivery and redelivery", keywords: ["delivery", "pod", "proof", "recipient", "redelivery"], permission: "job_file", icon: "CheckSquare", prefixes: ["/admin/delivery"] },

  { id: "enquiries", href: "/admin/enquiries", label: "Enquiries", hub: "sales", tab: "Enquiries", group: "Plan & Sell", hint: "Incoming freight requests and quote pipeline", keywords: ["enquiry", "quote", "request", "lead"], permission: "all", icon: "MessageSquare", prefixes: ["/admin/enquiries"] },
  { id: "pricing", href: "/admin/pricing", label: "Pricing Desk", hub: "sales", tab: "Pricing", group: "Plan & Sell", hint: "Customer sell price, margin floors and approvals", keywords: ["pricing", "sell rate", "margin", "markup", "quote"], permission: "commercial", icon: "Tag", prefixes: ["/admin/pricing"] },
  { id: "rating", href: "/admin/rating", label: "Orders & Rate Desk", hub: "sales", tab: "Orders & rates", group: "Plan & Sell", hint: "Transport orders, Partner buy rates and selection", keywords: ["order", "rate", "buy rate", "procurement", "rate desk"], permission: "commercial", icon: "BarChart3", prefixes: ["/admin/rating"] },
  { id: "tenders", href: "/admin/tenders", label: "Tender & Booking", hub: "sales", tab: "Tenders & booking", group: "Plan & Sell", hint: "Carrier tendering, counter-offers and booking", keywords: ["tender", "booking", "carrier", "counter offer"], permission: "commercial", icon: "ClipboardList", prefixes: ["/admin/tenders"] },
  { id: "consolidation", href: "/admin/consolidation", label: "Load Planner", hub: "sales", tab: "Load planner", group: "Plan & Sell", hint: "Consolidation, capacity, stops and master loads", keywords: ["load", "consolidation", "multi stop", "master", "house"], permission: "commercial", icon: "Layers", prefixes: ["/admin/consolidation"] },
  { id: "market-estimate", href: "/admin/market-estimate", label: "Market Estimate", hub: "sales", tab: "Market rates", group: "Plan & Sell", hint: "FX, market inputs and planning references", keywords: ["market", "estimate", "fx", "nrb", "rates"], permission: "commercial", icon: "TrendingUp", prefixes: ["/admin/market-estimate"] },

  { id: "customers", href: "/admin/crm", label: "Customers", hub: "customers", tab: "Customers", group: "Plan & Sell", hint: "Customer accounts and Customer 360", keywords: ["customer", "crm", "account"], permission: "all", icon: "Users", prefixes: ["/admin/crm"] },
  { id: "portal-access", href: "/admin/portal-access", label: "Customer Portal Access", hub: "customers", tab: "Portal logins", group: "Organisation", hint: "Customer logins for shipment, document and invoice self-service", keywords: ["portal", "customer login", "self service", "customer access", "invite"], permission: "staff", icon: "Users", prefixes: ["/admin/portal-access"] },

  { id: "partners", href: "/admin/partners", label: "Partners & Vendors", hub: "partners", tab: "Partners", group: "Network", hint: "Carriers, agents, vendors and global counterparts", keywords: ["partner", "vendor", "carrier", "agent", "counterpart"], permission: "all", icon: "Globe", prefixes: ["/admin/partners"] },
  { id: "carrier-integrations", href: "/admin/carrier-integrations", label: "Carrier Integrations", hub: "partners", tab: "Carrier APIs", group: "Network", hint: "Live carrier APIs, DCSA webhooks, provider health and shipment sync", keywords: ["carrier api", "integration", "maersk", "dhl", "dcsa", "webhook", "tracking sync", "schedule"], permission: "job_file", icon: "Zap", prefixes: ["/admin/carrier-integrations"] },
  { id: "edi", href: "/admin/edi", label: "EDI Gateway", hub: "partners", tab: "EDI", group: "Network", hint: "X12 204 tenders, 990 carrier responses, 214 tracking and transaction quarantine", keywords: ["edi", "x12", "204", "990", "214", "load tender", "carrier response", "van", "transaction"], permission: "job_file", icon: "Network", prefixes: ["/admin/edi"] },

  { id: "receivables", href: "/admin/finance", label: "Receivables", hub: "finance", tab: "Receivables", group: "Finance", hint: "Customer invoices, aging and collections", keywords: ["receivable", "invoice", "customer billing", "collections"], permission: "finance", icon: "CreditCard", prefixes: ["/admin/finance"] },
  { id: "payables", href: "/admin/payables", label: "Payables", hub: "finance", tab: "Payables", group: "Finance", hint: "Supplier bills and payment obligations", keywords: ["payable", "supplier bill", "ap", "payment"], permission: "finance", icon: "Receipt", prefixes: ["/admin/payables"] },
  { id: "freight-audit", href: "/admin/freight-audit", label: "Freight Audit & Match-Pay", hub: "finance", tab: "Freight audit", group: "Finance", hint: "Match booked procurement to supplier invoices before payment", keywords: ["freight audit", "match pay", "variance", "supplier invoice", "overcharge"], permission: "finance", icon: "Scale", prefixes: ["/admin/freight-audit"] },
  { id: "supplier-reconciliation", href: "/admin/partners/reconciliation", label: "Supplier Reconciliation", hub: "finance", tab: "Supplier reconciliation", group: "Finance", hint: "Resolve supplier records and legacy payable links", keywords: ["supplier", "reconciliation", "legacy", "bills"], permission: "finance", icon: "Scale", prefixes: ["/admin/partners/reconciliation"] },

  { id: "management", href: "/admin/management", label: "Management", hub: "reports", tab: "Management", group: "Organisation", hint: "Operational, commercial and branch analytics", keywords: ["management", "analytics", "performance"], permission: "management", icon: "BarChart2", prefixes: ["/admin/management"] },

  { id: "staff", href: "/admin/staff", label: "People & Branches", hub: "settings", tab: "People & branches", group: "Organisation", hint: "Staff access, teams and branch ownership", keywords: ["staff", "people", "branches", "permissions", "rbac"], permission: "staff", icon: "Users2", prefixes: ["/admin/staff"] },
  { id: "site-gallery", href: "/admin/gallery", label: "Website Gallery", hub: "settings", tab: "Website gallery", group: "Organisation", hint: "Upload and publish photos on the public website", keywords: ["gallery", "website", "photo", "image", "publish"], permission: "management", icon: "Folder", prefixes: ["/admin/gallery"] },
  { id: "migration", href: "/admin/migration", label: "Migration Hub", hub: "settings", tab: "Migration", group: "Organisation", hint: "Controlled paper-to-KCPL migration", keywords: ["migration", "paper", "import"], permission: "management", icon: "Database", prefixes: ["/admin/migration"] },
  { id: "paper-archive", href: "/admin/migration/archive", label: "Paper Archive", hub: "settings", tab: "Paper archive", group: "Organisation", hint: "Historical paper evidence and linked digital records", keywords: ["archive", "paper", "history"], permission: "management", icon: "Folder", prefixes: ["/admin/migration/archive"] },
  { id: "migration-recovery", href: "/admin/migration/recovery", label: "Migration Recovery", hub: "settings", tab: "Migration recovery", group: "Organisation", hint: "Dry-run and controlled rollback of migration batches", keywords: ["migration", "recovery", "rollback"], permission: "management_finance", icon: "Database", prefixes: ["/admin/migration/recovery"] },
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
