"use client";

import { FormEvent, useRef, useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import {
  crmCustomerDocumentTypeLabels,
  crmCustomerDocumentTypes,
  type CrmCustomerDocument,
  type CrmCustomerDocumentType,
} from "../crm-customer-document-types";
import { OpsButton, OpsEmptyState, OpsField, OpsFileDrop, OpsNotice, OpsTableWrap } from "../../operations-ui";
import type { StaffCapabilities } from "../../staff-permissions";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const uploadedAt = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" });

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : uploadedAt.format(date);
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
  const formRef = useRef<HTMLFormElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentType, setDocumentType] = useState<CrmCustomerDocumentType>("kyc");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "warning" | "danger" } | null>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setNotice({ text: "Choose a file first.", tone: "warning" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("documentType", documentType);
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customerId)}/documents`, { method: "POST", body: form });
      const data = await response.json() as { ok?: boolean; document?: CrmCustomerDocument; error?: string };
      if (!response.ok || !data.document) throw new Error(data.error || "The document didn’t upload. Try again.");
      setDocuments((current) => [data.document!, ...current]);
      formRef.current?.reset();
      setNotice({ text: "Document uploaded.", tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "The document didn’t upload. Try again.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(document: CrmCustomerDocument) {
    if (!window.confirm(`Delete ${document.filename} from this customer’s documents?`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customerId)}/documents/${document.id}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "The document wasn’t deleted. Try again.");
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setNotice({ text: "Document deleted.", tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "The document wasn’t deleted. Try again.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (!permissions.canManageCustomerDocuments) return null;

  return (
    <div className="crm-tool-panel">
      {!storageAvailable ? <OpsNotice tone="warning">File storage isn’t set up on this site yet, so new documents can’t be uploaded.</OpsNotice> : null}
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

      <form ref={formRef} onSubmit={upload} className="crm-doc-upload">
        <OpsField label="Document type"><select className="ops-select" value={documentType} onChange={(event) => setDocumentType(event.target.value as CrmCustomerDocumentType)}>{crmCustomerDocumentTypes.map((type) => <option key={type} value={type}>{crmCustomerDocumentTypeLabels[type]}</option>)}</select></OpsField>
        <OpsFileDrop inputRef={fileRef} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" prompt="Choose a file" hint="PDF, image, Word, Excel, CSV or TXT · up to 15 MB" disabled={!storageAvailable || busy}/>
        <OpsButton type="submit" variant="primary" disabled={busy || !storageAvailable}><Upload size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Uploading…" : "Upload"}</OpsButton>
      </form>

      {documents.length ? <OpsTableWrap>
        <table className="ops-table ops-register-table ops-stack-table" aria-label="Customer documents">
          <thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Uploaded</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{documents.map((document) => <tr key={document.id}>
            <td><strong className="block truncate">{document.filename}</strong></td>
            <td>{crmCustomerDocumentTypeLabels[document.document_type]}</td>
            <td>{formatBytes(document.size_bytes)}</td>
            <td>{formatDate(document.uploaded_at)} · {document.uploaded_by}</td>
            <td><div className="flex justify-end gap-2"><a href={`/api/admin/crm/customers/${encodeURIComponent(customerId)}/documents/${document.id}`} className="ops-button" data-variant="secondary" data-size="sm"><Download size={13} strokeWidth={1.75} aria-hidden="true"/>Download</a><OpsButton size="sm" variant="danger" disabled={busy} onClick={() => remove(document)}><Trash2 size={13} strokeWidth={1.75} aria-hidden="true"/>Delete</OpsButton></div></td>
          </tr>)}</tbody>
        </table>
      </OpsTableWrap> : <OpsEmptyState compact icon={<FileText size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No customer documents yet" description="Upload KYC, tax registration or a contract above."/>}
    </div>
  );
}
