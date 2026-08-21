"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Boxes,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  ChevronRight,
  HandCoins,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Star,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (path: string) => boolean;
  hint: string;
};

type NavGroup = { label: string; items: NavItem[] };
type StoredWorkspace = { href: string; label: string };

const operationsNav: NavItem[] = [
  { href: "/admin/command-centre", label: "Home", icon: LayoutDashboard, match: (path) => path.startsWith("/admin/command-centre"), hint: "Operational day and exceptions" },
  { href: "/admin", label: "Enquiries", icon: PackageSearch, match: (path) => path === "/admin", hint: "Requests, quotes and pricing" },
  { href: "/admin/shipments", label: "Shipments", icon: Boxes, match: (path) => path.startsWith("/admin/shipments") || path.startsWith("/admin/jobs/"), hint: "Movements and Digital Job Files" },
  { href: "/admin/customs", label: "Customs", icon: ShieldCheck, match: (path) => path.startsWith("/admin/customs"), hint: "Clearance queue, documents and customs blockers" },
  { href: "/admin/alerts", label: "Tasks & alerts", icon: Bell, match: (path) => path.startsWith("/admin/alerts"), hint: "Exceptions, ownership and follow-up" },
];

const relationshipNav: NavItem[] = [
  { href: "/admin/crm", label: "Customers", icon: Building2, match: (path) => path.startsWith("/admin/crm"), hint: "Customer accounts and Customer 360" },
  { href: "/admin/partners", label: "Partners", icon: Handshake, match: (path) => path.startsWith("/admin/partners"), hint: "Agents, carriers, vendors and counterparts" },
];

const marketNav: NavItem = { href: "/admin/market-estimate", label: "Market estimate", icon: Calculator, match: (path) => path.startsWith("/admin/market-estimate"), hint: "Rates, currencies and market inputs" };

function safeStoredWorkspaces(key: string): StoredWorkspace[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]") as StoredWorkspace[];
    return Array.isArray(value) ? value.filter((item) => item && typeof item.href === "string" && typeof item.label === "string") : [];
  } catch {
    return [];
  }
}

export function OperationsShell({
  children,
  userName,
  canManageStaff = false,
  canManageFinance = false,
  isManagement = false,
  signOutPath = "/api/admin/session?logout=1",
}: {
  children: React.ReactNode;
  userName: string;
  canManageStaff?: boolean;
  canManageFinance?: boolean;
  isManagement?: boolean;
  signOutPath?: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [favorites, setFavorites] = useState<StoredWorkspace[]>([]);
  const [recents, setRecents] = useState<StoredWorkspace[]>([]);

  const groups = useMemo<NavGroup[]>(() => {
    const commercial: NavItem[] = [
      marketNav,
      ...(canManageFinance ? [
        { href: "/admin/finance", label: "Receivables", icon: ReceiptText, match: (path: string) => path.startsWith("/admin/finance"), hint: "Invoices, aging and collections" },
        { href: "/admin/payables", label: "Payables", icon: HandCoins, match: (path: string) => path.startsWith("/admin/payables"), hint: "Supplier bills and obligations" },
      ] : []),
    ];
    const organisation: NavItem[] = [
      ...(isManagement ? [{ href: "/admin/management", label: "Management", icon: ChartNoAxesCombined, match: (path: string) => path.startsWith("/admin/management"), hint: "Operational and commercial analytics" }] : []),
      ...(canManageStaff ? [{ href: "/admin/staff", label: "People & branches", icon: UsersRound, match: (path: string) => path.startsWith("/admin/staff"), hint: "Access, teams and branch ownership" }] : []),
    ];
    return [
      { label: "Operations", items: operationsNav },
      { label: "Relationships", items: relationshipNav },
      { label: "Commercial", items: commercial },
      ...(organisation.length ? [{ label: "Organisation", items: organisation }] : []),
    ];
  }, [canManageFinance, canManageStaff, isManagement]);

  const allNav = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeItem = allNav.find((item) => item.match(pathname));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(window.localStorage.getItem("kcpl-ops-sidebar-collapsed") === "1");
      setFavorites(safeStoredWorkspaces("kcpl-ops-favorites"));
      setRecents(safeStoredWorkspaces("kcpl-ops-recents"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kcpl-ops-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (!activeItem) return;
    const current = { href: activeItem.href, label: activeItem.label };
    const next = [current, ...safeStoredWorkspaces("kcpl-ops-recents").filter((item) => item.href !== current.href)].slice(0, 5);
    window.localStorage.setItem("kcpl-ops-recents", JSON.stringify(next));
    const frame = window.requestAnimationFrame(() => setRecents(next));
    return () => window.cancelAnimationFrame(frame);
  }, [activeItem]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCreateOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleFavorite() {
    if (!activeItem) return;
    const exists = favorites.some((item) => item.href === activeItem.href);
    const next = exists ? favorites.filter((item) => item.href !== activeItem.href) : [...favorites, { href: activeItem.href, label: activeItem.label }];
    setFavorites(next);
    window.localStorage.setItem("kcpl-ops-favorites", JSON.stringify(next));
  }

  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";
  const activeFavorite = activeItem ? favorites.some((item) => item.href === activeItem.href) : false;
  const favoriteItems = favorites.map((favorite) => allNav.find((item) => item.href === favorite.href)).filter((item): item is NavItem => Boolean(item));
  const recentItems = recents.map((recent) => allNav.find((item) => item.href === recent.href)).filter((item): item is NavItem => Boolean(item)).slice(0, 3);

  return (
    <div className="kcpl-ops min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-[#dcd7d1] bg-[#f1efec]/96 backdrop-blur-xl transition-[width] duration-200 lg:flex ${collapsed ? "w-[68px]" : "w-[244px]"}`}>
        <div className={`flex h-[58px] items-center ${collapsed ? "justify-center px-2" : "justify-between px-3.5"}`}>
          <Link href="/admin/command-centre" className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`} aria-label="KCPL Operations home">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#df7159] text-[11px] font-black text-white shadow-[0_5px_14px_rgba(177,78,58,.13)]">K</span>
            {!collapsed ? <span className="min-w-0"><strong className="block truncate text-[13px] font-[760] tracking-[-.02em] text-[#2f2a27]">KCPL Operations</strong><span className="mt-0.5 block truncate text-[10px] font-medium text-[#817a73]">Freight operating system</span></span> : null}
          </Link>
          {!collapsed ? <button type="button" onClick={() => setCollapsed(true)} className="grid h-8 w-8 place-items-center rounded-[8px] text-[#8f8881] hover:bg-white hover:text-[#4d4742]" aria-label="Collapse navigation"><PanelLeftClose size={15}/></button> : null}
        </div>

        <div className={`px-2.5 pt-2 ${collapsed ? "flex justify-center" : ""}`}>
          <button type="button" className={`flex h-9 items-center rounded-[9px] border border-[#d9d4ce] bg-white text-[#716a64] shadow-[0_1px_2px_rgba(45,35,29,.03)] hover:border-[#c7c0b9] ${collapsed ? "w-9 justify-center" : "w-full gap-2.5 px-2.5"}`} aria-label="Open command palette">
            <Search size={14}/>{!collapsed ? <><span className="flex-1 text-left text-[11px] font-semibold">Search KCPL…</span><kbd className="rounded-[5px] border border-[#e2ddd8] bg-[#f7f5f2] px-1.5 py-0.5 text-[9px] font-bold text-[#8f8881]">⌘K</kbd></> : null}
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          {!collapsed && favoriteItems.length ? <SidebarSection label="Pinned">{favoriteItems.map((item) => <NavLink key={`favorite-${item.href}`} item={item} active={item.match(pathname)} collapsed={false}/>)}</SidebarSection> : null}
          {groups.map((group, groupIndex) => <div key={group.label} className={groupIndex || favoriteItems.length ? "mt-4" : ""}>
            {!collapsed ? <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#928b84]">{group.label}</p> : groupIndex ? <div className="mx-2 mb-3 border-t border-[#ded9d4]"/> : null}
            <div className="space-y-0.5">{group.items.map((item) => <NavLink key={item.href} item={item} active={item.match(pathname)} collapsed={collapsed}/>)}</div>
          </div>)}

          {!collapsed && recentItems.length ? <div className="mt-4 border-t border-[#ded9d4] pt-3"><p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#928b84]">Recent</p>{recentItems.map((item) => <Link key={`recent-${item.href}`} href={item.href} className="block truncate rounded-[8px] px-2.5 py-1.5 text-[10px] font-medium text-[#777069] hover:bg-white hover:text-[#403a35]">{item.label}</Link>)}</div> : null}
        </nav>

        <div className="border-t border-[#ded9d4] p-2.5">
          {collapsed ? <div className="grid place-items-center gap-2"><button type="button" onClick={() => setCollapsed(false)} className="grid h-9 w-9 place-items-center rounded-[9px] text-[#817a73] hover:bg-white" aria-label="Expand navigation"><PanelLeftOpen size={15}/></button><div className="grid h-8 w-8 place-items-center rounded-full bg-[#eee2dc] text-[9px] font-bold text-[#8e5648]" title={userName}>{initials}</div></div> : <div className="flex items-center gap-2 rounded-[9px] px-1.5 py-1"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eee2dc] text-[9px] font-bold text-[#8e5648]">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#45403c]">{userName}</p><p className="mt-0.5 text-[9px] text-[#857e77]">Authorised staff</p></div><a href={signOutPath} className="grid h-8 w-8 place-items-center rounded-[8px] text-[#8c857e] hover:bg-white hover:text-[#9d4748]" aria-label="Sign out"><LogOut size={13}/></a></div>}
        </div>
      </aside>

      <header className={`fixed inset-x-0 top-0 z-40 h-[58px] border-b border-[#ded9d4] bg-[#f8f7f5]/94 backdrop-blur-xl transition-[left] duration-200 ${collapsed ? "lg:left-[68px]" : "lg:left-[244px]"}`}>
        <div className="flex h-full items-center gap-2.5 px-3 sm:px-4 lg:px-5">
          <button type="button" onClick={() => setMobileOpen((current) => !current)} className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#d9d4ce] bg-white text-[#625c56] lg:hidden" aria-label="Toggle navigation">{mobileOpen ? <X size={16}/> : <Menu size={16}/>}</button>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#8e8780]"><span>KCPL</span><ChevronRight size={10}/><span className="truncate text-[#4f4944]">{activeItem?.label ?? "Operations"}</span></div></div>

          {activeItem ? <button type="button" onClick={toggleFavorite} className={`hidden h-9 w-9 place-items-center rounded-[9px] md:grid ${activeFavorite ? "bg-[#fbe9e3] text-[#b95b47]" : "text-[#8d867f] hover:bg-white hover:text-[#4f4944]"}`} aria-label={activeFavorite ? `Remove ${activeItem.label} from pinned workspaces` : `Pin ${activeItem.label}`}><Star size={14} fill={activeFavorite ? "currentColor" : "none"}/></button> : null}
          <button type="button" className="hidden h-9 min-w-[280px] items-center gap-2 rounded-[9px] border border-[#d9d4ce] bg-white px-3 text-[#716a64] shadow-[0_1px_2px_rgba(45,35,29,.03)] hover:border-[#c7c0b9] md:flex" aria-label="Open command palette"><Search size={13}/><span className="flex-1 text-left text-[11px] font-semibold">Search KCPL…</span><span className="text-[9px] font-bold text-[#918a83]">⌘K</span></button>
          <Link href="/admin/alerts" className="grid h-9 w-9 place-items-center rounded-[9px] text-[#777069] hover:bg-white hover:text-[#3f3935]" aria-label="Open tasks and alerts"><Bell size={14}/></Link>

          <div className="relative">
            <button type="button" onClick={() => setCreateOpen((current) => !current)} className="flex h-9 items-center gap-1.5 rounded-[9px] bg-[#df7159] px-3.5 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(177,78,58,.12)] hover:bg-[#cf624d]"><Plus size={13}/><span className="hidden sm:inline">Create</span></button>
            {createOpen ? <div className="absolute right-0 top-11 w-64 overflow-hidden rounded-[12px] border border-[#ddd7d1] bg-white p-1.5 shadow-[0_22px_62px_rgba(54,43,34,.16)]">
              <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[.07em] text-[#8f8881]">Create or start</p>
              <MenuLink href="/admin" icon={<PackageSearch size={14}/>} label="New enquiry / quote" detail="Work an incoming freight request" close={() => setCreateOpen(false)}/>
              <MenuLink href="/admin/crm" icon={<Building2 size={14}/>} label="New customer" detail="Create a customer account" close={() => setCreateOpen(false)}/>
              <MenuLink href="/admin/partners" icon={<Handshake size={14}/>} label="New partner" detail="Add an agent, carrier or vendor" close={() => setCreateOpen(false)}/>
              <MenuLink href="/admin/market-estimate" icon={<Calculator size={14}/>} label="Market estimate" detail="Build a rate estimate" close={() => setCreateOpen(false)}/>
              {canManageFinance ? <MenuLink href="/admin/finance/new" icon={<ReceiptText size={14}/>} label="New receivable" detail="Create a customer invoice" close={() => setCreateOpen(false)}/> : null}
            </div> : null}
          </div>
        </div>
      </header>

      {mobileOpen ? <div className="fixed inset-x-0 bottom-0 top-[58px] z-50 overflow-y-auto bg-[#f3f1ee] p-3 lg:hidden"><div className="mx-auto max-w-xl space-y-4">
        <button type="button" className="flex h-11 w-full items-center gap-2 rounded-[10px] border border-[#d8d2cc] bg-white px-3 text-[#655f59]" aria-label="Open command palette"><Search size={15}/><span className="text-[12px] font-semibold">Search KCPL…</span><span className="ml-auto text-[9px] font-bold text-[#918a83]">⌘K</span></button>
        {groups.map((group) => <div key={group.label}><p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#8f8881]">{group.label}</p><div className="space-y-1">{group.items.map((item) => { const Icon = item.icon; const active = item.match(pathname); return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[12px] font-semibold ${active ? "bg-white text-[#3e3935] shadow-sm" : "text-[#6e6761]"}`}><Icon size={15} className={active ? "text-[#c15f4a]" : "text-[#8f8881]"}/><span>{item.label}</span></Link>; })}</div></div>)}
        <a href={signOutPath} className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[12px] font-semibold text-[#9d4748]"><LogOut size={15}/>Sign out</a>
      </div></div> : null}

      <div className={`min-w-0 pt-[58px] transition-[padding] duration-200 ${collapsed ? "lg:pl-[68px]" : "lg:pl-[244px]"}`}>{children}</div>
    </div>
  );
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#928b84]">{label}</p><div className="space-y-0.5">{children}</div></div>;
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href} aria-current={active ? "page" : undefined} title={collapsed ? `${item.label} · ${item.hint}` : item.hint} className={`group relative flex min-h-10 items-center rounded-[9px] ${collapsed ? "justify-center" : "gap-2.5 px-2.5"} ${active ? "bg-white text-[#302b27] shadow-[0_2px_8px_rgba(54,43,34,.05)]" : "text-[#625c56] hover:bg-white/70 hover:text-[#3e3935]"}`}>
    {active ? <span className="absolute left-0 h-5 w-[2.5px] rounded-r-full bg-[#df7159]"/> : null}
    <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-[#bf5f4b]" : "text-[#827b74] group-hover:text-[#615a54]"}/>
    {!collapsed ? <span className="truncate text-[12px] font-semibold">{item.label}</span> : null}
  </Link>;
}

function MenuLink({ href, icon, label, detail, close }: { href: string; icon: React.ReactNode; label: string; detail: string; close: () => void }) {
  return <Link href={href} onClick={close} className="flex items-start gap-3 rounded-[9px] px-3 py-2.5 text-[#443e39] hover:bg-[#f8f6f3]"><span className="mt-0.5 text-[#b85b48]">{icon}</span><span><strong className="block text-[11px] font-bold">{label}</strong><small className="mt-0.5 block text-[9px] leading-4 text-[#817a73]">{detail}</small></span></Link>;
}