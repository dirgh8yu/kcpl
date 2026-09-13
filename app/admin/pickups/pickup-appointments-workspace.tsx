"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, RefreshCw, Search, Truck } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsMono, OpsNotice, OpsPage } from "../operations-ui";
import { pickupAppointmentStatusLabels, pickupChannels, pickupNeedsAttention, type PickupChannel, type PickupQueueRow, type PickupSummary } from "./pickup-appointments";

type ApiResponse = { ok?: boolean; error?: string; rows?: PickupQueueRow[]; summary?: PickupSummary };
type Focus = "all" | "unscheduled" | "requested" | "confirmed" | "missed" | "picked_up";

function dateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function shortDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kathmandu" }).format(date);
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

function focusLabel(focus: Focus) {
  if (focus === "all") return "All booked shipments";
  if (focus === "picked_up") return "Picked up";
  return pickupAppointmentStatusLabels[focus];
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
    setRows(data.rows);
    setSummary(data.summary);
    if (!data.rows.some((row) => row.shipment_reference === selectedReference)) setSelectedReference(data.rows[0]?.shipment_reference ?? "");
    if (!keepNotice) setNotice({ tone: "success", text: "Pickup Scheduling refreshed." });
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    try {
      const body: Record<string, unknown> = { action, reference: selected.shipment_reference, ...extra };
      const response = await fetch("/api/admin/pickups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Pickup action failed.");
      await refresh(true);
      const label = action === "schedule" ? "Pickup request saved." : action === "confirm" ? "Pickup appointment confirmed." : action === "assign_driver" ? "Driver assignment saved." : action === "picked_up" ? "Pickup completed and Live Visibility updated." : action === "missed" ? "Missed pickup recorded and an operational exception was raised." : "Pickup appointment cancelled.";
      setNotice({ tone: action === "missed" ? "warning" : "success", text: label });
      if (action === "missed") setMissedReason("");
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Pickup action failed." });
    } finally {
      setBusy(false);
    }
  }

  const metrics: Array<{ label: string; value: number; target: Focus; alert?: boolean }> = [
    { label: "Unscheduled", value: summary.unscheduled, target: "unscheduled", alert: summary.unscheduled > 0 },
    { label: "Requested", value: summary.requested, target: "requested" },
    { label: "Confirmed", value: summary.confirmed + summary.driver_assigned, target: "confirmed" },
    { label: "Missed / overdue", value: summary.missed, target: "missed", alert: summary.missed > 0 },
    { label: "Picked up today", value: summary.picked_up_today, target: "picked_up" },
  ];

  return <OpsPage>
    <main className="min-h-[calc(100vh-64px)] bg-[#F6F6F3] text-[#101010]">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        <header className="grid gap-6 border-b border-[#101010] pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[10px] font-normal uppercase tracking-[0.11em] text-[#DC143C]">Operations · Pickup control</p>
            <h1 className="mt-3 text-[clamp(36px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.04em]">Pickup Scheduling</h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#5B5B57]">Move booked cargo into physical execution: secure the collection window, assign the vehicle and driver, then hand the movement into Live Visibility.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy} onClick={() => { setBusy(true); refresh().catch((error) => setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Refresh failed." })).finally(() => setBusy(false)); }} className="inline-flex h-10 items-center gap-2 border border-[#A5A5A0] bg-transparent px-3 text-[12px] transition-colors hover:border-[#101010] hover:bg-[#EEEEE8] disabled:opacity-50"><RefreshCw size={13}/>Refresh</button>
            <Link href="/admin/visibility" className="inline-flex h-10 items-center gap-2 border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white transition-colors hover:border-[#B61032] hover:bg-[#B61032]">Live Visibility <ChevronRight size={13}/></Link>
          </div>
        </header>

        <section className="grid border-b border-[#D6D6D0] sm:grid-cols-5" aria-label="Pickup status summary">
          {metrics.map((item, index) => <button key={item.label} type="button" onClick={() => setFocus(focus === item.target ? "all" : item.target)} className={`min-h-[108px] border-b border-[#D6D6D0] px-4 py-5 text-left transition-colors hover:bg-[#EEEEE8] sm:border-b-0 ${index < metrics.length - 1 ? "sm:border-r sm:border-[#D6D6D0]" : ""} ${focus === item.target ? "bg-[#EEEEE8]" : ""}`}>
            <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.07em] text-[#5B5B57]"><span>{item.label}</span>{focus === item.target ? <span className="h-2 w-2 bg-[#DC143C]"/> : null}</span>
            <strong className={`mt-4 block text-[32px] font-normal leading-none tracking-[-0.045em] ${item.alert ? "text-[#DC143C]" : "text-[#101010]"}`}>{item.value}</strong>
          </button>)}
        </section>

        {notice ? <div className="mt-5"><OpsNotice tone={notice.tone}>{notice.text}</OpsNotice></div> : null}

        <section className="mt-6 grid min-h-[720px] border-y border-[#D6D6D0] lg:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0 lg:border-r lg:border-[#D6D6D0]">
            <div className="flex flex-col gap-3 border-b border-[#D6D6D0] py-4 pr-0 lg:pr-5 sm:flex-row sm:items-center">
              <label className="flex h-10 min-w-0 flex-1 items-center border border-[#BDBDB6] bg-white px-3">
                <Search size={13} className="mr-2 text-[#777771]"/>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, carrier, route, driver…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8A8A84]"/>
              </label>
              <button type="button" onClick={() => { setQuery(""); setFocus("all"); }} className="h-10 border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Reset</button>
              <span className="text-[11px] text-[#5B5B57]">{focusLabel(focus)} · {filtered.length} shown</span>
            </div>

            {!filtered.length ? <div className="grid min-h-[420px] place-items-center px-8 text-center"><div><Search size={20} className="mx-auto text-[#777771]"/><p className="mt-4 text-[15px] font-medium">No pickup movements match this view</p><p className="mt-2 text-[12px] leading-5 text-[#777771]">Change the status filter or search terms. Booked shipments will appear here automatically.</p></div></div> : <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
                <thead><tr className="h-11 border-b border-[#101010] text-[10px] uppercase tracking-[0.06em] text-[#5B5B57]"><th className="w-[150px] px-3 font-normal">Shipment</th><th className="w-[150px] px-3 font-normal">Customer / route</th><th className="w-[125px] px-3 font-normal">Status</th><th className="w-[150px] px-3 font-normal">Pickup window</th><th className="w-[140px] px-3 font-normal">Driver / vehicle</th></tr></thead>
                <tbody>{filtered.map((row) => {
                  const chosen = selectedReference === row.shipment_reference;
                  const attention = pickupNeedsAttention(row, new Date().toISOString()) && row.status !== "picked_up";
                  return <tr key={row.shipment_reference} onClick={() => choose(row)} className={`h-[64px] cursor-pointer border-b border-[#D6D6D0] text-[12px] transition-colors hover:bg-[#EEEEE8] ${chosen ? "bg-[#EEEEE8]" : ""}`}>
                    <td className="relative px-3">{chosen ? <span className="absolute bottom-2 left-0 top-2 w-[2px] bg-[#DC143C]"/> : null}<OpsMono>{row.shipment_reference}</OpsMono>{row.booking_reference ? <span className="mt-1 block truncate text-[10px] text-[#777771]">Booking {row.booking_reference}</span> : null}</td>
                    <td className="px-3"><span className="block truncate font-medium text-[#101010]">{row.customer_name}</span><span className="mt-1 block truncate text-[10px] text-[#777771]">{row.origin} → {row.destination} · {row.branch}</span></td>
                    <td className="px-3"><OpsBadge tone={statusTone(row)}>{pickupAppointmentStatusLabels[row.status]}</OpsBadge>{attention ? <span className="mt-1.5 block text-[9px] font-medium uppercase tracking-[0.05em] text-[#A80E2F]">Needs attention</span> : null}</td>
                    <td className="px-3 text-[11px] text-[#5B5B57]">{shortDateTime(row.confirmed_window_start ?? row.requested_window_start)}</td>
                    <td className="px-3 text-[11px] text-[#5B5B57]"><span className="block truncate">{row.driver_name || "Unassigned"}</span><span className="mt-1 block truncate text-[10px] text-[#8A8A84]">{row.vehicle_reference || row.partner_name || "No vehicle / partner"}</span></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>}
          </div>

          <aside className="bg-[#EEEEE8] px-5 py-6 sm:px-6">
            {!selected ? <div className="grid h-full min-h-[420px] place-items-center text-center"><div><CalendarClock size={20} className="mx-auto text-[#777771]"/><p className="mt-4 text-[15px] font-medium">No shipment selected</p><p className="mt-2 text-[12px] leading-5 text-[#777771]">Choose a booked shipment to control its pickup.</p></div></div> : <div className="flex h-full flex-col">
              <div className="border-b border-[#BEBEB7] pb-5">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.07em] text-[#777771]">{selected.booking_reference ? `Booking ${selected.booking_reference}` : "Pickup control"}</p><h2 className="mt-2 text-[26px] font-normal leading-[1.08] tracking-[-0.035em]">{selected.shipment_reference}</h2></div><OpsBadge tone={statusTone(selected)}>{pickupAppointmentStatusLabels[selected.status]}</OpsBadge></div>
                <p className="mt-3 text-[12px] leading-5 text-[#5B5B57]">{selected.customer_name}<br/>{selected.origin} → {selected.destination}</p>
                <div className="mt-4 flex flex-wrap gap-3"><Link href={`/admin/jobs/${encodeURIComponent(selected.shipment_reference)}`} className="border-b border-[#101010] pb-0.5 text-[11px] hover:border-[#DC143C] hover:text-[#DC143C]">Open Job File</Link>{selected.partner_name ? <span className="text-[11px] text-[#777771]">Partner · {selected.partner_name}</span> : null}</div>
              </div>

              {selected.status !== "picked_up" && selected.status !== "cancelled" ? <div>
                <section className="border-b border-[#BEBEB7] py-5">
                  <StepNumber number="01" title="Appointment" detail="Request or confirm the collection window."/>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><OpsField label="Pickup window start"><input type="datetime-local" value={windowStart} onChange={(event) => setWindowStart(event.target.value)}/></OpsField><OpsField label="Pickup window end"><input type="datetime-local" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)}/></OpsField><OpsField label="Pickup location"><input value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} placeholder="Warehouse, factory, terminal…"/></OpsField><OpsField label="Request channel"><select value={channel} onChange={(event) => setChannel(event.target.value as PickupChannel)}>{pickupChannels.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></OpsField><OpsField label="Contact name"><input value={contactName} onChange={(event) => setContactName(event.target.value)}/></OpsField><OpsField label="Contact phone"><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)}/></OpsField><OpsField label="Carrier/vendor reference"><input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Appointment / pickup reference"/></OpsField><OpsField label="Operational note"><input value={notes} onChange={(event) => setNotes(event.target.value)}/></OpsField></div>
                  <div className="mt-4 flex flex-wrap gap-2"><OpsButton variant="secondary" disabled={busy || !windowStart || !windowEnd} onClick={() => act("schedule", { windowStart, windowEnd, pickupLocation, contactName, contactPhone, channel, providerReference, notes, confirmed: false })}><CalendarClock size={12}/>Request pickup</OpsButton><OpsButton variant="primary" disabled={busy || !windowStart || !windowEnd} onClick={() => act(selected.status === "unscheduled" || selected.status === "missed" ? "schedule" : "confirm", selected.status === "unscheduled" || selected.status === "missed" ? { windowStart, windowEnd, pickupLocation, contactName, contactPhone, channel, providerReference, notes, confirmed: true } : { windowStart, windowEnd, providerReference, notes })}><CheckCircle2 size={12}/>Confirm appointment</OpsButton></div>
                </section>

                <section className="border-b border-[#BEBEB7] py-5">
                  <StepNumber number="02" title="Vehicle & driver" detail="Assign the collection resource once the appointment is ready."/>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3"><OpsField label="Driver name"><input value={driverName} onChange={(event) => setDriverName(event.target.value)}/></OpsField><OpsField label="Driver phone"><input value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)}/></OpsField><OpsField label="Vehicle reference"><input value={vehicleReference} onChange={(event) => setVehicleReference(event.target.value)} placeholder="Truck / plate / vehicle"/></OpsField></div>
                  <div className="mt-4"><OpsButton variant="secondary" disabled={busy || driverName.trim().length < 2 || selected.status === "unscheduled"} onClick={() => act("assign_driver", { driverName, driverPhone, vehicleReference, notes })}><Truck size={12}/>Assign driver</OpsButton></div>
                </section>

                <section className="py-5">
                  <StepNumber number="03" title="Pickup outcome" detail="Complete the collection or record the operational exception."/>
                  <div className="mt-4 flex flex-wrap gap-2"><OpsButton variant="primary" disabled={busy || selected.status === "unscheduled"} onClick={() => act("picked_up", { eventTime: new Date().toISOString(), location: pickupLocation })}><CheckCircle2 size={12}/>Cargo picked up</OpsButton><OpsButton variant="danger" disabled={busy || selected.status === "unscheduled" || missedReason.trim().length < 6} onClick={() => act("missed", { reason: missedReason })}><AlertTriangle size={12}/>Mark missed</OpsButton><OpsButton variant="ghost" disabled={busy || selected.status === "unscheduled"} onClick={() => act("cancel", { note: notes })}>Cancel pickup</OpsButton></div>
                  <div className="mt-4"><OpsField label="Missed-pickup reason"><textarea className="ops-textarea min-h-20" value={missedReason} onChange={(event) => setMissedReason(event.target.value)} placeholder="Carrier no-show, cargo not ready, warehouse closed, documents incomplete…"/></OpsField></div>
                </section>
              </div> : <div className="py-5"><OpsNotice tone={selected.status === "picked_up" ? "success" : "warning"}>{selected.status === "picked_up" ? `Pickup completed ${dateTime(selected.picked_up_at)}. Live Visibility now owns the movement timeline.` : "This pickup appointment is cancelled."}</OpsNotice></div>}
            </div>}
          </aside>
        </section>
      </div>
    </main>
  </OpsPage>;
}

function StepNumber({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-[10px] font-medium text-[#DC143C]">{number}</span><div><h3 className="text-[14px] font-medium tracking-[-0.015em]">{title}</h3><p className="mt-1 text-[11px] leading-5 text-[#777771]">{detail}</p></div></div>;
}
