"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, Building2, FileSearch, Handshake, PackageSearch, Plus, ReceiptText, Search, X } from "lucide-react";
import type { WorkflowWorkspace } from "./workflow-navigation";
import { workspaceSearchText } from "./workflow-navigation";

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
};

function resultIcon(kind: PaletteEntry["kind"]) {
  if (kind === "action") return <Plus size={14}/>;
  if (kind === "shipment" || kind === "order") return <Boxes size={14}/>;
  if (kind === "customer") return <Building2 size={14}/>;
  if (kind === "partner" || kind === "tender") return <Handshake size={14}/>;
  if (kind === "payable") return <ReceiptText size={14}/>;
  if (kind === "quote") return <PackageSearch size={14}/>;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setQuery("");
      setRemoteResults([]);
      setSelectedIndex(0);
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/admin/operations-search?q=${encodeURIComponent(normalized)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { ok?: boolean; results?: SearchResult[] };
        if (response.ok && data.ok && Array.isArray(data.results)) setRemoteResults(data.results);
        else setRemoteResults([]);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setRemoteResults([]);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
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
      .map((workspace) => ({ key: `workspace:${workspace.id}`, title: workspace.label, subtitle: `${workspace.group} · ${workspace.hint}`, meta: null, href: workspace.href, kind: "workspace" as const }));
    const remoteEntries = needle.length >= 2 ? remoteResults.map((result) => ({ key: `${result.kind}:${result.id}`, title: result.title, subtitle: result.subtitle, meta: result.meta, href: result.href, kind: result.kind })) : [];
    return [...quickActions.slice(0, needle ? 6 : 4), ...workspaceEntries, ...remoteEntries].slice(0, 45);
  }, [query, remoteResults, workspaces]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSelectedIndex(0));
    return () => window.cancelAnimationFrame(frame);
  }, [query, remoteResults]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  if (!open) return null;
  const selected = entries[selectedIndex] ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[#101010]/30 px-3 pt-[10vh]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full max-w-[760px] overflow-hidden border border-[#101010] bg-[#F6F6F3] shadow-[0_24px_72px_rgba(16,16,16,.18)]" role="dialog" aria-modal="true" aria-label="KCPL command palette">
        <div className="flex items-center gap-3 border-b border-[#101010] px-4 py-4 sm:px-5">
          <Search size={16} className="shrink-0 text-[#DC143C]"/>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((current) => Math.min(entries.length - 1, current + 1)); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((current) => Math.max(0, current - 1)); }
              else if (event.key === "Enter" && selected) { event.preventDefault(); go(selected.href); }
              else if (event.key === "Escape") { event.preventDefault(); onClose(); }
            }}
            className="min-w-0 flex-1 bg-transparent text-[14px] font-normal text-[#101010] outline-none placeholder:text-[#777771]"
            placeholder="Search KCPL, jobs, customers, orders, tenders, partners…"
            aria-label="Search KCPL"
          />
          {busy && query.trim().length >= 2 ? <span className="text-[9px] font-normal uppercase tracking-[.09em] text-[#777771]">Searching</span> : null}
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center border-l border-[#D6D6D0] text-[#5B5B57] transition-colors hover:bg-[#EEEEE8] hover:text-[#101010]" aria-label="Close command palette"><X size={15}/></button>
        </div>

        <div className="max-h-[66vh] overflow-y-auto">
          {!entries.length ? <div className="px-5 py-14 text-center"><FileSearch size={20} className="mx-auto text-[#777771]"/><p className="mt-4 text-[13px] font-medium text-[#101010]">No matching KCPL records</p><p className="mt-2 text-[11px] text-[#777771]">Try a shipment reference, customer, lane, carrier, order, tender or invoice number.</p></div> : entries.map((entry, index) => (
            <button
              type="button"
              key={entry.key}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => go(entry.href)}
              className={`grid min-h-[64px] w-full grid-cols-[32px_minmax(0,1fr)_auto_16px] items-center gap-3 border-b border-[#D6D6D0] px-4 py-3 text-left transition-colors sm:px-5 ${index === selectedIndex ? "bg-[#EEEEE8] shadow-[inset_2px_0_0_#DC143C]" : "hover:bg-[#F0F0EA]"}`}
            >
              <span className={`${index === selectedIndex ? "text-[#DC143C]" : "text-[#777771]"}`}>{resultIcon(entry.kind)}</span>
              <span className="min-w-0"><span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"><strong className="truncate text-[12px] font-medium text-[#101010]">{entry.title}</strong><span className="shrink-0 border border-[#BEBEB7] px-1.5 py-0.5 text-[8px] font-normal uppercase tracking-[.06em] text-[#777771]">{kindLabel(entry.kind)}</span></span><span className="mt-1 block truncate text-[10px] text-[#777771]">{entry.subtitle}</span></span>
              {entry.meta ? <span className="hidden shrink-0 text-[9px] text-[#777771] sm:block">{entry.meta.replaceAll("_", " ")}</span> : <span/>}
              <ArrowRight size={12} className="shrink-0 text-[#777771]"/>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#101010] bg-[#EEEEE8] px-4 py-2.5 text-[8px] font-normal uppercase tracking-[0.05em] text-[#777771] sm:px-5"><span>↑↓ move · Enter open · Esc close</span><span>⌘K / Ctrl+K · KCPL search</span></div>
      </section>
    </div>
  );
}
