"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, ClipboardCheck, FileText, Landmark, RefreshCw, Route, UserRound, WalletCards } from "lucide-react";
import { shipmentActivityCategories, shipmentActivityCategoryLabels, type ShipmentActivityCategory, type ShipmentActivityItem, type ShipmentActivityTimeline } from "../../shipment-activity";
import { OpsBadge, OpsButton, OpsEmptyState, OpsFilterChip, OpsNotice, OpsSearch, OpsSurface, OpsTimeline, type OpsTimelineEntry } from "../../operations-ui";

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

export function ShipmentActivityTimeline({ initialTimeline }: { initialTimeline: ShipmentActivityTimeline }) {
  const [timeline, setTimeline] = useState(initialTimeline);
  const [category, setCategory] = useState<"all" | ShipmentActivityCategory>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

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
    const timer = window.setInterval(() => refresh(true), 10000);
    const onFocus = () => refresh(true);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

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

  const entries = useMemo<OpsTimelineEntry[]>(() => visible.map((entry) => ({
    id: entry.id,
    tone: timelineTone(entry),
    icon: categoryIcon(entry.category),
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
  })), [visible]);

  return (
    <div className="ops-content-wide pb-10">
      <OpsSurface eyebrow="Shipment flight recorder" title="Unified activity timeline" description="One chronological audit trail for movement milestones, ownership, tasks, customs, documents, workflow controls, alerts and authorised finance activity." action={<OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => refresh(false)}><RefreshCw size={12} className={busy ? "animate-spin" : ""}/>{busy ? "Refreshing…" : "Refresh"}</OpsButton>}>
        {notice ? <div className="mb-3"><OpsNotice tone={notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}
        <div className="ops-activity-filters">
          <OpsFilterChip active={category === "all"} onClick={() => setCategory("all")}>All · {timeline.items.length}</OpsFilterChip>
          {shipmentActivityCategories.map((value) => counts[value] ? <OpsFilterChip key={value} active={category === value} onClick={() => setCategory(value)}>{shipmentActivityCategoryLabels[value]} · {counts[value]}</OpsFilterChip> : null)}
        </div>
        <div className="mt-3"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity: owner, customs, document, alert, staff…"/></div>

        <div className="mt-4">
          <OpsTimeline entries={entries} empty={<OpsEmptyState icon={<AlertTriangle size={18}/>} title="No activity matches this view" description="Try another category or clear the search." action={<OpsButton variant="secondary" size="sm" onClick={() => { setCategory("all"); setQuery(""); }}>Reset view</OpsButton>}/>}/>
        </div>
      </OpsSurface>
    </div>
  );
}
