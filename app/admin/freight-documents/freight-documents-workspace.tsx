"use client";

import Link from "next/link";
import { FilePlus2, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { generatedFreightDocumentKinds, generatedFreightDocumentLabels, generatedReference, type FreightDocumentQueueRow, type GeneratedFreightDocumentKind } from "./freight-documents";

type Summary = { eligible: number; missing_primary: number; generated_current: number; review_pending: number };

type FormState = {
  kind: GeneratedFreightDocumentKind; shipper: string; consignee: string; notifyParty: string; cargoDescription: string; marksAndNumbers: string; packageType: string; freightTerms: string; placeOfReceipt: string; placeOfDelivery: string; masterReference: string; houseReference: string; incoterm: string; specialInstructions: string; customerSafe: boolean;
};

function formFor(row: FreightDocumentQueueRow): FormState {
  const kind = row.recommended_kinds[0] ?? "shipping_instruction";
  return { kind, shipper: "", consignee: "", notifyParty: "", cargoDescription: row.cargo_description, marksAndNumbers: "", packageType: row.pieces > 0 ? `${row.pieces} package(s)` : "", freightTerms: "", placeOfReceipt: row.origin, placeOfDelivery: row.destination, masterReference: row.booking_reference ?? "", houseReference: generatedReference(kind, row.reference), incoterm: "", specialInstructions: "", customerSafe: false };
}

export function FreightDocumentsWorkspace({ initialRows, initialSummary, initialShipment }: { initialRows: FreightDocumentQueueRow[]; initialSummary: Summary; initialShipment?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedReference, setSelectedReference] = useState(initialShipment && initialRows.some((row) => row.reference === initialShipment) ? initialShipment : initialRows[0]?.reference ?? "");
  const selected = useMemo(() => rows.find((row) => row.reference === selectedReference) ?? null, [rows, selectedReference]);
  const [form, setForm] = useState<FormState>(() => selected ? formFor(selected) : { kind: "shipping_instruction", shipper: "", consignee: "", notifyParty: "", cargoDescription: "", marksAndNumbers: "", packageType: "", freightTerms: "", placeOfReceipt: "", placeOfDelivery: "", masterReference: "", houseReference: "", incoterm: "", specialInstructions: "", customerSafe: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function choose(row: FreightDocumentQueueRow) { setSelectedReference(row.reference); setForm(formFor(row)); setMessage(""); }
  function patch<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function changeKind(kind: GeneratedFreightDocumentKind) { setForm((current) => ({ ...current, kind, houseReference: selected ? generatedReference(kind, selected.reference) : current.houseReference })); }

  async function refresh() {
    const response = await fetch("/api/admin/freight-documents", { cache: "no-store" });
    const data = await response.json() as { ok?: boolean; rows?: FreightDocumentQueueRow[]; summary?: Summary; error?: string };
    if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Could not refresh freight documents.");
    setRows(data.rows); setSummary(data.summary);
  }

  async function generate() {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/freight-documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference: selected.reference, ...form }) });
      const data = await response.json() as { ok?: boolean; error?: string; document?: { filename: string } };
      if (!response.ok || !data.ok) throw new Error(data.error || "Document generation failed.");
      await refresh();
      setMessage(`${data.document?.filename ?? "Freight document"} generated and placed in Document Vault for review.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Document generation failed."); }
    finally { setBusy(false); }
  }

  async function openDocument(reference: string, documentId: string) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/freight-documents?reference=${encodeURIComponent(reference)}&document=${encodeURIComponent(documentId)}`, { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !data.ok || !data.url) throw new Error(data.error || "Document could not be opened.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Document could not be opened."); }
  }

  return <main className="ops-content-wide py-5 text-[#423b36]">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="ops-eyebrow">Execution documents</p><h1 className="mt-1 text-[25px] font-[760] tracking-[-.04em]">Freight Documents</h1><p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#81776f]">Generate controlled KCPL carriage and execution PDFs from the Digital Job File. Generated carriage documents start as reviewable drafts and never impersonate carrier-issued master originals.</p></div><div className="flex gap-2"><button type="button" className="ops-button" data-variant="secondary" data-size="sm" onClick={() => refresh().catch((error) => setMessage(error.message))}><RefreshCw size={13}/>Refresh</button><Link href="/admin/documents" className="ops-button" data-variant="primary" data-size="sm">Document Vault</Link></div></div>

    <div className="mt-4 grid gap-2 sm:grid-cols-4">{[["Eligible jobs", summary.eligible], ["Missing carriage doc", summary.missing_primary], ["Current generated", summary.generated_current], ["Awaiting review", summary.review_pending]].map(([label, value]) => <div key={label} className="rounded-[12px] border border-[#e4ddd7] bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#918880]">{label}</p><strong className="mt-1 block text-[20px]">{value}</strong></div>)}</div>

    {message ? <div className="mt-4 rounded-[10px] border border-[#e8ddd2] bg-[#fffaf4] px-3 py-2 text-[10px] text-[#705e51]">{message}</div> : null}

    <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-[14px] border border-[#e2dbd5] bg-white p-2"><div className="px-2 py-2"><p className="ops-eyebrow">Shipment queue</p><p className="mt-1 text-[10px] text-[#857b73]">Booked and active Job Files available for document generation.</p></div><div className="max-h-[70vh] space-y-1 overflow-y-auto">{rows.map((row) => <button key={row.reference} type="button" onClick={() => choose(row)} className={`w-full rounded-[10px] border px-3 py-3 text-left ${row.reference === selectedReference ? "border-[#d8b9ac] bg-[#fff8f4]" : "border-transparent hover:bg-[#f8f5f2]"}`}><div className="flex items-center justify-between gap-2"><strong className="truncate text-[11px]">{row.reference}</strong>{row.missing_primary_carriage_document ? <span className="rounded-full bg-[#fff0e7] px-2 py-0.5 text-[8px] font-bold text-[#a86143]">carriage doc missing</span> : <span className="rounded-full bg-[#edf7ef] px-2 py-0.5 text-[8px] font-bold text-[#53745a]">generated</span>}</div><p className="mt-1 truncate text-[10px] text-[#736a63]">{row.customer_name}</p><p className="mt-1 text-[9px] text-[#948a82]">{row.origin} → {row.destination} · {row.mode.toUpperCase()} · {row.current_generated_count} current</p></button>)}</div></section>

      {selected ? <section className="rounded-[14px] border border-[#e2dbd5] bg-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="ops-eyebrow">{selected.reference}</p><h2 className="mt-1 text-[18px] font-[740]">Generate controlled freight document</h2><p className="mt-1 text-[10px] text-[#81776f]">{selected.customer_name} · {selected.origin} → {selected.destination} · {selected.mode.toUpperCase()}</p></div><Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Open Job File</Link></div>

        <div className="mt-4 rounded-[11px] border border-[#ead9cf] bg-[#fff9f5] p-3 text-[9px] leading-4 text-[#765d50]"><ShieldCheck size={13} className="mb-1"/>Generated PDFs are stored privately in Firebase Storage, SHA-256 hashed, revisioned and registered in Document Vault as <strong>Received</strong>. A new revision supersedes the previous generated revision.</div>

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
        <label className="mt-3 flex items-center gap-2 text-[10px] font-semibold"><input type="checkbox" checked={form.customerSafe} onChange={(event) => patch("customerSafe", event.target.checked)}/>Mark generated draft customer-safe after staff checks content</label>
        <button type="button" disabled={busy} onClick={generate} className="ops-button mt-4" data-variant="primary" data-size="md"><FilePlus2 size={14}/>{busy ? "Generating…" : "Generate PDF & register in Vault"}</button>

        <div className="mt-6 border-t border-[#ece5df] pt-4"><div className="flex items-center gap-2"><FileText size={14}/><h3 className="text-[12px] font-bold">Generated revisions</h3></div><div className="mt-2 space-y-2">{selected.generated_documents.length ? selected.generated_documents.map((doc) => <div key={doc.document_id} className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] border border-[#e7e0da] p-3"><div><strong className="text-[10px]">{doc.label} · R{doc.revision}</strong><p className="mt-1 text-[9px] text-[#887e76]">{doc.filename} · {doc.review_status}{doc.superseded ? " · superseded" : ""} · SHA {doc.sha256.slice(0, 12)}…</p></div><button type="button" className="ops-button" data-variant="secondary" data-size="sm" onClick={() => openDocument(selected.reference, doc.document_id)}>Open PDF</button></div>) : <p className="text-[10px] text-[#8a817a]">No generated freight documents yet.</p>}</div></div>
      </section> : <section className="grid min-h-80 place-items-center rounded-[14px] border border-[#e2dbd5] bg-white text-[11px] text-[#857b73]">No eligible shipment selected.</section>}
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-[.06em] text-[#817870]">{label}</span>{children}</label>; }
