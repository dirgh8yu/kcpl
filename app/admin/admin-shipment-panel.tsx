"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, Clock3, ExternalLink, MapPin, Plus, Truck } from "lucide-react";
import type { QuoteStatus } from "./admin-data";
import {
  shipmentStatusLabels,
  shipmentStatuses,
  type ShipmentDetail,
  type ShipmentEvent,
  type ShipmentStatus,
} from "../shipment-types";

const shipmentStatusStyles: Record<ShipmentStatus, string> = {
  booking_confirmed: "border-sky-200 bg-sky-50 text-sky-700",
  preparing: "border-amber-200 bg-amber-50 text-amber-800",
  in_transit: "border-indigo-200 bg-indigo-50 text-indigo-700",
  customs_clearance: "border-violet-200 bg-violet-50 text-violet-700",
  out_for_delivery: "border-cyan-200 bg-cyan-50 text-cyan-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  exception: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

export function AdminShipmentPanel({
  shipment,
  quoteStatus,
  onShipmentChange,
  onNotice,
}: {
  shipment: ShipmentDetail | null;
  quoteStatus: QuoteStatus;
  onShipmentChange: (shipment: ShipmentDetail) => void;
  onNotice: (message: string) => void;
}) {
  if (!shipment) {
    if (quoteStatus !== "won") return null;
    return <article className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-7">
      <div className="flex gap-3"><span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><Truck size={20}/></span><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Shipment</p><h3 className="mt-1 text-xl font-black text-[#10263f]">Shipment record is being prepared.</h3><p className="mt-2 text-sm leading-6 text-black/55">Save the Won workflow or reload this enquiry. KCPL will create the tracking reference automatically.</p></div></div>
    </article>;
  }

  return <ShipmentWorkspace key={shipment.reference} initialShipment={shipment} onShipmentChange={onShipmentChange} onNotice={onNotice}/>;
}

function ShipmentWorkspace({
  initialShipment,
  onShipmentChange,
  onNotice,
}: {
  initialShipment: ShipmentDetail;
  onShipmentChange: (shipment: ShipmentDetail) => void;
  onNotice: (message: string) => void;
}) {
  const [draft, setDraft] = useState(initialShipment);
  const [saving, setSaving] = useState(false);
  const [eventDraft, setEventDraft] = useState({ title: "", location: "", details: "", eventTime: "" });

  async function saveShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          eta: draft.eta ?? "",
          currentLocation: draft.current_location ?? "",
          carrier: draft.carrier ?? "",
          carrierReference: draft.carrier_reference ?? "",
          customerNote: draft.customer_note ?? "",
        }),
      });
      const data = await response.json() as { shipment?: ShipmentDetail; error?: string };
      if (!response.ok || !data.shipment) throw new Error(data.error || "Could not save the shipment.");
      setDraft(data.shipment);
      onShipmentChange(data.shipment);
      onNotice("Shipment details updated.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not save the shipment.");
    } finally {
      setSaving(false);
    }
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventDraft.title.trim()) return;
    setSaving(true);
    onNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(eventDraft),
      });
      const data = await response.json() as { event?: ShipmentEvent; error?: string };
      if (!response.ok || !data.event) throw new Error(data.error || "Could not add the tracking event.");
      const next = {
        ...draft,
        current_location: data.event.location || draft.current_location,
        events: [data.event, ...draft.events],
      };
      setDraft(next);
      onShipmentChange(next);
      setEventDraft({ title: "", location: "", details: "", eventTime: "" });
      onNotice("Tracking event published.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not add the tracking event.");
    } finally {
      setSaving(false);
    }
  }

  return <article className="rounded-3xl border border-black/10 bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex gap-3"><span className="mt-0.5 rounded-xl bg-[#10263f]/7 p-2.5 text-[#10263f]"><Truck size={21}/></span><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#b78a3e]">Shipment operations</p><h3 className="mt-1 text-xl font-black">{draft.reference}</h3><p className="mt-1 text-sm text-black/45">Created from won quote {draft.quote_reference}</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[.1em] ${shipmentStatusStyles[draft.status]}`}>{shipmentStatusLabels[draft.status]}</span><a href={`/tracking?reference=${encodeURIComponent(draft.reference)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-xs font-black text-[#10263f] transition hover:bg-[#f8f7f2]">Public tracking <ExternalLink size={13}/></a></div>
    </div>

    <form onSubmit={saveShipment} className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="text-xs font-black uppercase tracking-[.13em] text-black/45">Shipment status<select className={`mt-2 w-full rounded-xl border p-3 text-sm font-bold outline-none ${shipmentStatusStyles[draft.status]}`} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ShipmentStatus })}>{shipmentStatuses.map((status) => <option value={status} key={status}>{shipmentStatusLabels[status]}</option>)}</select></label>
      <label className="text-xs font-black uppercase tracking-[.13em] text-black/45">ETA<input type="date" className="mt-2 w-full rounded-xl border border-black/10 bg-[#f8f7f2] p-3 text-sm font-bold text-[#10263f] outline-none focus:border-[#b78a3e]" value={draft.eta ?? ""} onChange={(event) => setDraft({ ...draft, eta: event.target.value })}/></label>
      <label className="text-xs font-black uppercase tracking-[.13em] text-black/45">Current location<input className="mt-2 w-full rounded-xl border border-black/10 bg-[#f8f7f2] p-3 text-sm text-[#10263f] outline-none focus:border-[#b78a3e]" value={draft.current_location ?? ""} onChange={(event) => setDraft({ ...draft, current_location: event.target.value })} placeholder="Kathmandu, Nepal" maxLength={180}/></label>
      <label className="text-xs font-black uppercase tracking-[.13em] text-black/45">Carrier / line<input className="mt-2 w-full rounded-xl border border-black/10 bg-[#f8f7f2] p-3 text-sm text-[#10263f] outline-none focus:border-[#b78a3e]" value={draft.carrier ?? ""} onChange={(event) => setDraft({ ...draft, carrier: event.target.value })} placeholder="Airline, shipping line or road carrier" maxLength={160}/></label>
      <label className="text-xs font-black uppercase tracking-[.13em] text-black/45">Carrier reference<input className="mt-2 w-full rounded-xl border border-black/10 bg-[#f8f7f2] p-3 text-sm text-[#10263f] outline-none focus:border-[#b78a3e]" value={draft.carrier_reference ?? ""} onChange={(event) => setDraft({ ...draft, carrier_reference: event.target.value })} placeholder="AWB / BL / container / carrier ref" maxLength={160}/></label>
      <div className="rounded-2xl bg-[#f8f7f2] p-4 text-sm"><div className="flex items-center gap-2 text-black/40"><CalendarDays size={15}/><span className="text-[10px] font-black uppercase tracking-[.13em]">Customer view</span></div><p className="mt-2 font-bold text-[#10263f]">{draft.eta ? `ETA ${formatDateOnly(draft.eta)}` : "ETA not set"}</p><p className="mt-1 text-xs text-black/45">{draft.current_location || "Location not set"}</p></div>
      <label className="text-xs font-black uppercase tracking-[.13em] text-black/45 sm:col-span-2 xl:col-span-3">Customer status note<textarea className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f8f7f2] p-4 text-sm font-medium normal-case leading-6 tracking-normal text-[#10263f] outline-none focus:border-[#b78a3e]" rows={3} value={draft.customer_note ?? ""} onChange={(event) => setDraft({ ...draft, customer_note: event.target.value })} placeholder="A short update customers can safely see on the tracking page…" maxLength={2000}/></label>
      <div className="sm:col-span-2 xl:col-span-3"><button disabled={saving} type="submit" className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save shipment"}</button></div>
    </form>

    <div className="mt-8 border-t border-black/10 pt-7">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b78a3e]">Tracking timeline</p><h4 className="mt-1 text-lg font-black">Public shipment events</h4></div><span className="text-xs font-bold text-black/35">{draft.events.length} {draft.events.length === 1 ? "event" : "events"}</span></div>

      <form onSubmit={addEvent} className="mt-5 grid gap-3 rounded-2xl border border-black/8 bg-[#f8f7f2] p-4 sm:grid-cols-2">
        <label className="text-[10px] font-black uppercase tracking-[.12em] text-black/40">Event title<input className="mt-2 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-semibold normal-case tracking-normal text-[#10263f] outline-none focus:border-[#b78a3e]" value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} placeholder="Departed origin facility" maxLength={180}/></label>
        <label className="text-[10px] font-black uppercase tracking-[.12em] text-black/40">Location<input className="mt-2 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-semibold normal-case tracking-normal text-[#10263f] outline-none focus:border-[#b78a3e]" value={eventDraft.location} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} placeholder="Birgunj, Nepal" maxLength={180}/></label>
        <label className="text-[10px] font-black uppercase tracking-[.12em] text-black/40">Event time<input type="datetime-local" className="mt-2 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-semibold normal-case tracking-normal text-[#10263f] outline-none focus:border-[#b78a3e]" value={eventDraft.eventTime} onChange={(event) => setEventDraft({ ...eventDraft, eventTime: event.target.value })}/><span className="mt-1 block text-[10px] font-semibold normal-case tracking-normal text-black/35">Leave blank to use the current time</span></label>
        <label className="text-[10px] font-black uppercase tracking-[.12em] text-black/40">Details<textarea className="mt-2 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-medium normal-case leading-5 tracking-normal text-[#10263f] outline-none focus:border-[#b78a3e]" rows={2} value={eventDraft.details} onChange={(event) => setEventDraft({ ...eventDraft, details: event.target.value })} placeholder="Optional customer-safe detail" maxLength={2000}/></label>
        <div className="sm:col-span-2"><button disabled={saving || !eventDraft.title.trim()} type="submit" className="flex items-center gap-2 rounded-xl bg-[#b78a3e] px-4 py-3 text-sm font-black text-white disabled:opacity-40"><Plus size={15}/> Publish tracking event</button></div>
      </form>

      <div className="mt-6 space-y-4">
        {draft.events.length === 0 && <p className="text-sm text-black/45">No tracking events yet.</p>}
        {draft.events.map((event, index) => <div key={event.id} className="relative pl-8"><span className={`absolute left-0 top-1.5 h-3 w-3 rounded-full ${index === 0 ? "bg-[#b78a3e]" : "bg-[#10263f]/25"}`}/>{index < draft.events.length - 1 && <span className="absolute left-[5px] top-5 h-[calc(100%+4px)] w-px bg-black/10"/>}<div className="rounded-2xl border border-black/8 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black text-[#10263f]">{event.title}</p>{event.location && <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-black/45"><MapPin size={12}/>{event.location}</p>}</div><p className="flex items-center gap-1.5 text-[11px] font-semibold text-black/35"><Clock3 size={12}/>{formatDate(event.event_time)}</p></div>{event.details && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black/60">{event.details}</p>}<p className="mt-3 text-[10px] font-semibold text-black/30">Published by {event.author_name}</p></div></div>)}
      </div>
    </div>
  </article>;
}
