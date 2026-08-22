"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, RefreshCw, Search, Truck } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
import { pickupAppointmentStatusLabels, pickupChannels, pickupNeedsAttention, type PickupChannel, type PickupQueueRow, type PickupSummary } from "./pickup-appointments";

type ApiResponse = { ok?: boolean; error?: string; rows?: PickupQueueRow[]; summary?: PickupSummary };
type Focus = "all" | "unscheduled" | "requested" | "confirmed" | "missed" | "picked_up";

function dateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function statusTone(row: PickupQueueRow): "neutral" | "info" | "warning" | "success" | "danger" {
  if (row.status === "picked_up") return "success";
  if (row.status === "missed" || pickupNeedsAttention(row, new Date().toISOString())) return "danger";
  if (row.status === "confirmed" || row.status === "driver_assigned") return "success";
  if (row.status === "requested") return "warning";
  return "neutral";
}

export function PickupAppointmentsWorkspace({ initialRows, initialSummary, initialReference = "" }: { initialRows: PickupQueueRow[]; initialSummary: PickupSummary; initialReference?: string }) {
  const initialSelected = initialRows.find((row) => row.shipment_reference === initialReference) ?? initialRows.find((row) => row.status === "missed" || row.status === "unscheduled") ?? initialRows[0] ?? null;
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedReference, setSelectedReference] = useState(initialSelected?.shipment_reference ?? "");
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<Focus>("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const [windowStart, setWindowStart] = useState(toLocalInput(initialSelected?.confirmed_window_start ?? initialSelected?.requested_window_start ?? null));
  const [windowEnd, setWindowEnd] = useState(toLocalInput(initialSelected?.confirmed_window_end ?? initialSelected?.requested_window_end ?? null));
  const [pickupLocation, setPickupLocation] = useState(initialSelected?.pickup_location ?? "");
  const [contactName, setContactName] = useState(initialSelected?.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(initialSelected?.contact_phone ?? "");
  const [channel, setChannel] = useState<PickupChannel>(initialSelected?.channel ?? "manual");
  const [providerReference, setProviderReference] = useState(initialSelected?.provider_reference ?? "");
  const [driverName, setDriverName] = useState(initialSelected?.driver_name ?? "");
  const [driverPhone, setDriverPhone] = useState(initialSelected?.driver_phone ?? "");
  const [vehicleReference, setVehicleReference] = useState(initialSelected?.vehicle_reference ?? "");
  const [notes, setNotes] = useState(initialSelected?.notes ?? "");
  const [missedReason, setMissedReason] = useState("");

  const selected = rows.find((row) => row.shipment_reference === selectedReference) ?? null;
  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (focus !== "all" && focus !== "picked_up" && row.status !== focus) return false;
      if (focus === "picked_up" && row.status !== "picked_up") return false;
      if (!terms.length) return true;
      const haystack = [row.shipment_reference, row.booking_reference ?? "", row.customer_name, row.partner_name ?? "", row.origin, row.destination, row.branch, row.pickup_location ?? "", row.driver_name ?? "", row.vehicle_reference ?? "", row.status].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [focus, query, rows]);

  function choose(row: PickupQueueRow) {
    setSelectedReference(row.shipment_reference);
    setWindowStart(toLocalInput(row.confirmed_window_start ?? row.requested_window_start));
    setWindowEnd(toLocalInput(row.confirmed_window_end ?? row.requested_window_end));
    setPickupLocation(row.pickup_location ?? row.origin);
    setContactName(row.contact_name ?? "");
    setContactPhone(row.contact_phone ?? "");
    setChannel(row.channel);
    setProviderReference(row.provider_reference ?? "");
    setDriverName(row.driver_name ?? "");
    setDriverPhone(row.driver_phone ?? "");
    setVehicleReference(row.vehicle_reference ?? "");
    setNotes(row.notes ?? "");
    setMissedReason("");
    setNotice(null);
  }

  async function refresh(keepNotice = false) {
    const response = await fetch("/api/admin/pickups", { cache: "no-store" });
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Pickup Scheduling could not be refreshed.");
    setRows(data.rows); setSummary(data.summary);
    if (!data.rows.some((row) => row.shipment_reference === selectedReference)) setSelectedReference(data.rows[0]?.shipment_reference ?? "");
    if (!keepNotice) setNotice({ tone: "success", text: "Pickup Scheduling refreshed." });
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    setBusy(true); setNotice(null);
    try {
      const body: Record<string, unknown> = { action, reference: selected.shipment_reference, ...extra };
      const response = await fetch("/api/admin/pickups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Pickup action failed.");
      await refresh(true);
      const label = action === "schedule" ? "Pickup request saved." : action === "confirm" ? "Pickup appointment confirmed." : action === "assign_driver" ? "Driver assignment saved." : action === "picked_up" ? "Pickup completed and Live Visibility updated." : action === "missed" ? "Missed pickup recorded and an operational exception was raised." : "Pickup appointment cancelled.";
      setNotice({ tone: action === "missed" ? "warning" : "success", text: label });
      if (action === "missed") setMissedReason("");
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Pickup action failed." }); }
    finally { setBusy(false); }
  }

  return <OpsPage>
    <OpsPageHeader eyebrow="Execution planning" title="Pickup & Appointment Scheduling" description="Bridge confirmed bookings into physical cargo execution. Request and confirm pickup windows, assign vehicles and drivers, record missed pickups and push completed pickups into the same Live Visibility timeline." actions={<><OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => { setBusy(true); refresh().catch((error) => setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Refresh failed." })).finally(() => setBusy(false)); }}><RefreshCw size={12}/>Refresh</OpsButton><Link href="/admin/tenders" className="ops-button" data-variant="secondary" data-size="sm">Tender & Booking</Link><Link href="/admin/visibility" className="ops-button" data-variant="primary" data-size="sm">Live Visibility <ArrowRight size={11}/></Link></>}/>
    <OpsStatStrip>
      <OpsStat label="Unscheduled" value={summary.unscheduled} tone={summary.unscheduled ? "warning" : "neutral"} active={focus === "unscheduled"} onClick={() => setFocus("unscheduled")}/>
      <OpsStat label="Requested" value={summary.requested} active={focus === "requested"} onClick={() => setFocus("requested")}/>
      <OpsStat label="Confirmed" value={summary.confirmed + summary.driver_assigned} tone="success" active={focus === "confirmed"} onClick={() => setFocus("confirmed")}/>
      <OpsStat label="Missed / overdue" value={summary.missed} tone={summary.missed ? "danger" : "neutral"} active={focus === "missed"} onClick={() => setFocus("missed")}/>
      <OpsStat label="Picked up today" value={summary.picked_up_today} tone="success" active={focus === "picked_up"} onClick={() => setFocus("picked_up")}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={notice.tone}>{notice.text}</OpsNotice> : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.05fr]">
        <OpsSurface eyebrow="Booking handoff" title="Pickup queue" description={`${filtered.length} booked shipment${filtered.length === 1 ? "" : "s"} shown. A booked shipment appears here even before an appointment exists.`}>
          <div className="mb-4"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, booking, customer, carrier, route, driver…"/></div>
          {!filtered.length ? <OpsEmptyState icon={<Search size={18}/>} title="No pickup movements match this view" description="Change the filter or search. New booked shipments appear here automatically."/> : <div className="space-y-2">{filtered.map((row) => <button type="button" key={row.shipment_reference} onClick={() => choose(row)} className={`w-full rounded-[11px] border p-3 text-left ${selectedReference === row.shipment_reference ? "border-[#d8ad91] bg-[#fff9f4]" : "border-[#e8e1db] bg-white hover:bg-[#fcfaf8]"}`}>
            <div className="flex items-start justify-between gap-3"><div><OpsMono>{row.shipment_reference}</OpsMono><div className="mt-1.5 text-[11px] font-bold text-[#4f4741]">{row.customer_name}</div><div className="mt-1 text-[9px] text-[#8b8179]">{row.origin} → {row.destination} · {row.branch}</div></div><div className="text-right"><OpsBadge tone={statusTone(row)}>{pickupAppointmentStatusLabels[row.status]}</OpsBadge>{pickupNeedsAttention(row, new Date().toISOString()) && row.status !== "picked_up" ? <div className="mt-2 text-[8px] font-bold text-[#a95b4d]">NEEDS ATTENTION</div> : null}</div></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3"><Mini label="Carrier / partner" value={row.partner_name || "Not recorded"}/><Mini label="Window" value={dateTime(row.confirmed_window_start ?? row.requested_window_start)}/><Mini label="Driver / vehicle" value={[row.driver_name, row.vehicle_reference].filter(Boolean).join(" · ") || "Not assigned"}/></div>
          </button>)}</div>}
        </OpsSurface>

        <OpsSurface eyebrow={selected?.booking_reference ? `Booking ${selected.booking_reference}` : "Pickup control"} title={selected?.shipment_reference ?? "Choose a booked shipment"} description={selected ? `${selected.customer_name} · ${selected.origin} → ${selected.destination}` : "Select a shipment from the pickup queue."}>
          {!selected ? <OpsEmptyState icon={<CalendarClock size={18}/>} title="No shipment selected" description="Choose a booking to schedule its cargo collection."/> : <div className="space-y-5">
            <div className="flex flex-wrap gap-2"><OpsBadge tone={statusTone(selected)}>{pickupAppointmentStatusLabels[selected.status]}</OpsBadge>{selected.partner_name ? <OpsBadge tone="neutral">{selected.partner_name}</OpsBadge> : null}<Link href={`/admin/jobs/${encodeURIComponent(selected.shipment_reference)}`} className="ops-button" data-variant="ghost" data-size="sm">Job File</Link></div>

            {selected.status !== "picked_up" && selected.status !== "cancelled" ? <>
              <div><p className="ops-eyebrow">1. Request / reschedule</p><div className="mt-3 grid gap-3 md:grid-cols-2"><OpsField label="Pickup window start"><input type="datetime-local" value={windowStart} onChange={(event) => setWindowStart(event.target.value)}/></OpsField><OpsField label="Pickup window end"><input type="datetime-local" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)}/></OpsField><OpsField label="Pickup location"><input value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} placeholder="Warehouse, factory, terminal…"/></OpsField><OpsField label="Request channel"><select value={channel} onChange={(event) => setChannel(event.target.value as PickupChannel)}>{pickupChannels.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></OpsField><OpsField label="Contact name"><input value={contactName} onChange={(event) => setContactName(event.target.value)}/></OpsField><OpsField label="Contact phone"><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)}/></OpsField><OpsField label="Carrier/vendor reference"><input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Appointment / pickup reference"/></OpsField><OpsField label="Operational note"><input value={notes} onChange={(event) => setNotes(event.target.value)}/></OpsField></div><div className="mt-3 flex flex-wrap gap-2"><OpsButton variant="secondary" disabled={busy || !windowStart || !windowEnd} onClick={() => act("schedule", { windowStart, windowEnd, pickupLocation, contactName, contactPhone, channel, providerReference, notes, confirmed: false })}><CalendarClock size={12}/>Request pickup</OpsButton><OpsButton variant="primary" disabled={busy || !windowStart || !windowEnd} onClick={() => act(selected.status === "unscheduled" || selected.status === "missed" ? "schedule" : "confirm", selected.status === "unscheduled" || selected.status === "missed" ? { windowStart, windowEnd, pickupLocation, contactName, contactPhone, channel, providerReference, notes, confirmed: true } : { windowStart, windowEnd, providerReference, notes })}><CheckCircle2 size={12}/>Confirm appointment</OpsButton></div></div>

              <div className="border-t border-[#eee7e1] pt-5"><p className="ops-eyebrow">2. Vehicle / driver</p><div className="mt-3 grid gap-3 md:grid-cols-3"><OpsField label="Driver name"><input value={driverName} onChange={(event) => setDriverName(event.target.value)}/></OpsField><OpsField label="Driver phone"><input value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)}/></OpsField><OpsField label="Vehicle reference"><input value={vehicleReference} onChange={(event) => setVehicleReference(event.target.value)} placeholder="Truck / plate / vehicle"/></OpsField></div><div className="mt-3"><OpsButton variant="secondary" disabled={busy || driverName.trim().length < 2 || selected.status === "unscheduled"} onClick={() => act("assign_driver", { driverName, driverPhone, vehicleReference, notes })}><Truck size={12}/>Assign driver</OpsButton></div></div>

              <div className="border-t border-[#eee7e1] pt-5"><p className="ops-eyebrow">3. Pickup outcome</p><div className="mt-3 flex flex-wrap gap-2"><OpsButton variant="primary" disabled={busy || selected.status === "unscheduled"} onClick={() => act("picked_up", { eventTime: new Date().toISOString(), location: pickupLocation })}><CheckCircle2 size={12}/>Cargo picked up</OpsButton><OpsButton variant="danger" disabled={busy || selected.status === "unscheduled" || missedReason.trim().length < 6} onClick={() => act("missed", { reason: missedReason })}><AlertTriangle size={12}/>Mark missed</OpsButton><OpsButton variant="ghost" disabled={busy || selected.status === "unscheduled"} onClick={() => act("cancel", { note: notes })}>Cancel pickup</OpsButton></div><div className="mt-3"><OpsField label="Missed-pickup reason"><textarea className="ops-textarea min-h-20" value={missedReason} onChange={(event) => setMissedReason(event.target.value)} placeholder="Carrier no-show, cargo not ready, warehouse closed, documents incomplete…"/></OpsField></div></div>
            </> : <OpsNotice tone={selected.status === "picked_up" ? "success" : "warning"}>{selected.status === "picked_up" ? `Pickup completed ${dateTime(selected.picked_up_at)}. Live Visibility now owns the movement timeline.` : "This pickup appointment is cancelled."}</OpsNotice>}
          </div>}
        </OpsSurface>
      </div>
    </div>
  </OpsPage>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[9px] border border-[#eee7e1] bg-[#fcfbf9] p-2.5"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#998e85]">{label}</p><strong className="mt-1 block truncate text-[9px] text-[#5c534c]">{value}</strong></div>;
}
