"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowRight, Clock3, MapPin, RefreshCw, RadioTower, ShieldAlert, Truck } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
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

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: NEPAL_TIME_ZONE }).format(date)} NPT`;
}

function delayText(hours: number | null) {
  if (hours === null) return "No baseline";
  if (Math.abs(hours) < 1) return "On baseline";
  return hours > 0 ? `${Math.round(hours)}h later` : `${Math.abs(Math.round(hours))}h earlier`;
}

function statusTone(row: VisibilityShipment): "neutral" | "info" | "warning" | "success" | "danger" {
  if (row.status === "delivered") return "success";
  if (row.stale || row.status === "exception") return "danger";
  if ((row.eta_delta_hours ?? 0) >= 24 || row.status === "customs_clearance") return "warning";
  return "info";
}

export function TrackingVisibilityWorkspace({ initialRows, initialSummary, canSweep, initialQuery = "" }: { initialRows: VisibilityShipment[]; initialSummary: VisibilitySummary; canSweep: boolean; initialQuery?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [query, setQuery] = useState(initialQuery);
  const [focus, setFocus] = useState<"all" | "delayed" | "stale" | "customs" | "delivery">("all");
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
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Visibility could not be refreshed.");
      setRows(data.rows); setSummary(data.summary);
      if (selectedReference && data.rows.some((row) => row.reference === selectedReference)) await loadEvents(selectedReference, false);
      setNotice({ tone: "success", text: "Live Visibility refreshed." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Visibility could not be refreshed." }); }
    finally { setBusy(false); }
  }

  async function loadEvents(reference: string, showNotice = true) {
    setSelectedReference(reference); setBusy(true); if (showNotice) setNotice(null);
    try {
      const response = await fetch(`/api/admin/visibility?shipment=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.events) throw new Error(data.error || "Tracking history could not be loaded.");
      setEvents(data.events);
    } catch (error) { if (showNotice) setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking history could not be loaded." }); }
    finally { setBusy(false); }
  }

  async function recordEvent() {
    if (!selectedReference || !rawStatus.trim()) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "record_event", shipmentReference: selectedReference, rawStatus, milestone: milestone || null, location, eta: eta || null, eventTime: eventTime || null, provider, details }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tracking event could not be recorded.");
      setRawStatus(""); setMilestone(""); setLocation(""); setEta(""); setEventTime(""); setProvider(""); setDetails("");
      await refresh(); await loadEvents(selectedReference, false);
      setNotice({ tone: data.opened_exceptions?.length ? "warning" : "success", text: data.opened_exceptions?.length ? `Tracking saved. Exceptions opened: ${data.opened_exceptions.join(", ")}.` : "Tracking event saved to the shipment timeline." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking event could not be recorded." }); }
    finally { setBusy(false); }
  }

  async function sweep() {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "health_sweep" }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tracking health sweep failed.");
      await refresh();
      setNotice({ tone: data.opened ? "warning" : "success", text: `Tracking health checked ${data.checked ?? 0} active shipments. ${data.opened ?? 0} stale-feed exception${data.opened === 1 ? "" : "s"} opened.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking health sweep failed." }); }
    finally { setBusy(false); }
  }

  return <OpsPage>
    <OpsPageHeader eyebrow="Execution control" title="Live Shipment Visibility" description="One normalized movement timeline across carrier APIs, webhooks, EDI-ready feeds, GPS, counterparts and manual operations." actions={<><Link href="/admin/delivery" className="ops-button" data-variant="secondary" data-size="md">Delivery & POD</Link><Link href="/admin/shipments" className="ops-button" data-variant="primary" data-size="md">Shipments</Link></>}/>
    <OpsStatStrip>
      <OpsStat label="Active" value={summary.active} icon={<RadioTower size={13}/>} active={focus === "all"} onClick={() => setFocus("all")}/>
      <OpsStat label="Delayed" value={summary.delayed} icon={<Clock3 size={13}/>} tone={summary.delayed ? "warning" : "neutral"} active={focus === "delayed"} onClick={() => setFocus("delayed")}/>
      <OpsStat label="Stale feeds" value={summary.stale} icon={<ShieldAlert size={13}/>} tone={summary.stale ? "danger" : "neutral"} active={focus === "stale"} onClick={() => setFocus("stale")}/>
      <OpsStat label="Customs" value={summary.customs} active={focus === "customs"} onClick={() => setFocus("customs")}/>
      <OpsStat label="Out for delivery" value={summary.out_for_delivery} icon={<Truck size={13}/>} active={focus === "delivery"} onClick={() => setFocus("delivery")}/>
      <OpsStat label="Delivered today" value={summary.delivered_today}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={notice.tone}>{notice.text}</OpsNotice> : null}
      <OpsSurface eyebrow="Control tower" title="Shipment feed" description={`${filtered.length} shipment${filtered.length === 1 ? "" : "s"} shown.`} action={<div className="flex gap-2">{canSweep ? <OpsButton variant="secondary" size="sm" onClick={sweep} disabled={busy}><ShieldAlert size={11}/>Health sweep</OpsButton> : null}<OpsButton variant="secondary" size="sm" onClick={refresh} disabled={busy}><RefreshCw size={11}/>Refresh</OpsButton></div>}>
        <div className="mb-4 max-w-xl"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, lane, carrier, location…"/></div>
        {!filtered.length ? <OpsEmptyState icon={<Activity size={18}/>} title="No shipments match this view" description="Change the visibility filter or search terms."/> : <div className="grid gap-2">{filtered.map((row) => <button key={row.reference} type="button" onClick={() => loadEvents(row.reference)} className={`w-full rounded-[11px] border p-3 text-left transition ${selectedReference === row.reference ? "border-[#d7af96] bg-[#fff9f5]" : "border-[#e8e1db] bg-white hover:bg-[#fcfaf8]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><OpsMono>{row.reference}</OpsMono><OpsBadge tone={statusTone(row)}>{shipmentStatusLabels[row.status]}</OpsBadge>{row.stale && row.status !== "delivered" ? <OpsBadge tone="danger">Stale</OpsBadge> : null}</div><div className="mt-1.5 text-[10px] font-semibold text-[#59514a]">{row.customer_name}</div><div className="mt-1 text-[9px] text-[#8d837b]">{row.origin} → {row.destination} · {row.mode} · {row.primary_branch}</div></div><div className="text-right text-[9px] text-[#81776f]"><div>{row.current_location || "Location not recorded"}</div><div className="mt-1">ETA {dateTime(row.eta)}</div><div className={`mt-1 font-bold ${(row.eta_delta_hours ?? 0) >= 24 ? "text-[#aa614f]" : "text-[#718071]"}`}>{delayText(row.eta_delta_hours)}</div></div></div><div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#eee8e2] pt-2 text-[9px] text-[#8a8078]"><span>{row.last_milestone ? trackingMilestoneLabels[row.last_milestone] : "No tracking milestone"}</span><span>·</span><span>{dateTime(row.last_event_at)}</span>{row.last_provider ? <><span>·</span><span>{row.last_provider}</span></> : null}{row.carrier ? <><span>·</span><span>{row.carrier}{row.carrier_reference ? ` (${row.carrier_reference})` : ""}</span></> : null}</div></button>)}</div>}
      </OpsSurface>

      {selected ? <OpsSurface eyebrow="Movement history" title={selected.reference} description={`${selected.customer_name} · ${selected.origin} → ${selected.destination}`} action={<div className="flex gap-2"><Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Job File</Link><OpsBadge tone={statusTone(selected)}>{shipmentStatusLabels[selected.status]}</OpsBadge></div>}>
        <div className="grid gap-5 xl:grid-cols-[1fr_.85fr]">
          <div><div className="space-y-2">{events.length ? events.map((event) => <div key={event.id} className="rounded-[10px] border border-[#e9e3dd] bg-white p-3"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><strong className="text-[10px] text-[#504842]">{event.title}</strong><OpsBadge tone="neutral">{trackingMilestoneLabels[event.milestone]}</OpsBadge></div><div className="mt-1 text-[9px] text-[#8c827a]">{event.location || "Location not supplied"} · {event.source.replaceAll("_", " ")}{event.provider ? ` · ${event.provider}` : ""}</div>{event.details ? <p className="mt-2 text-[9px] leading-5 text-[#766d66]">{event.details}</p> : null}</div><div className="text-right text-[8px] text-[#958b83]">{dateTime(event.event_time)}{event.eta ? <div className="mt-1">ETA {dateTime(event.eta)}</div> : null}</div></div></div>) : <OpsEmptyState title="No normalized tracking events" description="Record a manual event or connect a carrier adapter to begin the movement timeline."/>}</div></div>
          <div className="rounded-[12px] border border-[#e8e1db] bg-[#faf8f5] p-4"><p className="ops-eyebrow">Manual fallback</p><h3 className="mt-1 text-[12px] font-bold text-[#514943]">Record tracking event</h3><p className="mt-1 text-[9px] leading-4 text-[#8b8179]">Use this when a carrier, counterpart, driver or customs desk has no live integration.</p><div className="mt-4 grid gap-3"><OpsField label="Carrier / raw status"><input value={rawStatus} onChange={(event) => setRawStatus(event.target.value)} placeholder="e.g. Vessel departed"/></OpsField><OpsField label="Normalized milestone"><select value={milestone} onChange={(event) => setMilestone(event.target.value as TrackingMilestone | "")}><option value="">Auto-detect</option>{trackingMilestones.map((item) => <option key={item} value={item}>{trackingMilestoneLabels[item]}</option>)}</select></OpsField><OpsField label="Location"><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Kolkata Port"/></OpsField><div className="grid gap-3 sm:grid-cols-2"><OpsField label="Event time"><input type="datetime-local" value={eventTime} onChange={(event) => setEventTime(event.target.value)}/></OpsField><OpsField label="New ETA"><input type="datetime-local" value={eta} onChange={(event) => setEta(event.target.value)}/></OpsField></div><OpsField label="Provider / source"><input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Carrier, agent or counterpart"/></OpsField><OpsField label="Details"><textarea className="ops-textarea min-h-20" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Operational detail or exception context…"/></OpsField><OpsButton variant="primary" onClick={recordEvent} disabled={busy || !rawStatus.trim()}><ArrowRight size={11}/>Record event</OpsButton></div></div>
        </div>
      </OpsSurface> : null}
    </div>
  </OpsPage>;
}
