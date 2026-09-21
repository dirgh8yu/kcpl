"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, CheckCircle2, ClipboardCheck, FileText, Landmark, RefreshCw, Route, UserRound, WalletCards } from "lucide-react";
import { shipmentActivityCategories, shipmentActivityCategoryLabels, type ShipmentActivityCategory, type ShipmentActivityItem, type ShipmentActivityTimeline } from "../../shipment-activity";
import { OpsBadge, OpsButton, OpsEmptyState, OpsNotice, OpsRegisterToolbar, OpsScopeTabs, OpsSearch, OpsSurface, OpsTimeline, type OpsTimelineEntry } from "../../operations-ui";

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short" }).format(date)} NPT`;
}

function categoryIcon(category: ShipmentActivityCategory) {
  if (category === "shipment") return <Route size={13}/>;
  if (category === "ownership") return <UserRound size={13}/>;
  if (category === "task") return <ClipboardCheck size={13}/>;
  if (category === "customs") return <Landmark size={13}/>;
  if (category === "document") return <FileText size={13}/>;
  if (category === "finance") return <WalletCards size={13}/>;
  if (category === "alert") return <BellRing size={13}/>;
  return <CheckCircle2 size={13}/>;
}

function timelineTone(item: ShipmentActivityItem): OpsTimelineEntry["tone"] {
  if (item.tone === "violet") return "accent";
  if (item.tone === "danger" || item.tone === "warning" || item.tone === "success" || item.tone === "info") return item.tone;
  return "neutral";
}

function actorLine(entry: ShipmentActivityItem) {
  if (entry.actor_name || entry.actor_email) {
    return `${entry.actor_name || entry.actor_email}${entry.actor_name && entry.actor_email ? ` · ${entry.actor_email}` : ""}`;
  }
  return "System";
}

/** Shipment flight recorder. Loads with the page and then polls quietly every
 * 30s so the audit trail stays live. `highlightId` (the `a=` deep link from the
 * shipments inspector) marks and scrolls to one entry. */
const POLL_MS = 30_000;

export function ShipmentActivityTimeline({ initialTimeline, highlightId }: { initialTimeline: ShipmentActivityTimeline; highlightId?: string | null }) {
  const [timeline, setTimeline] = useState(initialTimeline);
  const [category, setCategory] = useState<"all" | ShipmentActivityCategory>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setBusy(true);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(timeline.reference)}/activity`, { cache: "no-store" });
      const data = await response.json() as { timeline?: ShipmentActivityTimeline; error?: string };
      if (!response.ok || !data.timeline) throw new Error(data.error || "Could not refresh shipment activity.");
      setTimeline(data.timeline);
      if (!quiet) setNotice("Shipment activity refreshed.");
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : "Could not refresh shipment activity.");
    } finally {
      if (!quiet) setBusy(false);
    }
  }, [timeline.reference]);

  useEffect(() => {
    const timer = window.setInterval(() => refresh(true), POLL_MS);
    const onFocus = () => refresh(true);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  // Deep link from the inspector: scroll the highlighted entry into view once.
  useEffect(() => {
    if (!highlightId) return;
    const node = timelineRef.current?.querySelector(`[data-entry-id="${CSS.escape(highlightId)}"]`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId, timeline.items]);

  const counts = useMemo(() => Object.fromEntries(shipmentActivityCategories.map((value) => [value, timeline.items.filter((item) => item.category === value).length])) as Record<ShipmentActivityCategory, number>, [timeline.items]);
  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return timeline.items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!terms.length) return true;
      const haystack = [item.title, item.detail ?? "", item.actor_name ?? "", item.actor_email ?? "", item.branch ?? "", item.source, shipmentActivityCategoryLabels[item.category]].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [category, query, timeline.items]);

  // "Since your last visit": the previous visit's anchor is stored per staff
  // member server-side (staff_activity_visits) so it follows the user across
  // devices; localStorage mirrors it as a fallback for Firestore outages. The
  // anchor is the timestamp of this visit, recorded after the previous one is
  // read — entries newer than the stored anchor sit above the divider.
  const [lastVisitAt, setLastVisitAt] = useState<number | null>(null);
  const [visited, setVisited] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const key = `kcpl:activity-last-visit:${timeline.reference}`;
      const visitNow = new Date().toISOString();
      const readLocal = (): number | null => {
        try { return Number(window.localStorage.getItem(key)) || null; } catch { return null; }
      };
      const writeLocal = (value: string) => {
        try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
      };
      fetch(`/api/admin/shipments/${encodeURIComponent(timeline.reference)}/visits`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json() as { ok?: boolean; seen_through_at?: string | null };
          if (cancelled) return;
          if (response.ok && data.ok) {
            const previous = data.seen_through_at ? Date.parse(data.seen_through_at) : Number.NaN;
            // ok with a null anchor = first-ever visit: nothing is "new".
            setLastVisitAt(Number.isFinite(previous) ? previous : null);
            setVisited(true);
            writeLocal(visitNow);
            return fetch(`/api/admin/shipments/${encodeURIComponent(timeline.reference)}/visits`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ seen_through_at: visitNow }),
            }).catch(() => { /* best-effort; local mirror already written */ });
          }
          // Storage unavailable: fall back to the local mirror only.
          setLastVisitAt(readLocal());
          setVisited(true);
          writeLocal(visitNow);
        })
        .catch(() => {
          if (cancelled) return;
          setLastVisitAt(readLocal());
          setVisited(true);
          writeLocal(visitNow);
        });
    });
    return () => { cancelled = true; window.cancelAnimationFrame(frame); };
  }, [timeline.reference]);

  const lastVisitBoundary = useMemo(() => {
    if (visited && lastVisitAt == null) return null; // first ever visit: nothing is "new"
    if (lastVisitAt == null) return null;
    // The newest item from the previous visit anchors the divider.
    const seen = timeline.items.filter((item) => Date.parse(item.occurred_at) <= lastVisitAt);
    return seen.length ? seen[0].id : null;
  }, [lastVisitAt, timeline.items, visited]);

  const entries = useMemo<OpsTimelineEntry[]>(() => visible.map((entry) => ({
    id: entry.id,
    tone: timelineTone(entry),
    icon: categoryIcon(entry.category),
    highlight: highlightId === entry.id || undefined,
    sinceLastVisit: Boolean(lastVisitBoundary) && lastVisitBoundary !== entry.id && visible.findIndex((candidate) => candidate.id === lastVisitBoundary) > visible.findIndex((candidate) => candidate.id === entry.id),
    title: (
      <span className="ops-activity-title">
        {entry.title}
        <OpsBadge>{shipmentActivityCategoryLabels[entry.category]}</OpsBadge>
        {entry.branch ? <OpsBadge>{entry.branch}</OpsBadge> : null}
        {entry.tone === "danger" ? <OpsBadge tone="danger">Attention</OpsBadge> : null}
      </span>
    ),
    meta: dateTime(entry.occurred_at),
    body: (
      <>
        {entry.detail ? <p className="ops-activity-detail">{entry.detail}</p> : null}
        <span className="ops-activity-actor">{actorLine(entry)} · {entry.source}</span>
      </>
    ),
  })), [visible, highlightId, lastVisitBoundary]);

  return (
    <div className="pb-10">
      <OpsSurface eyebrow="Shipment flight recorder" title="Unified activity timeline" description="One chronological audit trail for movement milestones, ownership, tasks, customs, documents, workflow controls, alerts and authorised finance activity." action={<OpsButton variant="ghost" size="xs" disabled={busy} onClick={() => refresh(false)}><RefreshCw size={13} strokeWidth={1.75} className={busy ? "app-refreshing" : ""} aria-hidden="true"/>{busy ? "Refreshing…" : "Refresh"}</OpsButton>}>
        {notice ? <div className="mb-3"><OpsNotice tone={notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}
        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity: owner, customs, document, alert, staff…" aria-label="Search activity"/>}
          tabs={<OpsScopeTabs label="Activity categories" items={[{ value: "all" as const, label: "All", count: timeline.items.length }, ...shipmentActivityCategories.filter((value) => counts[value]).map((value) => ({ value, label: shipmentActivityCategoryLabels[value], count: counts[value] }))]} value={category} onChange={setCategory}/>}
        />

        <OpsTimeline entries={entries} empty={<OpsEmptyState compact kind="search" title="No activity matches this view" description="Try another category or clear the search." action={<OpsButton variant="secondary" size="sm" onClick={() => { setCategory("all"); setQuery(""); }}>Reset view</OpsButton>}/>}/>
      </OpsSurface>
    </div>
  );
}
