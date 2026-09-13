"use client";

import Link from "next/link";
import { FilePlus2, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsNotice, OpsPage } from "../operations-ui";
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

const emptyForm: FormState = { kind: "shipping_instruction", shipper: "", consignee: "", notifyParty: "", cargoDescription: "", marksAndNumbers: "", packageType: "", freightTerms: "", placeOfReceipt: "", placeOfDelivery: "", masterReference: "", houseReference: "", incoterm: "", specialInstructions: "", customerSafe: false };

function formFor(row: FreightDocumentQueueRow): FormState {
  const kind = row.recommended_kinds[0] ?? "shipping_instruction";
  return { ...emptyForm, kind, cargoDescription: row.cargo_description, packageType: row.pieces > 0 ? `${row.pieces} package(s)` : "", placeOfReceipt: row.origin, placeOfDelivery: row.destination, masterReference: row.booking_reference ?? "", houseReference: generatedReference(kind, row.reference) };
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <div className="min-h-[108px] border-b border-[#D6D6D0] px-4 py-5 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-[10px] uppercase tracking-[0.07em] text-[#5B5B57]">{label}</p><strong className={`mt-4 block text-[32px] font-normal leading-none tracking-[-0.045em] ${alert && value ? "text-[#DC143C]" : "text-[#101010]"}`}>{value}</strong></div>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`grid gap-1.5 ${wide ? "md:col-span-2" : ""}`}><span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#666660]">{label}</span>{children}</label>;
}

function Step({ number, title, detail, children }: { number: string; title: string; detail: string; children: React.ReactNode }) {
  return <section className="border-t border-[#BEBEB7] py-5 first:border-t-0 first:pt-0"><div className="grid grid-cols-[42px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-[10px] font-medium text-[#DC143C]">{number}</span><div><h3 className="text-[15px] font-medium tracking-[-0.02em]">{title}</h3><p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#777771]">{detail}</p></div></div><div className="mt-4">{children}</div></section>;
}

export function FreightDocumentsWorkspace({ initialRows, initialSummary, initialShipment }: { initialRows: FreightDocumentQueueRow[]; initialSummary: Summary; initialShipment?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedReference, setSelectedReference] = useState(initialShipment && initialRows.some((row) => row.reference === initialShipment) ? initialShipment : initialRows[0]?.reference ?? "");
  const selected = useMemo(() => rows.find((row) => row.reference === selectedReference) ?? null, [rows, selectedReference]);
  const [form, setForm] = useState<FormState>(() => selected ? formFor(selected) : emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "danger">("success");

  function choose(row: FreightDocumentQueueRow) { setSelectedReference(row.reference); setForm(formFor(row)); setMessage(""); }
  function patch<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function changeKind(kind: GeneratedFreightDocumentKind) { setForm((current) => ({ ...current, kind, houseReference: selected ? generatedReference(kind, selected.reference) : current.houseReference })); }

  async function refresh(showNotice = true) {
    const response = await fetch("/api/admin/freight-documents", { cache: "no-store" });
    const data = await response.json() as { ok?: boolean; rows?: FreightDocumentQueueRow[]; summary?: Summary; error?: string };
    if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Could not refresh freight documents.");
    setRows(data.rows); setSummary(data.summary);
    if (showNotice) { setMessageTone("success"); setMessage("Freight document workspace refreshed."); }
  }

  async function generate() {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/freight-documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference: selected.reference, ...form }) });
      const data = await response.json() as { ok?: boolean; error?: string; document?: { filename: string } };
      if (!response.ok || !data.ok) throw new Error(data.error || "Document generation failed.");
      await refresh(false); setMessageTone("success"); setMessage(`${data.document?.filename ?? "Freight document"} generated and placed in Document Vault for review.`);
    } catch (error) { setMessageTone("danger"); setMessage(error instanceof Error ? error.message : "Document generation failed."); }
    finally { setBusy(false); }
  }

  async function openDocument(reference: string, documentId: string) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/freight-documents?reference=${encodeURIComponent(reference)}&document=${encodeURIComponent(documentId)}`, { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !data.ok || !data.url) throw new Error(data.error || "Document could not be opened.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) { setMessageTone("danger"); setMessage(error instanceof Error ? error.message : "Document could not be opened."); }
  }

  return <OpsPage><main className="min-h-[calc(100vh-64px)] bg-[#F6F6F3] text-[#101010]"><div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
    <header className="grid gap-6 border-b border-[#101010] pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><div><p className="text-[10px] uppercase tracking-[0.11em] text-[#DC143C]">Operations · Controlled documents</p><h1 className="mt-3 text-[clamp(36px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.04em]">Freight Documents</h1><p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#5B5B57]">Produce controlled KCPL carriage and execution documents from the Digital Job File, then pass each revision into the evidence vault for review.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => refresh().catch((error) => { setMessageTone("danger"); setMessage(error instanceof Error ? error.message : "Could not refresh freight documents."); })} className="inline-flex h-10 items-center gap-2 border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]"><RefreshCw size={13}/>Refresh</button><Link href="/admin/documents" className="inline-flex h-10 items-center border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white hover:border-[#B61032] hover:bg-[#B61032]">Document Vault</Link></div></header>

    <section className="grid border-b border-[#D6D6D0] sm:grid-cols-4"><Metric label="Eligible jobs" value={summary.eligible}/><Metric label="Missing carriage doc" value={summary.missing_primary} alert/><Metric label="Current generated" value={summary.generated_current}/><Metric label="Awaiting review" value={summary.review_pending} alert/></section>
    {message ? <div className="mt-5"><OpsNotice tone={messageTone} onDismiss={() => setMessage("")}>{message}</OpsNotice></div> : null}

    <section className="mt-6 grid min-h-[760px] border-y border-[#D6D6D0] xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside className="border-b border-[#D6D6D0] xl:border-b-0 xl:border-r"><div className="border-b border-[#101010] py-4 pr-4"><p className="text-[10px] uppercase tracking-[0.07em] text-[#5B5B57]">Production queue</p><h2 className="mt-1 text-[20px] font-normal tracking-[-0.03em]">Eligible Job Files</h2></div><div className="max-h-[760px] overflow-y-auto">{rows.length ? rows.map((row) => { const active = row.reference === selectedReference; return <button key={row.reference} type="button" onClick={() => choose(row)} className={`relative w-full border-b border-[#D6D6D0] px-4 py-4 text-left transition hover:bg-[#EEEEE8] ${active ? "bg-[#EEEEE8]" : ""}`}>{active ? <span className="absolute bottom-2 left-0 top-2 w-[2px] bg-[#DC143C]"/> : null}<div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-[12px] font-medium">{row.reference}</strong><p className="mt-1 truncate text-[11px] text-[#5B5B57]">{row.customer_name}</p></div>{row.missing_primary_carriage_document ? <OpsBadge tone="warning">Missing</OpsBadge> : <OpsBadge tone="success">Generated</OpsBadge>}</div><p className="mt-2 text-[10px] text-[#777771]">{row.origin} → {row.destination}</p><p className="mt-1 text-[9px] uppercase tracking-[0.05em] text-[#8A8A84]">{row.mode} · {row.current_generated_count} current revision{row.current_generated_count === 1 ? "" : "s"}</p></button>; }) : <OpsEmptyState title="No eligible Job Files" description="Booked and active shipments will appear here when document generation is available."/>}</div></aside>

      <div className="min-w-0 px-5 py-6 sm:px-7">{selected ? <>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#BEBEB7] pb-5"><div><p className="text-[10px] uppercase tracking-[0.07em] text-[#777771]">{selected.reference}</p><h2 className="mt-2 text-[28px] font-normal tracking-[-0.035em]">Document production</h2><p className="mt-2 text-[12px] text-[#5B5B57]">{selected.customer_name} · {selected.origin} → {selected.destination} · {selected.mode.toUpperCase()}</p></div><Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}`} className="border-b border-[#101010] pb-0.5 text-[11px] hover:border-[#DC143C] hover:text-[#DC143C]">Open Job File</Link></div>
        <div className="my-5 border-l-2 border-[#DC143C] bg-[#EEEEE8] px-4 py-3 text-[11px] leading-5 text-[#5B5B57]"><div className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#DC143C]"/><p>KCPL-generated PDFs are controlled internal/house drafts. They do not replace or impersonate carrier-issued master originals. Each generated file is privately stored, hashed, revisioned and sent to Document Vault for review.</p></div></div>

        <Step number="01" title="Document" detail="Choose the controlled document type and establish the house/internal reference."><div className="grid gap-3 md:grid-cols-2"><Field label="Document type"><select className="ops-input" value={form.kind} onChange={(event) => changeKind(event.target.value as GeneratedFreightDocumentKind)}>{generatedFreightDocumentKinds.filter((kind) => selected.recommended_kinds.includes(kind)).map((kind) => <option key={kind} value={kind}>{generatedFreightDocumentLabels[kind]}</option>)}</select></Field><Field label="House / internal reference"><input className="ops-input" value={form.houseReference} onChange={(event) => patch("houseReference", event.target.value)}/></Field></div></Step>
        <Step number="02" title="Parties & cargo" detail="Capture the legal parties and shipment description used in the controlled draft."><div className="grid gap-3 md:grid-cols-2"><Field label="Shipper"><textarea className="ops-input min-h-20" value={form.shipper} onChange={(event) => patch("shipper", event.target.value)} placeholder="Legal shipper/exporter name and address"/></Field><Field label="Consignee"><textarea className="ops-input min-h-20" value={form.consignee} onChange={(event) => patch("consignee", event.target.value)} placeholder="Legal consignee/importer name and address"/></Field><Field label="Notify party"><textarea className="ops-input min-h-16" value={form.notifyParty} onChange={(event) => patch("notifyParty", event.target.value)}/></Field><Field label="Cargo description"><textarea className="ops-input min-h-16" value={form.cargoDescription} onChange={(event) => patch("cargoDescription", event.target.value)}/></Field><Field label="Marks & numbers"><input className="ops-input" value={form.marksAndNumbers} onChange={(event) => patch("marksAndNumbers", event.target.value)}/></Field><Field label="Package type"><input className="ops-input" value={form.packageType} onChange={(event) => patch("packageType", event.target.value)}/></Field></div></Step>
        <Step number="03" title="Carriage terms" detail="Set receipt/delivery places, references and commercial carriage instructions."><div className="grid gap-3 md:grid-cols-2"><Field label="Place of receipt"><input className="ops-input" value={form.placeOfReceipt} onChange={(event) => patch("placeOfReceipt", event.target.value)}/></Field><Field label="Place of delivery"><input className="ops-input" value={form.placeOfDelivery} onChange={(event) => patch("placeOfDelivery", event.target.value)}/></Field><Field label="Carrier / master reference"><input className="ops-input" value={form.masterReference} onChange={(event) => patch("masterReference", event.target.value)}/></Field><Field label="Freight terms"><input className="ops-input" value={form.freightTerms} onChange={(event) => patch("freightTerms", event.target.value)} placeholder="Prepaid / collect / as agreed"/></Field><Field label="Incoterm"><input className="ops-input" value={form.incoterm} onChange={(event) => patch("incoterm", event.target.value)} placeholder="e.g. FOB, CIF, DDP"/></Field><Field label="Special instructions"><textarea className="ops-input min-h-16" value={form.specialInstructions} onChange={(event) => patch("specialInstructions", event.target.value)}/></Field></div></Step>
        <Step number="04" title="Generate & review" detail="Create the next controlled PDF revision and inspect the revision trail before customer-facing use."><label className="flex items-center gap-2 text-[11px] text-[#5B5B57]"><input type="checkbox" checked={form.customerSafe} onChange={(event) => patch("customerSafe", event.target.checked)}/>Mark generated draft customer-safe after staff checks content</label><button type="button" disabled={busy} onClick={generate} className="mt-4 inline-flex h-11 items-center gap-2 border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white hover:border-[#B61032] hover:bg-[#B61032] disabled:opacity-50"><FilePlus2 size={14}/>{busy ? "Generating…" : "Generate PDF & register in Vault"}</button>
          <div className="mt-6 border-t border-[#101010]"><div className="flex items-center gap-2 py-4"><FileText size={14}/><h3 className="text-[14px] font-medium">Revision history</h3></div>{selected.generated_documents.length ? <div>{selected.generated_documents.map((doc) => <div key={doc.document_id} className="grid gap-3 border-t border-[#D6D6D0] py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-[11px] font-medium">R{doc.revision} · {doc.label}</strong><OpsBadge tone={doc.superseded ? "neutral" : doc.review_status === "verified" ? "success" : "warning"}>{doc.superseded ? "Superseded" : doc.review_status.replaceAll("_", " ")}</OpsBadge></div><p className="mt-1 truncate text-[10px] text-[#777771]">{doc.filename} · SHA {doc.sha256.slice(0, 12)}…</p></div><button type="button" className="border-b border-[#101010] pb-0.5 text-[11px] hover:border-[#DC143C] hover:text-[#DC143C]" onClick={() => openDocument(selected.reference, doc.document_id)}>Open PDF</button></div>)}</div> : <div className="border-t border-[#D6D6D0] py-6 text-[12px] text-[#777771]">No generated revisions yet.</div>}</div>
        </Step>
      </> : <div className="grid min-h-[500px] place-items-center"><OpsEmptyState title="Choose a Job File" description="Select an eligible shipment from the production queue."/></div>}</div>
    </section>
  </div></main></OpsPage>;
}
