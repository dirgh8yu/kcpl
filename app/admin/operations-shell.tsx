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
  hint: string;
};

type NavGroup = { label: string; items: NavItem[] };
type StoredWorkspace = { href: string; label: string };

const workspaceNav: NavItem[] = [
  { href: "/admin/command-centre", label: "Home", icon: LayoutDashboard, match: (path) => path.startsWith("/admin/command-centre"), hint: "Your operational day" },
  { href: "/admin", label: "Enquiries", icon: PackageSearch, match: (path) => path === "/admin", hint: "Requests, pricing and quotes" },
  { href: "/admin/shipments", label: "Shipments", icon: Boxes, match: (path) => path.startsWith("/admin/shipments") || path.startsWith("/admin/jobs/"), hint: "Movements and digital job files" },
  { href: "/admin/alerts", label: "Tasks & alerts", icon: BellRing, match: (path) => path.startsWith("/admin/alerts"), hint: "Ownership, risk and follow-up" },
];

const relationshipNav: NavItem[] = [
  { href: "/admin/crm", label: "Customers", icon: Building2, match: (path) => path.startsWith("/admin/crm"), hint: "Customer 360 and relationships" },
  { href: "/admin/partners", label: "Partners", icon: Handshake, match: (path) => path.startsWith("/admin/partners"), hint: "Counterparts, suppliers and agents" },
  { href: "/admin/market-estimate", label: "Market estimate", icon: Calculator, match: (path) => path.startsWith("/admin/market-estimate"), hint: "Rates, currencies and estimates" },
];

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<StoredWorkspace[]>([]);
  const [recents, setRecents] = useState<StoredWorkspace[]>([]);

  const groups = useMemo<NavGroup[]>(() => {
    const businessItems: NavItem[] = [
      ...relationshipNav,
      ...(canManageFinance ? [
        { href: "/admin/finance", label: "Finance & AR", icon: ReceiptText, match: (path: string) => path.startsWith("/admin/finance"), hint: "Invoices, aging and collections" },
        { href: "/admin/payables", label: "Payables", icon: HandCoins, match: (path: string) => path.startsWith("/admin/payables"), hint: "Bills and supplier obligations" },
      ] : []),
    ];
    const adminItems: NavItem[] = [
      ...(isManagement ? [{ href: "/admin/management", label: "Management", icon: ChartNoAxesCombined, match: (path: string) => path.startsWith("/admin/management"), hint: "Operational and commercial analytics" }] : []),
      ...(canManageStaff ? [{ href: "/admin/staff", label: "People & branches", icon: UsersRound, match: (path: string) => path.startsWith("/admin/staff"), hint: "Access, teams and branch ownership" }] : []),
    ];
    return [
      { label: "Work", items: workspaceNav },
      { label: "Business", items: businessItems },
      ...(adminItems.length ? [{ label: "Manage", items: adminItems }] : []),
    ];
  }, [canManageFinance, canManageStaff, isManagement]);

  const allNav = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeItem = allNav.find((item) => item.match(pathname));
  const filteredNav = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allNav;
    return allNav.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(needle));
  }, [allNav, query]);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("kcpl-ops-sidebar-collapsed") === "1");
    setFavorites(safeStoredWorkspaces("kcpl-ops-favorites"));
    setRecents(safeStoredWorkspaces("kcpl-ops-recents"));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kcpl-ops-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (!activeItem) return;
    const current = { href: activeItem.href, label: activeItem.label };
    const next = [current, ...safeStoredWorkspaces("kcpl-ops-recents").filter((item) => item.href !== current.href)].slice(0, 5);
    window.localStorage.setItem("kcpl-ops-recents", JSON.stringify(next));
    setRecents(next);
  }, [activeItem?.href, activeItem?.label]);

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

  function toggleFavorite() {
    if (!activeItem) return;
    const exists = favorites.some((item) => item.href === activeItem.href);
    const next = exists ? favorites.filter((item) => item.href !== activeItem.href) : [...favorites, { href: activeItem.href, label: activeItem.label }];
    setFavorites(next);
    window.localStorage.setItem("kcpl-ops-favorites", JSON.stringify(next));
  }

  function navigateFromPalette(href: string) {
    setPaletteOpen(false);
    setQuery("");
    window.location.href = href;
  }

  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";
  const activeFavorite = activeItem ? favorites.some((item) => item.href === activeItem.href) : false;

  return (
    <div className="kcpl-ops min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-[#e7dfd8] bg-[#f5f1ed]/95 backdrop-blur-xl transition-[width] duration-300 lg:flex ${collapsed ? "w-[70px]" : "w-[236px]"}`}>
        <div className={`flex h-[58px] items-center ${collapsed ? "justify-center px-2" : "justify-between px-3.5"}`}>
          <Link href="/admin/command-centre" className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`} aria-label="KCPL Operations home">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#e8755d] text-[11px] font-black text-white shadow-[0_8px_22px_rgba(191,91,68,.14)]">K</span>
            {!collapsed ? <span className="min-w-0"><strong className="block truncate text-[12px] font-[760] tracking-[-.025em] text-[#3b342f]">KCPL Operations</strong><span className="mt-0.5 block truncate text-[9px] font-medium text-[#9b9189]">Freight workspace</span></span> : null}
          </Link>
          {!collapsed ? <button type="button" onClick={() => setCollapsed(true)} className="grid h-8 w-8 place-items-center rounded-[10px] text-[#a0968e] hover:bg-white hover:text-[#5d544d]" aria-label="Tuck away navigation"><PanelLeftClose size={15}/></button> : null}
        </div>

        <div className={`px-2.5 pt-2 ${collapsed ? "flex justify-center" : ""}`}>
          <button type="button" onClick={() => setPaletteOpen(true)} className={`flex h-9 items-center rounded-[11px] border border-[#e6ddd6] bg-white/78 text-[#857b73] shadow-[0_1px_2px_rgba(73,54,41,.025)] hover:bg-white ${collapsed ? "w-9 justify-center" : "w-full gap-2.5 px-2.5"}`} aria-label="Open command palette">
            <Search size={14}/>{!collapsed ? <><span className="flex-1 text-left text-[10px] font-semibold">Jump to…</span><kbd className="rounded-md border border-[#eee7e1] bg-[#faf7f4] px-1.5 py-0.5 text-[8px] font-bold text-[#aaa098]">⌘K</kbd></> : null}
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3.5">
          {groups.map((group, groupIndex) => <div key={group.label} className={groupIndex ? "mt-5" : ""}>
            {!collapsed ? <p className="mb-1 px-2 text-[8px] font-extrabold uppercase tracking-[.12em] text-[#afa69f]">{group.label}</p> : groupIndex ? <div className="mx-2 mb-3 border-t border-[#e6dfd8]"/> : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} className={`group relative flex min-h-9 items-center rounded-[11px] ${collapsed ? "justify-center" : "gap-2.5 px-2.5"} ${active ? "bg-white text-[#443b35] shadow-[0_4px_16px_rgba(77,57,43,.045)]" : "text-[#746b64] hover:bg-white/65 hover:text-[#49413b]"}`}>
                  {active ? <span className="absolute left-0 h-4 w-[2.5px] rounded-r-full bg-[#e8755d]"/> : null}
                  <Icon size={15} strokeWidth={active ? 2.25 : 1.75} className={active ? "text-[#cb664f]" : "text-[#9c928a] group-hover:text-[#766c64]"}/>
                  {!collapsed ? <span className="truncate text-[10px] font-semibold">{item.label}</span> : null}
                </Link>;
              })}
            </div>
          </div>)}
        </nav>

        <div className="border-t border-[#e6dfd8] p-2.5">
          {collapsed ? <div className="grid place-items-center gap-2"><button type="button" onClick={() => setCollapsed(false)} className="grid h-9 w-9 place-items-center rounded-[11px] text-[#887e76] hover:bg-white" aria-label="Expand navigation"><PanelLeftOpen size={15}/></button><div className="grid h-8 w-8 place-items-center rounded-full bg-[#efe2da] text-[9px] font-bold text-[#955644]" title={userName}>{initials}</div></div> : <div className="flex items-center gap-2 rounded-[12px] px-1.5 py-1"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#efe2da] text-[9px] font-bold text-[#955644]">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-[#514840]">{userName}</p><p className="mt-0.5 text-[8px] text-[#9d938b]">Authorised staff</p></div><a href={signOutPath} className="grid h-8 w-8 place-items-center rounded-[10px] text-[#a0968e] hover:bg-white hover:text-[#a55350]" aria-label="Sign out"><LogOut size={13}/></a></div>}
        </div>
      </aside>

      <header className={`fixed inset-x-0 top-0 z-40 h-[58px] border-b border-[#e9e2dc] bg-[#fbfaf8]/88 backdrop-blur-xl transition-[left] duration-300 ${collapsed ? "lg:left-[70px]" : "lg:left-[236px]"}`}>
        <div className="flex h-full items-center gap-2.5 px-3 sm:px-4">
          <button type="button" onClick={() => setMobileOpen((current) => !current)} className="grid h-9 w-9 place-items-center rounded-[11px] border border-[#e6dfd8] bg-white text-[#6f655d] lg:hidden" aria-label="Toggle navigation">{mobileOpen ? <X size={16}/> : <Menu size={16}/>}</button>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 text-[9px] font-semibold text-[#aaa098]"><span>KCPL</span><ChevronRight size={10}/><span className="truncate text-[#756b63]">{activeItem?.label ?? "Operations"}</span></div></div>

          {activeItem ? <button type="button" onClick={toggleFavorite} className={`hidden h-9 w-9 place-items-center rounded-full md:grid ${activeFavorite ? "bg-[#fff1eb] text-[#c9654f]" : "text-[#a0978f] hover:bg-white hover:text-[#6c625b]"}`} aria-label={activeFavorite ? `Remove ${activeItem.label} from favourites` : `Favourite ${activeItem.label}`}><Star size={14} fill={activeFavorite ? "currentColor" : "none"}/></button> : null}
          <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-9 min-w-[210px] items-center gap-2 rounded-full border border-[#e7e0da] bg-white/86 px-3 text-[#877d75] shadow-[0_1px_2px_rgba(75,55,42,.025)] hover:border-[#d9cdc4] md:flex"><Search size={13}/><span className="flex-1 text-left text-[10px] font-semibold">Search workspaces</span><span className="text-[8px] font-bold text-[#aaa098]">⌘K</span></button>
          <Link href="/admin/alerts" className="grid h-9 w-9 place-items-center rounded-full text-[#958b83] hover:bg-white hover:text-[#5f554e]" aria-label="Open tasks and alerts"><Bell size={14}/></Link>

          <div className="relative">
            <button type="button" onClick={() => setCreateOpen((current) => !current)} className="flex h-9 items-center gap-1.5 rounded-full bg-[#e8755d] px-3.5 text-[10px] font-bold text-white shadow-[0_7px_18px_rgba(191,91,68,.14)] hover:bg-[#d96851]"><Plus size={13}/><span className="hidden sm:inline">Create</span></button>
            {createOpen ? <div className="absolute right-0 top-11 w-60 overflow-hidden rounded-[15px] border border-[#e5ddd6] bg-[#fffdfa] p-1.5 shadow-[0_20px_60px_rgba(72,52,39,.14)]">
              <p className="px-3 pb-1 pt-2 text-[8px] font-extrabold uppercase tracking-[.11em] text-[#aca29a]">Quick create</p>
              <MenuLink href="/admin" icon={<PackageSearch size={14}/>} label="Work an enquiry" detail="Quote and convert freight requests" close={() => setCreateOpen(false)}/>
              <MenuLink href="/admin/market-estimate" icon={<Calculator size={14}/>} label="Build an estimate" detail="Check currency and market inputs" close={() => setCreateOpen(false)}/>
              {canManageFinance ? <MenuLink href="/admin/finance/new" icon={<ReceiptText size={14}/>} label="Create an invoice" detail="Start a customer receivable" close={() => setCreateOpen(false)}/> : null}
              <MenuLink href="/admin/shipments" icon={<Boxes size={14}/>} label="Open shipment queue" detail="Find or continue a job file" close={() => setCreateOpen(false)}/>
            </div> : null}
          </div>
        </div>
      </header>

      {mobileOpen ? <div className="fixed inset-x-0 bottom-0 top-[58px] z-50 overflow-y-auto bg-[#f8f5f1] p-3 lg:hidden"><div className="mx-auto max-w-xl space-y-4">
        <button type="button" onClick={() => { setMobileOpen(false); setPaletteOpen(true); }} className="flex h-11 w-full items-center gap-2 rounded-[13px] border border-[#e4dcd5] bg-white px-3 text-[#81776f]"><Search size={15}/><span className="text-[11px] font-semibold">Jump to workspace</span></button>
        {groups.map((group) => <div key={group.label}><p className="mb-1.5 px-2 text-[8px] font-extrabold uppercase tracking-[.12em] text-[#aaa098]">{group.label}</p><div className="space-y-1">{group.items.map((item) => { const Icon = item.icon; const active = item.match(pathname); return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-[13px] px-3 text-[11px] font-semibold ${active ? "bg-white text-[#4b423c] shadow-sm" : "text-[#766c64]"}`}><Icon size={15} className={active ? "text-[#cb664f]" : "text-[#9b9189]"}/><span>{item.label}</span></Link>; })}</div></div>)}
        <a href={signOutPath} className="flex min-h-11 items-center gap-3 rounded-[13px] px-3 text-[11px] font-semibold text-[#a05250]"><LogOut size={15}/>Sign out</a>
      </div></div> : null}

      <div className={`min-w-0 pt-[58px] transition-[padding] duration-300 ${collapsed ? "lg:pl-[70px]" : "lg:pl-[236px]"}`}>{children}</div>

      {paletteOpen ? <div className="fixed inset-0 z-[90] flex items-start justify-center bg-[#6a574b]/15 px-3 pt-[10vh] backdrop-blur-[4px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
        <div className="w-full max-w-[620px] overflow-hidden rounded-[19px] border border-[#e3d9d1] bg-[#fffdfa] shadow-[0_30px_90px_rgba(72,50,36,.19)]">
          <div className="flex h-14 items-center gap-3 border-b border-[#eee7e1] px-4"><Command size={16} className="text-[#d06b53]"/><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && filteredNav[0]) navigateFromPalette(filteredNav[0].href); }} className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#403833] outline-none" placeholder="Search a workspace or action…"/><kbd className="rounded-md border border-[#e9e1da] bg-[#faf7f4] px-2 py-1 text-[8px] font-bold text-[#a49a92]">ESC</kbd></div>
          <div className="max-h-[62vh] overflow-y-auto p-2">
            {!query && favorites.length ? <PaletteSection title="Favourites">{favorites.map((item) => <PaletteRow key={`favorite-${item.href}`} item={allNav.find((nav) => nav.href === item.href)} fallback={item} icon={<Star size={14} fill="currentColor"/>} onOpen={navigateFromPalette}/>)}</PaletteSection> : null}
            {!query && recents.length ? <PaletteSection title="Recent">{recents.map((item) => <PaletteRow key={`recent-${item.href}`} item={allNav.find((nav) => nav.href === item.href)} fallback={item} onOpen={navigateFromPalette}/>)}</PaletteSection> : null}
            <PaletteSection title={query ? "Results" : "All workspaces"}>{filteredNav.length ? filteredNav.map((item) => <PaletteRow key={item.href} item={item} onOpen={navigateFromPalette}/>) : <div className="px-3 py-8 text-center text-[10px] text-[#9d938b]">No workspace matches “{query}”.</div>}</PaletteSection>
            {!query ? <PaletteSection title="Quick actions"><PaletteAction icon={<Sparkles size={14}/>} label="Review new enquiries" hint="Open the quote desk" onClick={() => navigateFromPalette("/admin")}/><PaletteAction icon={<Plus size={14}/>} label="Build market estimate" hint="Currency and freight inputs" onClick={() => navigateFromPalette("/admin/market-estimate")}/>{canManageFinance ? <PaletteAction icon={<ReceiptText size={14}/>} label="Create invoice" hint="New Accounts Receivable draft" onClick={() => navigateFromPalette("/admin/finance/new")}/> : null}</PaletteSection> : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eee7e1] bg-[#faf7f4] px-4 py-2 text-[8px] font-semibold text-[#a49a92]"><span>KCPL command palette</span><span>Type to filter · Enter opens first result</span></div>
        </div>
      </div> : null}
    </div>
  );
}

function MenuLink({ href, icon, label, detail, close }: { href: string; icon: React.ReactNode; label: string; detail: string; close: () => void }) {
  return <Link href={href} onClick={close} className="flex items-start gap-3 rounded-[11px] px-3 py-2.5 text-[#524942] hover:bg-[#faf4ef]"><span className="mt-0.5 text-[#c9664f]">{icon}</span><span><strong className="block text-[10px] font-bold">{label}</strong><small className="mt-0.5 block text-[8px] leading-4 text-[#9d938b]">{detail}</small></span></Link>;
}

function PaletteSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-2 last:mb-0"><p className="px-3 pb-1.5 pt-2 text-[8px] font-extrabold uppercase tracking-[.11em] text-[#aca29a]">{title}</p><div>{children}</div></section>;
}

function PaletteRow({ item, fallback, icon, onOpen }: { item?: NavItem; fallback?: StoredWorkspace; icon?: React.ReactNode; onOpen: (href: string) => void }) {
  if (!item && !fallback) return null;
  const href = item?.href ?? fallback!.href;
  const label = item?.label ?? fallback!.label;
  const Icon = item?.icon;
  return <button type="button" onClick={() => onOpen(href)} className="flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left hover:bg-[#faf4ef]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#f3ede8] text-[#8d7e73]">{icon ?? (Icon ? <Icon size={14}/> : <ChevronRight size={13}/>)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[10px] font-bold text-[#514840]">{label}</strong>{item ? <small className="mt-0.5 block truncate text-[8px] text-[#9e948c]">{item.hint}</small> : null}</span><ChevronRight size={12} className="text-[#b3aaa2]"/></button>;
}

function PaletteAction({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left hover:bg-[#faf4ef]"><span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#fff0ea] text-[#c9654f]">{icon}</span><span><strong className="block text-[10px] font-bold text-[#514840]">{label}</strong><small className="mt-0.5 block text-[8px] text-[#9e948c]">{hint}</small></span></button>;
}
