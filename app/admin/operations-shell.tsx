"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  Boxes,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  ChevronRight,
  Command,
  HandCoins,
  Handshake,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OperationsCommandPalette, type OperationsCommandItem } from "./operations-command-palette";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (path: string) => boolean;
  keywords?: string[];
};

type NavGroup = { label: string; items: NavItem[] };

const workspace: NavItem[] = [
  { href: "/admin/command-centre", label: "Operations Home", icon: LayoutDashboard, match: (path) => path.startsWith("/admin/command-centre"), keywords: ["overview", "dashboard", "command centre"] },
];

const operations: NavItem[] = [
  { href: "/admin/shipments", label: "Shipments", icon: Boxes, match: (path) => path.startsWith("/admin/shipments") || path.startsWith("/admin/jobs/"), keywords: ["job file", "movement", "tracking"] },
  { href: "/admin/customs", label: "Customs", icon: Landmark, match: (path) => path.startsWith("/admin/customs"), keywords: ["clearance", "declaration", "border"] },
  { href: "/admin/alerts", label: "Alerts", icon: BellRing, match: (path) => path.startsWith("/admin/alerts"), keywords: ["exceptions", "attention", "warnings"] },
];

const commercial: NavItem[] = [
  { href: "/admin", label: "Enquiries", icon: PackageSearch, match: (path) => path === "/admin", keywords: ["quotes", "quote", "commercial"] },
  { href: "/admin/crm", label: "Customers", icon: Building2, match: (path) => path.startsWith("/admin/crm"), keywords: ["crm", "customer 360"] },
  { href: "/admin/partners", label: "Partners", icon: Handshake, match: (path) => path.startsWith("/admin/partners"), keywords: ["vendors", "agents", "counterparts", "suppliers"] },
  { href: "/admin/market-estimate", label: "Reference Tools", icon: Calculator, match: (path) => path.startsWith("/admin/market-estimate"), keywords: ["rates", "forex", "nrb", "route", "distance"] },
];

function breadcrumbFor(pathname: string) {
  if (pathname === "/admin") return ["Commercial", "Enquiries"];
  if (pathname.startsWith("/admin/command-centre")) return ["Workspace", "Operations Home"];
  if (pathname.startsWith("/admin/jobs/")) return ["Operations", "Shipments", decodeURIComponent(pathname.split("/").pop() || "Job file")];
  if (pathname.startsWith("/admin/shipments")) return ["Operations", "Shipments"];
  if (pathname.startsWith("/admin/customs")) return ["Operations", "Customs"];
  if (pathname.startsWith("/admin/alerts")) return ["Operations", "Alerts"];
  if (pathname.startsWith("/admin/crm/")) return ["Commercial", "Customers", "Customer 360"];
  if (pathname.startsWith("/admin/crm")) return ["Commercial", "Customers"];
  if (pathname.startsWith("/admin/partners")) return ["Commercial", "Partners"];
  if (pathname.startsWith("/admin/market-estimate")) return ["Commercial", "Reference Tools"];
  if (pathname.startsWith("/admin/finance")) return ["Finance", "Finance & AR"];
  if (pathname.startsWith("/admin/payables")) return ["Finance", "Payables"];
  if (pathname.startsWith("/admin/management")) return ["Finance", "Management Analytics"];
  if (pathname.startsWith("/admin/staff")) return ["Network", "Staff & branches"];
  return ["KCPL Operations"];
}

export function OperationsShell({
  children,
  userName,
  roleLabel,
  canManageStaff = false,
  canManageFinance = false,
  isManagement = false,
  signOutPath = "/api/admin/session?logout=1",
}: {
  children: React.ReactNode;
  userName: string;
  roleLabel?: string;
  canManageStaff?: boolean;
  canManageFinance?: boolean;
  isManagement?: boolean;
  signOutPath?: string;
}) {
  const pathname = usePathname();
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  function closeMobile() {
    setMobileOpen(false);
    window.setTimeout(() => mobileTriggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
        return;
      }
      if (event.key === "Escape") {
        if (mobileOpen) {
          event.preventDefault();
          closeMobile();
        } else if (paletteOpen) {
          event.preventDefault();
          setPaletteOpen(false);
        }
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [mobileOpen, paletteOpen]);

  useEffect(() => {
    if (!mobileOpen && !paletteOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen, paletteOpen]);

  const groups = useMemo<NavGroup[]>(() => {
    const finance: NavItem[] = canManageFinance ? [
      { href: "/admin/finance", label: "Finance & AR", icon: ReceiptText, match: (path) => path.startsWith("/admin/finance"), keywords: ["invoices", "receivables", "payments"] },
      { href: "/admin/payables", label: "Payables", icon: HandCoins, match: (path) => path.startsWith("/admin/payables"), keywords: ["suppliers", "vendor bills", "expenses"] },
    ] : [];
    if (isManagement) finance.push({ href: "/admin/management", label: "Management Analytics", icon: ChartNoAxesCombined, match: (path) => path.startsWith("/admin/management"), keywords: ["profit", "margin", "analytics", "p&l"] });

    const network: NavItem[] = canManageStaff ? [
      { href: "/admin/staff", label: "Staff & branches", icon: UsersRound, match: (path) => path.startsWith("/admin/staff"), keywords: ["users", "roles", "branches", "team"] },
    ] : [];

    return [
      { label: "Workspace", items: workspace },
      { label: "Operations", items: operations },
      { label: "Commercial", items: commercial },
      ...(finance.length ? [{ label: "Finance", items: finance }] : []),
      ...(network.length ? [{ label: "Network", items: network }] : []),
    ];
  }, [canManageFinance, canManageStaff, isManagement]);

  const commandItems = useMemo<OperationsCommandItem[]>(() => groups.flatMap((group) => group.items.map((item) => ({ href: item.href, label: item.label, group: group.label, keywords: item.keywords }))), [groups]);
  const breadcrumbs = breadcrumbFor(pathname);
  const resolvedRole = roleLabel || (isManagement ? "Management" : canManageFinance ? "Finance / Commercial" : canManageStaff ? "Administrator" : "Operations staff");
  const initial = (userName.trim()[0] || "K").toUpperCase();

  return (
    <div className={`kcpl-ops min-h-screen bg-[var(--ops-bg)] text-[var(--ops-text)] transition-[padding] duration-200 ${collapsed ? "lg:pl-[72px]" : "lg:pl-[244px]"}`}>
      <a href="#kcpl-ops-content" className="ops-skip-link">Skip to main content</a>
      <aside className={`ops-sidebar fixed inset-y-0 left-0 z-50 hidden flex-col text-white transition-[width] duration-200 lg:flex ${collapsed ? "w-[72px]" : "w-[244px]"}`}>
        <div className={`flex h-14 items-center border-b border-white/[.07] ${collapsed ? "justify-center px-2" : "justify-between px-3"}`}>
          <Link href="/admin/command-centre" className="flex min-w-0 items-center gap-2.5" title="KCPL Operations">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef0ff] text-[11px] font-black text-[#3445a3]">K</span>
            {!collapsed ? <span className="min-w-0"><strong className="block truncate text-[12px] font-semibold tracking-[-.01em] text-white/92">KCPL Operations</strong><span className="mt-0.5 block text-[9px] tracking-[.08em] text-white/35">OPERATING SYSTEM</span></span> : null}
          </Link>
          {!collapsed ? <button type="button" onClick={() => setCollapsed(true)} className="grid h-8 w-8 place-items-center rounded-md text-white/40 transition hover:bg-white/[.06] hover:text-white/80" aria-label="Collapse sidebar"><PanelLeftClose size={14}/></button> : null}
        </div>

        {collapsed ? <button type="button" onClick={() => setCollapsed(false)} className="mx-auto mt-2 grid h-8 w-8 place-items-center rounded-md text-white/40 transition hover:bg-white/[.06] hover:text-white/80" aria-label="Expand sidebar"><PanelLeftOpen size={14}/></button> : null}

        <nav className={`flex-1 overflow-y-auto pb-4 ${collapsed ? "px-2 pt-2" : "px-2.5 pt-3"}`} aria-label="KCPL Operations navigation">
          {groups.map((group, groupIndex) => <div key={group.label} className={groupIndex ? "mt-4" : ""}>
            {!collapsed ? <p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[.11em] text-white/35">{group.label}</p> : groupIndex ? <div className="mx-2 mb-2 border-t border-white/[.06]"/> : null}
            <div className="space-y-0.5">{group.items.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={`group relative flex h-9 items-center rounded-lg text-[11px] font-medium transition ${collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"} ${active ? "bg-white/[.09] text-white" : "text-white/60 hover:bg-white/[.055] hover:text-white/90"}`}>
                {active ? <span className="absolute inset-y-2 left-0 w-[2px] rounded-r bg-[#8996ff]"/> : null}
                <Icon size={15} strokeWidth={1.8} className={active ? "text-[#aab3ff]" : "text-white/48 transition group-hover:text-white/70"}/>
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>;
            })}</div>
          </div>)}
        </nav>

        <div className={`border-t border-white/[.07] ${collapsed ? "p-2" : "p-2.5"}`}>
          <div className={`rounded-lg ${collapsed ? "flex justify-center py-2" : "bg-white/[.035] p-2.5"}`}>
            <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.07] text-[10px] font-semibold text-white/85">{initial}</span>
              {!collapsed ? <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium text-white/82">{userName}</p><p className="mt-0.5 truncate text-[9px] text-white/40">{resolvedRole}</p></div> : null}
            </div>
            {!collapsed ? <a href={signOutPath} className="mt-2 flex h-8 items-center gap-2 rounded-md px-1.5 text-[10px] text-white/45 transition hover:bg-white/[.05] hover:text-white/80"><LogOut size={12}/>Sign out</a> : null}
          </div>
        </div>
      </aside>

      <header className="ops-topbar sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-[#e5e7ea] bg-white/95 px-3 backdrop-blur-xl sm:gap-3 sm:px-4 lg:px-5">
        <button ref={mobileTriggerRef} type="button" onClick={() => setMobileOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[#626a73] hover:bg-[#f2f3f4] lg:hidden" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="kcpl-mobile-nav"><Menu size={16}/></button>
        <nav aria-label="Current location" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[11px] text-[#8a9198]">
          {breadcrumbs.map((item, index) => <span key={`${item}-${index}`} className="flex min-w-0 items-center gap-1.5">{index ? <ChevronRight size={11} className="shrink-0 text-[#c0c4c8]"/> : null}<span className={`truncate ${index === breadcrumbs.length - 1 ? "font-medium text-[#444a51]" : ""}`} aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>{item}</span></span>)}
        </nav>
        <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-9 min-w-[210px] items-center gap-2 rounded-lg border border-[#e1e4e7] bg-[#fafafa] px-2.5 text-left text-[11px] text-[#7d858d] transition hover:border-[#d3d7dc] hover:bg-white md:flex" aria-haspopup="dialog">
          <Search size={13}/><span className="flex-1">Search workspaces</span><kbd className="rounded border border-[#dde0e3] bg-white px-1.5 py-0.5 font-sans text-[9px] text-[#858c93]">⌘ K</kbd>
        </button>
        <button type="button" onClick={() => setPaletteOpen(true)} className="grid h-9 w-9 place-items-center rounded-md text-[#68717a] hover:bg-[#f2f3f4] md:hidden" aria-label="Search workspaces" aria-haspopup="dialog"><Command size={15}/></button>
        <Link href="/admin/alerts" className="grid h-9 w-9 place-items-center rounded-md text-[#68717a] transition hover:bg-[#f2f3f4] hover:text-[#30363d]" aria-label="Open alerts" title="Alerts"><BellRing size={15}/></Link>
        <Link href="/admin" className="ops-button ops-button-primary hidden sm:inline-flex"><PackageSearch size={13}/>Enquiry desk</Link>
      </header>

      <div id="kcpl-ops-content" tabIndex={-1} className="min-w-0 outline-none">{children}</div>

      {mobileOpen ? <div className="fixed inset-0 z-[80] lg:hidden">
        <button type="button" className="absolute inset-0 bg-[#0d1117]/35 backdrop-blur-[1px]" onClick={closeMobile} aria-label="Close navigation overlay"/>
        <aside id="kcpl-mobile-nav" role="dialog" aria-modal="true" aria-label="KCPL Operations navigation" className="ops-sidebar absolute inset-y-0 left-0 flex w-[min(304px,88vw)] flex-col text-white shadow-2xl">
          <div className="flex h-14 items-center justify-between border-b border-white/[.07] px-3.5"><Link href="/admin/command-centre" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef0ff] text-[11px] font-black text-[#3445a3]">K</span><span><strong className="block text-[12px] font-semibold">KCPL Operations</strong><span className="text-[9px] text-white/40">OPERATING SYSTEM</span></span></Link><button type="button" onClick={closeMobile} className="grid h-10 w-10 place-items-center rounded-md text-white/60 hover:bg-white/[.06] hover:text-white" aria-label="Close navigation"><X size={15}/></button></div>
          <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Mobile KCPL Operations navigation">{groups.map((group, groupIndex) => <div key={group.label} className={groupIndex ? "mt-4" : ""}><p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[.11em] text-white/35">{group.label}</p><div className="space-y-0.5">{group.items.map((item) => { const active = item.match(pathname); const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-current={active ? "page" : undefined} className={`flex h-11 items-center gap-2.5 rounded-lg px-2.5 text-[12px] font-medium ${active ? "bg-white/[.09] text-white" : "text-white/65 hover:bg-white/[.055] hover:text-white/90"}`}><Icon size={16}/>{item.label}</Link>; })}</div></div>)}</nav>
          <div className="border-t border-white/[.07] p-3"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/[.08] text-[10px] font-semibold">{initial}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] text-white/85">{userName}</p><p className="text-[9px] text-white/40">{resolvedRole}</p></div><a href={signOutPath} className="grid h-10 w-10 place-items-center rounded-md text-white/50 hover:bg-white/[.05] hover:text-white" aria-label="Sign out"><LogOut size={14}/></a></div></div>
        </aside>
      </div> : null}

      {paletteOpen ? <OperationsCommandPalette items={commandItems} onClose={() => setPaletteOpen(false)}/> : null}
    </div>
  );
}
