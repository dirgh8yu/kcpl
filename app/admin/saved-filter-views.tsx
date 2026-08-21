"use client";

import { BookmarkPlus, X } from "lucide-react";
import { useState } from "react";

type SavedFilterView<TStatus extends string> = {
  id: string;
  name: string;
  query: string;
  status: TStatus;
};

function readViews<TStatus extends string>(storageKey: string): SavedFilterView<TStatus>[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as SavedFilterView<TStatus>[];
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.query === "string" && typeof item.status === "string");
  } catch {
    return [];
  }
}

export function SavedFilterViews<TStatus extends string>({
  storageKey,
  query,
  status,
  onApply,
}: {
  storageKey: string;
  query: string;
  status: TStatus;
  onApply: (view: { query: string; status: TStatus }) => void;
}) {
  const [views, setViews] = useState<SavedFilterView<TStatus>[]>(() => readViews<TStatus>(storageKey));

  function persist(next: SavedFilterView<TStatus>[]) {
    setViews(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function saveCurrent() {
    const suggested = status === "all" && !query.trim() ? "All records" : status === "all" ? `Search: ${query.trim()}` : query.trim() ? `${status} · ${query.trim()}` : status;
    const name = window.prompt("Name this view", suggested)?.trim();
    if (!name) return;
    const next: SavedFilterView<TStatus> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.slice(0, 48),
      query,
      status,
    };
    persist([next, ...views].slice(0, 10));
  }

  function remove(id: string) {
    persist(views.filter((view) => view.id !== id));
  }

  if (!views.length) {
    return <button type="button" onClick={saveCurrent} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#ddd3cb] px-2.5 py-1.5 text-[8px] font-bold text-[#948980] transition hover:border-[#d4b6a8] hover:bg-[#fff8f4] hover:text-[#b96852]"><BookmarkPlus size={10}/>Save current view</button>;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[7px] font-extrabold uppercase tracking-[.1em] text-[#aaa098]">Saved</span>
      {views.map((view) => <span key={view.id} className="group inline-flex items-center overflow-hidden rounded-full border border-[#e6ddd6] bg-white">
        <button type="button" onClick={() => onApply(view)} className="px-2.5 py-1.5 text-[8px] font-semibold text-[#6f655d] transition hover:bg-[#faf4ef]">{view.name}</button>
        <button type="button" onClick={() => remove(view.id)} aria-label={`Delete saved view ${view.name}`} className="mr-1 grid h-5 w-5 place-items-center rounded-full text-[#b4aaa2] opacity-60 transition hover:bg-[#fff0eb] hover:text-[#a9584d] group-hover:opacity-100"><X size={9}/></button>
      </span>)}
      <button type="button" onClick={saveCurrent} className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-[#ddd3cb] text-[#9c9189] transition hover:border-[#d4b6a8] hover:bg-[#fff8f4] hover:text-[#b96852]" aria-label="Save current view"><BookmarkPlus size={10}/></button>
    </div>
  );
}
