"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, Building2, FileSearch, Handshake, PackageSearch, Plus, ReceiptText, Search, X } from "lucide-react";
import type { WorkflowWorkspace, WorkspaceIconName } from "./workflow-navigation";
import { workspaceSearchText } from "./workflow-navigation";
import { WorkspaceIcon } from "./workflow-icon";

type SearchResult = {
  kind: "shipment" | "customer" | "quote" | "order" | "tender" | "partner" | "payable";
  id: string;
  title: string;
  subtitle: string;
  meta: string | null;
  href: string;
};

type PaletteEntry = {
  key: string;
  title: string;
  subtitle: string;
  meta: string | null;
  href: string;
  kind: "workspace" | "action" | SearchResult["kind"];
  icon?: WorkspaceIconName;
};

function resultIcon(entry: PaletteEntry) {
  if (entry.kind === "workspace" && entry.icon) return <WorkspaceIcon name={entry.icon} size={14}/>;
  if (entry.kind === "action") return <Plus size={14}/>;
  if (entry.kind === "shipment" || entry.kind === "order") return <Boxes size={14}/>;
  if (entry.kind === "customer") return <Building2 size={14}/>;
  if (entry.kind === "partner" || entry.kind === "tender") return <Handshake size={14}/>;
  if (entry.kind === "payable") return <ReceiptText size={14}/>;
  if (entry.kind === "quote") return <PackageSearch size={14}/>;
  return <FileSearch size={14}/>;
}

function kindLabel(kind: PaletteEntry["kind"]) {
  if (kind === "workspace") return "Workspace";
  if (kind === "action") return "Quick action";
  if (kind === "shipment") return "Job File";
  if (kind === "customer") return "Customer";
  if (kind === "quote") return "Enquiry";
  if (kind === "order") return "Transport order";
  if (kind === "tender") return "Tender";
  if (kind === "partner") return "Partner";
  return "Supplier bill";
}

export function OperationsCommandPalette({ open, onClose, workspaces }: { open: boolean; onClose: () => void; workspaces: WorkflowWorkspace[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [resultQuery, setResultQuery] = useState("");
  const [searchError, setSearchError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      setQuery("");
      setRemoteResults([]);
      setResultQuery("");
      setSearchError(false);
      setSelectedIndex(0);
      inputRef.current?.focus();
    });
    return () => { window.cancelAnimationFrame(frame); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialog!.querySelectorAll<HTMLElement>('input,button:not([tabindex="-1"]),[tabindex="0"]'));
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/operations-search?q=${encodeURIComponent(normalized)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { ok?: boolean; results?: SearchResult[] };
        if (controller.signal.aborted) return;
        setResultQuery(normalized);
        setSearchError(!response.ok || !data.ok);
        setRemoteResults(response.ok && data.ok && Array.isArray(data.results) ? data.results : []);
      } catch (error) {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
          setRemoteResults([]); setResultQuery(normalized); setSearchError(true);
        }
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const needle = query.trim().toLowerCase();
    const allowedIds = new Set(workspaces.map((workspace) => workspace.id));
    const quickActionCandidates: PaletteEntry[] = [
      { key: "action:new-customer", title: "New customer", subtitle: "Create a Customer 360 account", meta: null, href: "/admin/crm/new", kind: "action" },
      ...(allowedIds.has("partners") ? [{ key: "action:new-partner", title: "New partner", subtitle: "Add a carrier, agent, vendor or counterpart", meta: null, href: "/admin/partners/new", kind: "action" as const }] : []),
      ...(allowedIds.has("delivery") ? [{ key: "action:delivery", title: "Work Delivery & POD", subtitle: "Open final-mile attempts and POD review", meta: null, href: "/admin/delivery", kind: "action" as const }] : []),
      ...(allowedIds.has("payables") ? [{ key: "action:new-payable", title: "New supplier bill", subtitle: "Record a payable before Freight Audit", meta: null, href: "/admin/payables?create=1", kind: "action" as const }] : []),
    ];
    const quickActions = quickActionCandidates.filter((entry) => !needle || `${entry.title} ${entry.subtitle}`.toLowerCase().includes(needle));

    const matchingWorkspaces = workspaces.filter((workspace) => !needle || workspaceSearchText(workspace).includes(needle));
    const workspaceEntries = (needle ? matchingWorkspaces.slice(0, 18) : matchingWorkspaces)
      .map((workspace) => ({ key: `workspace:${workspace.id}`, title: workspace.label, subtitle: `${workspace.group} · ${workspace.hint}`, meta: null, href: workspace.href, kind: "workspace" as const, icon: workspace.icon }));
    const remoteEntries = needle.length >= 2 && resultQuery === query.trim() ? remoteResults.map((result) => ({ key: `${result.kind}:${result.id}`, title: result.title, subtitle: result.subtitle, meta: result.meta, href: result.href, kind: result.kind })) : [];
    return [...remoteEntries, ...quickActions.slice(0, needle ? 6 : 4), ...workspaceEntries].slice(0, 45);
  }, [query, remoteResults, resultQuery, workspaces]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSelectedIndex(0));
    return () => window.cancelAnimationFrame(frame);
  }, [query, remoteResults]);

  useEffect(() => {
    resultsRef.current?.querySelector(`[data-result-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  if (!open) return null;
  const selected = entries[selectedIndex] ?? entries[0] ?? null;
  const busy = query.trim().length >= 2 && resultQuery !== query.trim();

  return (
    <div className="app-command-backdrop fixed inset-0 z-[100] flex items-start justify-center bg-[var(--admin-ink)]/30 px-3 pt-[10vh]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="app-command-dialog w-full max-w-[760px] overflow-hidden border border-[var(--admin-ink)] bg-[var(--admin-surface)]" role="dialog" aria-modal="true" aria-label="KCPL command palette">
        <div className="flex items-center gap-3 border-b border-[var(--admin-ink)] px-4 py-4 sm:px-5">
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-[var(--admin-crimson)]"/>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((current) => Math.max(0, Math.min(entries.length - 1, current + 1))); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((current) => Math.max(0, current - 1)); }
              else if (event.key === "Enter" && selected) { event.preventDefault(); go(selected.href); }
              else if (event.key === "Escape") { event.preventDefault(); onClose(); }
            }}
            className="min-w-0 flex-1 bg-transparent text-[length:var(--app-font-size)] font-normal text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)]"
            placeholder="Search KCPL, jobs, customers, orders, tenders, partners…"
            aria-label="Search KCPL"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="command-results"
            aria-activedescendant={selected ? `command-result-${Math.max(0, entries.indexOf(selected))}` : undefined}
          />
          {busy && query.trim().length >= 2 ? <span className="text-[length:var(--app-label-size)] font-medium text-[var(--admin-muted)]">Searching</span> : null}
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center border-l border-[var(--admin-line)] text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)]" aria-label="Close command palette"><X size={15} strokeWidth={1.75}/></button>
        </div>

        {searchError && resultQuery === query.trim() && query.trim().length >= 2 ? <p role="status" className="app-search-error">Record search is unavailable. You can still open a workspace below.</p> : null}
        <div ref={resultsRef} id="command-results" role="listbox" aria-label="Search results" aria-busy={busy} className="max-h-[66vh] overflow-y-auto">
          {!entries.length ? <div className="px-5 py-14 text-center"><FileSearch size={20} strokeWidth={1.75} className="mx-auto text-[var(--admin-muted)]"/><p className="mt-4 text-[length:var(--app-font-size)] font-medium text-[var(--admin-ink)]">No matching KCPL records</p><p className="mt-2 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Try a shipment reference, customer, lane, carrier, order, tender or invoice number.</p></div> : entries.map((entry, index) => (
            <button
              type="button"
              key={entry.key}
              id={`command-result-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              tabIndex={-1}
              data-result-index={index}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => go(entry.href)}
              className={`grid min-h-[48px] w-full grid-cols-[32px_minmax(0,1fr)_auto_16px] items-center gap-3 border-b border-[var(--admin-line)] px-4 py-2 text-left transition-colors sm:px-5 ${index === selectedIndex ? "bg-[var(--admin-surface-muted)] shadow-[inset_2px_0_0_var(--admin-crimson)]" : "hover:bg-[var(--admin-canvas)]"}`}
            >
              <span className={`${index === selectedIndex ? "text-[var(--admin-crimson)]" : "text-[var(--admin-muted)]"}`}>{resultIcon(entry)}</span>
              <span className="min-w-0"><span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"><strong className="truncate text-[length:var(--app-font-size)] font-medium text-[var(--admin-ink)]">{entry.title}</strong><span className="shrink-0 border border-[var(--admin-line-strong)] px-1.5 py-0.5 text-[length:var(--app-label-size)] font-normal text-[var(--admin-muted)]">{kindLabel(entry.kind)}</span></span><span className="mt-1 block truncate text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{entry.subtitle}</span></span>
              {entry.meta ? <span className="hidden shrink-0 text-[length:var(--app-label-size)] text-[var(--admin-muted)] sm:block">{entry.meta.replaceAll("_", " ")}</span> : <span/>}
              <ArrowRight size={13} strokeWidth={1.75} className="shrink-0 text-[var(--admin-muted)]"/>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--admin-ink)] bg-[var(--admin-surface-muted)] px-4 py-2.5 text-[length:var(--app-label-size)] font-normal text-[var(--admin-muted)] sm:px-5"><span>↑↓ move · Enter open · Esc close</span><span>⌘K / Ctrl+K · KCPL search</span></div>
      </div>
    </div>
  );
}
