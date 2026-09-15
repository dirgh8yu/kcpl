"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileCheck2, FileSearch2, RefreshCw, Trash2 } from "lucide-react";
import { canDeleteShipmentDocument, canReviewShipmentDocuments } from "../../shipment-document-policy";
import { shipmentDocumentReviewStatusLabels, shipmentDocumentTypes, shipmentDocumentTypeLabels, type ShipmentDocumentEffectiveStatus, type ShipmentDocumentReviewStatus, type ShipmentDocumentType } from "../../shipment-document-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface, OpsTableWrap, OpsToolbar } from "../operations-ui";
import type { KcplStaffRole } from "../staff-permissions";
import type { DocumentVaultDashboard, DocumentVaultRow } from "./documents-data.server";

type StatusFilter = "active" | "all" | ShipmentDocumentEffectiveStatus;
type Notice = { tone: "success" | "danger" | "warning"; text: string } | null;

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date) + " NPT";
}

function dateOnly(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(date);
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: ShipmentDocumentEffectiveStatus) {
  return status === "expired" ? "Expired" : shipmentDocumentReviewStatusLabels[status];
}

function statusTone(status: ShipmentDocumentEffectiveStatus): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "verified") return "success";
  if (status === "received" || status === "under_review") return "warning";
  if (status === "rejected" || status === "expired") return "danger";
  return "neutral";
}

export function DocumentsWorkspace({ dashboard, role, currentUserEmail }: { dashboard: DocumentVaultDashboard; role: KcplStaffRole; currentUserEmail: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [type, setType] = useState<"all" | ShipmentDocumentType>("all");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(dashboard.rows[0] ? `${dashboard.rows[0].shipment_reference}:${dashboard.rows[0].id}` : null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return dashboard.rows.filter((row) => {
      if (status === "active" && ["deleted", "superseded"].includes(row.review_status)) return false;
      if (status !== "active" && status !== "all" && row.effective_status !== status) return false;
      if (type !== "all" && row.document_type !== type) return false;
      if (branch !== "all" && !row.handling_branches.includes(branch)) return false;
      if (!terms.length) return true;
      const haystack = [
        row.shipment_reference,
        row.customer_id ?? "",
        row.customer_name,
        row.filename,
        shipmentDocumentTypeLabels[row.document_type],
        row.uploaded_by,
        row.uploaded_by_email ?? "",
        row.reviewed_by ?? "",
        row.reviewed_by_email ?? "",
        row.verified_by ?? "",
        row.verified_by_email ?? "",
        row.review_note ?? "",
        row.origin,
        row.destination,
        row.mode,
        row.branch ?? "",
        statusLabel(row.effective_status),
        row.sha256 ?? "",
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [branch, dashboard.rows, query, status, type]);

  const selected = dashboard.rows.find((row) => `${row.shipment_reference}:${row.id}` === selectedKey) ?? visible[0] ?? null;
  const selectedCanReview = selected ? canReviewShipmentDocuments(role) && !["deleted", "superseded"].includes(selected.review_status) : false;
  const selectedCanDelete = selected ? canDeleteShipmentDocument({ role, actorEmail: currentUserEmail, uploadedByEmail: selected.uploaded_by_email, status: selected.review_status }) : false;
  const selectedCanSelfVerify = selected ? role === "management" || currentUserEmail.trim().toLowerCase() !== (selected.uploaded_by_email ?? "").trim().toLowerCase() : false;

  function reset() {
    setQuery("");
    setStatus("active");
    setType("all");
    setBranch("all");
  }

  async function deleteDocument(row: DocumentVaultRow) {
    if (!window.confirm(`Delete ${row.filename}? The metadata and audit history will be retained.`)) return;
    setBusyId(row.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string; warning?: string | null };
      if (!response.ok) throw new Error(data.error || "Could not delete the document.");
      setNotice({ tone: data.warning ? "warning" : "success", text: data.warning || `${row.filename} was tombstoned and removed from active document readiness.` });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not delete the document." });
    } finally {
      setBusyId(null);
    }
  }

  async function saveReview(event: FormEvent<HTMLFormElement>, row: DocumentVaultRow) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reviewStatus = String(form.get("status") ?? "received") as ShipmentDocumentReviewStatus;
    const body = {
      status: reviewStatus,
      customerSafe: form.get("customerSafe") === "on",
      reviewNote: String(form.get("reviewNote") ?? ""),
      expiresOn: String(form.get("expiresOn") ?? ""),
    };
    setReviewBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the document review.");
      setNotice({ tone: "success", text: `${row.filename} review state updated.` });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not save the document review." });
    } finally {
      setReviewBusy(false);
    }
  }

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Operations · Evidence control"
      title="Document Vault"
      description="Control shipment evidence, review state, expiry and version history. Uploading a file does not verify it; only verified, current evidence satisfies readiness."
      meta={<><span>Generated {dateTime(dashboard.generated_at)}</span><span>{visible.length} of {dashboard.rows.length} shown</span></>}
      actions={<><Link href="/admin/freight-documents" className="ops-button" data-variant="secondary">Freight Documents</Link><Link href="/admin/customs" className="ops-button" data-variant="secondary">Customs</Link><OpsButton variant="primary" onClick={() => router.refresh()}><RefreshCw size={14}/>Refresh</OpsButton></>}
    />

    <OpsStatStrip>
      <OpsStat label="Active" value={dashboard.active_count} active={status === "active"} onClick={() => setStatus("active")}/>
      <OpsStat label="Verified" value={dashboard.verified_count} tone="success" active={status === "verified"} onClick={() => setStatus(status === "verified" ? "active" : "verified")}/>
      <OpsStat label="Review queue" value={dashboard.review_count} tone={dashboard.review_count ? "warning" : "neutral"} active={status === "received" || status === "under_review"} onClick={() => setStatus(status === "received" ? "active" : "received")}/>
      <OpsStat label="Rejected" value={dashboard.rejected_count} tone={dashboard.rejected_count ? "danger" : "neutral"} active={status === "rejected"} onClick={() => setStatus(status === "rejected" ? "active" : "rejected")}/>
      <OpsStat label="Expired" value={dashboard.expired_count} tone={dashboard.expired_count ? "danger" : "neutral"} active={status === "expired"} onClick={() => setStatus(status === "expired" ? "active" : "expired")}/>
      <OpsStat label="History" value={dashboard.deleted_count} active={status === "deleted"} onClick={() => setStatus(status === "deleted" ? "active" : "deleted")}/>
    </OpsStatStrip>

    <div className="ops-content-wide grid gap-4">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
      {dashboard.cleanup_pending_count ? <OpsNotice tone="warning">{dashboard.cleanup_pending_count} tombstoned file{dashboard.cleanup_pending_count === 1 ? " has" : "s have"} storage cleanup pending. They are inaccessible and do not count toward readiness.</OpsNotice> : null}

      <OpsToolbar>
        <OpsSearch className="flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, filename, reviewer or hash"/>
        <select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filter by document state"><option value="active">Active documents</option><option value="all">All history</option><option value="received">Received</option><option value="under_review">Under review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="expired">Expired</option><option value="superseded">Superseded</option><option value="deleted">Deleted</option></select>
        <select className="ops-select" value={type} onChange={(event) => setType(event.target.value as "all" | ShipmentDocumentType)} aria-label="Filter by document type"><option value="all">All document types</option>{shipmentDocumentTypes.map((item) => <option key={item} value={item}>{shipmentDocumentTypeLabels[item]}</option>)}</select>
        <select className="ops-select" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)} aria-label="Filter by branch"><option value="all">All branches</option>{kcplBranches.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <OpsButton variant="secondary" onClick={reset}>Reset</OpsButton>
      </OpsToolbar>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <OpsSurface className="lg:col-span-2" title="Evidence register" description="Select a document to inspect verification, expiry, fingerprint and audit history." flush>
          {visible.length ? <OpsTableWrap>
            <table className="ops-table">
              <thead><tr><th>Document / shipment</th><th>Status</th><th>Received</th><th>Control</th><th>Action</th></tr></thead>
              <tbody>{visible.map((row) => {
                const key = `${row.shipment_reference}:${row.id}`;
                const inactive = row.review_status === "deleted" || row.review_status === "superseded";
                return <tr key={key} data-selected={selected && `${selected.shipment_reference}:${selected.id}` === key ? "true" : undefined} className={inactive ? "opacity-70" : undefined}>
                  <td><button type="button" onClick={() => setSelectedKey(key)} className="max-w-md text-left"><strong className="block truncate hover:text-[var(--admin-crimson)]">{row.filename}</strong><span className="mt-1 block text-xs text-[var(--admin-faint)]"><OpsMono>{row.shipment_reference}</OpsMono> · {row.customer_name}</span><span className="block text-xs text-[var(--admin-faint)]">{row.origin} → {row.destination} · {bytes(row.size_bytes)}</span></button></td>
                  <td><OpsBadge tone={statusTone(row.effective_status)} dot>{statusLabel(row.effective_status)}</OpsBadge><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.sha256 ? `SHA ${row.sha256.slice(0, 12)}…` : "Hash unavailable"}</span></td>
                  <td><span className="block">{dateTime(row.uploaded_at)}</span><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.uploaded_by}</span></td>
                  <td><span className="block">{row.expires_on ? `Expires ${dateOnly(row.expires_on)}` : "No expiry"}</span><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.customer_safe ? "Customer-safe" : "Internal evidence"}</span></td>
                  <td><OpsButton size="sm" variant={row.effective_status === "rejected" || row.effective_status === "expired" ? "primary" : "secondary"} onClick={() => setSelectedKey(key)}>Inspect</OpsButton></td>
                </tr>;
              })}</tbody>
            </table>
          </OpsTableWrap> : <div className="p-5"><OpsEmptyState kind="search" icon={<FileSearch2 size={18}/>} title="No documents match this view" description="Reset the filters or upload the required file from the relevant Digital Job File." action={<OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton>}/></div>}
        </OpsSurface>

        <OpsSurface
          eyebrow="Selected evidence"
          title={selected ? selected.filename : "No document selected"}
          description={selected ? `${shipmentDocumentTypeLabels[selected.document_type]} · ${selected.shipment_reference}` : "Select a document from the register to inspect its evidence controls."}
          priority={selected?.effective_status === "verified" ? "success" : selected?.effective_status === "rejected" || selected?.effective_status === "expired" ? "danger" : selected?.effective_status === "received" || selected?.effective_status === "under_review" ? "warning" : "normal"}
        >
          {selected ? <div className="grid gap-5">
            <div className="flex flex-wrap gap-2"><OpsBadge tone={statusTone(selected.effective_status)}>{statusLabel(selected.effective_status)}</OpsBadge><OpsBadge>{selected.branch || "No branch"}</OpsBadge>{selected.customer_safe ? <OpsBadge tone="info">Customer-safe</OpsBadge> : null}</div>

            {selected.review_status === "deleted" ? <OpsNotice tone="warning"><strong>Tombstoned evidence.</strong> Deleted {dateTime(selected.deleted_at)} by {selected.deleted_by || selected.deleted_by_email || "recorded operator"}. Metadata and audit history are retained; the file no longer counts toward readiness.</OpsNotice> : null}
            {selected.review_status === "superseded" ? <OpsNotice tone="warning">This evidence has been superseded and no longer counts as the current document for readiness.</OpsNotice> : null}
            {selected.review_status === "received" || selected.review_status === "under_review" ? <OpsNotice tone="warning"><strong>Upload is not verification.</strong> This file remains evidence under review until an authorised reviewer verifies or rejects it.</OpsNotice> : null}

            <dl className="grid gap-3 text-sm">
              <div><dt className="text-xs text-[var(--admin-faint)]">Shipment / customer</dt><dd className="mt-1 font-medium"><OpsMono>{selected.shipment_reference}</OpsMono> · {selected.customer_name}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Route</dt><dd className="mt-1 font-medium">{selected.origin} → {selected.destination} · {selected.mode}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Received</dt><dd className="mt-1 font-medium">{dateTime(selected.uploaded_at)}</dd><dd className="text-xs text-[var(--admin-muted)]">{selected.uploaded_by}{selected.uploaded_by_email ? ` · ${selected.uploaded_by_email}` : ""}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Fingerprint</dt><dd className="mt-1 break-all font-mono text-xs">{selected.sha256 || "SHA-256 unavailable"}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Review</dt><dd className="mt-1 font-medium">{statusLabel(selected.effective_status)}</dd><dd className="text-xs text-[var(--admin-muted)]">{selected.reviewed_by || selected.reviewed_by_email || "No reviewer recorded"}{selected.reviewed_at ? ` · ${dateTime(selected.reviewed_at)}` : ""}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Expiry</dt><dd className="mt-1 font-medium">{dateOnly(selected.expires_on)}</dd></div>
              {selected.review_note ? <div><dt className="text-xs text-[var(--admin-faint)]">Review note</dt><dd className="mt-1 text-[var(--admin-muted)]">{selected.review_note}</dd></div> : null}
            </dl>

            <div className="flex flex-wrap gap-2">
              {selected.review_status !== "deleted" ? <a href={`/api/admin/shipments/${encodeURIComponent(selected.shipment_reference)}/documents/${selected.id}`} className="ops-button" data-variant="secondary" data-size="sm"><Download size={13}/>Download</a> : null}
              <Link href={`/admin/jobs/${encodeURIComponent(selected.shipment_reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Open Job File</Link>
              {selected.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(selected.customer_id)}`} className="ops-button" data-variant="ghost" data-size="sm">Customer 360</Link> : null}
              {selectedCanDelete ? <OpsButton variant="danger" size="sm" disabled={busyId === selected.id} onClick={() => deleteDocument(selected)}><Trash2 size={13}/>{busyId === selected.id ? "Deleting…" : "Delete"}</OpsButton> : null}
            </div>

            {selectedCanReview ? <form key={`${selected.shipment_reference}:${selected.id}:${selected.review_status}`} onSubmit={(event) => saveReview(event, selected)} className="grid gap-4 border-t border-[var(--admin-line)] pt-4">
              <div className="flex items-center gap-2"><FileCheck2 size={15}/><h3>Review evidence</h3></div>
              <OpsField label="Review state"><select name="status" defaultValue={selected.review_status}><option value="received">Received</option><option value="under_review">Under review</option><option value="verified" disabled={!selectedCanSelfVerify}>Verified</option><option value="rejected">Rejected</option></select></OpsField>
              {!selectedCanSelfVerify ? <p className="text-xs text-[var(--admin-muted)]">The uploader cannot verify their own document unless they hold management authority.</p> : null}
              <OpsField label="Expiry date" hint="Leave blank when this document type has no expiry."><input name="expiresOn" type="date" defaultValue={selected.expires_on || ""}/></OpsField>
              <OpsField label="Review note"><textarea name="reviewNote" defaultValue={selected.review_note || ""}/></OpsField>
              <label className="flex items-center gap-2 text-sm"><input name="customerSafe" type="checkbox" defaultChecked={selected.customer_safe}/>Customer-safe evidence</label>
              <OpsButton type="submit" variant="primary" disabled={reviewBusy}>{reviewBusy ? "Saving review…" : "Save review"}</OpsButton>
            </form> : null}
          </div> : <OpsEmptyState compact title="No document selected" description="Choose evidence from the register."/>}
        </OpsSurface>
      </div>
    </div>
  </OpsPage>;
}
