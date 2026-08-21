"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Archive,
  BellRing,
  Boxes,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  ChevronRight,
  Command,
  Database,
  FileText,
  HandCoins,
  Handshake,
  LayoutDashboard,
  ListChecks,
  PackageSearch,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  UsersRound,
} from "lucide-react";

type SearchResult = {
  kind: "shipment" | "customer" | "enquiry";
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  href: string;
  searchText: string;
};

type SearchPermissions = {
  canManageFinance: boolean;
  canManageStaff: boolean;
  isManagement: boolean;
};

type Workspace = {
  href: string;
  label: string;
  hint: string;
  icon: typeof LayoutDashboard;
  visible?: (permissions: SearchPermissions) => boolean;
};

type RecentRecord = Pick<SearchResult, "kind" | "id" | "title" | "subtitle" | "meta" | "href">;
type StoredWorkspace = { href: string; label: string };

const coreWorkspaces: Workspace[] = [
  { href: "/admin/command-centre", label: "Home", hint: "Operational day, movement and exceptions", icon: LayoutDashboard },
  { href: "/admin", label: "Enquiries", hint: "Requests, quotes and pricing", icon: PackageSearch },
  { href: "/admin/shipments", label: "Shipments", hint: "Movement queue and Digital Job Files", icon: Boxes },
  { href: "/admin/customs", label: "Customs", hint: "Clearance queue, documents and customs blockers", icon: ShieldCheck },
  { href: "/admin/documents", label: "Documents", hint: "Verified shipment documents and review queue", icon: FileText },
  { href: "/admin/alerts", label: "Tasks & alerts", hint: "Ownership, exceptions and follow-up", icon: BellRing },
  { href: "/admin/notifications", label: "Notifications", hint: "Complete assignment and automation notification history", icon: BellRing },
  { href: "/admin/crm", label: "Customers", hint: "Customer accounts and Customer 360", icon: Building2 },
  { href: "/admin/partners", label: "Partners", hint: "Agents, carriers, vendors and counterparts", icon: Handshake },
  { href: "/admin/market-estimate", label: "Market estimate", hint: "Rates, currencies and market inputs", icon: Calculator },
  { href: "/admin/rating", label: "Rate Desk", hint: "Transport orders, multimodal buy rates and rate selection", icon: Calculator },
  { href: "/admin/pricing", label: "Pricing Desk", hint: "Customer sell pricing, margin rules and approvals", icon: ReceiptText },
  { href: "/admin/tenders", label: "Tender Desk", hint: "Carrier tenders, counter-offers, expiry and booking", icon: Handshake },
  { href: "/admin/consolidation", label: "Load Planner", hint: "Consolidation, capacity, stops and master load planning", icon: Boxes },
  { href: "/admin/finance", label: "Receivables", hint: "Invoices, aging and collections", icon: ReceiptText, visible: (permissions) => permissions.canManageFinance },
  { href: "/admin/payables", label: "Payables", hint: "Supplier bills and obligations", icon: HandCoins, visible: (permissions) => permissions.canManageFinance },
  { href: "/admin/partners/reconciliation", label: "Supplier reconciliation", hint: "Resolve legacy supplier bills against Partner records", icon: ListChecks, visible: (permissions) => permissions.canManageFinance },
  { href: "/admin/management", label: "Management", hint: "Analytics, profitability and production runtime readiness", icon: ChartNoAxesCombined, visible: (permissions) => permissions.isManagement },
  { href: "/admin/migration", label: "Migration Hub", hint: "Controlled paper-to-KCPL data migration", icon: Database, visible: (permissions) => permissions.isManagement },
  { href: "/admin/migration/archive", label: "Paper archive", hint: "Historical paper evidence and linked digital records", icon: Archive, visible: (permissions) => permissions.isManagement },
  { href: "/admin/migration/recovery", label: "Migration recovery", hint: "Dry-run and controlled rollback of migration batches", icon: RotateCcw, visible: (permissions) => permissions.isManagement && permissions.canManageFinance },
  { href: "/admin/staff", label: "People & branches", hint: "Access, staff and branch ownership", icon: UsersRound, visible: (permissions) => permissions.canManageStaff },
];

const emptyPermissions: SearchPermissions = {
  canManageFinance: false,
  canManageStaff: false,
  isManagement: false,
};

function readRecents(): RecentRecord[] {
  try {
    const value = JSON.parse(window.localStorage.getItem("kcpl-ops-record-recents") || "[]") as RecentRecord[];
    return Array.isArray(value) ? value.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function readWorkspaces(key: string): StoredWorkspace[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]") as StoredWorkspace[];
    return Array.isArray(value) ? value.filter((item) => item && typeof item.href === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function resultScore(item: SearchResult, needle: string) {
  const id = item.id.toLowerCase();
  const title = item.title.toLowerCase();
  const haystack = `${item.searchText} ${item.subtitle} ${item.meta}`.toLowerCase();
  if (id === needle || title === needle) return 1000;
  if (id.startsWith(needle) || title.startsWith(needle)) return 600;
  if (title.includes(needle)) return 350;
  return haystack.includes(needle) ? 100 : 0;
}

export function OperationsGlobalSearch() {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchResult[]>([]);
  const [permissions, setPermissions] = useState<SearchPermissions>(emptyPermissions);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recordSearchUnavailable, setRecordSearchUnavailable] = useState(false);
  const [recents, setRecents] = useState<RecentRecord[]>([]);
  const [favorites, setFavorites] = useState<StoredWorkspace[]>([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<StoredWorkspace[]>([]);

  const isAdmin = pathname.startsWith("/admin");
  const workspaces = useMemo(() => coreWorkspaces.filter((item) => !item.visible || item.visible(permissions)), [permissions]);
  const recordResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return index
      .map((item) => ({ item, score: resultScore(item, needle) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((entry) => entry.item);
  }, [index, query]);
  const workspaceResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workspaces;
    return workspaces.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(needle));
  }, [query, workspaces]);

  const loadIndex = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    setRecordSearchUnavailable(false);
    try {
      const response = await fetch("/api/admin/search", { cache: "no-store" });
      const data = await response.json() as { results?: SearchResult[]; permissions?: SearchPermissions; degraded?: boolean };
      if (!response.ok || !data.results) throw new Error("KCPL search is unavailable.");
      setIndex(data.results);
      setPermissions(data.permissions ?? emptyPermissions);
      setRecordSearchUnavailable(Boolean(data.degraded));
      setLoaded(true);
    } catch {
      setIndex([]);
      setRecordSearchUnavailable(true);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [loaded, loading]);

  const openSearch = useCallback(() => {
    if (!isAdmin) return;
    setRecents(readRecents());
    setFavorites(readWorkspaces("kcpl-ops-favorites"));
    setRecentWorkspaces(readWorkspaces("kcpl-ops-recents"));
    setOpen(true);
    void loadIndex();
  }, [isAdmin, loadIndex]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  function openHref(href: string) {
    closeSearch();
    window.location.assign(href);
  }

  function openRecord(item: SearchResult | RecentRecord) {
    const next: RecentRecord[] = [
      { kind: item.kind, id: item.id, title: item.title, subtitle: item.subtitle, meta: item.meta, href: item.href },
      ...readRecents().filter((recent) => recent.kind !== item.kind || recent.id !== item.id),
    ].slice(0, 6);
    window.localStorage.setItem("kcpl-ops-record-recents", JSON.stringify(next));
    setRecents(next);
    openHref(item.href);
  }

  useEffect(() => {
    if (!isAdmin) return;

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (open) closeSearch(); else openSearch();
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeSearch();
      }
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button) return;
      if (button.getAttribute("aria-label") === "Open command palette") {
        event.preventDefault();
        event.stopPropagation();
        openSearch();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [closeSearch, isAdmin, open, openSearch]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!isAdmin || !open) return null;

  const firstHref = recordResults[0]?.href ?? workspaceResults[0]?.href;
  const favoriteItems = favorites.map((saved) => workspaces.find((item) => item.href === saved.href)).filter((item): item is Workspace => Boolean(item));
  const recentWorkspaceItems = recentWorkspaces.map((saved) => workspaces.find((item) => item.href === saved.href)).filter((item): item is Workspace => Boolean(item));

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-[#332a25]/20 px-3 pt-[7vh] backdrop-blur-[4px]" role="dialog" aria-modal="true" aria-label="KCPL universal search">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close KCPL search" onClick={closeSearch}/>
      <section className="relative z-10 w-full max-w-[720px] overflow-hidden rounded-[15px] border border-[#d7d0ca] bg-white shadow-[0_32px_96px_rgba(45,34,28,.22)]">
        <div className="flex min-h-14 items-center gap-3 border-b border-[#e7e2dd] px-4 sm:px-5">
          <Command size={16} className="shrink-0 text-[#b95d49]"/>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && firstHref) {
                const record = recordResults[0];
                if (record) openRecord(record); else openHref(firstHref);
              }
            }}
            className="min-w-0 flex-1 bg-transparent py-4 text-[14px] font-medium text-[#302b27] outline-none placeholder:text-[#8e8780]"
            placeholder="Search KCPL…"
          />
          <span className="hidden rounded-[5px] border border-[#ded8d2] bg-[#f7f5f2] px-2 py-1 text-[9px] font-bold text-[#827b74] sm:inline">ESC</span>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-2">
          {recordSearchUnavailable ? <div className="mx-2 mt-2 rounded-[9px] border border-[#eadfd6] bg-[#fff9f5] px-3 py-2 text-[10px] leading-5 text-[#7c6559]">Record search is temporarily unavailable. All available workspaces below remain usable.</div> : null}
          {!query && recents.length ? <SearchSection title="Recent records">{recents.map((item) => <RecordRow key={`${item.kind}-${item.id}`} item={item} onOpen={() => openRecord(item)}/>)}</SearchSection> : null}
          {!query && favoriteItems.length ? <SearchSection title="Pinned workspaces">{favoriteItems.map((item) => <WorkspaceRow key={`fav-${item.href}`} item={item} onOpen={() => openHref(item.href)} pinned/>)}</SearchSection> : null}
          {!query && !favoriteItems.length && recentWorkspaceItems.length ? <SearchSection title="Recent workspaces">{recentWorkspaceItems.map((item) => <WorkspaceRow key={`recent-${item.href}`} item={item} onOpen={() => openHref(item.href)}/>)}</SearchSection> : null}

          {query.trim().length >= 2 ? (
            <SearchSection title="Records">
              {loading ? <SearchMessage>Loading KCPL records…</SearchMessage> : recordSearchUnavailable ? <SearchMessage>Record search is unavailable right now. Workspace search still works.</SearchMessage> : recordResults.length ? recordResults.map((item) => <RecordRow key={`${item.kind}-${item.id}`} item={item} onOpen={() => openRecord(item)}/>) : <SearchMessage>No shipment, customer or enquiry matches “{query}”.</SearchMessage>}
            </SearchSection>
          ) : null}

          <SearchSection title="Workspaces">
            {workspaceResults.length ? workspaceResults.map((item) => <WorkspaceRow key={item.href} item={item} onOpen={() => openHref(item.href)}/>) : <SearchMessage>No workspace matches.</SearchMessage>}
          </SearchSection>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7e2dd] bg-[#f8f7f5] px-4 py-2.5 text-[9px] font-semibold text-[#817a73] sm:px-5">
          <span className="flex items-center gap-1.5"><Search size={11}/>Shipments · customers · enquiries · workspaces</span>
          <span>Enter open · Esc close</span>
        </footer>
      </section>
    </div>
  );
}

function SearchSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-2 last:mb-0"><p className="px-3 pb-1.5 pt-2 text-[9px] font-bold uppercase tracking-[.07em] text-[#89827b]">{title}</p>{children}</section>;
}

function SearchMessage({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-5 text-[11px] leading-5 text-[#746d67]">{children}</div>;
}

function RecordRow({ item, onOpen }: { item: SearchResult | RecentRecord; onOpen: () => void }) {
  const Icon = item.kind === "shipment" ? Boxes : item.kind === "customer" ? Building2 : PackageSearch;
  const kindLabel = item.kind === "shipment" ? "Shipment" : item.kind === "customer" ? "Customer" : "Enquiry";
  const toneClass = item.kind === "shipment" ? "bg-[#edf5fa] text-[#3f7295]" : item.kind === "customer" ? "bg-[#edf6f0] text-[#47795a]" : "bg-[#fbebe6] text-[#b45b47]";
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left hover:bg-[#f8f7f5]">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[9px] ${toneClass}`}><Icon size={15}/></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><strong className="truncate text-[12px] font-bold text-[#38332f]">{item.title}</strong><small className="shrink-0 rounded-full bg-[#efebe7] px-1.5 py-0.5 text-[8px] font-bold text-[#716a64]">{kindLabel}</small></span>
        <small className="mt-0.5 block truncate text-[10px] text-[#6e6761]">{item.subtitle}</small>
        <small className="mt-0.5 block truncate text-[9px] font-semibold text-[#918a83]">{item.meta}</small>
      </span>
      <ChevronRight size={13} className="shrink-0 text-[#a49d96] transition group-hover:translate-x-0.5"/>
    </button>
  );
}

function WorkspaceRow({ item, onOpen, pinned = false }: { item: Workspace; onOpen: () => void; pinned?: boolean }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left hover:bg-[#f8f7f5]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-[#efebe7] text-[#766f68]"><Icon size={15}/></span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="block truncate text-[11px] font-bold text-[#403a36]">{item.label}</strong>{pinned ? <Star size={10} className="text-[#b95d49]" fill="currentColor"/> : null}</span><small className="mt-0.5 block truncate text-[9px] text-[#817a73]">{item.hint}</small></span>
      <ChevronRight size={13} className="shrink-0 text-[#a49d96] transition group-hover:translate-x-0.5"/>
    </button>
  );
}
