"use client";

import Link from "next/link";
import { FilePlus2, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsStat,
  OpsStatStrip,
  OpsSurface,
} from "../operations-ui";
import { generatedFreightDocumentKinds, generatedFreightDocumentLabels, generatedReference, type FreightDocumentQueueRow, type GeneratedFreightDocumentKind } from "./freight-documents";

type Summary = { eligible: number; missing_primary: number; generated_current: number; review_pending: number };

type FormState = {
  kind: GeneratedFreightDocumentKind;
  shipper: string;
  consignee: string;
  notifyParty: string;
  cargoDescription: string;
  marksAndNumbers: string;
  packageType: string;
  freightTerms: string;
  placeOfReceipt: string;
  placeOfDelivery: string;
  masterReference: string;
  houseReference: string;
  incoterm: string;
  specialInstructions: string;
  customerSafe: boolean;
};

function formFor(row: FreightDocumentQueueRow): FormState {
  const kind = row.recommended_kinds[0] ?? "shipping_instruction";
  return {
    kind,
    shipper: "",
    consignee: "",
    notifyParty: "",
    cargoDescription: row.cargo_description,
    marksAndNumbers: "",
    packageType: row.pieces > 0 ? `${row.pieces} package(s)` : "",
    freightTerms: "",
    placeOfReceipt: row.origin,
    placeOfDelivery: row.destination,
    masterReference: row.booking_reference ?? "",
    houseReference: generatedReference(kind, row.reference),
    incoterm: "",
    specialInstructions: "",
    customerSafe: false,
  };
}

export function FreightDocumentsWorkspace({ initialRows, initialSummary, initialShipment }: { initialRows: FreightDocumentQueueRow[]; initialSummary: Summary; initialShipment?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedReference, setSelectedReference] = useState(initialShipment && initialRows.some((row) => row.reference === initialShipment) ? initialShipment : initialRows[0]?.reference ?? "");
  const selected = useMemo(() => rows.find((row) => row.reference === selectedReference) ?? null, [rows, selectedReference]);
  const [form, setForm] = useState<FormState>(() => selected ? formFor(selected) : { kind: "shipping_instruction", shipper: "", consignee: "", notifyParty: "", cargoDescription: "", marksAndNumbers: "", packageType: "", freightTerms: "", placeOfReceipt: "", placeOfDelivery: "", masterReference: "", houseReference: "", incoterm: "", specialInstructions: "", customerSafe: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "danger">("success");

  function choose(row: FreightDocumentQueueRow) {
    setSelectedReference(row.reference);
    setForm(formFor(row));
    setMessage("");
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeKind(kind: GeneratedFreightDocumentKind) {
    setForm((current) => ({ ...current, kind, houseReference: selected ? generatedReference(kind, selected.reference) : current.houseReference }));
  }

  async function refresh(showNotice = true) {
    const response = await fetch("/api/admin/freight-documents", { cache: "no-store" });
    const data = await response.json() as { ok?: boolean; rows?: FreightDocumentQueueRow[]; summary?: Summary; error?: string };
    if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Could not refresh freight documents.");
    setRows(data.rows);
    setSummary(data.summary);
    if (showNotice) {
      setMessageTone("success");
      setMessage("Freight document workspace refreshed.");
    }
  }

  async function generate() {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/freight-documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: selected.reference, ...form }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; document?: { filename: string } };
      if (!response.ok || !data.ok) throw new Error(data.error || "Document generation failed.");
      await refresh(false);
      setMessageTone("success");
      setMessage(`${data.document?.filename ?? "Freight document"} generated and placed in Document Vault for review.`);
    } catch (error) {
      setMessageTone("danger");
      setMessage(error instanceof Error ? error.message : "Document generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(reference: string, documentId: string) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/freight-documents?reference=${encodeURIComponent(reference)}&document=${encodeURIComponent(documentId)}`, { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !data.ok || !data.url) throw new Error(data.error || "Document could not be opened.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessageTone("danger");
      setMessage(error instanceof Error ? error.message : "Document could not be opened.");
    }
  }

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Execution documents"
      title="Freight Documents"
      description="Generate controlled KCPL carriage and execution PDFs from the Digital Job File. Generated carriage documents start as reviewable drafts and never impersonate carrier-issued master originals."
      actions={<div className="flex flex-wrap gap-2"><OpsButton size="sm" onClick={() => refresh().catch((error) => { setMessageTone("danger"); setMessage(error instanceof Error ? error.message : "Could not refresh freight documents."); })}><RefreshCw size={13}/>Refresh</OpsButton><Link href="/admin/documents" className="ops-button" data-variant="primary" data-size="sm">Document Vault</Link></div>}
    />

    <OpsStatStrip>
      <OpsStat label="Eligible jobs" value={summary.eligible}/>
      <OpsStat label="Missing carriage doc" value={summary.missing_primary} tone={summary.missing_primary ? "warning" : "neutral"}/>
      <OpsStat label="Current generated" value={summary.generated_current} tone="success"/>
      <OpsStat label="Awaiting review" value={summary.review_pending} tone={summary.review_pending ? "warning" : "neutral"}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {message ? <OpsNotice tone={messageTone} onDismiss={() => setMessage("")}>{message}</OpsNotice> : null}

      <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
        <OpsSurface eyebrow="Shipment queue" title="Eligible Job Files" description="Booked and active Job Files available for controlled document generation." bodyClassName="ops-surface-body-flush">
          <div className="max-h-[720px] overflow-y-auto">
            {rows.length ? rows.map((row) => {
              const isSelected = row.reference === selectedReference;
              return <button key={row.reference} type="button" onClick={() => choose(row)} className="ops-record-row relative w-full border-b px-4 py-3 text-left" data-selected={isSelected ? "true" : undefined}>
                <div className="flex items-center justify-between gap-2"><strong className="truncate text-[12px] font-semibold text-[#141414]">{row.reference}</strong>{row.missing_primary_carriage_document ? <OpsBadge tone="warning">Carriage doc missing</OpsBadge> : <OpsBadge tone="success">Generated</OpsBadge>}</div>
                <p className="mt-1 truncate text-[11px] font-medium text-[#5b5b5b]">{row.customer_name}</p>
                <p className="mt-1 text-[10px] text-[#737373]">{row.origin} → {row.destination} · {row.mode.toUpperCase()} · {row.current_generated_count} current</p>
              </button>;
            }) : <OpsEmptyState title="No eligible Job Files" description="Booked and active shipments will appear when they are eligible for document generation."/>}
          </div>
        </OpsSurface>

        {selected ? <OpsSurface eyebrow={selected.reference} title="Generate controlled freight document" description={`${selected.customer_name} · ${selected.origin} → ${selected.destination} · ${selected.mode.toUpperCase()}`} action={<Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Open Job File</Link>}>
          <div className="border border-[#ead9ae] bg-[#fffaf0] p-3 text-[11px] leading-[17px] text-[#945b00]"><div className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0"/><p>Generated PDFs are stored privately in Firebase Storage, SHA-256 hashed, revisioned and registered in Document Vault as <strong>Received</strong>. A new revision supersedes the previous generated revision.</p></div></div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Document type"><select className="ops-input" value={form.kind} onChange={(event) => changeKind(event.target.value as GeneratedFreightDocumentKind)}>{generatedFreightDocumentKinds.filter((kind) => selected.recommended_kinds.includes(kind)).map((kind) => <option key={kind} value={kind}>{generatedFreightDocumentLabels[kind]}</option>)}</select></Field>
            <Field label="House / internal reference"><input className="ops-input" value={form.houseReference} onChange={(event) => patch("houseReference", event.target.value)}/></Field>
            <Field label="Shipper"><textarea className="ops-input min-h-20" value={form.shipper} onChange={(event) => patch("shipper", event.target.value)} placeholder="Legal shipper/exporter name and address"/></Field>
            <Field label="Consignee"><textarea className="ops-input min-h-20" value={form.consignee} onChange={(event) => patch("consignee", event.target.value)} placeholder="Legal consignee/importer name and address"/></Field>
            <Field label="Notify party"><textarea className="ops-input min-h-16" value={form.notifyParty} onChange={(event) => patch("notifyParty", event.target.value)}/></Field>
            <Field label="Cargo description"><textarea className="ops-input min-h-16" value={form.cargoDescription} onChange={(event) => patch("cargoDescription", event.target.value)}/></Field>
            <Field label="Marks & numbers"><input className="ops-input" value={form.marksAndNumbers} onChange={(event) => patch("marksAndNumbers", event.target.value)}/></Field>
            <Field label="Package type"><input className="ops-input" value={form.packageType} onChange={(event) => patch("packageType", event.target.value)}/></Field>
            <Field label="Place of receipt"><input className="ops-input" value={form.placeOfReceipt} onChange={(event) => patch("placeOfReceipt", event.target.value)}/></Field>
            <Field label="Place of delivery"><input className="ops-input" value={form.placeOfDelivery} onChange={(event) => patch("placeOfDelivery", event.target.value)}/></Field>
            <Field label="Carrier / master reference"><input className="ops-input" value={form.masterReference} onChange={(event) => patch("masterReference", event.target.value)}/></Field>
            <Field label="Freight terms"><input className="ops-input" value={form.freightTerms} onChange={(event) => patch("freightTerms", event.target.value)} placeholder="Prepaid / collect / as agreed"/></Field>
            <Field label="Incoterm"><input className="ops-input" value={form.incoterm} onChange={(event) => patch("incoterm", event.target.value)} placeholder="e.g. FOB, CIF, DDP"/></Field>
            <Field label="Special instructions"><textarea className="ops-input min-h-16" value={form.specialInstructions} onChange={(event) => patch("specialInstructions", event.target.value)}/></Field>
          </div>

          <label className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[#5b5b5b]"><input type="checkbox" checked={form.customerSafe} onChange={(event) => patch("customerSafe", event.target.checked)}/>Mark generated draft customer-safe after staff checks content</label>
          <button type="button" disabled={busy} onClick={generate} className="ops-button mt-4" data-variant="primary" data-size="md"><FilePlus2 size={14}/>{busy ? "Generating…" : "Generate PDF & register in Vault"}</button>

          <div className="mt-6 border-t border-[#e2e2e2] pt-4">
            <div className="flex items-center gap-2"><FileText size={14}/><h3 className="text-[13px] font-semibold">Generated revisions</h3></div>
            <div className="mt-3 border-t border-[#e2e2e2]">{selected.generated_documents.length ? selected.generated_documents.map((doc) => <div key={doc.document_id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e2e2] bg-white px-3 py-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-[11px] font-semibold">{doc.label} · R{doc.revision}</strong><OpsBadge tone={doc.superseded ? "neutral" : doc.review_status === "verified" ? "success" : "warning"}>{doc.superseded ? "Superseded" : doc.review_status.replaceAll("_", " ")}</OpsBadge></div><p className="mt-1 truncate text-[10px] text-[#737373]">{doc.filename} · SHA {doc.sha256.slice(0, 12)}…</p></div><button type="button" className="ops-button" data-variant="secondary" data-size="sm" onClick={() => openDocument(selected.reference, doc.document_id)}>Open PDF</button></div>) : <OpsEmptyState compact title="No generated freight documents" description="Generate the first controlled revision from the fields above."/>}</div>
          </div>
        </OpsSurface> : <OpsSurface eyebrow="Shipment queue" title="No eligible shipment selected"><OpsEmptyState title="Choose a Job File" description="Select an eligible shipment from the queue to generate controlled freight documents."/></OpsSurface>}
      </div>
    </div>
  </OpsPage>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="ops-field block"><span className="ops-field-label block">{label}</span>{children}</label>;
}
