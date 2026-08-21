"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Clock3, MapPin, RefreshCw, RadioTower, ShieldAlert, Truck } from "lucide-react";
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

export function TrackingVisibilityWorkspace({ initialRows, initialSummary, canSweep }: { initialRows: VisibilityShipment[]; initialSummary: VisibilitySummary; canSweep: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<"all" | "delayed" | "stale" | "customs" | "delivery">("all");
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
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
      setNotice({ tone: "success", text: "Live visibility refreshed." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Visibility could not be refreshed." }); }
    finally { setBusy(false); }
  }

  async function loadEvents(reference: string, updateSelection = true) {
    if (updateSelection) setSelectedReference(reference);
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/visibility?reference=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.events) throw new Error(data.error || "Tracking history could not be loaded.");
      setEvents(data.events);
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking history could not be loaded." }); }
    finally { setBusy(false); }
  }

  async function recordEvent() {
    if (!selected || !rawStatus.trim()) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "record", reference: selected.reference, rawStatus, milestone: milestone || null, location, eta, eventTime, provider, details }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tracking event could not be recorded.");
      setRawStatus(""); setMilestone(""); setLocation(""); setEta(""); setEventTime(""); setProvider(""); setDetails("");
      await refresh();
      await loadEvents(selected.reference, false);
      const exceptions = data.opened_exceptions?.length ? ` Automatic exceptions opened: ${data.opened_exceptions.join(", ")}.` : "";
      setNotice({ tone: exceptions ? "warning" : "success", text: `Tracking event recorded.${exceptions}` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking event could not be recorded." }); }
    finally { setBusy(false); }
  }

  async function sweep() {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sweep" }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tracking health sweep failed.");
      await refresh();
      setNotice({ tone: (data.opened ?? 0) > 0 ? "warning" : "success", text: `Checked ${data.checked ?? 0} active shipments. Opened ${data.opened ?? 0} stale-feed exceptions.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking health sweep failed." }); }
    finally { setBusy(false); }
  }

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Transportation management"
      title="Live shipment visibility"
      description="One normalized movement timeline across carrier APIs, webhooks, EDI 214, GPS feeds, overseas counterparts and KCPL manual updates. ETA slips, refusals and stale feeds become operational exceptions instead of disappearing into inboxes."
      actions={<div className="flex flex-wrap gap-2"><OpsButton size="sm" onClick={refresh} disabled={busy}><RefreshCw size={12}/>Refresh</OpsButton>{canSweep ? <OpsButton size="sm" variant="primary" onClick={sweep} disabled={busy}><ShieldAlert size={12}/>Run health sweep</OpsButton> : null}<Link href="/admin/shipments" className="ops-button" data-size="sm" data-variant="secondary">Shipment register <ArrowRight size={11}/></Link></div>}
    />

    <OpsStatStrip>
      <OpsStat label="Active" value={summary.active} icon={<Truck size={13}/>} active={focus === "all"} onClick={() => setFocus("all")}/>
      <OpsStat label="ETA delayed" value={summary.delayed} tone={summary.delayed ? "warning" : "neutral"} icon={<Clock3 size={13}/>} active={focus === "delayed"} onClick={() => setFocus("delayed")}/>
      <OpsStat label="Stale feeds" value={summary.stale} tone={summary.stale ? "danger" : "neutral"} icon={<RadioTower size={13}/>} active={focus === "stale"} onClick={() => setFocus("stale")}/>
      <OpsStat label="Customs" value={summary.customs} tone={summary.customs ? "warning" : "neutral"} icon={<ShieldAlert size={13}/>} active={focus === "customs"} onClick={() => setFocus("customs")}/>
      <OpsStat label="Out for delivery" value={summary.out_for_delivery} icon={<MapPin size={13}/>} active={focus === "delivery"} onClick={() => setFocus("delivery")}/>
      <OpsStat label="Delivered today" value={summary.delivered_today} tone="success" icon={<Activity size={13}/>}/>
    </OpsStatStrip>

    {notice ? <div className="mt-4"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,.8fr)]">
      <OpsSurface eyebrow="Control tower" title="Shipment feeds" description={`${filtered.length} of ${rows.length} visible shipments.`}>
        <div className="mb-3"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, route, carrier, location…"/></div>
        <div className="grid gap-2">
          {filtered.length ? filtered.map((row) => <button key={row.reference} type="button" onClick={() => loadEvents(row.reference)} className={`rounded-[12px] border p-3 text-left transition ${selectedReference === row.reference ? "border-[#dca99d] bg-[#fff8f5]" : "border-[#e8e0d9] bg-white hover:border-[#d8cec7]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><OpsMono>{row.reference}</OpsMono><OpsBadge tone={statusTone(row)}>{shipmentStatusLabels[row.status]}</OpsBadge>{row.stale ? <OpsBadge tone="danger">Stale feed</OpsBadge> : null}{(row.eta_delta_hours ?? 0) >= 24 ? <OpsBadge tone="warning">ETA +{Math.round(row.eta_delta_hours ?? 0)}h</OpsBadge> : null}</div><strong className="mt-2 block text-[11px] text-[#4b423c]">{row.customer_name}</strong><p className="mt-1 text-[10px] text-[#7f756d]">{row.origin} → {row.destination} · {row.mode || "Mode not set"}</p></div><div className="text-right text-[9px] text-[#8e837b]"><strong className="block text-[10px] text-[#5b514a]">{row.last_milestone ? trackingMilestoneLabels[row.last_milestone] : "No normalized feed"}</strong><span>{row.current_location || "Location unknown"}</span></div></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4"><Mini label="Carrier" value={row.carrier || "Not set"}/><Mini label="Latest ETA" value={row.eta ? dateTime(row.eta) : "Not set"}/><Mini label="ETA movement" value={delayText(row.eta_delta_hours)}/><Mini label="Last event" value={dateTime(row.last_event_at)}/></div>
          </button>) : <OpsEmptyState title="No matching shipment feeds" description="Change the filters or create/activate shipment records in KCPL Operations."/>}
        </div>
      </OpsSurface>

      <div className="grid content-start gap-4">
        {selected ? <>
          <OpsSurface eyebrow={selected.reference} title="Movement timeline" description={`${selected.carrier || "Carrier not assigned"}${selected.carrier_reference ? ` · ${selected.carrier_reference}` : ""}`} action={<Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}`} className="ops-button" data-size="sm" data-variant="secondary">Job File <ArrowRight size={11}/></Link>}>
            <div className="grid gap-2">
              {events.length ? events.map((event) => <div key={event.id} className="rounded-[11px] border border-[#e8e0d9] bg-white p-3"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><OpsBadge tone={event.milestone === "delivery_refused" || event.milestone === "exception" ? "danger" : event.milestone === "delivered" ? "success" : "info"}>{trackingMilestoneLabels[event.milestone]}</OpsBadge><strong className="text-[10px] text-[#4b423c]">{event.title}</strong></div><p className="mt-1 text-[9px] text-[#81766e]">{event.location || "Location not supplied"}{event.details ? ` · ${event.details}` : ""}</p></div><span className="text-right text-[8px] text-[#9a9088]">{dateTime(event.event_time)}<br/>{event.provider || event.source}</span></div>{event.eta ? <p className="mt-2 text-[9px] font-semibold text-[#6e625a]">ETA update: {dateTime(event.eta)}</p> : null}</div>) : <OpsEmptyState title="No normalized tracking events" description="Record the first event below, or connect a carrier/counterpart feed to the tracking ingestion endpoint."/>}
            </div>
          </OpsSurface>

          <OpsSurface eyebrow="Manual fallback" title="Record carrier/counterpart update" description="Use this when the transport provider has no API. Raw status is still normalized into the same KCPL milestone model.">
            <div className="grid gap-3 md:grid-cols-2">
              <OpsField label="Raw carrier status"><input value={rawStatus} onChange={(event) => setRawStatus(event.target.value)} placeholder="e.g. Vessel departed Singapore"/></OpsField>
              <OpsField label="Milestone override"><select value={milestone} onChange={(event) => setMilestone(event.target.value as TrackingMilestone | "")}><option value="">Auto-detect</option>{trackingMilestones.filter((value) => value !== "unknown").map((value) => <option key={value} value={value}>{trackingMilestoneLabels[value]}</option>)}</select></OpsField>
              <OpsField label="Location"><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Port, airport, border, city…"/></OpsField>
              <OpsField label="Provider / counterpart"><input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Maersk, airline, Kolkata agent…"/></OpsField>
              <OpsField label="Event time"><input type="datetime-local" value={eventTime} onChange={(event) => setEventTime(event.target.value)}/></OpsField>
              <OpsField label="New ETA"><input type="datetime-local" value={eta} onChange={(event) => setEta(event.target.value)}/></OpsField>
              <OpsField label="Details" className="md:col-span-2"><textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Operational context, reason, vehicle/vessel/flight details…"/></OpsField>
            </div>
            <div className="mt-3 flex justify-end"><OpsButton variant="primary" onClick={recordEvent} disabled={busy || !rawStatus.trim()}>Record tracking event</OpsButton></div>
          </OpsSurface>
        </> : <OpsSurface><OpsEmptyState icon={<RadioTower size={18}/>} title="Choose a shipment" description="Select a shipment to inspect its normalized movement timeline or record a manual tracking update."/></OpsSurface>}
      </div>
    </div>
  </OpsPage>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[9px] border border-[#eee7e1] bg-[#fcfbf9] p-2.5"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#998e85]">{label}</p><strong className="mt-1 block truncate text-[9px] text-[#5c534c]">{value}</strong></div>;
}
