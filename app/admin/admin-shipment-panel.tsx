"use client";

import { FormEvent, useEffect, useState } from "react";
import {
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
import { OpsButton, OpsEmptyState, OpsErrorState, OpsMetric, OpsMetricStrip, OpsPanel, OpsStatusBadge } from "./operations-ui";

const shipmentTabs = ["details", "tracking", "documents"] as const;
type ShipmentTab = (typeof shipmentTabs)[number];

function statusTone(status: ShipmentStatus): "neutral" | "info" | "success" | "warning" | "danger" | "accent" {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance" || status === "preparing") return "warning";
  if (status === "in_transit") return "accent";
  if (status === "booking_confirmed" || status === "out_for_delivery") return "info";
  return "neutral";
}

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

export function AdminShipmentPanel({ shipment, quoteStatus, onShipmentChange, onNotice }: {
  shipment: ShipmentDetail | null;
  quoteStatus: QuoteStatus;
  onShipmentChange: (shipment: ShipmentDetail) => void;
  onNotice: (message: string) => void;
}) {
  if (!shipment) {
    if (quoteStatus !== "won") return null;
    return <OpsPanel title="Shipment record is being prepared" eyebrow="Operations" description="Save the Won workflow or reload this enquiry. KCPL creates the tracking reference automatically." action={<OpsStatusBadge tone="success"><Truck size={10}/>Won quote</OpsStatusBadge>}/>;
  }

  return <ShipmentWorkspace key={shipment.reference} initialShipment={shipment} onShipmentChange={onShipmentChange} onNotice={onNotice}/>;
}

function ShipmentWorkspace({ initialShipment, onShipmentChange, onNotice }: {
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
        console.warn("Shipment documents unavailable", error);
        onNotice("Shipment documents are temporarily unavailable. Shipment data is unaffected.");
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
    } finally { setSaving(false); }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setDocumentSaving(true);
    onNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(draft.reference)}/documents`, { method: "POST", body: new FormData(form) });
      const data = await response.json() as { document?: ShipmentDocument; error?: string };
      if (!response.ok || !data.document) throw new Error(data.error || "Could not upload the document.");
      setDocuments((current) => [data.document!, ...current]);
      setDocumentStorageAvailable(true);
      form.reset();
      onNotice(`${data.document.filename} uploaded to the private shipment vault.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not upload the document.");
    } finally { setDocumentSaving(false); }
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
    } finally { setDocumentSaving(false); }
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
    } finally { setSaving(false); }
  }

  return <OpsPanel
    title={draft.reference}
    eyebrow="Shipment operations"
    description={`Won quote ${draft.quote_reference}`}
    action={<div className="flex flex-wrap items-center gap-2"><OpsStatusBadge tone={statusTone(draft.status)}>{shipmentStatusLabels[draft.status]}</OpsStatusBadge><OpsButton href={`/admin/jobs/${encodeURIComponent(draft.reference)}`} tone="primary">Digital Job File <ExternalLink size={11}/></OpsButton><OpsButton href={`/tracking?reference=${encodeURIComponent(draft.reference)}`}>Public tracking <ExternalLink size={11}/></OpsButton></div>}
  >
    <OpsMetricStrip columns={4}>
      <OpsMetric label="Status" value={<span className="text-[14px]">{shipmentStatusLabels[draft.status]}</span>}/>
      <OpsMetric label="Current location" value={<span className="text-[14px]">{draft.current_location || "Not set"}</span>} icon={<MapPin size={12}/>}/>
      <OpsMetric label="ETA" value={<span className="text-[14px]">{draft.eta ? formatDateOnly(draft.eta) : "Not set"}</span>} icon={<Clock3 size={12}/>}/>
      <OpsMetric label="Carrier" value={<span className="text-[14px]">{draft.carrier || "Not set"}</span>}/>
    </OpsMetricStrip>

    <nav className="flex overflow-x-auto border-b border-[#eceef0] px-2" aria-label="Shipment sections">
      {shipmentTabs.map((tab) => {
        const count = tab === "tracking" ? draft.events.length : tab === "documents" ? documents.length : undefined;
        const active = activeTab === tab;
        return <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`relative flex h-10 items-center gap-1.5 px-3 text-[11px] font-medium capitalize ${active ? "text-[#303a75]" : "text-[#737b84] hover:text-[#333940]"}`}>{tab}{count !== undefined ? <span className={`rounded px-1.5 py-0.5 text-[9px] ${active ? "bg-[#eef0ff] text-[#5367a8]" : "bg-[#f1f2f3] text-[#8c939b]"}`}>{count}</span> : null}{active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-[#5367d9]"/> : null}</button>;
      })}
    </nav>

    <div className="p-4">
      {activeTab === "details" ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={saveShipment} className="grid gap-3 sm:grid-cols-2">
          <Field label="Shipment status"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ShipmentStatus })}>{shipmentStatuses.map((status) => <option value={status} key={status}>{shipmentStatusLabels[status]}</option>)}</select></Field>
          <Field label="ETA"><input type="date" value={draft.eta ?? ""} onChange={(event) => setDraft({ ...draft, eta: event.target.value })}/></Field>
          <Field label="Current location"><input value={draft.current_location ?? ""} onChange={(event) => setDraft({ ...draft, current_location: event.target.value })} placeholder="Kathmandu, Nepal" maxLength={180}/></Field>
          <Field label="Carrier / line"><input value={draft.carrier ?? ""} onChange={(event) => setDraft({ ...draft, carrier: event.target.value })} placeholder="Airline, shipping line or road carrier" maxLength={160}/></Field>
          <Field label="Carrier reference" hint="AWB, BL, container or carrier reference"><input value={draft.carrier_reference ?? ""} onChange={(event) => setDraft({ ...draft, carrier_reference: event.target.value })} placeholder="Reference" maxLength={160}/></Field>
          <div className="sm:col-span-2"><Field label="Customer status note"><textarea rows={4} value={draft.customer_note ?? ""} onChange={(event) => setDraft({ ...draft, customer_note: event.target.value })} placeholder="Short customer-safe update shown on tracking…" maxLength={2000}/></Field></div>
          <div className="sm:col-span-2 flex justify-end"><OpsButton tone="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save shipment"}</OpsButton></div>
        </form>

        <div className="h-fit rounded-lg border border-[#e2e5e8] bg-[#fafafa] p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#858c94]">Customer tracking view</p>
          <div className="mt-3 flex flex-wrap gap-1.5"><OpsStatusBadge tone={statusTone(draft.status)}>{shipmentStatusLabels[draft.status]}</OpsStatusBadge></div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#626a73]"><MapPin size={11}/>{draft.current_location || "Location not set"}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#626a73]"><Clock3 size={11}/>{draft.eta ? `ETA ${formatDateOnly(draft.eta)}` : "ETA not set"}</p>
          {draft.customer_note ? <p className="mt-3 border-t border-[#e3e5e8] pt-3 text-[10px] leading-5 text-[#737b84]">{draft.customer_note}</p> : null}
        </div>
      </div> : null}

      {activeTab === "tracking" ? <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <form onSubmit={addEvent} className="h-fit rounded-lg border border-[#e2e5e8] bg-[#fafafa] p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#858c94]">New public update</p><h3 className="mt-1 text-xs font-semibold text-[#30363d]">Publish tracking event</h3>
          <div className="mt-3 space-y-3"><Field label="Event title"><input value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} placeholder="Departed origin facility" maxLength={180}/></Field><Field label="Location"><input value={eventDraft.location} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} placeholder="Birgunj, Nepal" maxLength={180}/></Field><Field label="Event time" hint="Leave blank to use current time"><input type="datetime-local" value={eventDraft.eventTime} onChange={(event) => setEventDraft({ ...eventDraft, eventTime: event.target.value })}/></Field><Field label="Details"><textarea rows={3} value={eventDraft.details} onChange={(event) => setEventDraft({ ...eventDraft, details: event.target.value })} placeholder="Optional customer-safe detail" maxLength={2000}/></Field><OpsButton tone="primary" type="submit" disabled={saving || !eventDraft.title.trim()}><Plus size={12}/>Publish update</OpsButton></div>
        </form>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#858c94]">Tracking timeline</p><h3 className="mt-1 text-xs font-semibold text-[#30363d]">Customer-visible events</h3></div><span className="text-[10px] text-[#9299a0]">{draft.events.length} events</span></div>
          {draft.events.length ? <div>{draft.events.map((event, index) => <div key={event.id} className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-3"><div className="flex flex-col items-center"><span className={`mt-3 h-2 w-2 rounded-full ${index === 0 ? "bg-[#6878c5]" : "bg-[#c1c6cc]"}`}/>{index < draft.events.length - 1 ? <span className="min-h-10 w-px flex-1 bg-[#e3e5e8]"/> : null}</div><div className="pb-3"><div className="rounded-lg border border-[#e3e5e8] bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[11px] font-semibold text-[#343a40]">{event.title}</p>{event.location ? <p className="mt-1 flex items-center gap-1 text-[10px] text-[#737b84]"><MapPin size={10}/>{event.location}</p> : null}</div><p className="text-[9px] text-[#969da4]">{formatDate(event.event_time)}</p></div>{event.details ? <p className="mt-2 text-[10px] leading-5 text-[#626a73]">{event.details}</p> : null}<p className="mt-2 text-[9px] text-[#9aa1a8]">Published by {event.author_name}</p></div></div></div>)}</div> : <OpsEmptyState compact title="No tracking events" detail="Publish the first customer-visible update using the form."/>}
        </div>
      </div> : null}

      {activeTab === "documents" ? <div>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#858c94]">Document vault</p><p className="mt-1 text-[10px] text-[#7d858d]">Private Firebase Storage files. They never appear on public tracking.</p></div><OpsStatusBadge tone="success"><ShieldCheck size={10}/>Admin only</OpsStatusBadge></div>
        {!documentStorageAvailable ? <OpsErrorState tone="warning" title="Document storage unavailable" detail="Shipment data remains safe. Uploads and downloads will resume when Firebase Storage is available."/> : null}
        <form onSubmit={uploadDocument} className="grid gap-3 rounded-lg border border-[#e3e5e8] bg-[#fafafa] p-3.5 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end"><Field label="Document type"><select name="documentType" defaultValue="other">{shipmentDocumentTypes.map((type) => <option value={type} key={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></Field><Field label="File" hint="PDF, image, Word, Excel, CSV or TXT · max 15 MB"><input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"/></Field><OpsButton tone="primary" type="submit" disabled={documentSaving || !documentStorageAvailable}><Upload size={12}/>{documentSaving ? "Uploading…" : "Upload"}</OpsButton></form>
        <div className="mt-3 overflow-hidden rounded-lg border border-[#e3e5e8]">
          {documentsLoading ? <div className="p-4 text-[11px] text-[#87919a]">Loading shipment documents…</div> : null}
          {!documentsLoading && !documents.length ? <OpsEmptyState compact title="No shipment documents" detail="Upload customs, transport or commercial documents when they become available."/> : null}
          {documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f2] p-3 last:border-b-0"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#343a40]">{document.filename}</p><p className="mt-1 text-[9px] text-[#8d949b]">{shipmentDocumentTypeLabels[document.document_type]} · {formatBytes(document.size_bytes)} · {document.uploaded_by} · {formatDate(document.uploaded_at)}</p></div><div className="flex items-center gap-1.5"><a href={`/api/admin/shipments/${encodeURIComponent(draft.reference)}/documents/${document.id}`} className="ops-button ops-button-secondary"><Download size={11}/>Download</a><OpsButton tone="danger" disabled={documentSaving} onClick={() => void removeDocument(document)}><Trash2 size={11}/>Delete</OpsButton></div></div>)}
        </div>
      </div> : null}
    </div>
  </OpsPanel>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}{hint ? <span className="mt-1 block text-[9px] text-[#9aa2a9]">{hint}</span> : null}</label>;
}
