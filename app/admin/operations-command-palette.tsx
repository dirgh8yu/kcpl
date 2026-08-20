"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Command, Search, X } from "lucide-react";

export type OperationsCommandItem = {
  href: string;
  label: string;
  group: string;
  keywords?: string[];
};

export function OperationsCommandPalette({ items, open, onOpenChange }: { items: OperationsCommandItem[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.label, item.group, ...(item.keywords ?? [])].join(" ").toLowerCase().includes(needle));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(Math.max(0, results.length - 1));
  }, [activeIndex, results.length]);

  if (!open) return null;

  function choose(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[#0d1117]/35 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={() => onOpenChange(false)}>
      <div role="dialog" aria-modal="true" aria-label="KCPL command palette" className="w-full max-w-xl overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,.22)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex h-12 items-center gap-3 border-b border-[#e6e8eb] px-3.5">
          <Search size={16} className="shrink-0 text-[#858c94]"/>
          <input
            autoFocus
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((current) => Math.min(results.length - 1, current + 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
              if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex].href); }
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#20242a] outline-none placeholder:text-[#a1a7ad]"
            placeholder="Jump to a workspace…"
          />
          <button type="button" onClick={() => onOpenChange(false)} className="grid h-7 w-7 place-items-center rounded-md text-[#8b9299] hover:bg-[#f2f3f4] hover:text-[#3a4047]" aria-label="Close command palette"><X size={14}/></button>
        </div>

        <div className="max-h-[390px] overflow-y-auto p-1.5">
          {results.length ? results.map((item, index) => (
            <button
              key={`${item.group}:${item.href}`}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(item.href)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${activeIndex === index ? "bg-[#f2f4f8]" : "hover:bg-[#f7f8f9]"}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#e3e6ea] bg-white text-[#5b67a7]"><Command size={13}/></span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-[#2d3238]">{item.label}</strong><span className="mt-0.5 block text-[10px] text-[#939aa1]">{item.group}</span></span>
              <ArrowRight size={13} className="text-[#a3a9af]"/>
            </button>
          )) : <div className="px-4 py-10 text-center"><p className="text-xs font-semibold text-[#555d66]">No matching workspace</p><p className="mt-1 text-[11px] text-[#9299a0]">Try a shipment, customs, customer, finance or administration keyword.</p></div>}
        </div>

        <div className="flex items-center justify-between border-t border-[#e8eaec] bg-[#fafafa] px-3.5 py-2 text-[10px] text-[#979da4]">
          <span>Navigation search across KCPL Operations</span>
          <span className="flex items-center gap-2"><kbd className="rounded border border-[#dfe2e5] bg-white px-1.5 py-0.5 font-sans">↑↓</kbd> navigate <kbd className="rounded border border-[#dfe2e5] bg-white px-1.5 py-0.5 font-sans">↵</kbd> open</span>
        </div>
      </div>
    </div>
  );
}
