"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, RefreshCw, RadioTower, Search, ShieldAlert } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsMono, OpsNotice, OpsPage } from "../operations-ui";
import { shipmentStatusLabels } from "../../shipment-types";
import { trackingMilestoneLabels, trackingMilestones, type TrackingEvent, type TrackingMilestone, type VisibilityShipment, type VisibilitySummary } from "./tracking-visibility";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

type ApiResponse = {
  ok: boolean;
  error?: string;
  rows?: VisibilityShipment[];
  summary?: VisibilitySummary;
  events?: TrackingEvent[];
  opened_exceptions?: string[];
  checked?: number;
  opened?: number;
};

type Focus = "all" | "delayed" | "stale" | "customs" | "delivery";

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: NEPAL_TIME_ZONE }).format(date)} NPT`;
}

function shortDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: NEPAL_TIME_ZONE }).format(date);
}

function delayText(hours: number | null) {
  if (hours === null) return "No baseline";
  if (Math.abs(hours) < 1) return "On baseline";
  return hours > 0 ? `+${Math.round(hours)}h` : `-${Math.abs(Math.round(hours))}h`;
}

function statusTone(row: VisibilityShipment): "neutral" | "info" | "warning" | "success" | "danger" {
  if (row.status === "delivered") return "success";
  if (row.stale || row.status === "exception") return "danger";
  if ((row.eta_delta_hours ?? 0) >= 24 || row.status === "customs_clearance") return "warning";
  return "info";
}

function focusLabel(focus: Focus) {
  if (focus === "delayed") return "ETA delayed";
  if (focus === "stale") return "Stale feeds";
  if (focus === "customs") return "Customs";
  if (focus === "delivery") return "Out for delivery";
  return "All active feeds";
}

export function TrackingVisibilityWorkspace({ initialRows, initialSummary, canSweep, initialQuery = "" }: { initialRows: VisibilityShipment[]; initialSummary: VisibilitySummary; canSweep: boolean; initialQuery?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [query, setQuery] = useState(initialQuery);
  const [focus, setFocus] = useState<Focus>("all");
  const [selectedReference, setSelectedReference] = useState<string | null>(initialQuery && initialRows.some((row) => row.reference === initialQuery) ? initialQuery : null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const [rawStatus, setRawStatus] = useState("");
  const [milestone, setMilestone] = useState<TrackingMilestone | "">("");
  const [location, setLocation] = useState("");
  const [eta, setEta] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [provider, setProvider] = useState("");
  const [details, setDetails] = useState("");

  const selected = selectedReference ? rows.find((row) => row.reference === selectedReference) ?? null : null;
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (focus === "delayed" && (row.eta_delta_hours ?? 0) < 24) return false;
      if (focus === "stale" && !row.stale) return false;
      if (focus === "customs" && row.status !== "customs_clearance") return false;
      if (focus === "delivery" && row.status !== "out_for_delivery") return false;
      if (!terms.length) return true;
      const haystack = [row.reference, row.customer_name, row.origin, row.destination, row.mode, row.carrier ?? "", row.carrier_reference ?? "", row.current_location ?? "", row.last_provider ?? "", row.last_milestone ?? "", shipmentStatusLabels[row.status]].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [focus, query, rows]);

  async function refresh() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Visibility could not be refreshed.");
      setRows(data.rows);
      setSummary(data.summary);
      if (selectedReference && data.rows.some((row) => row.reference === selectedReference)) await loadEvents(selectedReference, false);
      setNotice({ tone: "success", text: "Live visibility refreshed." });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Visibility could not be refreshed." });
    } finally {
      setBusy(false);
    }
  }

  async function loadEvents(reference: string, updateSelection = true) {
    if (updateSelection) setSelectedReference(reference);
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/visibility?reference=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.events) throw new Error(data.error || "Tracking history could not be loaded.");
      setEvents(data.events);
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking history could not be loaded." });
    } finally {
      setBusy(false);
    }
  }

  async function recordEvent() {
    if (!selected || !rawStatus.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "record", reference: selected.reference, rawStatus, milestone: milestone || null, location, eta, eventTime, provider, details }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tracking event could not be recorded.");
      setRawStatus("");
      setMilestone("");
      setLocation("");
      setEta("");
      setEventTime("");
      setProvider("");
      setDetails("");
      await refresh();
      await loadEvents(selected.reference, false);
      const exceptions = data.opened_exceptions?.length ? ` Automatic exceptions opened: ${data.opened_exceptions.join(", ")}.` : "";
      setNotice({ tone: exceptions ? "warning" : "success", text: `Tracking event recorded.${exceptions}` });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking event could not be recorded." });
    } finally {
      setBusy(false);
    }
  }

  async function sweep() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sweep" }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tracking health sweep failed.");
      await refresh();
      setNotice({ tone: (data.opened ?? 0) > 0 ? "warning" : "success", text: `Checked ${data.checked ?? 0} active shipments. Opened ${data.opened ?? 0} stale-feed exceptions.` });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking health sweep failed." });
    } finally {
      setBusy(false);
    }
  }

  const metrics: Array<{ label: string; value: number; target?: Focus; alert?: boolean }> = [
    { label: "Active", value: summary.active, target: "all" },
    { label: "ETA delayed", value: summary.delayed, target: "delayed", alert: summary.delayed > 0 },
    { label: "Stale feeds", value: summary.stale, target: "stale", alert: summary.stale > 0 },
    { label: "Customs", value: summary.customs, target: "customs", alert: summary.customs > 0 },
    { label: "Out for delivery", value: summary.out_for_delivery, target: "delivery" },
    { label: "Delivered today", value: summary.delivered_today },
  ];

  return <OpsPage>
    <main className="min-h-[calc(100vh-64px)] bg-[#F6F6F3] text-[#101010]">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        <header className="grid gap-6 border-b border-[#101010] pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[10px] font-normal uppercase tracking-[0.11em] text-[#DC143C]">Operations · Control tower</p>
            <h1 className="mt-3 text-[clamp(36px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.04em]">Live Visibility</h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-[#5B5B57]">One operational movement timeline across carrier APIs, EDI, GPS, overseas counterparts and KCPL manual updates. Delay, stale-feed and exception signals stay visible instead of disappearing into inboxes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={refresh} className="inline-flex h-10 items-center gap-2 border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8] disabled:opacity-50"><RefreshCw size={13}/>Refresh</button>
            {canSweep ? <button type="button" disabled={busy} onClick={sweep} className="inline-flex h-10 items-center gap-2 border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white hover:border-[#B61032] hover:bg-[#B61032] disabled:opacity-50"><ShieldAlert size={13}/>Run health sweep</button> : null}
          </div>
        </header>

        <section className="grid border-b border-[#D6D6D0] sm:grid-cols-3 xl:grid-cols-6" aria-label="Visibility status summary">
          {metrics.map((item, index) => {
            const active = item.target ? focus === item.target : false;
            return <button key={item.label} type="button" disabled={!item.target} onClick={() => item.target && setFocus(item.target)} className={`min-h-[106px] border-b border-[#D6D6D0] px-4 py-5 text-left transition-colors sm:border-r sm:border-[#D6D6D0] xl:border-b-0 ${index === metrics.length - 1 ? "xl:border-r-0" : ""} ${active ? "bg-[#EEEEE8]" : item.target ? "hover:bg-[#EEEEE8]" : "cursor-default"}`}>
              <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.07em] text-[#5B5B57]"><span>{item.label}</span>{active ? <span className="h-2 w-2 bg-[#DC143C]"/> : null}</span>
              <strong className={`mt-4 block text-[31px] font-normal leading-none tracking-[-0.045em] ${item.alert ? "text-[#DC143C]" : "text-[#101010]"}`}>{item.value}</strong>
            </button>;
          })}
        </section>

        {notice ? <div className="mt-5"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

        <section className="mt-6 grid min-h-[720px] border-y border-[#D6D6D0] xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0 xl:border-r xl:border-[#D6D6D0]">
            <div className="flex flex-col gap-3 border-b border-[#D6D6D0] py-4 pr-0 xl:pr-5 sm:flex-row sm:items-center">
              <label className="flex h-10 min-w-0 flex-1 items-center border border-[#BDBDB6] bg-white px-3">
                <Search size={13} className="mr-2 text-[#777771]"/>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, route, carrier, location…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8A8A84]"/>
              </label>
              <button type="button" onClick={() => { setQuery(""); setFocus("all"); }} className="h-10 border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Reset</button>
              <span className="text-[11px] text-[#5B5B57]">{focusLabel(focus)} · {filtered.length} shown</span>
            </div>

            {!filtered.length ? <div className="grid min-h-[420px] place-items-center px-8 text-center"><div><RadioTower size={20} className="mx-auto text-[#777771]"/><p className="mt-4 text-[15px] font-medium">No shipment feeds match this view</p><p className="mt-2 text-[12px] leading-5 text-[#777771]">Change the filter or search. Active shipment feeds will appear here.</p></div></div> : <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                <thead><tr className="h-11 border-b border-[#101010] text-[10px] uppercase tracking-[0.06em] text-[#5B5B57]"><th className="w-[150px] px-3 font-normal">Shipment</th><th className="w-[185px] px-3 font-normal">Customer / route</th><th className="w-[130px] px-3 font-normal">State</th><th className="w-[145px] px-3 font-normal">Last milestone</th><th className="w-[120px] px-3 font-normal">ETA</th><th className="w-[95px] px-3 font-normal">Movement</th><th className="w-[125px] px-3 font-normal">Last event</th></tr></thead>
                <tbody>{filtered.map((row) => {
                  const chosen = selectedReference === row.reference;
                  const delayed = (row.eta_delta_hours ?? 0) >= 24;
                  return <tr key={row.reference} onClick={() => loadEvents(row.reference)} className={`h-[66px] cursor-pointer border-b border-[#D6D6D0] text-[12px] transition-colors hover:bg-[#EEEEE8] ${chosen ? "bg-[#EEEEE8]" : ""}`}>
                    <td className="relative px-3">{chosen ? <span className="absolute bottom-2 left-0 top-2 w-[2px] bg-[#DC143C]"/> : null}<OpsMono>{row.reference}</OpsMono><span className="mt-1 block truncate text-[10px] text-[#777771]">{row.carrier || "Carrier not set"}</span></td>
                    <td className="px-3"><span className="block truncate font-medium text-[#101010]">{row.customer_name}</span><span className="mt-1 block truncate text-[10px] text-[#777771]">{row.origin} → {row.destination} · {row.mode || "Mode not set"}</span></td>
                    <td className="px-3"><OpsBadge tone={statusTone(row)}>{shipmentStatusLabels[row.status]}</OpsBadge>{row.stale ? <span className="mt-1.5 block text-[9px] font-medium uppercase tracking-[0.05em] text-[#A80E2F]">Stale feed</span> : null}</td>
                    <td className="px-3"><span className="block truncate text-[11px] font-medium">{row.last_milestone ? trackingMilestoneLabels[row.last_milestone] : "No normalized feed"}</span><span className="mt-1 block truncate text-[10px] text-[#777771]">{row.current_location || "Location unknown"}</span></td>
                    <td className="px-3 text-[11px] text-[#5B5B57]">{shortDateTime(row.eta)}</td>
                    <td className={`px-3 text-[11px] font-medium ${delayed ? "text-[#A80E2F]" : "text-[#5B5B57]"}`}>{delayText(row.eta_delta_hours)}</td>
                    <td className="px-3 text-[11px] text-[#5B5B57]">{shortDateTime(row.last_event_at)}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>}
          </div>

          <aside className="bg-[#EEEEE8] px-5 py-6 sm:px-6">
            {!selected ? <div className="grid h-full min-h-[420px] place-items-center text-center"><div><RadioTower size={20} className="mx-auto text-[#777771]"/><p className="mt-4 text-[15px] font-medium">Choose a shipment</p><p className="mt-2 text-[12px] leading-5 text-[#777771]">Select a movement to inspect its normalized timeline or record a manual tracking update.</p></div></div> : <div className="flex h-full flex-col">
              <div className="border-b border-[#BEBEB7] pb-5">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.07em] text-[#777771]">Movement timeline</p><h2 className="mt-2 text-[26px] font-normal leading-[1.08] tracking-[-0.035em]">{selected.reference}</h2></div><OpsBadge tone={statusTone(selected)}>{shipmentStatusLabels[selected.status]}</OpsBadge></div>
                <p className="mt-3 text-[12px] leading-5 text-[#5B5B57]">{selected.customer_name}<br/>{selected.origin} → {selected.destination}</p>
                <div className="mt-4 flex flex-wrap gap-3"><Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}`} className="border-b border-[#101010] pb-0.5 text-[11px] hover:border-[#DC143C] hover:text-[#DC143C]">Open Job File</Link>{selected.carrier_reference ? <span className="text-[11px] text-[#777771]">Carrier ref · {selected.carrier_reference}</span> : null}</div>
              </div>

              <section className="border-b border-[#BEBEB7] py-5">
                <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-[10px] font-medium text-[#DC143C]">01</span><div><h3 className="text-[14px] font-medium">Latest position</h3><p className="mt-1 text-[11px] leading-5 text-[#777771]">{selected.current_location || "Location unknown"} · {selected.last_milestone ? trackingMilestoneLabels[selected.last_milestone] : "No normalized milestone"}</p></div></div>
                <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-[11px]"><div><dt className="text-[#777771]">Carrier</dt><dd className="mt-1 font-medium">{selected.carrier || "Not set"}</dd></div><div><dt className="text-[#777771]">Latest ETA</dt><dd className="mt-1 font-medium">{dateTime(selected.eta)}</dd></div><div><dt className="text-[#777771]">ETA movement</dt><dd className={`mt-1 font-medium ${(selected.eta_delta_hours ?? 0) >= 24 ? "text-[#A80E2F]" : ""}`}>{delayText(selected.eta_delta_hours)}</dd></div><div><dt className="text-[#777771]">Last provider</dt><dd className="mt-1 font-medium">{selected.last_provider || "Not recorded"}</dd></div></dl>
              </section>

              <section className="border-b border-[#BEBEB7] py-5">
                <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-[10px] font-medium text-[#DC143C]">02</span><div><h3 className="text-[14px] font-medium">Event timeline</h3><p className="mt-1 text-[11px] leading-5 text-[#777771]">Normalized carrier and counterpart updates.</p></div></div>
                <div className="mt-4 border-t border-[#BEBEB7]">
                  {events.length ? events.map((event) => <div key={event.id} className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 border-b border-[#CFCFC8] py-3"><span className="text-[9px] leading-4 text-[#777771]">{shortDateTime(event.event_time)}</span><div><div className="flex flex-wrap items-center gap-2"><OpsBadge tone={event.milestone === "delivery_refused" || event.milestone === "exception" ? "danger" : event.milestone === "delivered" ? "success" : "info"}>{trackingMilestoneLabels[event.milestone]}</OpsBadge><strong className="text-[11px] font-medium">{event.title}</strong></div><p className="mt-1 text-[10px] leading-4 text-[#777771]">{event.location || "Location not supplied"}{event.details ? ` · ${event.details}` : ""}</p>{event.eta ? <p className="mt-1 text-[10px] font-medium">ETA · {dateTime(event.eta)}</p> : null}</div></div>) : <div className="py-8 text-center text-[12px] leading-5 text-[#777771]">No normalized tracking events yet.</div>}
                </div>
              </section>

              <section className="py-5">
                <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-[10px] font-medium text-[#DC143C]">03</span><div><h3 className="text-[14px] font-medium">Manual fallback</h3><p className="mt-1 text-[11px] leading-5 text-[#777771]">Record an update when the provider has no live integration.</p></div></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><OpsField label="Raw carrier status"><input value={rawStatus} onChange={(event) => setRawStatus(event.target.value)} placeholder="e.g. Vessel departed Singapore"/></OpsField><OpsField label="Milestone override"><select value={milestone} onChange={(event) => setMilestone(event.target.value as TrackingMilestone | "")}><option value="">Auto-detect</option>{trackingMilestones.filter((value) => value !== "unknown").map((value) => <option key={value} value={value}>{trackingMilestoneLabels[value]}</option>)}</select></OpsField><OpsField label="Location"><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Port, airport, border, city…"/></OpsField><OpsField label="Provider / counterpart"><input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Carrier, airline, overseas agent…"/></OpsField><OpsField label="Event time"><input type="datetime-local" value={eventTime} onChange={(event) => setEventTime(event.target.value)}/></OpsField><OpsField label="New ETA"><input type="datetime-local" value={eta} onChange={(event) => setEta(event.target.value)}/></OpsField><OpsField label="Details" className="sm:col-span-2 xl:col-span-1"><textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Operational context, reason, vehicle/vessel/flight details…"/></OpsField></div>
                <div className="mt-4"><OpsButton variant="primary" onClick={recordEvent} disabled={busy || !rawStatus.trim()}><Activity size={12}/>Record tracking event</OpsButton></div>
              </section>
            </div>}
          </aside>
        </section>
      </div>
    </main>
  </OpsPage>;
}
