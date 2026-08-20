"use client";

import { FormEvent, useEffect, useState } from "react";
import { Clock3, Download, ExternalLink, FileText, MapPin, Plus, ShieldCheck, Trash2, Truck, Upload } from "lucide-react";
import type { QuoteStatus } from "./admin-data";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentDetail, type ShipmentEvent, type ShipmentStatus } from "../shipment-types";
import { shipmentDocumentTypeLabels, shipmentDocumentTypes, type ShipmentDocument } from "../shipment-document-types";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice } from "./operations-ui";

const shipmentTabs = ["details", "tracking", "documents"] as const;
type ShipmentTab = (typeof shipmentTabs)[number];

function statusTone(status: ShipmentStatus): "neutral" | "info" | "warning" | "violet" | "success" | "danger" {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance") return "violet";
  if (status === "preparing") return "warning";
  if (status === "booking_confirmed" || status === "in_transit" || status === "out_for_delivery") return "info";
  return "neutral";
}
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date); }
function formatDateOnly(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export function AdminShipmentPanel({ shipment, quoteStatus, onShipmentChange, onNotice }: { shipment: ShipmentDetail | null; quoteStatus: QuoteStatus; onShipmentChange: (shipment: ShipmentDetail) => void; onNotice: (message: string) => void }) {
  if (!shipment) {
    if (quoteStatus !== "won") return null;
    return <OpsNotice tone="success"><span className="inline-flex items-center gap-2"><Truck size={13}/>Shipment creation is being prepared. Save the Won workflow or reload this enquiry; KCPL will create the tracking reference automatically.</span></OpsNotice>;
  }
  return <ShipmentWorkspace key={shipment.reference} initialShipment={shipment} onShipmentChange={onShipmentChange} onNotice={onNotice}/>;
}

function ShipmentWorkspace({ initialShipment, onShipmentChange, onNotice }: { initialShipment: ShipmentDetail; onShipmentChange: (shipment: ShipmentDetail) => void; onNotice: (message: string) => void }) {
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
      .then(async (response) => { const data = await response.json() as { documents?: ShipmentDocument[]; storageAvailable?: boolean; error?: string }; if (!response.ok || !data.documents) throw new Error(data.error || "Could not load shipment documents."); setDocuments(data.documents); setDocumentStorageAvailable(data.storageAvailable !== false); })
      .catch((error) => { if (error instanceof DOMException && error.name === "AbortError") return; onNotice(error instanceof Error ? error.message : "Could not load shipment documents."); })
      .finally(() => setDocumentsLoading(false));
    return () => controller.abort();
  }, [draft.reference, onNotice]);

  async function saveShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); onNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: draft.status, eta: draft.eta ?? "", currentLocation: draft.current_location ?? "", carrier: draft.carrier ?? "", carrierReference: draft.carrier_reference ?? "", customerNote: draft.customer_note ?? "" }) });
      const data = await response.json() as { shipment?: ShipmentDetail; error?: string };
      if (!response.ok || !data.shipment) throw new Error(data.error || "Could not save the shipment.");
      setDraft(data.shipment); onShipmentChange(data.shipment); onNotice("Shipment details updated.");
    } catch (error) { onNotice(error instanceof Error ? error.message : "Could not save the shipment."); }
    finally { setSaving(false); }
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!eventDraft.title.trim()) return; setSaving(true); onNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(eventDraft) });
      const data = await response.json() as { event?: ShipmentEvent; error?: string };
      if (!response.ok || !data.event) throw new Error(data.error || "Could not add the tracking event.");
      const next = { ...draft, current_location: data.event.location || draft.current_location, events: [data.event, ...draft.events] };
      setDraft(next); onShipmentChange(next); setEventDraft({ title: "", location: "", details: "", eventTime: "" }); onNotice("Tracking event published.");
    } catch (error) { onNotice(error instanceof Error ? error.message : "Could not add the tracking event."); }
    finally { setSaving(false); }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setDocumentSaving(true); onNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}/documents`, { method: "POST", body: new FormData(form) });
      const data = await response.json() as { document?: ShipmentDocument; error?: string };
      if (!response.ok || !data.document) throw new Error(data.error || "Could not upload the document.");
      setDocuments((current) => [data.document!, ...current]); setDocumentStorageAvailable(true); form.reset(); onNotice(`${data.document.filename} uploaded to the private shipment vault.`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Could not upload the document."); }
    finally { setDocumentSaving(false); }
  }

  async function removeDocument(document: ShipmentDocument) {
    if (!window.confirm(`Delete ${document.filename} from this shipment?`)) return;
    setDocumentSaving(true); onNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}/documents/${document.id}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not delete the document.");
      setDocuments((current) => current.filter((item) => item.id !== document.id)); onNotice(`${document.filename} deleted from the shipment vault.`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Could not delete the document."); }
    finally { setDocumentSaving(false); }
  }

  return <div className="overflow-hidden rounded-[15px] border border-[#e7dfd8] bg-[#fffdfa]">
    <div className="border-b border-[#eee7e1] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="ops-eyebrow">Shipment operations</p><OpsBadge tone={statusTone(draft.status)} dot>{shipmentStatusLabels[draft.status]}</OpsBadge></div><h2 className="mt-2 text-[16px] font-[730] tracking-[-.03em] text-[#443b35]"><OpsMono>{draft.reference}</OpsMono></h2><p className="mt-1 text-[8px] text-[#9b9189]">Won quote <OpsMono>{draft.quote_reference}</OpsMono></p></div><div className="flex gap-2"><a href={`/admin/jobs/${encodeURIComponent(draft.reference)}`} className="ops-button" data-variant="primary" data-size="sm">Digital Job File <ExternalLink size={11}/></a><a href={`/tracking?reference=${encodeURIComponent(draft.reference)}`} target="_blank" rel="noreferrer" className="ops-button" data-variant="secondary" data-size="sm">Public tracking <ExternalLink size={11}/></a></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4"><Snapshot label="Status" value={shipmentStatusLabels[draft.status]}/><Snapshot label="Location" value={draft.current_location || "Not set"}/><Snapshot label="ETA" value={draft.eta ? formatDateOnly(draft.eta) : "Not set"}/><Snapshot label="Carrier" value={draft.carrier || "Not set"}/></div>
      <nav className="ops-segmented mt-4">{shipmentTabs.map((tab) => <button key={tab} type="button" data-active={activeTab === tab || undefined} onClick={() => setActiveTab(tab)}>{tab}{tab === "tracking" ? ` · ${draft.events.length}` : tab === "documents" ? ` · ${documents.length}` : ""}</button>)}</nav>
    </div>

    <div className="p-4 sm:p-5">
      {activeTab === "details" ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><form onSubmit={saveShipment} className="grid gap-4 sm:grid-cols-2"><OpsField label="Shipment status"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ShipmentStatus })}>{shipmentStatuses.map((status) => <option value={status} key={status}>{shipmentStatusLabels[status]}</option>)}</select></OpsField><OpsField label="ETA"><input type="date" value={draft.eta ?? ""} onChange={(event) => setDraft({ ...draft, eta: event.target.value })}/></OpsField><OpsField label="Current location"><input value={draft.current_location ?? ""} onChange={(event) => setDraft({ ...draft, current_location: event.target.value })} placeholder="Kathmandu, Nepal"/></OpsField><OpsField label="Carrier / line"><input value={draft.carrier ?? ""} onChange={(event) => setDraft({ ...draft, carrier: event.target.value })} placeholder="Airline, line or road carrier"/></OpsField><OpsField label="Carrier reference" hint="AWB, BL, container or carrier reference"><input value={draft.carrier_reference ?? ""} onChange={(event) => setDraft({ ...draft, carrier_reference: event.target.value })}/></OpsField><OpsField label="Customer status note" className="sm:col-span-2"><textarea value={draft.customer_note ?? ""} onChange={(event) => setDraft({ ...draft, customer_note: event.target.value })} placeholder="Customer-safe update shown on tracking…"/></OpsField><div className="sm:col-span-2"><OpsButton variant="primary" disabled={saving}>{saving ? "Saving…" : "Save shipment"}</OpsButton></div></form><aside className="h-fit rounded-[13px] border border-[#e8e0d9] bg-[#faf7f4] p-4"><p className="ops-eyebrow">Customer view</p><p className="mt-3 text-[11px] font-bold text-[#514840]">{shipmentStatusLabels[draft.status]}</p><p className="mt-2 flex items-center gap-1.5 text-[9px] text-[#7f756d]"><MapPin size={11}/>{draft.current_location || "Location not set"}</p><p className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#7f756d]"><Clock3 size={11}/>{draft.eta ? `ETA ${formatDateOnly(draft.eta)}` : "ETA not set"}</p>{draft.customer_note ? <p className="mt-3 border-t border-[#e8e0d9] pt-3 text-[9px] leading-5 text-[#81776f]">{draft.customer_note}</p> : null}</aside></div> : null}

      {activeTab === "tracking" ? <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]"><form onSubmit={addEvent} className="h-fit rounded-[13px] border border-[#e8e0d9] bg-[#faf7f4] p-4"><p className="ops-eyebrow">New public update</p><h3 className="mt-1 text-[12px] font-bold text-[#514840]">Publish tracking event</h3><div className="mt-4 grid gap-3"><OpsField label="Event title"><input value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} placeholder="Departed origin facility"/></OpsField><OpsField label="Location"><input value={eventDraft.location} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} placeholder="Birgunj, Nepal"/></OpsField><OpsField label="Event time" hint="Leave blank to use current time"><input type="datetime-local" value={eventDraft.eventTime} onChange={(event) => setEventDraft({ ...eventDraft, eventTime: event.target.value })}/></OpsField><OpsField label="Details"><textarea value={eventDraft.details} onChange={(event) => setEventDraft({ ...eventDraft, details: event.target.value })} placeholder="Optional customer-safe detail"/></OpsField><OpsButton variant="primary" disabled={saving || !eventDraft.title.trim()}><Plus size={12}/>Publish update</OpsButton></div></form><div><div className="mb-3 flex items-center justify-between"><div><p className="ops-eyebrow">Timeline</p><h3 className="mt-1 text-[12px] font-bold text-[#514840]">Customer-visible events</h3></div><span className="text-[8px] text-[#9b9189]">{draft.events.length} events</span></div>{draft.events.length ? <div>{draft.events.map((event,index) => <div key={event.id} className="relative pb-4 pl-6 last:pb-0"><span className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${index === 0 ? "bg-[#e8755d]" : "bg-[#c8beb6]"}`}/>{index < draft.events.length - 1 ? <span className="absolute left-[3.5px] top-3.5 h-[calc(100%-4px)] w-px bg-[#e4ddd6]"/> : null}<div className="rounded-[12px] border border-[#e8e0d9] bg-white p-3.5"><div className="flex items-start justify-between gap-3"><div><strong className="text-[10px] text-[#514840]">{event.title}</strong>{event.location ? <p className="mt-1 flex items-center gap-1 text-[8px] text-[#8d837b]"><MapPin size={9}/>{event.location}</p> : null}</div><span className="text-[8px] text-[#9d938b]">{formatDate(event.event_time)}</span></div>{event.details ? <p className="mt-2 text-[9px] leading-5 text-[#776d65]">{event.details}</p> : null}<p className="mt-2 text-[8px] text-[#aaa098]">Published by {event.author_name}</p></div></div>)}</div> : <OpsEmptyState title="No tracking events" description="Publish the first customer-visible movement update here."/>}</div></div> : null}

      {activeTab === "documents" ? <div><div className="mb-4 flex items-start justify-between gap-3"><div><p className="ops-eyebrow">Document vault</p><h3 className="mt-1 text-[12px] font-bold text-[#514840]">Private shipment files</h3><p className="mt-1 text-[8px] text-[#91877f]">Admin-only files in Firebase Storage. They never appear on public tracking.</p></div><OpsBadge tone="success"><ShieldCheck size={10}/>Admin only</OpsBadge></div>{!documentStorageAvailable ? <OpsNotice tone="warning">Firebase Storage is unavailable for this deployment.</OpsNotice> : null}<form onSubmit={uploadDocument} className="grid gap-3 rounded-[13px] border border-[#e8e0d9] bg-[#faf7f4] p-4 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end"><OpsField label="Document type"><select name="documentType" defaultValue="other">{shipmentDocumentTypes.map((type) => <option value={type} key={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></OpsField><OpsField label="File" hint="PDF, image, Word, Excel, CSV or TXT · max 15 MB"><input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"/></OpsField><OpsButton variant="primary" disabled={documentSaving || !documentStorageAvailable}><Upload size={12}/>{documentSaving ? "Uploading…" : "Upload"}</OpsButton></form><div className="mt-4 divide-y divide-[#eee7e1]">{documentsLoading ? <p className="py-4 text-[9px] text-[#91877f]">Loading documents…</p> : documents.length ? documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><strong className="block truncate text-[10px] text-[#514840]">{document.filename}</strong><p className="mt-1 text-[8px] text-[#948a82]">{shipmentDocumentTypeLabels[document.document_type]} · {formatBytes(document.size_bytes)} · {document.uploaded_by} · {formatDate(document.uploaded_at)}</p></div><div className="flex gap-1.5"><a href={`/api/admin/shipments/${encodeURIComponent(draft.reference)}/documents/${document.id}`} className="ops-button" data-variant="secondary" data-size="sm"><Download size={10}/>Download</a><OpsButton variant="danger" size="sm" disabled={documentSaving} onClick={() => removeDocument(document)}><Trash2 size={10}/>Delete</OpsButton></div></div>) : <OpsEmptyState icon={<FileText size={17}/>} title="No documents uploaded" description="Add shipment documents here when the movement begins."/>}</div></div> : null}
    </div>
  </div>;
}

function Snapshot({label,value}:{label:string;value:string}) { return <div className="rounded-[11px] bg-[#faf7f4] px-3 py-2.5"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#9c928a]">{label}</p><p className="mt-1 truncate text-[9px] font-semibold text-[#5b524b]" title={value}>{value}</p></div>; }
