"use client";

import { BookmarkPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { OpsButton, OpsNotice } from "./operations-ui";

type SavedFilterView<TStatus extends string> = { id: string; name: string; query: string; status: TStatus };
function readViews<TStatus extends string>(storageKey: string): SavedFilterView<TStatus>[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as SavedFilterView<TStatus>[];
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.query === "string" && typeof item.status === "string").slice(0, 10) : [];
  } catch { return []; }
}
export function SavedFilterViews<TStatus extends string>({ storageKey, query, status, onApply }: {
  storageKey: string; query: string; status: TStatus; onApply: (view: { query: string; status: TStatus }) => void;
}) {
  const [views, setViews] = useState<SavedFilterView<TStatus>[]>([]);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { setViews(readViews<TStatus>(storageKey)); setReadyKey(storageKey); setEditing(false); setError(""); });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  function persist(next: SavedFilterView<TStatus>[]) {
    setViews(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); setError(""); }
    catch { setError("This browser cannot save views. Your filters still work for this session."); }
  }
  function saveCurrent() {
    const title = name.trim().slice(0, 48);
    if (!title) return;
    const existing = views.find((view) => view.name.toLowerCase() === title.toLowerCase());
    const next = { id: existing?.id ?? crypto.randomUUID(), name: title, query, status };
    persist([next, ...views.filter((view) => view.id !== next.id)].slice(0, 10));
    setEditing(false);
  }
  if (readyKey !== storageKey) return null;
  return <div className="ops-saved-views">
    <div className="ops-saved-view-list" role="group" aria-label="Saved filter views">
      {views.map((view) => <span key={view.id} className="ops-saved-view"><button type="button" aria-pressed={view.query === query && view.status === status} onClick={() => onApply(view)}>{view.name}</button><button type="button" onClick={() => persist(views.filter((item) => item.id !== view.id))} aria-label={`Delete saved view ${view.name}`}><X size={12}/></button></span>)}
      <OpsButton size="sm" variant="ghost" onClick={() => { setName(query.trim() ? `Search: ${query.trim()}` : status === "all" ? "All records" : status); setEditing(true); }}><BookmarkPlus size={13}/>Save view</OpsButton>
    </div>
    {editing ? <div className="ops-save-view-editor"><label>View name<input className="ops-input" value={name} maxLength={48} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveCurrent(); } if (event.key === "Escape") { event.preventDefault(); setEditing(false); } }}/></label><OpsButton size="sm" variant="primary" disabled={!name.trim()} onClick={saveCurrent}>Save</OpsButton><OpsButton size="sm" onClick={() => setEditing(false)}>Cancel</OpsButton></div> : null}
    {error ? <OpsNotice tone="warning" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
  </div>;
}
