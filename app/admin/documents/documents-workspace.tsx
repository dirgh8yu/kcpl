"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileCheck2, FileClock, FileSearch2, FileText, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { canDeleteShipmentDocument, canReviewShipmentDocuments } from "../../shipment-document-policy";
import { shipmentDocumentReviewStatusLabels, shipmentDocumentTypes, shipmentDocumentTypeLabels, type ShipmentDocumentEffectiveStatus, type ShipmentDocumentReviewStatus, type ShipmentDocumentType } from "../../shipment-document-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage } from "../operations-ui";
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
function statusLabel(status: ShipmentDocumentEffectiveStatus) { return status === "expired" ? "Expired" : shipmentDocumentReviewStatusLabels[status]; }
function statusTone(status: ShipmentDocumentEffectiveStatus): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "verified") return "success";
  if (status === "received" || status === "under_review") return "warning";
  if (status === "rejected" || status === "expired") return "danger";
  return "neutral";
}

function Metric({ label, value, active, alert, onClick }: { label: string; value: number; active?: boolean; alert?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`min-h-[106px] border-b border-[#D6D6D0] px-4 py-5 text-left transition-colors hover:bg-[#EEEEE8] sm:border-b-0 sm:border-r sm:last:border-r-0 ${active ? "bg-[#EEEEE8]" : ""}`}><span className="flex items-center justify-between text-[10px] uppercase tracking-[0.07em] text-[#5B5B57]"><span>{label}</span>{active ? <span className="h-2 w-2 bg-[#DC143C]"/> : null}</span><strong className={`mt-4 block text-[31px] font-normal leading-none tracking-[-0.045em] ${alert && value ? "text-[#DC143C]" : "text-[#101010]"}`}>{value}</strong></button>;
}

export function DocumentsWorkspace({ dashboard, role, currentUserEmail }: { dashboard: DocumentVaultDashboard; role: KcplStaffRole; currentUserEmail: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [type, setType] = useState<"all" | ShipmentDocumentType>("all");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return dashboard.rows.filter((row) => {
      if (status === "active" && ["deleted", "superseded"].includes(row.review_status)) return false;
      if (status !== "active" && status !== "all" && row.effective_status !== status) return false;
      if (type !== "all" && row.document_type !== type) return false;
      if (branch !== "all" && !row.handling_branches.includes(branch)) return false;
      if (!terms.length) return true;
      const haystack = [row.shipment_reference, row.customer_id ?? "", row.customer_name, row.filename, shipmentDocumentTypeLabels[row.document_type], row.uploaded_by, row.uploaded_by_email ?? "", row.reviewed_by ?? "", row.reviewed_by_email ?? "", row.verified_by ?? "", row.verified_by_email ?? "", row.review_note ?? "", row.origin, row.destination, row.mode, row.branch ?? "", statusLabel(row.effective_status), row.sha256 ?? ""].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [branch, dashboard.rows, query, status, type]);

  function reset() { setQuery(""); setStatus("active"); setType("all"); setBranch("all"); }

  async function deleteDocument(row: DocumentVaultRow) {
    if (!window.confirm(`Delete ${row.filename}? The metadata and audit history will be retained.`)) return;
    setBusyId(row.id); setNotice(null);
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string; warning?: string | null };
      if (!response.ok) throw new Error(data.error || "Could not delete the document.");
      setNotice({ tone: data.warning ? "warning" : "success", text: data.warning || `${row.filename} was tombstoned and removed from active document readiness.` });
      router.refresh();
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not delete the document." }); }
    finally { setBusyId(null); }
  }

  return <OpsPage><main className="min-h-[calc(100vh-64px)] bg-[#F6F6F3] text-[#101010]"><div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
    <header className="grid gap-6 border-b border-[#101010] pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><div><p className="text-[10px] uppercase tracking-[0.11em] text-[#DC143C]">Operations · Evidence control</p><h1 className="mt-3 text-[clamp(36px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.04em]">Document Vault</h1><p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#5B5B57]">Control shipment evidence, review state, expiry and version history. Only verified, current files satisfy readiness.</p><p className="mt-3 text-[10px] uppercase tracking-[0.05em] text-[#8A8A84]">Generated {dateTime(dashboard.generated_at)}</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/freight-documents" className="inline-flex h-10 items-center border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Freight Documents</Link><Link href="/admin/customs" className="inline-flex h-10 items-center border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Customs</Link><button type="button" onClick={() => router.refresh()} className="inline-flex h-10 items-center gap-2 border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white hover:border-[#B61032] hover:bg-[#B61032]"><RefreshCw size={13}/>Refresh vault</button></div></header>

    <section className="grid border-b border-[#D6D6D0] sm:grid-cols-3 lg:grid-cols-6"><Metric label="Active" value={dashboard.active_count} active={status === "active"} onClick={() => setStatus("active")}/><Metric label="Verified" value={dashboard.verified_count} active={status === "verified"} onClick={() => setStatus(status === "verified" ? "active" : "verified")}/><Metric label="Review queue" value={dashboard.review_count} alert active={status === "received" || status === "under_review"} onClick={() => setStatus(status === "received" ? "active" : "received")}/><Metric label="Rejected" value={dashboard.rejected_count} alert active={status === "rejected"} onClick={() => setStatus(status === "rejected" ? "active" : "rejected")}/><Metric label="Expired" value={dashboard.expired_count} alert active={status === "expired"} onClick={() => setStatus(status === "expired" ? "active" : "expired")}/><Metric label="History" value={dashboard.deleted_count} active={status === "deleted"} onClick={() => setStatus(status === "deleted" ? "active" : "deleted")}/></section>

    {notice ? <div className="mt-5"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}
    {dashboard.cleanup_pending_count ? <div className="mt-3"><OpsNotice tone="warning">{dashboard.cleanup_pending_count} tombstoned file{dashboard.cleanup_pending_count === 1 ? " has" : "s have"} storage cleanup pending. They are inaccessible and do not count toward readiness.</OpsNotice></div> : null}

    <section className="mt-6 border-y border-[#D6D6D0]">
      <div className="grid gap-3 border-b border-[#101010] py-4 md:grid-cols-[minmax(260px,1fr)_190px_220px_170px_auto]">
        <label className="flex h-10 items-center border border-[#BDBDB6] bg-white px-3"><Search size={13} className="mr-2 text-[#777771]"/><input className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8A8A84]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, filename, reviewer or hash"/></label>
        <select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="active">Active documents</option><option value="all">All history</option><option value="received">Received</option><option value="under_review">Under review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="expired">Expired</option><option value="superseded">Superseded</option><option value="deleted">Deleted</option></select>
        <select className="ops-select" value={type} onChange={(event) => setType(event.target.value as "all" | ShipmentDocumentType)}><option value="all">All document types</option>{shipmentDocumentTypes.map((item) => <option key={item} value={item}>{shipmentDocumentTypeLabels[item]}</option>)}</select>
        <select className="ops-select" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)}><option value="all">All branches</option>{kcplBranches.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <button type="button" onClick={reset} className="h-10 border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Reset</button>
      </div>

      <div className="hidden min-h-11 grid-cols-[minmax(240px,1.4fr)_190px_210px_190px_auto] items-center gap-4 border-b border-[#101010] px-3 text-[10px] uppercase tracking-[0.06em] text-[#5B5B57] lg:grid"><span>Document / shipment</span><span>Status</span><span>Received</span><span>Control</span><span className="text-right">Actions</span></div>
      {visible.length ? <div>{visible.map((row) => <DocumentRow key={`${row.shipment_reference}:${row.id}`} row={row} role={role} currentUserEmail={currentUserEmail} busy={busyId === row.id} onDelete={() => deleteDocument(row)} onNotice={setNotice}/>)}</div> : <div className="py-12"><OpsEmptyState kind="healthy" icon={<FileSearch2 size={18}/>} title="No documents match this view" description="Reset the filters or upload the required file from the relevant Digital Job File." action={<OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton>}/></div>}
    </section>
  </div></main></OpsPage>;
}

function DocumentRow({ row, role, currentUserEmail, busy, onDelete, onNotice }: { row: DocumentVaultRow; role: KcplStaffRole; currentUserEmail: string; busy: boolean; onDelete: () => void; onNotice: (notice: Notice) => void }) {
  const router = useRouter();
  const [reviewOpen, setReviewOpen] = useState(false);
  const canReview = canReviewShipmentDocuments(role) && !["deleted", "superseded"].includes(row.review_status);
  const canDelete = canDeleteShipmentDocument({ role, actorEmail: currentUserEmail, uploadedByEmail: row.uploaded_by_email, status: row.review_status });
  const canSelfVerify = role === "management" || currentUserEmail.trim().toLowerCase() !== (row.uploaded_by_email ?? "").trim().toLowerCase();

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reviewStatus = String(form.get("status") ?? "received") as ShipmentDocumentReviewStatus;
    const body = { status: reviewStatus, customerSafe: form.get("customerSafe") === "on", reviewNote: String(form.get("reviewNote") ?? ""), expiresOn: String(form.get("expiresOn") ?? "") };
    onNotice(null);
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the document review.");
      onNotice({ tone: "success", text: `${row.filename} review state updated.` }); setReviewOpen(false); router.refresh();
    } catch (error) { onNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not save the document review." }); }
  }

  const inactive = row.review_status === "deleted" || row.review_status === "superseded";
  return <article className={`border-b border-[#D6D6D0] last:border-b-0 ${inactive ? "opacity-65" : ""}`}>
    <div className="grid gap-4 px-3 py-4 transition-colors hover:bg-[#EEEEE8] lg:grid-cols-[minmax(240px,1.4fr)_190px_210px_190px_auto] lg:items-start">
      <div className="min-w-0"><p className="truncate text-[13px] font-medium">{row.filename}</p><p className="mt-1 text-[10px] text-[#777771]"><Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="font-medium hover:text-[#DC143C]"><OpsMono>{row.shipment_reference}</OpsMono></Link> · {row.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(row.customer_id)}`} className="hover:text-[#DC143C]">{row.customer_name}</Link> : row.customer_name}</p><p className="mt-1 text-[10px] text-[#8A8A84]">{row.origin} → {row.destination} · {row.mode} · {bytes(row.size_bytes)}</p><div className="mt-2 flex flex-wrap gap-1.5"><OpsBadge>{shipmentDocumentTypeLabels[row.document_type]}</OpsBadge>{row.customer_safe ? <OpsBadge tone="info">Customer-safe</OpsBadge> : <OpsBadge>Internal</OpsBadge>}{row.branch ? <OpsBadge>{row.branch}</OpsBadge> : <OpsBadge tone="warning">Branch repair needed</OpsBadge>}</div></div>
      <div><OpsBadge tone={statusTone(row.effective_status)} dot>{statusLabel(row.effective_status)}</OpsBadge><p className="mt-2 text-[10px] leading-4 text-[#777771]">{row.sha256 ? `SHA ${row.sha256.slice(0, 12)}…` : "Hash unavailable"}</p></div>
      <div><p className="text-[11px] font-medium">{dateTime(row.uploaded_at)}</p><p className="mt-1 text-[9px] leading-4 text-[#777771]">{row.uploaded_by}{row.uploaded_by_email ? ` · ${row.uploaded_by_email}` : ""}</p></div>
      <div><p className="text-[11px] font-medium">{row.expires_on ? `Expires ${dateOnly(row.expires_on)}` : "No expiry"}</p><p className="mt-1 text-[9px] leading-4 text-[#777771]">{row.reviewed_by ? `Reviewed by ${row.reviewed_by}` : "Awaiting first review"}</p>{row.review_note ? <p className="mt-1 text-[9px] leading-4 text-[#666660]">{row.review_note}</p> : null}{row.storage_delete_pending ? <p className="mt-1 text-[9px] font-medium text-[#DC143C]">Storage cleanup pending</p> : null}</div>
      <div className="flex flex-wrap gap-2 lg:justify-end">{row.review_status !== "deleted" ? <a href={`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`} className="ops-button" data-variant="secondary" data-size="sm"><Download size={11}/>Download</a> : null}<Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="ops-button" data-variant="ghost" data-size="sm">Job File</Link>{canReview ? <OpsButton variant="secondary" size="sm" onClick={() => setReviewOpen((value) => !value)}><FileCheck2 size={11}/>{reviewOpen ? "Close" : "Review"}</OpsButton> : null}{canDelete ? <OpsButton variant="danger" size="sm" disabled={busy} onClick={onDelete}><Trash2 size={11}/>{busy ? "Deleting…" : "Delete"}</OpsButton> : null}</div>
    </div>

    {reviewOpen ? <form onSubmit={saveReview} className="grid gap-3 border-t border-[#BEBEB7] bg-[#EEEEE8] px-4 py-5 md:grid-cols-2 xl:grid-cols-[180px_180px_minmax(280px,1fr)_220px_auto] xl:items-end"><label className="grid gap-1.5 text-[10px] font-medium text-[#5B5B57]">Review status<select name="status" defaultValue={row.review_status} className="ops-select"><option value="received">Received</option><option value="under_review">Under review</option>{canSelfVerify ? <option value="verified">Verified</option> : null}<option value="rejected">Rejected</option></select></label><label className="grid gap-1.5 text-[10px] font-medium text-[#5B5B57]">Expiry date<input name="expiresOn" type="date" defaultValue={row.expires_on ?? ""} className="ops-input"/></label><label className="grid gap-1.5 text-[10px] font-medium text-[#5B5B57]">Review note<input name="reviewNote" defaultValue={row.review_note ?? ""} className="ops-input" placeholder="Required when rejecting; useful for verification notes"/></label><label className="flex min-h-10 items-center gap-2 text-[10px] font-medium text-[#5B5B57]"><input name="customerSafe" type="checkbox" defaultChecked={row.customer_safe}/>Safe for customer-facing use</label><OpsButton variant="primary" size="sm"><CheckCircle2 size={11}/>Save review</OpsButton></form> : null}
  </article>;
}
