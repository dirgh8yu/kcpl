"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, Folder, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { canDeleteShipmentDocument, canReviewShipmentDocuments } from "../../shipment-document-policy";
import { shipmentDocumentReviewStatusLabels, shipmentDocumentTypes, shipmentDocumentTypeLabels, type ShipmentDocumentEffectiveStatus, type ShipmentDocumentReviewStatus, type ShipmentDocumentType } from "../../shipment-document-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import type { KcplStaffRole } from "../staff-permissions";
import {
  OpsActiveFilters,
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsFact,
  OpsFacts,
  OpsField,
  OpsFilterSelect,
  OpsInlineAlert,
  OpsInspectorHeader,
  OpsInspectorNote,
  OpsInspectorSection,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsRegisterToolbar,
  OpsScopeTabs,
  OpsSearch,
  OpsTableWrap,
  type OpsActiveFilter,
} from "../operations-ui";
import { useWorkspaceQuery } from "../use-workspace-query";
import type { DocumentVaultDashboard, DocumentVaultRow } from "./documents-data.server";

type StatusFilter = "active" | "all" | "pending" | ShipmentDocumentEffectiveStatus;
type Notice = { tone: "success" | "danger" | "warning"; text: string } | null;

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function dateOnly(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(date);
}

function shortDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kathmandu" }).format(date);
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

function nextAction(row: DocumentVaultRow) {
  if (row.review_status === "received" || row.review_status === "under_review") return "Review evidence";
  if (row.effective_status === "rejected") return "Replace evidence";
  if (row.effective_status === "expired") return "Renew evidence";
  if (row.effective_status === "verified") return "Verified";
  if (row.review_status === "deleted" || row.review_status === "superseded") return "Audit only";
  return "Open record";
}

function matchesStatus(row: DocumentVaultRow, status: StatusFilter) {
  if (status === "all") return true;
  if (status === "active") return !["deleted", "superseded"].includes(row.review_status);
  if (status === "pending") return row.review_status === "received" || row.review_status === "under_review";
  return row.effective_status === status;
}

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "superseded", label: "Superseded" },
  { value: "deleted", label: "Deleted" },
];

const SOURCE_OPTIONS = [
  { value: "customer", label: "From customers" },
  { value: "staff", label: "Staff uploads" },
];

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

function Inspector({
  row,
  role,
  currentUserEmail,
  busyId,
  reviewBusy,
  onClose,
  onDelete,
  onSaveReview,
  inspectorRef,
}: {
  row: DocumentVaultRow;
  role: KcplStaffRole;
  currentUserEmail: string;
  busyId: number | null;
  reviewBusy: boolean;
  onClose: () => void;
  onDelete: (row: DocumentVaultRow) => Promise<void>;
  onSaveReview: (event: FormEvent<HTMLFormElement>, row: DocumentVaultRow) => Promise<void>;
  inspectorRef: RefObject<HTMLElement | null>;
}) {
  const canReview = canReviewShipmentDocuments(role) && !["deleted", "superseded"].includes(row.review_status);
  const canDelete = canDeleteShipmentDocument({ role, actorEmail: currentUserEmail, uploadedByEmail: row.uploaded_by_email, status: row.review_status });
  const canSelfVerify = role === "management" || currentUserEmail.trim().toLowerCase() !== (row.uploaded_by_email ?? "").trim().toLowerCase();
  const inactive = row.review_status === "deleted" || row.review_status === "superseded";

  return <aside ref={inspectorRef} className="ops-inspector" aria-label={`Document ${row.filename}`}>
    <OpsInspectorHeader
      kicker={row.shipment_reference}
      title={shipmentDocumentTypeLabels[row.document_type]}
      subtitle={row.filename}
      actions={<button type="button" className="ops-inspector-close" onClick={onClose} aria-label="Close document inspector"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
    />
    <div className="ops-inspector-scroll">
      <div className="ops-inspector-body">
        <div className="flex flex-wrap gap-1.5">
          <OpsBadge tone={statusTone(row.effective_status)}>{statusLabel(row.effective_status)}</OpsBadge>
          {inactive ? <OpsBadge>{row.review_status === "deleted" ? "Tombstoned" : "Superseded"}</OpsBadge> : null}
          {row.customer_safe ? <OpsBadge tone="success">Customer-safe</OpsBadge> : null}
        </div>

        {row.review_status === "deleted" ? <OpsInspectorNote tone="neutral" title="Tombstoned · audit record only">Removed {dateTime(row.deleted_at)} by {row.deleted_by || row.deleted_by_email || "recorded operator"}. It no longer counts toward readiness.</OpsInspectorNote> : null}
        {row.review_status === "superseded" ? <OpsInspectorNote tone="warning" title="Superseded evidence">This revision is retained for history but no longer counts as the current readiness evidence.</OpsInspectorNote> : null}
        {row.review_status === "received" || row.review_status === "under_review" ? <OpsInspectorNote tone="warning" icon={<AlertCircle size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Upload ≠ verification">This file remains under evidence review until an authorised reviewer verifies or rejects it.</OpsInspectorNote> : null}

        <OpsInspectorSection title="Evidence">
          <OpsFacts>
            <OpsFact label="Document">{row.filename}</OpsFact>
            <OpsFact label="Customer">{row.customer_name}</OpsFact>
            <OpsFact label="Route">{`${row.origin} → ${row.destination} · ${row.mode}`}</OpsFact>
            <OpsFact label="File size">{bytes(row.size_bytes)}</OpsFact>
            <OpsFact label="Uploaded">{`${dateTime(row.uploaded_at)} · ${row.uploaded_by}`}</OpsFact>
            <OpsFact label="Reviewed by">{row.reviewed_by || row.reviewed_by_email || "Not reviewed"}</OpsFact>
            <OpsFact label="Review time">{dateTime(row.reviewed_at)}</OpsFact>
            <OpsFact label="Expires">{dateOnly(row.expires_on)}</OpsFact>
            <OpsFact label="Branch" warning={!row.branch}>{row.branch || "Branch repair needed"}</OpsFact>
          </OpsFacts>
        </OpsInspectorSection>

        <OpsInspectorSection title="Integrity fingerprint · SHA-256">
          <div className="document-vault-fingerprint">{row.sha256 || "Unavailable"}</div>
        </OpsInspectorSection>

        {row.review_note ? <OpsInspectorSection title="Review note"><p className="document-vault-note">{row.review_note}</p></OpsInspectorSection> : null}

        <div className="ops-inspector-actions">
          {row.review_status !== "deleted" ? <a href={`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`} className="ops-button" data-variant="secondary" data-size="sm"><Download size={14} strokeWidth={1.75} aria-hidden="true"/>Download</a> : null}
          <Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Job File</Link>
          {row.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(row.customer_id)}`} className="ops-button" data-variant="ghost" data-size="sm">Customer 360</Link> : null}
          {canDelete ? <OpsButton variant="danger" size="sm" disabled={busyId === row.id} onClick={() => void onDelete(row)}><Trash2 size={14} strokeWidth={1.75} aria-hidden="true"/>{busyId === row.id ? "Deleting…" : "Delete"}</OpsButton> : null}
        </div>

        {canReview ? (
          <OpsInspectorSection tinted title="Review evidence">
            <form key={`${row.shipment_reference}:${row.id}:${row.review_status}`} onSubmit={(event) => void onSaveReview(event, row)} className="ops-inspector-form">
              <OpsField label="Review state" className="col-span-full"><select name="status" defaultValue={row.review_status}><option value="received">Received</option><option value="under_review">Under review</option><option value="verified" disabled={!canSelfVerify}>Verified</option><option value="rejected">Rejected</option></select></OpsField>
              {!canSelfVerify ? <p className="ops-inspector-hint col-span-full">The uploader cannot verify their own document unless they hold management authority.</p> : null}
              <OpsField label="Expiry date" className="col-span-full"><input name="expiresOn" type="date" defaultValue={row.expires_on || ""}/></OpsField>
              <OpsField label="Review note" className="col-span-full"><textarea name="reviewNote" defaultValue={row.review_note || ""} rows={2}/></OpsField>
              <label className="document-vault-check col-span-full"><input name="customerSafe" type="checkbox" defaultChecked={row.customer_safe}/>Customer-safe evidence</label>
              <div className="col-span-full"><OpsButton type="submit" variant="primary" disabled={reviewBusy}>{reviewBusy ? "Saving…" : "Save review"}</OpsButton></div>
            </form>
          </OpsInspectorSection>
        ) : row.effective_status === "verified" && !inactive ? <OpsInspectorNote tone="success" icon={<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Verified">No further review required.</OpsInspectorNote> : null}
      </div>
    </div>
  </aside>;
}

export function DocumentsWorkspace({ dashboard, role, currentUserEmail }: { dashboard: DocumentVaultDashboard; role: KcplStaffRole; currentUserEmail: string }) {
  const router = useRouter();
  const { params, update } = useWorkspaceQuery();
  const query = params.get("q") ?? "";
  const statusValue = params.get("status");
  const status: StatusFilter = statusValue === "active" || statusValue === "pending" || statusValue === "verified" || statusValue === "rejected" || statusValue === "expired" || statusValue === "superseded" || statusValue === "deleted" ? statusValue : "all";
  const typeValue = params.get("type");
  const type: "all" | ShipmentDocumentType = shipmentDocumentTypes.includes(typeValue as ShipmentDocumentType) ? typeValue as ShipmentDocumentType : "all";
  const branchValue = params.get("branch");
  const branch: "all" | KcplBranch = kcplBranches.includes(branchValue as KcplBranch) ? branchValue as KcplBranch : "all";
  const originValue = params.get("origin");
  const origin: "all" | "customer" | "staff" = originValue === "customer" || originValue === "staff" ? originValue : "all";
  const selectedKey = params.get("selected");
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const pendingReview = dashboard.rows.filter((row) => row.review_status === "received" || row.review_status === "under_review").length;
  const customerInbound = dashboard.rows.filter((row) => row.uploaded_by_source === "customer_portal" && (row.review_status === "received" || row.review_status === "under_review")).length;
  const setStatusFilter = (nextStatus: StatusFilter) => {
    update({ status: nextStatus === "all" ? null : nextStatus, selected: null });
  };
  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return dashboard.rows.filter((row) => {
      if (!matchesStatus(row, status)) return false;
      if (type !== "all" && row.document_type !== type) return false;
      if (origin !== "all" && row.uploaded_by_source !== (origin === "customer" ? "customer_portal" : "staff")) return false;
      if (branch !== "all" && !row.handling_branches.includes(branch)) return false;
      if (!terms.length) return true;
      const haystack = [row.shipment_reference, row.customer_id ?? "", row.customer_name, row.filename, shipmentDocumentTypeLabels[row.document_type], row.uploaded_by, row.uploaded_by_email ?? "", row.reviewed_by ?? "", row.reviewed_by_email ?? "", row.verified_by ?? "", row.verified_by_email ?? "", row.review_note ?? "", row.origin, row.destination, row.mode, row.branch ?? "", statusLabel(row.effective_status), row.sha256 ?? ""].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [branch, dashboard.rows, origin, query, status, type]);
  const selected = selectedKey ? dashboard.rows.find((row) => `${row.shipment_reference}:${row.id}` === selectedKey) ?? null : null;

  async function deleteDocument(row: DocumentVaultRow) {
    if (!window.confirm(`Delete ${row.filename}? The metadata and audit history will be retained.`)) return;
    setBusyId(row.id); setNotice(null);
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string; warning?: string | null };
      if (!response.ok) throw new Error(data.error || "Could not delete the document.");
      setNotice({ tone: data.warning ? "warning" : "success", text: data.warning || `${row.filename} was tombstoned and removed from active readiness.` });
      update({ selected: null }); router.refresh();
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not delete the document." }); }
    finally { setBusyId(null); }
  }

  async function saveReview(event: FormEvent<HTMLFormElement>, row: DocumentVaultRow) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { status: String(form.get("status") ?? "received") as ShipmentDocumentReviewStatus, customerSafe: form.get("customerSafe") === "on", reviewNote: String(form.get("reviewNote") ?? ""), expiresOn: String(form.get("expiresOn") ?? "") };
    setReviewBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the document review.");
      setNotice({ tone: "success", text: `${row.filename} review state updated.` }); router.refresh();
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not save the document review." }); }
    finally { setReviewBusy(false); }
  }

  function reset() {
    update({ q: null, status: null, type: null, branch: null, selected: null });
  }

  const inspectorRef = useRef<HTMLElement>(null);
  const hasSelection = selected !== null;
  // Escape closes the inspector, as it does on the other registers.
  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      update({ selected: null });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSelection, update]);

  function openRow(key: string) {
    update({ selected: key }, "push");
    // Stacked layouts put the inspector under the queue; bring it into view.
    window.requestAnimationFrame(() => {
      if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inspectorRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  }

  const statusCounts = useMemo(() => Object.fromEntries(STATUS_TABS.map((tab) => [tab.value, dashboard.rows.filter((row) => matchesStatus(row, tab.value)).length])) as Record<StatusFilter, number>, [dashboard.rows]);
  const filtersActive = Boolean(query.trim()) || status !== "all" || type !== "all" || branch !== "all";
  const compact = selected !== null;
  const activeFilters: OpsActiveFilter[] = [];
  if (type !== "all") activeFilters.push({ key: "type", label: shipmentDocumentTypeLabels[type], title: `Type: ${shipmentDocumentTypeLabels[type]}`, onRemove: () => update({ type: null }) });
  if (branch !== "all") activeFilters.push({ key: "branch", label: branch, title: `Branch: ${branch}`, onRemove: () => update({ branch: null }) });
  if (origin !== "all") activeFilters.push({ key: "origin", label: origin === "customer" ? "From customers" : "Staff uploads", title: `Source: ${origin}`, onRemove: () => update({ origin: null, selected: null }) });

  return <OpsPage className="document-vault-register">
    <OpsPageHeader
      title="Document Vault"
      description={`Evidence control · upload ≠ verification · ${dashboard.rows.length} documents · snapshot ${dateTime(dashboard.generated_at)}`}
      actions={<><Link href="/admin/freight-documents" className="ops-button" data-variant="secondary" data-size="md">Freight Documents</Link><Link href="/admin/customs" className="ops-button" data-variant="secondary" data-size="md">Customs</Link><OpsButton variant="secondary" onClick={() => router.refresh()}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true"/>Refresh</OpsButton></>}
    />

    <div className="px-4 pb-8 pt-4 md:px-6">
      {pendingReview > 0 ? (
        <div className="mb-3">
          <OpsInlineAlert
            icon={<AlertCircle size={14} strokeWidth={1.75} aria-hidden="true"/>}
            actions={(
              <>
                <button type="button" className="ops-inline-alert-action" aria-pressed={status === "pending"} onClick={() => setStatusFilter("pending")}>Show pending</button>
                {customerInbound ? <button type="button" className="ops-inline-alert-action" aria-pressed={origin === "customer"} onClick={() => update({ origin: origin === "customer" ? null : "customer", selected: null })}>From customers · {customerInbound}</button> : null}
              </>
            )}
          >
            <strong>{pendingReview}</strong> document{pendingReview === 1 ? "" : "s"} awaiting review. Upload alone does not constitute verification.
          </OpsInlineAlert>
        </div>
      ) : null}
      {dashboard.cleanup_pending_count ? <div className="mb-3"><OpsInlineAlert tone="info">{dashboard.cleanup_pending_count} tombstoned file{dashboard.cleanup_pending_count === 1 ? " has" : "s have"} storage cleanup pending. They are inaccessible and do not count toward readiness.</OpsInlineAlert></div> : null}
      {notice ? <div className="mb-3"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

      <OpsRegisterToolbar
        search={<OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null })} placeholder="Search shipment, customer, filename, reviewer…" aria-label="Search document vault"/>}
        actions={(
          <>
            <OpsFilterSelect label="Type" value={type} allLabel="All document types" options={shipmentDocumentTypes.map((item) => ({ value: item, label: shipmentDocumentTypeLabels[item] }))} onChange={(value) => update({ type: value === "all" ? null : value })}/>
            <OpsFilterSelect label="Branch" value={branch} allLabel="All branches" options={kcplBranches.map((item) => ({ value: item, label: item }))} onChange={(value) => update({ branch: value === "all" ? null : value })}/>
            <OpsFilterSelect label="Source" value={origin} allLabel="All sources" options={SOURCE_OPTIONS} onChange={(value) => update({ origin: value === "all" ? null : value, selected: null })}/>
            {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
            <span className="ops-toolbar-divider" aria-hidden="true"/>
            <span className="ops-result-count" aria-live="polite">{visible.length === dashboard.rows.length ? `${dashboard.rows.length} documents` : `${visible.length} of ${dashboard.rows.length}`}</span>
          </>
        )}
        tabs={<OpsScopeTabs label="Status filter" items={STATUS_TABS.map((tab) => ({ ...tab, count: statusCounts[tab.value] }))} value={status} onChange={setStatusFilter}/>}
      />

      <OpsActiveFilters chips={activeFilters}/>

      <div className="ops-register-layout" data-inspector={selected ? "open" : undefined}>
        <section className="ops-surface document-vault-surface" aria-label="Document evidence queue">
          {visible.length ? (
            <OpsTableWrap>
              <table className="ops-table ops-register-table document-vault-table" data-compact={compact || undefined} aria-label="Document Vault">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Shipment</th>
                    {compact ? null : <th>Uploaded</th>}
                    {compact ? null : <th>Expiry</th>}
                    <th>Review · Access</th>
                    {compact ? null : <th>Next action</th>}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const key = `${row.shipment_reference}:${row.id}`;
                    const inactive = row.review_status === "deleted" || row.review_status === "superseded";
                    const rowSelected = selectedKey === key;
                    return (
                      <tr key={key} data-selected={rowSelected || undefined} data-inactive={inactive || undefined} aria-current={rowSelected || undefined} tabIndex={0} onClick={() => openRow(key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openRow(key); } }}>
                        <td>
                          <span className="ops-cell-primary ops-cell-clamp" title={row.filename}>{row.filename}</span>
                          <span className="ops-cell-secondary ops-cell-clamp">{row.uploaded_by_source === "customer_portal" ? <span className="document-vault-source">From customer · </span> : null}by {row.uploaded_by} · {bytes(row.size_bytes)}</span>
                        </td>
                        <td><span className="ops-cell-primary document-vault-type">{shipmentDocumentTypeLabels[row.document_type]}</span></td>
                        <td>
                          <span className="ops-cell-primary ops-mono ops-cell-id">{row.shipment_reference}</span>
                          <span className="ops-cell-secondary document-vault-customer">{row.customer_name}</span>
                        </td>
                        {compact ? null : <td><span className="ops-cell-muted" title={dateTime(row.uploaded_at)}>{shortDateTime(row.uploaded_at)}</span></td>}
                        {compact ? null : <td>{row.expires_on ? <span className="document-vault-expiry">{dateOnly(row.expires_on)}</span> : <span className="ops-cell-muted">—</span>}</td>}
                        <td>
                          <div className="freight-documents-review">
                            <OpsBadge tone={statusTone(row.effective_status)}>{statusLabel(row.effective_status)}</OpsBadge>
                            {row.customer_safe ? <span className="freight-documents-safety" data-safe="true"><ShieldCheck size={12} strokeWidth={1.75} aria-hidden="true"/>Customer-safe</span> : <span className="freight-documents-safety">Internal</span>}
                          </div>
                        </td>
                        {compact ? null : <td><span className={`document-vault-next-action${row.effective_status === "verified" ? " is-complete" : row.effective_status === "rejected" || row.effective_status === "expired" ? " is-attention" : ""}`}>{nextAction(row)}</span></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </OpsTableWrap>
          ) : <OpsEmptyState compact kind="search" icon={<Folder size={16} strokeWidth={1.75} aria-hidden="true"/>} title={filtersActive ? "No results" : "No documents"} description={filtersActive ? "Try changing or resetting the current filters." : "No documents are available in the vault."} action={filtersActive ? <OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton> : undefined}/>}
          {visible.length ? <footer className="ops-register-footer"><span>{visible.length} document{visible.length === 1 ? "" : "s"} in this view</span></footer> : null}
        </section>

        {selected ? <Inspector row={selected} role={role} currentUserEmail={currentUserEmail} busyId={busyId} reviewBusy={reviewBusy} onClose={() => update({ selected: null })} onDelete={deleteDocument} onSaveReview={saveReview} inspectorRef={inspectorRef}/> : null}
      </div>
    </div>
  </OpsPage>;
}
