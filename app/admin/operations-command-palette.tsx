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
      { key: "action:new-enquiry", title: "New enquiry / quote", subtitle: "Open the customer freight request desk", meta: null, href: "/admin", kind: "action" },
      { key: "action:new-customer", title: "New customer", subtitle: "Open Customers to create a Customer 360 account", meta: null, href: "/admin/crm", kind: "action" },
      ...(allowedIds.has("partners") ? [{ key: "action:new-partner", title: "New partner", subtitle: "Add a carrier, agent, vendor or counterpart", meta: null, href: "/admin/partners/new", kind: "action" as const }] : []),
      ...(allowedIds.has("rating") ? [{ key: "action:new-order", title: "New transport order", subtitle: "Open Orders & Rate Desk to create and rate cargo", meta: null, href: "/admin/rating", kind: "action" as const }] : []),
      ...(allowedIds.has("consolidation") ? [{ key: "action:load-plan", title: "Plan consolidation", subtitle: "Build a master load from compatible orders", meta: null, href: "/admin/consolidation", kind: "action" as const }] : []),
      ...(allowedIds.has("tenders") ? [{ key: "action:tender", title: "Tender / book carrier", subtitle: "Issue or manage a procurement tender", meta: null, href: "/admin/tenders", kind: "action" as const }] : []),
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/20 px-3 pt-[10vh]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full max-w-[720px] overflow-hidden rounded-[10px] border border-[#e2e2e2] bg-white shadow-[0_24px_72px_rgba(0,0,0,.18)]" role="dialog" aria-modal="true" aria-label="KCPL command palette">
        <div className="flex items-center gap-3 border-b border-[#e2e2e2] px-4 py-3">
          <Search size={16} className="shrink-0 text-[#dc143c]"/>
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
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[#141414] outline-none placeholder:text-[#737373]"
            placeholder="Search KCPL, jobs, customers, orders, tenders, partners…"
            aria-label="Search KCPL"
          />
          {busy && query.trim().length >= 2 ? <span className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#737373]">Searching</span> : null}
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[6px] text-[#737373] hover:bg-[#f7f7f7] hover:text-[#141414]" aria-label="Close command palette"><X size={15}/></button>
        </div>

        <div className="max-h-[66vh] overflow-y-auto p-2">
          {!entries.length ? <div className="px-4 py-12 text-center"><FileSearch size={20} className="mx-auto text-[#737373]"/><p className="mt-3 text-[12px] font-semibold text-[#141414]">No matching KCPL records</p><p className="mt-1 text-[10px] text-[#737373]">Try a shipment reference, customer, lane, carrier, order, tender or invoice number.</p></div> : entries.map((entry, index) => (
            <button
              type="button"
              key={entry.key}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => go(entry.href)}
              className={`flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-left ${index === selectedIndex ? "bg-[#f7f7f7] shadow-[inset_2px_0_0_#dc143c]" : "hover:bg-[#fbfbf9]"}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[6px] bg-[#f7f7f7] ${index === selectedIndex ? "text-[#dc143c]" : "text-[#737373]"}`}>{resultIcon(entry.kind)}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-[11px] font-semibold text-[#141414]">{entry.title}</strong><span className="shrink-0 rounded-[5px] border border-[#e2e2e2] bg-white px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.05em] text-[#737373]">{kindLabel(entry.kind)}</span></span><span className="mt-0.5 block truncate text-[9px] text-[#737373]">{entry.subtitle}</span></span>
              {entry.meta ? <span className="hidden shrink-0 text-[9px] font-medium text-[#737373] sm:block">{entry.meta.replaceAll("_", " ")}</span> : null}
              <ArrowRight size={12} className="shrink-0 text-[#737373]"/>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e2e2] bg-[#f7f7f7] px-4 py-2 text-[8px] font-medium text-[#737373]"><span>↑↓ move · Enter open · Esc close</span><span>⌘K / Ctrl+K opens anywhere in KCPL Operations</span></div>
      </section>
    </div>
  );
}
