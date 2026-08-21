"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Search,
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

const coreWorkspaces: Workspace[] = [
  { href: "/admin/command-centre", label: "Operations Home", hint: "Operational day, movement and exceptions", icon: LayoutDashboard },
  { href: "/admin", label: "Enquiries", hint: "Requests, quotes and pricing", icon: PackageSearch },
  { href: "/admin/shipments", label: "Shipments", hint: "Movement queue and Digital Job Files", icon: Boxes },
  { href: "/admin/alerts", label: "Tasks & alerts", hint: "Ownership, exceptions and follow-up", icon: BellRing },
  { href: "/admin/crm", label: "Customers", hint: "CRM and Customer 360", icon: Building2 },
  { href: "/admin/partners", label: "Partners", hint: "Counterparts, suppliers and agents", icon: Handshake },
  { href: "/admin/market-estimate", label: "Market estimate", hint: "Commercial pricing inputs", icon: Calculator },
  { href: "/admin/finance", label: "Finance & AR", hint: "Invoices, aging and collections", icon: ReceiptText, visible: (permissions) => permissions.canManageFinance },
  { href: "/admin/payables", label: "Payables", hint: "Supplier bills and obligations", icon: HandCoins, visible: (permissions) => permissions.canManageFinance },
  { href: "/admin/management", label: "Management", hint: "Operational and commercial analytics", icon: ChartNoAxesCombined, visible: (permissions) => permissions.isManagement },
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
  const [recents, setRecents] = useState<RecentRecord[]>([]);

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

  async function loadIndex() {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/search", { cache: "no-store" });
      const data = await response.json() as { results?: SearchResult[]; permissions?: SearchPermissions };
      if (!response.ok || !data.results) throw new Error("KCPL search is unavailable.");
      setIndex(data.results);
      setPermissions(data.permissions ?? emptyPermissions);
      setLoaded(true);
    } catch {
      setIndex([]);
    } finally {
      setLoading(false);
    }
  }

  function openSearch() {
    if (!isAdmin) return;
    setRecents(readRecents());
    setOpen(true);
    void loadIndex();
  }

  function closeSearch() {
    setOpen(false);
    setQuery("");
  }

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
      const label = button.getAttribute("aria-label") || "";
      const text = button.textContent || "";
      if (label === "Open command palette" || text.includes("Search workspaces")) {
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
  }, [isAdmin, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!isAdmin || !open) return null;

  const firstHref = recordResults[0]?.href ?? workspaceResults[0]?.href;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-[#725f53]/18 px-3 pt-[8vh] backdrop-blur-[5px]" role="dialog" aria-modal="true" aria-label="KCPL command search">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close KCPL search" onClick={closeSearch}/>
      <section className="relative z-10 w-full max-w-[680px] overflow-hidden rounded-[20px] border border-[#e2d8d0] bg-[#fffdfa] shadow-[0_35px_100px_rgba(67,47,35,.22)]">
        <div className="flex min-h-14 items-center gap-3 border-b border-[#eee6df] px-4 sm:px-5">
          <Command size={16} className="shrink-0 text-[#d06b53]"/>
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
            className="min-w-0 flex-1 bg-transparent py-4 text-[13px] font-medium text-[#403833] outline-none placeholder:text-[#aaa098]"
            placeholder="Search shipment, customer, enquiry or workspace…"
          />
          <span className="hidden rounded-md border border-[#e9e1da] bg-[#faf7f4] px-2 py-1 text-[8px] font-bold text-[#a49a92] sm:inline">ESC</span>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-2">
          {!query && recents.length ? <SearchSection title="Recent records">{recents.map((item) => <RecordRow key={`${item.kind}-${item.id}`} item={item} onOpen={() => openRecord(item)}/>)}</SearchSection> : null}

          {query.trim().length >= 2 ? (
            <SearchSection title="Records">
              {loading ? <SearchMessage>Loading KCPL records…</SearchMessage> : recordResults.length ? recordResults.map((item) => <RecordRow key={`${item.kind}-${item.id}`} item={item} onOpen={() => openRecord(item)}/>) : <SearchMessage>No shipment, customer or enquiry matches “{query}”.</SearchMessage>}
            </SearchSection>
          ) : null}

          <SearchSection title={query ? "Workspaces" : "Workspaces"}>
            {workspaceResults.length ? workspaceResults.map((item) => <WorkspaceRow key={item.href} item={item} onOpen={() => openHref(item.href)}/>) : <SearchMessage>No workspace matches.</SearchMessage>}
          </SearchSection>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eee6df] bg-[#faf7f4] px-4 py-2.5 text-[8px] font-semibold text-[#9f958d] sm:px-5">
          <span className="flex items-center gap-1.5"><Search size={10}/>KCPL universal search</span>
          <span>↑↓ scan · Enter open · Esc close</span>
        </footer>
      </section>
    </div>
  );
}

function SearchSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-2 last:mb-0"><p className="px-3 pb-1.5 pt-2 text-[8px] font-extrabold uppercase tracking-[.11em] text-[#aca29a]">{title}</p>{children}</section>;
}

function SearchMessage({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-5 text-[9px] leading-5 text-[#948a82]">{children}</div>;
}

function RecordRow({ item, onOpen }: { item: SearchResult | RecentRecord; onOpen: () => void }) {
  const Icon = item.kind === "shipment" ? Boxes : item.kind === "customer" ? Building2 : PackageSearch;
  const kindLabel = item.kind === "shipment" ? "Shipment" : item.kind === "customer" ? "Customer" : "Enquiry";
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[#faf3ee]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#fff0ea] text-[#c9654f]"><Icon size={15}/></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><strong className="truncate text-[10px] font-bold text-[#514840]">{item.title}</strong><small className="shrink-0 rounded-full bg-[#f1ebe6] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[.07em] text-[#8e8178]">{kindLabel}</small></span>
        <small className="mt-0.5 block truncate text-[8px] text-[#8f857d]">{item.subtitle}</small>
        <small className="mt-0.5 block truncate text-[7px] font-semibold text-[#aaa098]">{item.meta}</small>
      </span>
      <ChevronRight size={12} className="shrink-0 text-[#b8aea6] transition group-hover:translate-x-0.5"/>
    </button>
  );
}

function WorkspaceRow({ item, onOpen }: { item: Workspace; onOpen: () => void }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[#faf3ee]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#f2ece7] text-[#8b7c72]"><Icon size={15}/></span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-[10px] font-bold text-[#514840]">{item.label}</strong><small className="mt-0.5 block truncate text-[8px] text-[#9a9088]">{item.hint}</small></span>
      <ChevronRight size={12} className="shrink-0 text-[#b8aea6] transition group-hover:translate-x-0.5"/>
    </button>
  );
}
