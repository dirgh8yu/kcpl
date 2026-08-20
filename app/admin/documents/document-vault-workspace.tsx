"use client";

import { Download, FileArchive, FileText, Search, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  DOCUMENT_MAX_BYTES,
  documentCategories,
  documentCategoryLabels,
  type KcplDocumentCategory,
  type VaultDocument,
} from "./document-vault";

type ApiResponse = {
  ok?: boolean;
  document?: VaultDocument;
  error?: string;
};

function bytesText(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dateText(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DocumentVaultWorkspace({
  initialDocuments,
  allowedBranches,
  defaultBranch,
  initialShipment = "",
  initialCustomer = "",
  storageConfigured,
  canManageCustomerDocuments,
  canDelete,
}: {
  initialDocuments: VaultDocument[];
  allowedBranches: string[];
  defaultBranch: string;
  initialShipment?: string;
  initialCustomer?: string;
  storageConfigured: boolean;
  canManageCustomerDocuments: boolean;
  canDelete: boolean;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | KcplDocumentCategory>("all");
  const [shipmentReference, setShipmentReference] = useState(initialShipment);
  const [customerId, setCustomerId] = useState(initialCustomer);
  const [branch, setBranch] = useState(defaultBranch || allowedBranches[0] || "Kathmandu");
  const [category, setCategory] = useState<KcplDocumentCategory>("commercial_invoice");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const visibleDocuments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return documents.filter((document) => {
      if (categoryFilter !== "all" && document.category !== categoryFilter) return false;
      if (!needle) return true;
      return [
        document.file_name,
        documentCategoryLabels[document.category],
        document.shipment_reference,
        document.customer_id,
        document.customer_name,
        document.branch,
        document.notes,
        document.uploaded_by_name,
      ].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [categoryFilter, documents, search]);

  const totalBytes = documents.reduce((sum, document) => sum + document.size_bytes, 0);
  const linkedToJobs = documents.filter((document) => document.shipment_reference).length;

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a document first.");
      return;
    }
    if (file.size > DOCUMENT_MAX_BYTES) {
      setError("This file is larger than the 20 MB document limit.");
      return;
    }
    if (!shipmentReference.trim() && !canManageCustomerDocuments) {
      setError("Your role can upload documents only when they are linked to a shipment.");
      return;
    }

    const form = new FormData();
    form.set("file", file);
    form.set("category", category);
    form.set("shipment_reference", shipmentReference.trim());
    form.set("customer_id", customerId.trim());
    form.set("branch", branch);
    form.set("notes", notes.trim());

    setUploading(true);
    try {
      const response = await fetch("/api/admin/documents", { method: "POST", body: form });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.document) throw new Error(data.error || "Document upload failed.");
      setDocuments((current) => [data.document!, ...current]);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      setNotice(`${data.document.file_name} uploaded securely.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(document: VaultDocument) {
    if (!window.confirm(`Delete ${document.file_name}? The file will be removed from Storage but its audit record will remain.`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/documents/${encodeURIComponent(document.id)}`, { method: "DELETE" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Document could not be deleted.");
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setNotice(`${document.file_name} deleted. Audit history retained.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document could not be deleted.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#8a6c36]"><FileArchive size={16}/><span className="text-[10px] font-black uppercase tracking-[.14em]">KCPL Document Vault</span></div>
          <h1 className="mt-2 text-2xl font-black text-[#10263f]">Shipment and customer documents</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#6f7a84]">Private Firebase Storage backed by Firestore metadata, KCPL staff permissions and audit records. Files are never made public.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-800"><ShieldCheck size={14}/>{storageConfigured ? "Private storage ready" : "Storage setup required"}</div>
      </div>

      {!storageConfigured ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          The Vault code is ready, but this Firebase project does not currently expose a Storage bucket to App Hosting. Enable Firebase Storage, then roll out the app again.
        </div>
      ) : null}

      <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-[#dfe3e8] bg-[#dfe3e8] sm:grid-cols-3">
        <Metric label="Current documents" value={String(documents.length)}/>
        <Metric label="Linked to shipments" value={String(linkedToJobs)}/>
        <Metric label="Stored document size" value={bytesText(totalBytes)}/>
      </div>

      <section className="mt-5 rounded-xl border border-[#dfe3e8] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2"><UploadCloud size={15} className="text-[#8a6c36]"/><h2 className="text-sm font-black text-[#10263f]">Upload document</h2></div>
        <p className="mt-1 text-[10px] leading-4 text-[#7a858e]">PDF, image, Word, Excel or CSV. Maximum 20 MB. If a shipment reference is supplied, KCPL automatically inherits the job customer and branch.</p>

        <form onSubmit={upload} className="mt-4 grid gap-3 xl:grid-cols-6">
          <label className="xl:col-span-2"><FieldLabel>File</FieldLabel><input ref={fileRef} type="file" required disabled={!storageConfigured || uploading} accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv" className="mt-1 block h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 py-2 text-[10px] file:mr-3 file:border-0 file:bg-transparent file:text-[10px] file:font-bold"/></label>
          <label><FieldLabel>Category</FieldLabel><select value={category} onChange={(event) => setCategory(event.target.value as KcplDocumentCategory)} className="mt-1 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-xs outline-none focus:border-[#aa8748]">{documentCategories.map((item) => <option key={item} value={item}>{documentCategoryLabels[item]}</option>)}</select></label>
          <label><FieldLabel>Shipment reference</FieldLabel><input value={shipmentReference} onChange={(event) => setShipmentReference(event.target.value.toUpperCase())} placeholder="KCPL-..." className="mt-1 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-xs outline-none focus:border-[#aa8748]"/></label>
          <label><FieldLabel>Customer ID</FieldLabel><input value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={Boolean(shipmentReference.trim())} placeholder="Optional" className="mt-1 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-xs outline-none focus:border-[#aa8748] disabled:opacity-50"/></label>
          <label><FieldLabel>Branch</FieldLabel><select value={branch} onChange={(event) => setBranch(event.target.value)} disabled={Boolean(shipmentReference.trim() || customerId.trim())} className="mt-1 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-xs outline-none focus:border-[#aa8748] disabled:opacity-50">{allowedBranches.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="xl:col-span-5"><FieldLabel>Notes</FieldLabel><input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1200} placeholder="Optional document note" className="mt-1 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-xs outline-none focus:border-[#aa8748]"/></label>
          <div className="flex items-end"><button type="submit" disabled={!storageConfigured || uploading} className="h-10 w-full rounded-lg bg-[#10263f] px-4 text-[10px] font-black uppercase tracking-[.08em] text-white disabled:opacity-50">{uploading ? "Uploading…" : "Upload securely"}</button></div>
        </form>

        {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}
        {notice ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p> : null}
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-[#dfe3e8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ebee] px-4 py-3">
          <div className="flex items-center gap-2"><FileText size={15} className="text-[#8a6c36]"/><h2 className="text-sm font-black text-[#10263f]">Documents</h2></div>
          <div className="flex w-full gap-2 sm:w-auto">
            <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 sm:w-72"><Search size={13} className="text-[#89939b]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" className="w-full bg-transparent text-xs outline-none"/></label>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | KcplDocumentCategory)} className="h-9 rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-[10px] font-semibold outline-none"><option value="all">All categories</option>{documentCategories.map((item) => <option key={item} value={item}>{documentCategoryLabels[item]}</option>)}</select>
          </div>
        </div>

        {visibleDocuments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead className="bg-[#f7f8f9] text-[9px] font-black uppercase tracking-[.09em] text-[#87919a]"><tr><th className="px-4 py-2.5">Document</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">Linked record</th><th className="px-4 py-2.5">Branch</th><th className="px-4 py-2.5">Size</th><th className="px-4 py-2.5">Uploaded</th><th className="px-4 py-2.5 text-right">Actions</th></tr></thead>
              <tbody>{visibleDocuments.map((document) => (
                <tr key={document.id} className="border-t border-[#edf0f2] text-xs text-[#445561]">
                  <td className="px-4 py-3"><p className="max-w-[320px] truncate font-bold text-[#20364b]">{document.file_name}</p><p className="mt-0.5 max-w-[320px] truncate text-[9px] text-[#8a949c]">{document.notes || document.content_type}</p></td>
                  <td className="px-4 py-3"><span className="rounded-full border border-[#e1e5e8] bg-[#fafbfb] px-2 py-1 text-[9px] font-bold">{documentCategoryLabels[document.category]}</span></td>
                  <td className="px-4 py-3"><p className="font-semibold">{document.shipment_reference || document.customer_name || "General"}</p>{document.shipment_reference && document.customer_name ? <p className="mt-0.5 text-[9px] text-[#8a949c]">{document.customer_name}</p> : null}</td>
                  <td className="px-4 py-3">{document.branch}</td>
                  <td className="px-4 py-3 tabular-nums">{bytesText(document.size_bytes)}</td>
                  <td className="px-4 py-3"><p>{dateText(document.uploaded_at)}</p><p className="mt-0.5 text-[9px] text-[#8a949c]">{document.uploaded_by_name}</p></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><a href={`/api/admin/documents/${encodeURIComponent(document.id)}/download`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfe3e8] px-2.5 text-[9px] font-bold text-[#30485e]"><Download size={12}/>Download</a>{canDelete ? <button type="button" onClick={() => remove(document)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-[9px] font-bold text-red-700"><Trash2 size={12}/>Delete</button> : null}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="px-6 py-14 text-center"><FileArchive size={28} className="mx-auto text-[#b1b8be]"/><p className="mt-3 text-sm font-bold text-[#53616d]">No documents match this view.</p><p className="mt-1 text-xs text-[#8a949c]">Upload the first job or customer document above.</p></div>}
      </section>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8b949c]">{children}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-white px-4 py-4"><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8b949c]">{label}</p><p className="mt-1 text-xl font-black text-[#10263f]">{value}</p></div>;
}
