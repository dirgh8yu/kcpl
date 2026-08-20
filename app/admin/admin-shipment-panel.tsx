"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import type { QuoteStatus } from "./admin-data";
import {
  shipmentStatusLabels,
  shipmentStatuses,
  type ShipmentDetail,
  type ShipmentEvent,
  type ShipmentStatus,
} from "../shipment-types";
import {
  shipmentDocumentTypeLabels,
  shipmentDocumentTypes,
  type ShipmentDocument,
} from "../shipment-document-types";

const shipmentStatusStyles: Record<ShipmentStatus, string> = {
  booking_confirmed: "border-sky-200 bg-sky-50 text-sky-700",
  preparing: "border-amber-200 bg-amber-50 text-amber-800",
  in_transit: "border-indigo-200 bg-indigo-50 text-indigo-700",
  customs_clearance: "border-violet-200 bg-violet-50 text-violet-700",
  out_for_delivery: "border-cyan-200 bg-cyan-50 text-cyan-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  exception: "border-rose-200 bg-rose-50 text-rose-700",
};

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-sm text-[#10263f] outline-none transition focus:border-[#aa8748] focus:bg-white";
const shipmentTabs = ["details", "tracking", "documents"] as const;
type ShipmentTab = (typeof shipmentTabs)[number];

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    return <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
      <div className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-emerald-100 p-2 text-emerald-700"><Truck size={18}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-emerald-700">Shipment creation</p><h3 className="mt-1 text-base font-bold text-[#173c2d]">Shipment record is being prepared</h3><p className="mt-1 text-sm leading-6 text-emerald-900/65">Save the Won workflow or reload this enquiry. KCPL will create the tracking reference automatically.</p></div></div>
    </div>;
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
  const [activeTab, setActiveTab] = useState<ShipmentTab>("details");
  const [saving, setSaving] = useState(false);
  const [eventDraft, setEventDraft] = useState({ title: "", location: "", details: "", eventTime: "" });
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentStorageAvailable, setDocumentStorageAvailable] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}/documents`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { documents?: ShipmentDocument[]; storageAvailable?: boolean; error?: string };
        if (!response.ok || !data.documents) throw new Error(data.error || "Could not load shipment documents.");
        setDocuments(data.documents);
        setDocumentStorageAvailable(data.storageAvailable !== false);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        onNotice(error instanceof Error ? error.message : "Could not load shipment documents.");
      })
      .finally(() => setDocumentsLoading(false));
    return () => controller.abort();
  }, [draft.reference, onNotice]);

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

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    setDocumentSaving(true);
    onNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}/documents`, { method: "POST", body });
      const data = await response.json() as { document?: ShipmentDocument; error?: string };
      if (!response.ok || !data.document) throw new Error(data.error || "Could not upload the document.");
      setDocuments((current) => [data.document!, ...current]);
      setDocumentStorageAvailable(true);
      form.reset();
      onNotice(`${data.document.filename} uploaded to the private shipment vault.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not upload the document.");
    } finally {
      setDocumentSaving(false);
    }
  }

  async function removeDocument(document: ShipmentDocument) {
    if (!window.confirm(`Delete ${document.filename} from this shipment?`)) return;
    setDocumentSaving(true);
    onNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}/documents/${document.id}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not delete the document.");
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      onNotice(`${document.filename} deleted from the shipment vault.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not delete the document.");
    } finally {
      setDocumentSaving(false);
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
      const next = { ...draft, current_location: data.event.location || draft.current_location, events: [data.event, ...draft.events] };
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

  return <div className="overflow-hidden rounded-xl border border-[#dfe3e8] bg-white">
    <div className="border-b border-[#e8ebee] px-4 pt-4 sm:px-5 sm:pt-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8b744d]">Shipment operations</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${shipmentStatusStyles[draft.status]}`}>{shipmentStatusLabels[draft.status]}</span></div><h2 className="mt-1 text-lg font-bold tracking-[-.02em]">{draft.reference}</h2><p className="mt-1 text-xs text-[#87919a]">Won quote {draft.quote_reference}</p></div>
        <a href={`/tracking?reference=${encodeURIComponent(draft.reference)}`} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1.5 rounded-lg border border-[#dfe3e8] bg-white px-3 text-xs font-semibold transition hover:bg-[#f7f8f9]">Public tracking <ExternalLink size={13}/></a>
      </div>

      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-[#e3e7ea] bg-[#e3e7ea] sm:grid-cols-4">
        <ShipmentSnapshot label="Status" value={shipmentStatusLabels[draft.status]}/>
        <ShipmentSnapshot label="Current location" value={draft.current_location || "Not set"}/>
        <ShipmentSnapshot label="ETA" value={draft.eta ? formatDateOnly(draft.eta) : "Not set"}/>
        <ShipmentSnapshot label="Carrier" value={draft.carrier || "Not set"}/>
      </div>

      <nav className="mt-5 flex gap-5 overflow-x-auto">
        {shipmentTabs.map((tab) => {
          const suffix = tab === "tracking" ? ` ${draft.events.length}` : tab === "documents" ? ` ${documents.length}` : "";
          return <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`border-b-2 pb-3 text-xs font-semibold capitalize transition ${activeTab === tab ? "border-[#b78a3e] text-[#10263f]" : "border-transparent text-[#7b858e] hover:text-[#10263f]"}`}>{tab}<span className="ml-1 text-[10px] text-[#9aa2aa]">{suffix}</span></button>;
        })}
      </nav>
    </div>

    <div className="p-4 sm:p-5">
      {activeTab === "details" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={saveShipment} className="grid gap-4 sm:grid-cols-2">
          <ShipmentField label="Shipment status"><select className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none ${shipmentStatusStyles[draft.status]}`} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ShipmentStatus })}>{shipmentStatuses.map((status) => <option value={status} key={status}>{shipmentStatusLabels[status]}</option>)}</select></ShipmentField>
          <ShipmentField label="ETA"><input type="date" className={inputClass} value={draft.eta ?? ""} onChange={(event) => setDraft({ ...draft, eta: event.target.value })}/></ShipmentField>
          <ShipmentField label="Current location"><input className={inputClass} value={draft.current_location ?? ""} onChange={(event) => setDraft({ ...draft, current_location: event.target.value })} placeholder="Kathmandu, Nepal" maxLength={180}/></ShipmentField>
          <ShipmentField label="Carrier / line"><input className={inputClass} value={draft.carrier ?? ""} onChange={(event) => setDraft({ ...draft, carrier: event.target.value })} placeholder="Airline, shipping line or road carrier" maxLength={160}/></ShipmentField>
          <ShipmentField label="Carrier reference" hint="AWB, BL, container or carrier reference"><input className={inputClass} value={draft.carrier_reference ?? ""} onChange={(event) => setDraft({ ...draft, carrier_reference: event.target.value })} placeholder="Reference" maxLength={160}/></ShipmentField>
          <label className="sm:col-span-2"><span className="text-[11px] font-semibold text-[#5f6973]">Customer status note</span><textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] p-3 text-sm leading-6 text-[#10263f] outline-none transition focus:border-[#aa8748] focus:bg-white" value={draft.customer_note ?? ""} onChange={(event) => setDraft({ ...draft, customer_note: event.target.value })} placeholder="Short customer-safe update shown on tracking…" maxLength={2000}/></label>
          <div className="sm:col-span-2"><button disabled={saving} type="submit" className="h-10 rounded-lg bg-[#10263f] px-4 text-xs font-bold text-white transition hover:bg-[#183651] disabled:opacity-50">{saving ? "Saving…" : "Save shipment"}</button></div>
        </form>

        <aside className="h-fit rounded-lg border border-[#e3e7ea] bg-[#f8f9fa] p-4">
          <div className="flex items-center gap-2 text-[#8a6b37]"><CalendarDays size={14}/><p className="text-[10px] font-bold uppercase tracking-[.1em]">Customer view</p></div>
          <p className="mt-3 text-sm font-bold text-[#10263f]">{shipmentStatusLabels[draft.status]}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#65717c]"><MapPin size={12}/>{draft.current_location || "Location not set"}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#65717c]"><Clock3 size={12}/>{draft.eta ? `ETA ${formatDateOnly(draft.eta)}` : "ETA not set"}</p>
          {draft.customer_note && <p className="mt-3 border-t border-[#e3e7ea] pt-3 text-xs leading-5 text-[#68737d]">{draft.customer_note}</p>}
        </aside>
      </div>}

      {activeTab === "tracking" && <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={addEvent} className="h-fit rounded-lg border border-[#e3e7ea] bg-[#f8f9fa] p-4">
          <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8b744d]">New public update</p><h3 className="mt-1 text-sm font-bold">Publish tracking event</h3></div>
          <ShipmentField label="Event title"><input className={inputClass} value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} placeholder="Departed origin facility" maxLength={180}/></ShipmentField>
          <div className="mt-3"><ShipmentField label="Location"><input className={inputClass} value={eventDraft.location} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} placeholder="Birgunj, Nepal" maxLength={180}/></ShipmentField></div>
          <div className="mt-3"><ShipmentField label="Event time" hint="Leave blank to use current time"><input type="datetime-local" className={inputClass} value={eventDraft.eventTime} onChange={(event) => setEventDraft({ ...eventDraft, eventTime: event.target.value })}/></ShipmentField></div>
          <label className="mt-3 block"><span className="text-[11px] font-semibold text-[#5f6973]">Details</span><textarea className="mt-1.5 min-h-20 w-full rounded-lg border border-[#dfe3e8] bg-white p-3 text-sm leading-5 outline-none focus:border-[#aa8748]" value={eventDraft.details} onChange={(event) => setEventDraft({ ...eventDraft, details: event.target.value })} placeholder="Optional customer-safe detail" maxLength={2000}/></label>
          <button disabled={saving || !eventDraft.title.trim()} type="submit" className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-[#b78a3e] px-4 text-xs font-bold text-white disabled:opacity-40"><Plus size={14}/> Publish update</button>
        </form>

        <div>
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8b744d]">Tracking timeline</p><h3 className="mt-1 text-sm font-bold">Customer-visible events</h3></div><span className="text-xs font-semibold text-[#89939c]">{draft.events.length} {draft.events.length === 1 ? "event" : "events"}</span></div>
          {draft.events.length === 0 && <div className="rounded-lg border border-dashed border-[#d9dee2] p-8 text-center text-sm text-[#87919a]">No tracking events yet.</div>}
          <div className="space-y-0">{draft.events.map((event, index) => <div key={event.id} className="relative pl-7 pb-5 last:pb-0"><span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-[#b78a3e]" : "bg-[#b8c0c7]"}`}/>{index < draft.events.length - 1 && <span className="absolute left-[4px] top-4 h-[calc(100%-4px)] w-px bg-[#dfe3e8]"/>}<div className="rounded-lg border border-[#e3e7ea] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold text-[#263a50]">{event.title}</p>{event.location && <p className="mt-1 flex items-center gap-1.5 text-xs text-[#707b85]"><MapPin size={11}/>{event.location}</p>}</div><p className="flex items-center gap-1.5 text-[10px] font-medium text-[#949da5]"><Clock3 size={11}/>{formatDate(event.event_time)}</p></div>{event.details && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5d6873]">{event.details}</p>}<p className="mt-3 text-[10px] text-[#9ba3aa]">Published by {event.author_name}</p></div></div>)}</div>
        </div>
      </div>}

      {activeTab === "documents" && <div>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><FileText size={15} className="text-[#92703a]"/><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8b744d]">Document vault</p></div><h3 className="mt-1 text-sm font-bold">Private shipment files</h3><p className="mt-1 text-xs text-[#838d96]">Admin-only files stored privately. They never appear on public tracking.</p></div><span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"><ShieldCheck size={12}/> Admin only</span></div>

        {!documentStorageAvailable && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-800">R2 document storage has not been bound to this Worker yet. Existing metadata remains safe, but uploads and downloads are unavailable until the binding is deployed.</div>}

        <form onSubmit={uploadDocument} className="grid gap-3 rounded-lg border border-[#e3e7ea] bg-[#f8f9fa] p-4 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
          <ShipmentField label="Document type"><select name="documentType" defaultValue="other" className={inputClass}>{shipmentDocumentTypes.map((type) => <option value={type} key={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></ShipmentField>
          <ShipmentField label="File" hint="PDF, image, Word, Excel, CSV or TXT · max 15 MB"><input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" className="mt-1.5 block h-10 w-full rounded-lg border border-[#dfe3e8] bg-white p-1.5 text-xs text-[#5f6973] file:mr-3 file:rounded-md file:border-0 file:bg-[#10263f] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"/></ShipmentField>
          <button disabled={documentSaving || !documentStorageAvailable} type="submit" className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#b78a3e] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Upload size={14}/>{documentSaving ? "Uploading…" : "Upload"}</button>
        </form>

        <div className="mt-4 overflow-hidden rounded-lg border border-[#e3e7ea]">
          {documentsLoading && <p className="p-4 text-sm text-[#87919a]">Loading shipment documents…</p>}
          {!documentsLoading && documents.length === 0 && <div className="p-8 text-center"><FileText className="mx-auto text-[#b3bbc2]" size={20}/><p className="mt-2 text-sm font-semibold text-[#7e8992]">No documents uploaded yet.</p></div>}
          {documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f2] p-3 last:border-b-0">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#263a50]">{document.filename}</p><p className="mt-1 text-[10px] text-[#89939c]">{shipmentDocumentTypeLabels[document.document_type]} · {formatBytes(document.size_bytes)} · {document.uploaded_by} · {formatDate(document.uploaded_at)}</p></div>
            <div className="flex items-center gap-1.5"><a href={`/api/admin/shipments/${encodeURIComponent(draft.reference)}/documents/${document.id}`} className="flex h-8 items-center gap-1.5 rounded-md border border-[#dfe3e8] px-2.5 text-[11px] font-semibold hover:bg-[#f7f8f9]"><Download size={12}/> Download</a><button type="button" disabled={documentSaving} onClick={() => removeDocument(document)} className="flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40"><Trash2 size={12}/> Delete</button></div>
          </div>)}
        </div>
      </div>}
    </div>
  </div>;
}

function ShipmentSnapshot({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-[#f8f9fa] px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[.09em] text-[#929ba3]">{label}</p><p className="mt-1 truncate text-xs font-semibold text-[#34495d]" title={value}>{value}</p></div>;
}

function ShipmentField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] font-semibold text-[#5f6973]">{label}</span>{children}{hint && <span className="mt-1 block text-[10px] text-[#9aa2a9]">{hint}</span>}</label>;
}
