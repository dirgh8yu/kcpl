"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, ClipboardCheck, FileText, Landmark, RefreshCw, Route, UserRound, WalletCards } from "lucide-react";
import { shipmentActivityCategories, shipmentActivityCategoryLabels, type ShipmentActivityCategory, type ShipmentActivityItem, type ShipmentActivityTimeline } from "../../shipment-activity";
import { OpsBadge, OpsButton, OpsEmptyState, OpsNotice, OpsSearch, OpsSurface } from "../../operations-ui";

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

function toneClass(item: ShipmentActivityItem) {
  if (item.tone === "danger") return "border-[#e0a9ab] bg-[#fff0f0] text-[#a23f46]";
  if (item.tone === "warning") return "border-[#e2c48c] bg-[#fff8e9] text-[#9a6b24]";
  if (item.tone === "success") return "border-[#b7cfbb] bg-[#f0f7f1] text-[#5d7862]";
  if (item.tone === "violet") return "border-[#cfc2dc] bg-[#f7f2fb] text-[#775d8f]";
  if (item.tone === "info") return "border-[#b9cfdf] bg-[#f0f6fa] text-[#527590]";
  return "border-[#ddd6d0] bg-[#faf8f5] text-[#786f68]";
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

  return (
    <div className="ops-content-wide pb-10">
      <OpsSurface eyebrow="Shipment flight recorder" title="Unified activity timeline" description="One chronological audit trail for movement milestones, ownership, tasks, customs, documents, workflow controls, alerts and authorised finance activity." action={<OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => refresh(false)}><RefreshCw size={12} className={busy ? "animate-spin" : ""}/>{busy ? "Refreshing…" : "Refresh"}</OpsButton>}>
        {notice ? <div className="mb-3"><OpsNotice tone={notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setCategory("all")} className={`ops-badge ${category === "all" ? "ring-1 ring-[#c56a55]" : ""}`}>All · {timeline.items.length}</button>
          {shipmentActivityCategories.map((value) => counts[value] ? <button type="button" key={value} onClick={() => setCategory(value)} className={`ops-badge ${category === value ? "ring-1 ring-[#c56a55]" : ""}`}>{shipmentActivityCategoryLabels[value]} · {counts[value]}</button> : null)}
        </div>
        <div className="mt-3"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity: owner, customs, document, alert, staff…"/></div>

        {visible.length ? <div className="mt-4 divide-y divide-[#eee7e1]">{visible.map((entry, index) => (
          <article key={entry.id} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 py-3.5">
            <div className="relative flex justify-center">
              {index < visible.length - 1 ? <span className="absolute bottom-[-14px] top-7 w-px bg-[#e8e0da]" aria-hidden="true"/> : null}
              <span className={`relative z-10 grid h-7 w-7 place-items-center rounded-full border ${toneClass(entry)}`}>{categoryIcon(entry.category)}</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5"><strong className="text-[11px] font-[720] text-[#453f3a]">{entry.title}</strong><OpsBadge>{shipmentActivityCategoryLabels[entry.category]}</OpsBadge>{entry.branch ? <OpsBadge>{entry.branch}</OpsBadge> : null}{entry.tone === "danger" ? <OpsBadge tone="danger">Attention</OpsBadge> : null}</div>
              {entry.detail ? <p className="mt-1 text-[10px] leading-5 text-[#766e67]">{entry.detail}</p> : null}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-semibold text-[#9a918a]"><span>{dateTime(entry.occurred_at)}</span><span>{entry.actor_name || entry.actor_email ? `${entry.actor_name || entry.actor_email}${entry.actor_name && entry.actor_email ? ` · ${entry.actor_email}` : ""}` : "System"}</span><span>{entry.source}</span></div>
            </div>
          </article>
        ))}</div> : <div className="mt-4"><OpsEmptyState icon={<AlertTriangle size={18}/>} title="No activity matches this view" description="Try another category or clear the search." action={<OpsButton variant="secondary" size="sm" onClick={() => { setCategory("all"); setQuery(""); }}>Reset view</OpsButton>}/></div>}
      </OpsSurface>
    </div>
  );
}
