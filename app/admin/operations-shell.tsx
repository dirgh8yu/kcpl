"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BellRing,
  Boxes,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Command,
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
  Sparkles,
  Star,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (path: string) => boolean;
  hint?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const workspaceNav: NavItem[] = [
  { href: "/admin/command-centre", label: "Home", icon: LayoutDashboard, match: (path) => path.startsWith("/admin/command-centre"), hint: "Your operational day" },
  { href: "/admin", label: "Enquiries", icon: PackageSearch, match: (path) => path === "/admin", hint: "New requests and quotes" },
  { href: "/admin/shipments", label: "Shipments", icon: Boxes, match: (path) => path.startsWith("/admin/shipments") || path.startsWith("/admin/jobs/"), hint: "Active movements and job files" },
  { href: "/admin/alerts", label: "Tasks & alerts", icon: BellRing, match: (path) => path.startsWith("/admin/alerts"), hint: "What needs attention" },
];

const relationshipNav: NavItem[] = [
  { href: "/admin/crm", label: "Customers", icon: Building2, match: (path) => path.startsWith("/admin/crm"), hint: "Customer 360" },
  { href: "/admin/partners", label: "Partners", icon: Handshake, match: (path) => path.startsWith("/admin/partners"), hint: "Counterparts and agents" },
  { href: "/admin/market-estimate", label: "Market estimate", icon: Calculator, match: (path) => path.startsWith("/admin/market-estimate"), hint: "Rates and commercial estimates" },
];

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo<NavGroup[]>(() => {
    const businessItems: NavItem[] = [
      ...relationshipNav,
      ...(canManageFinance ? [
        { href: "/admin/finance", label: "Finance & AR", icon: ReceiptText, match: (path: string) => path.startsWith("/admin/finance"), hint: "Receivables and collection" },
        { href: "/admin/payables", label: "Payables", icon: HandCoins, match: (path: string) => path.startsWith("/admin/payables"), hint: "Supplier obligations" },
      ] : []),
    ];

    const adminItems: NavItem[] = [
      ...(isManagement ? [
        { href: "/admin/management", label: "Management", icon: ChartNoAxesCombined, match: (path: string) => path.startsWith("/admin/management"), hint: "Operational analytics" },
      ] : []),
      ...(canManageStaff ? [
        { href: "/admin/staff", label: "People & branches", icon: UsersRound, match: (path: string) => path.startsWith("/admin/staff"), hint: "Staff access and ownership" },
      ] : []),
    ];

    return [
      { label: "Work", items: workspaceNav },
      { label: "Business", items: businessItems },
      ...(adminItems.length ? [{ label: "Manage", items: adminItems }] : []),
    ];
  }, [canManageFinance, canManageStaff, isManagement]);

  const allNav = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const filteredNav = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allNav;
    return allNav.filter((item) => `${item.label} ${item.hint ?? ""}`.toLowerCase().includes(needle));
  }, [allNav, query]);

  useEffect(() => {
    const stored = window.localStorage.getItem("kcpl-ops-sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kcpl-ops-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setCreateOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [paletteOpen]);

  function toggleCollapsed() {
    setCollapsed((current) => !current);
  }

  const activeItem = allNav.find((item) => item.match(pathname));
  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";

  return (
    <div className="kcpl-ops min-h-screen bg-[#fbfaf8] text-[#302b27]">
      <aside className={`fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-[#e9e3dc] bg-[#f7f3ee]/95 backdrop-blur-xl transition-[width] duration-300 lg:flex ${collapsed ? "w-[76px]" : "w-[248px]"}`}>
        <div className={`flex h-16 items-center border-b border-[#ebe5de] ${collapsed ? "justify-center px-3" : "justify-between px-4"}`}>
          <Link href="/admin/command-centre" className={`group flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-3"}`} aria-label="KCPL Operations home">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#e97d5d] text-xs font-black tracking-[-.04em] text-white shadow-[0_8px_24px_rgba(201,106,77,.18)]">K</span>
            {!collapsed ? <span className="min-w-0">
              <strong className="block truncate text-[13px] font-[750] tracking-[-.02em] text-[#302b27]">KCPL Operations</strong>
              <span className="mt-0.5 block truncate text-[10px] font-medium text-[#91877e]">Freight workspace</span>
            </span> : null}
          </Link>
          {!collapsed ? <button type="button" onClick={toggleCollapsed} className="grid h-8 w-8 place-items-center rounded-[10px] text-[#9a9087] transition hover:bg-white hover:text-[#4a423b]" aria-label="Collapse navigation"><PanelLeftClose size={15}/></button> : null}
        </div>

        <div className={`px-3 pt-3 ${collapsed ? "flex justify-center" : ""}`}>
          <button type="button" onClick={() => setPaletteOpen(true)} className={`flex h-10 items-center rounded-[12px] border border-[#e6ded6] bg-white/80 text-[#746b63] shadow-[0_1px_0_rgba(255,255,255,.9)] transition hover:border-[#dccfc3] hover:bg-white ${collapsed ? "w-10 justify-center" : "w-full gap-2.5 px-3"}`} aria-label="Search KCPL Operations">
            <Search size={15}/>
            {!collapsed ? <><span className="flex-1 text-left text-[11px] font-semibold">Search anything</span><kbd className="rounded-md border border-[#eee7e0] bg-[#faf8f5] px-1.5 py-0.5 text-[9px] font-semibold text-[#9b9188]">⌘K</kbd></> : null}
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group, groupIndex) => <div key={group.label} className={groupIndex ? "mt-5" : ""}>
            {!collapsed ? <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#aaa097]">{group.label}</p> : groupIndex ? <div className="mx-2 mb-3 border-t border-[#e8e1da]"/> : null}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex min-h-10 items-center rounded-[12px] transition ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "bg-white text-[#332c27] shadow-[0_1px_2px_rgba(77,57,43,.06),0_7px_20px_rgba(77,57,43,.045)]" : "text-[#756c64] hover:bg-white/70 hover:text-[#403832]"}`}
                >
                  {active ? <span className={`absolute bg-[#e97d5d] ${collapsed ? "left-0 h-5 w-[3px] rounded-r-full" : "left-0 h-4 w-[3px] rounded-r-full"}`}/> : null}
                  <Icon size={16} strokeWidth={active ? 2.25 : 1.8} className={active ? "text-[#cf6f52]" : "text-[#9b9188] transition group-hover:text-[#70665e]"}/>
                  {!collapsed ? <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{item.label}</span> : null}
                </Link>;
              })}
            </div>
          </div>)}
        </nav>

        <div className="border-t border-[#e8e1da] p-3">
          {collapsed ? <div className="grid gap-2 place-items-center">
            <button type="button" onClick={toggleCollapsed} className="grid h-10 w-10 place-items-center rounded-[12px] text-[#887e75] transition hover:bg-white" aria-label="Expand navigation"><PanelLeftOpen size={16}/></button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#efe4dc] text-[10px] font-bold text-[#8f5544]" title={userName}>{initials}</div>
          </div> : <div className="flex items-center gap-2 rounded-[14px] px-2 py-1.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efe4dc] text-[10px] font-bold text-[#8f5544]">{initials}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#4b433d]">{userName}</p><p className="mt-0.5 text-[9px] font-medium text-[#9b9188]">Authorised staff</p></div>
            <a href={signOutPath} className="grid h-8 w-8 place-items-center rounded-[10px] text-[#9a9087] transition hover:bg-white hover:text-[#9d5042]" aria-label="Sign out"><LogOut size={14}/></a>
          </div>}
        </div>
      </aside>

      <header className={`fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-[#ebe5de] bg-[#fbfaf8]/90 px-4 backdrop-blur-xl transition-[left] duration-300 lg:left-auto ${collapsed ? "lg:left-[76px]" : "lg:left-[248px]"}`}>
        <div className="flex w-full items-center gap-3">
          <button type="button" onClick={() => setMobileOpen((current) => !current)} className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#e7e0d9] bg-white text-[#6f655d] lg:hidden" aria-label="Toggle navigation">{mobileOpen ? <X size={17}/> : <Menu size={17}/>}</button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#a0978e]"><span>KCPL</span><ChevronRight size={11}/><span className="truncate text-[#776d65]">{activeItem?.label ?? "Operations"}</span></div>
          </div>

          <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-9 min-w-[220px] items-center gap-2 rounded-full border border-[#e7e0d9] bg-white px-3 text-[#857b72] shadow-[0_1px_2px_rgba(77,57,43,.03)] transition hover:border-[#dacdc3] md:flex"><Search size={14}/><span className="flex-1 text-left text-[11px] font-semibold">Search</span><span className="text-[9px] font-semibold text-[#aaa097]">⌘K</span></button>

          <div className="relative">
            <button type="button" onClick={() => setCreateOpen((current) => !current)} className="flex h-9 items-center gap-1.5 rounded-full bg-[#e97d5d] px-3.5 text-[11px] font-bold text-white shadow-[0_6px_18px_rgba(201,106,77,.16)] transition hover:bg-[#dd7253]"><Plus size={14}/> <span className="hidden sm:inline">Create</span></button>
            {createOpen ? <div className="absolute right-0 top-11 w-56 overflow-hidden rounded-[16px] border border-[#e7dfd7] bg-white p-1.5 shadow-[0_18px_55px_rgba(67,49,38,.14)]">
              <Link href="/admin" onClick={() => setCreateOpen(false)} className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[11px] font-semibold text-[#514840] hover:bg-[#faf6f2]"><PackageSearch size={15} className="text-[#c96f52]"/>New enquiry</Link>
              <Link href="/admin/market-estimate" onClick={() => setCreateOpen(false)} className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[11px] font-semibold text-[#514840] hover:bg-[#faf6f2]"><Calculator size={15} className="text-[#c96f52]"/>New estimate</Link>
              <Link href="/admin/shipments" onClick={() => setCreateOpen(false)} className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[11px] font-semibold text-[#514840] hover:bg-[#faf6f2]"><Boxes size={15} className="text-[#c96f52]"/>Open shipment queue</Link>
            </div> : null}
          </div>

          <Link href="/admin/alerts" className="relative grid h-9 w-9 place-items-center rounded-full border border-[#e7e0d9] bg-white text-[#7d736a] transition hover:border-[#dacdc3]" aria-label="Tasks and alerts"><Bell size={15}/><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e97d5d]"/></Link>
          <div className="hidden h-9 w-9 place-items-center rounded-full bg-[#efe4dc] text-[10px] font-bold text-[#8f5544] sm:grid" title={userName}>{initials}</div>
        </div>
      </header>

      {mobileOpen ? <div className="fixed inset-x-0 top-16 z-50 max-h-[calc(100vh-64px)] overflow-y-auto border-b border-[#e8e1da] bg-[#fbfaf8] p-3 shadow-[0_20px_45px_rgba(70,50,37,.12)] lg:hidden">
        {groups.map((group) => <div key={group.label} className="mb-4 last:mb-0"><p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#aaa097]">{group.label}</p><div className="space-y-1">{group.items.map((item) => { const Icon = item.icon; const active = item.match(pathname); return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex h-11 items-center gap-3 rounded-[12px] px-3 text-[12px] font-semibold ${active ? "bg-white text-[#332c27] shadow-sm" : "text-[#70675f] hover:bg-white"}`}><Icon size={16} className={active ? "text-[#cf6f52]" : "text-[#9b9188]"}/>{item.label}</Link>; })}</div></div>)}
        <a href={signOutPath} className="mt-2 flex h-11 items-center gap-3 rounded-[12px] px-3 text-[12px] font-semibold text-[#a45445] hover:bg-white"><LogOut size={16}/>Sign out</a>
      </div> : null}

      <div className={`min-w-0 pt-16 transition-[padding-left] duration-300 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]"}`}>{children}</div>

      {paletteOpen ? <div className="fixed inset-0 z-[80] flex items-start justify-center bg-[#3e342c]/15 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) setPaletteOpen(false); }}>
        <section className="w-full max-w-xl overflow-hidden rounded-[20px] border border-[#e4dbd3] bg-[#fffdfb] shadow-[0_30px_90px_rgba(66,48,37,.18)]">
          <div className="flex items-center gap-3 border-b border-[#eee7e0] px-4"><Search size={17} className="text-[#9a8f86]"/><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspaces, customers, shipments…" className="h-14 min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#3d3530] outline-none placeholder:text-[#aaa198]"/><kbd className="rounded-md border border-[#eee7e0] bg-[#faf7f3] px-2 py-1 text-[9px] font-semibold text-[#a0978e]">ESC</kbd></div>
          <div className="max-h-[52vh] overflow-y-auto p-2">
            <p className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#aaa097]">Navigate</p>
            {filteredNav.length ? filteredNav.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => { setPaletteOpen(false); setQuery(""); }} className="group flex items-center gap-3 rounded-[13px] px-3 py-3 transition hover:bg-[#faf5f0]"><span className="grid h-8 w-8 place-items-center rounded-[10px] border border-[#eee5dd] bg-white text-[#c96f52]"><Icon size={15}/></span><span className="min-w-0 flex-1"><strong className="block text-[12px] font-semibold text-[#4b423b]">{item.label}</strong><small className="mt-0.5 block truncate text-[10px] text-[#9b9188]">{item.hint}</small></span><ChevronRight size={14} className="text-[#bbb1a8] transition group-hover:translate-x-0.5"/></Link>; }) : <div className="px-3 py-10 text-center"><Sparkles size={18} className="mx-auto text-[#d6957f]"/><p className="mt-2 text-[12px] font-semibold text-[#675d55]">No workspace found</p><p className="mt-1 text-[10px] text-[#a0978e]">Record-level search can be connected here next.</p></div>}
          </div>
          <footer className="flex items-center justify-between border-t border-[#eee7e0] bg-[#fcf9f6] px-4 py-2.5 text-[9px] font-medium text-[#a0978e]"><span className="flex items-center gap-1.5"><Command size={11}/>KCPL quick command</span><span className="flex items-center gap-3"><span className="flex items-center gap-1"><Star size={10}/> favourites</span><span>↑↓ navigate</span></span></footer>
        </section>
      </div> : null}
    </div>
  );
}
