"use client";

import { FormEvent, useRef, useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import {
  crmCustomerDocumentTypeLabels,
  crmCustomerDocumentTypes,
  type CrmCustomerDocument,
  type CrmCustomerDocumentType,
} from "../crm-customer-document-types";
import type { StaffCapabilities } from "../../staff-permissions";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function CrmCustomerDocumentsPanel({
  customerId,
  initialDocuments,
  storageAvailable,
  permissions,
}: {
  customerId: string;
  initialDocuments: CrmCustomerDocument[];
  storageAvailable: boolean;
  permissions: StaffCapabilities;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentType, setDocumentType] = useState<CrmCustomerDocumentType>("kyc");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setNotice("Choose a file first.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("documentType", documentType);
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customerId)}/documents`, { method: "POST", body: form });
      const data = await response.json() as { ok?: boolean; document?: CrmCustomerDocument; error?: string };
      if (!response.ok || !data.document) throw new Error(data.error || "Document could not be uploaded.");
      setDocuments((current) => [data.document!, ...current]);
      if (fileRef.current) fileRef.current.value = "";
      setNotice("Document uploaded to the customer vault.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Document could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(document: CrmCustomerDocument) {
    if (!window.confirm(`Delete ${document.filename} from this customer vault?`)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customerId)}/documents/${document.id}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Document could not be deleted.");
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setNotice("Document deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Document could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  if (!permissions.canManageCustomerDocuments) return null;

  return (
    <section className="bg-[#f4f1e9] px-5 pb-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] rounded-[28px] border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b78a3e]">Permanent account files</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-.035em]">Customer document vault</h2>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-black/45">Keep KYC, PAN/VAT, contracts, credit agreements, standing instructions and rate sheets against the customer, separate from shipment documents.</p>
        </div>

        {!storageAvailable ? <div className="mx-6 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 sm:mx-8">Firebase Storage is not available for this deployment. Metadata can load, but new customer documents cannot be uploaded.</div> : null}
        {notice ? <div className="mx-6 mt-5 rounded-xl bg-[#fff8e8] px-4 py-3 text-xs font-bold text-[#6d5427] sm:mx-8">{notice}</div> : null}

        <form onSubmit={upload} className="mx-6 mt-5 grid gap-3 rounded-2xl border border-black/10 bg-[#faf9f5] p-4 sm:mx-8 md:grid-cols-[220px_1fr_auto] md:items-end">
          <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.13em] text-black/40">Document type</span><select className="crm360-input" value={documentType} onChange={(event) => setDocumentType(event.target.value as CrmCustomerDocumentType)}>{crmCustomerDocumentTypes.map((type) => <option key={type} value={type}>{crmCustomerDocumentTypeLabels[type]}</option>)}</select></label>
          <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.13em] text-black/40">File · max 15 MB</span><input ref={fileRef} type="file" className="block w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" /></label>
          <button type="submit" disabled={busy || !storageAvailable} className="flex items-center justify-center gap-2 rounded-xl bg-[#10263f] px-4 py-3 text-xs font-black text-white disabled:opacity-50"><Upload size={14} />{busy ? "Working…" : "Upload"}</button>
        </form>

        <div className="p-6 sm:p-8">
          {documents.length ? <div className="divide-y divide-black/10 rounded-2xl border border-black/10">{documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#10263f] text-white"><FileText size={16} /></div><div className="min-w-0"><strong className="block truncate text-sm">{document.filename}</strong><p className="mt-1 text-[10px] font-bold text-black/40">{crmCustomerDocumentTypeLabels[document.document_type]} · {formatBytes(document.size_bytes)} · {formatDate(document.uploaded_at)} · {document.uploaded_by}</p></div></div>
            <div className="flex gap-2"><a href={`/api/admin/crm/customers/${encodeURIComponent(customerId)}/documents/${document.id}`} className="flex items-center gap-1 rounded-lg border border-black/10 bg-[#faf9f5] px-2.5 py-2 text-[9px] font-black"><Download size={11} />Download</a><button type="button" disabled={busy} onClick={() => remove(document)} className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[9px] font-black text-rose-700"><Trash2 size={11} />Delete</button></div>
          </div>)}</div> : <div className="rounded-2xl border border-dashed border-black/15 bg-[#faf9f5] p-8 text-center text-sm text-black/40">No permanent customer documents stored yet.</div>}
        </div>
      </div>
    </section>
  );
}
