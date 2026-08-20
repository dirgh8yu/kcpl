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
import { OpsButton, OpsEmptyState, OpsPanel } from "../../operations-ui";

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
    <section className="ops-page-body !pt-0">
      <OpsPanel eyebrow="Permanent account files" title="Customer document vault" description="Store KYC, PAN/VAT, contracts, credit agreements, standing instructions and rate sheets separately from shipment documents.">
        {!storageAvailable ? <div role="alert" className="mx-4 mt-4 rounded-lg border border-[#eadfca] bg-[#fbf7ef] px-3 py-2.5 text-[11px] font-medium text-[#8a6734]">Firebase Storage is unavailable for this deployment. Existing metadata can load, but new customer documents cannot be uploaded.</div> : null}
        {notice ? <div role="status" aria-live="polite" className="mx-4 mt-4 rounded-lg border border-[#e5dfd1] bg-[#faf7f0] px-3 py-2.5 text-[11px] font-medium text-[#765f3b]">{notice}</div> : null}

        <form onSubmit={upload} className="mx-4 mt-4 grid gap-3 rounded-lg border border-[#e3e6e9] bg-[#fafafa] p-4 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
          <label><span className="mb-1.5 block text-[10px] font-semibold text-[#69727b]">Document type</span><select className="crm360-input" value={documentType} onChange={(event) => setDocumentType(event.target.value as CrmCustomerDocumentType)}>{crmCustomerDocumentTypes.map((type) => <option key={type} value={type}>{crmCustomerDocumentTypeLabels[type]}</option>)}</select></label>
          <label><span className="mb-1.5 block text-[10px] font-semibold text-[#69727b]">File <span className="font-normal text-[#9aa0a7]">· max 15 MB</span></span><input ref={fileRef} type="file" required className="block min-h-10 w-full rounded-lg border border-[#dfe2e6] bg-white px-2 py-1.5 text-[11px] file:mr-2 file:rounded-md file:border-0 file:bg-[#f0f1f2] file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-[#4d555e]" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"/></label>
          <OpsButton type="submit" tone="primary" disabled={busy || !storageAvailable}><Upload size={13}/>{busy ? "Working…" : "Upload"}</OpsButton>
        </form>

        <div className="p-4">
          {documents.length ? <div className="overflow-hidden rounded-lg border border-[#e3e6e9]"><div className="overflow-x-auto"><table className="ops-dense-table min-w-[760px] text-left"><thead><tr><th className="px-4">Document</th><th className="px-3">Type</th><th className="px-3">Size</th><th className="px-3">Uploaded</th><th className="px-3">By</th><th className="px-3 text-right">Actions</th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td className="px-4"><div className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#f0f2ff] text-[#5367d9]"><FileText size={14}/></span><strong className="max-w-[260px] truncate text-[11px] font-semibold text-[#31363c]" title={document.filename}>{document.filename}</strong></div></td><td className="px-3 text-[#66707a]">{crmCustomerDocumentTypeLabels[document.document_type]}</td><td className="px-3 text-[#66707a]">{formatBytes(document.size_bytes)}</td><td className="px-3 text-[#66707a]">{formatDate(document.uploaded_at)}</td><td className="px-3 text-[#66707a]">{document.uploaded_by}</td><td className="px-3"><div className="flex justify-end gap-1.5"><a href={`/api/admin/crm/customers/${encodeURIComponent(customerId)}/documents/${document.id}`} className="ops-button ops-button-secondary !min-h-8 !px-2.5 !text-[10px]"><Download size={11}/>Download</a><OpsButton type="button" tone="danger" className="!min-h-8 !px-2.5 !text-[10px]" disabled={busy} onClick={() => remove(document)}><Trash2 size={11}/>Delete</OpsButton></div></td></tr>)}</tbody></table></div></div> : <OpsEmptyState compact title="No permanent customer documents" detail="Account-level documents will appear here after upload."/>}
        </div>
      </OpsPanel>
    </section>
  );
}
