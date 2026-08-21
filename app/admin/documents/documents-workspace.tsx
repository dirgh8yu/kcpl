"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileClock,
  FileSearch2,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  canDeleteShipmentDocument,
  canReviewShipmentDocuments,
} from "../../shipment-document-policy";
import {
  shipmentDocumentReviewStatusLabels,
  shipmentDocumentTypes,
  shipmentDocumentTypeLabels,
  type ShipmentDocumentEffectiveStatus,
  type ShipmentDocumentReviewStatus,
  type ShipmentDocumentType,
} from "../../shipment-document-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsStat,
  OpsStatStrip,
  OpsSurface,
} from "../operations-ui";
import type { KcplStaffRole } from "../staff-permissions";
import type { DocumentVaultDashboard, DocumentVaultRow } from "./documents-data.server";

type StatusFilter = "active" | "all" | ShipmentDocumentEffectiveStatus;
type Notice = { tone: "success" | "danger" | "warning"; text: string } | null;

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(date) + " NPT";
}

function dateOnly(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeZone: "Asia/Kathmandu",
  }).format(date);
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: ShipmentDocumentEffectiveStatus) {
  if (status === "expired") return "Expired";
  return shipmentDocumentReviewStatusLabels[status];
}

function statusTone(status: ShipmentDocumentEffectiveStatus): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "verified") return "success";
  if (status === "received" || status === "under_review") return "warning";
  if (status === "rejected" || status === "expired") return "danger";
  return "neutral";
}

export function DocumentsWorkspace({
  dashboard,
  role,
  currentUserEmail,
}: {
  dashboard: DocumentVaultDashboard;
  role: KcplStaffRole;
  currentUserEmail: string;
}) {
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

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Operations"
        title="Document Vault"
        description="Shipment evidence with review state, expiry, version history and branch-aware access. A file must be verified and unexpired before it satisfies controlled shipment readiness."
        meta={<><span>{dashboard.active_count} active files</span><span>{dashboard.verified_count} verified</span><span>{dashboard.review_count} awaiting review</span><span>Generated {dateTime(dashboard.generated_at)}</span></>}
        actions={<><Link href="/admin/customs" className="ops-button" data-variant="secondary" data-size="md">Customs control</Link><OpsButton variant="primary" onClick={() => router.refresh()}><RefreshCw size={13}/>Refresh vault</OpsButton></>}
      />

      <OpsStatStrip>
        <OpsStat label="Active" value={dashboard.active_count} icon={<FileText size={13}/>} active={status === "active"} onClick={() => setStatus("active")}/>
        <OpsStat label="Verified" value={dashboard.verified_count} icon={<FileCheck2 size={13}/>} tone="success" active={status === "verified"} onClick={() => setStatus(status === "verified" ? "active" : "verified")}/>
        <OpsStat label="Review queue" value={dashboard.review_count} icon={<FileClock size={13}/>} tone={dashboard.review_count ? "warning" : "neutral"} active={status === "received" || status === "under_review"} onClick={() => setStatus(status === "received" ? "active" : "received")}/>
        <OpsStat label="Rejected" value={dashboard.rejected_count} icon={<AlertTriangle size={13}/>} tone={dashboard.rejected_count ? "danger" : "neutral"} active={status === "rejected"} onClick={() => setStatus(status === "rejected" ? "active" : "rejected")}/>
        <OpsStat label="Expired" value={dashboard.expired_count} icon={<AlertTriangle size={13}/>} tone={dashboard.expired_count ? "danger" : "neutral"} active={status === "expired"} onClick={() => setStatus(status === "expired" ? "active" : "expired")}/>
        <OpsStat label="History" value={dashboard.deleted_count} icon={<ShieldCheck size={13}/>} active={status === "deleted"} onClick={() => setStatus(status === "deleted" ? "active" : "deleted")}/>
      </OpsStatStrip>

      <div className="ops-content ops-stack">
        {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
        {dashboard.cleanup_pending_count ? <OpsNotice tone="warning">{dashboard.cleanup_pending_count} tombstoned file{dashboard.cleanup_pending_count === 1 ? " has" : "s have"} Firebase Storage cleanup pending. They are already inaccessible and do not count toward readiness.</OpsNotice> : null}

        <OpsSurface eyebrow="Shipment evidence" title="Document register" description={`${visible.length} document${visible.length === 1 ? "" : "s"} match this view. Review and expiry states are operational controls, not decorative labels.`} flush>
          <div className="ops-toolbar">
            <label className="relative min-w-[260px] flex-1"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9b9189]"/><input className="ops-input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, filename, uploader, reviewer or hash"/></label>
            <select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="active">Active documents</option><option value="all">All history</option><option value="received">Received</option><option value="under_review">Under review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="expired">Expired</option><option value="superseded">Superseded</option><option value="deleted">Deleted</option>
            </select>
            <select className="ops-select" value={type} onChange={(event) => setType(event.target.value as "all" | ShipmentDocumentType)}><option value="all">All document types</option>{shipmentDocumentTypes.map((item) => <option key={item} value={item}>{shipmentDocumentTypeLabels[item]}</option>)}</select>
            <select className="ops-select" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)}><option value="all">All branches</option>{kcplBranches.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <OpsButton variant="ghost" size="sm" onClick={reset}>Reset</OpsButton>
          </div>

          {visible.length ? <div className="divide-y divide-[#eee7e1]">{visible.map((row) => (
            <DocumentRow
              key={`${row.shipment_reference}:${row.id}`}
              row={row}
              role={role}
              currentUserEmail={currentUserEmail}
              busy={busyId === row.id}
              onDelete={() => deleteDocument(row)}
              onNotice={setNotice}
            />
          ))}</div> : <OpsEmptyState kind="healthy" icon={<FileSearch2 size={18}/>} title="No documents match this view" description="Reset the filters or upload the required file from the relevant Digital Job File." action={<OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton>}/>} 
        </OpsSurface>
      </div>
    </OpsPage>
  );
}

function DocumentRow({
  row,
  role,
  currentUserEmail,
  busy,
  onDelete,
  onNotice,
}: {
  row: DocumentVaultRow;
  role: KcplStaffRole;
  currentUserEmail: string;
  busy: boolean;
  onDelete: () => void;
  onNotice: (notice: Notice) => void;
}) {
  const router = useRouter();
  const [reviewOpen, setReviewOpen] = useState(false);
  const canReview = canReviewShipmentDocuments(role) && !["deleted", "superseded"].includes(row.review_status);
  const canDelete = canDeleteShipmentDocument({ role, actorEmail: currentUserEmail, uploadedByEmail: row.uploaded_by_email, status: row.review_status });
  const canSelfVerify = role === "management" || currentUserEmail.trim().toLowerCase() !== (row.uploaded_by_email ?? "").trim().toLowerCase();

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? "received") as ShipmentDocumentReviewStatus;
    const body = {
      status,
      customerSafe: form.get("customerSafe") === "on",
      reviewNote: String(form.get("reviewNote") ?? ""),
      expiresOn: String(form.get("expiresOn") ?? ""),
    };
    onNotice(null);
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the document review.");
      onNotice({ tone: "success", text: `${row.filename} review state updated.` });
      setReviewOpen(false);
      router.refresh();
    } catch (error) {
      onNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not save the document review." });
    }
  }

  return <article className={`px-4 py-4 sm:px-5 ${row.review_status === "deleted" || row.review_status === "superseded" ? "opacity-70" : ""}`}>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_240px_250px_auto] xl:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><OpsBadge tone={statusTone(row.effective_status)} dot>{statusLabel(row.effective_status)}</OpsBadge><OpsBadge>{shipmentDocumentTypeLabels[row.document_type]}</OpsBadge>{row.customer_safe ? <OpsBadge tone="info">Customer-safe</OpsBadge> : <OpsBadge>Internal</OpsBadge>}{row.branch ? <OpsBadge>{row.branch}</OpsBadge> : <OpsBadge tone="warning">Branch repair needed</OpsBadge>}</div>
        <p className="mt-2 truncate text-[13px] font-[730] text-[#4f4842]">{row.filename}</p>
        <p className="mt-1 text-[10px] text-[#887e76]"><Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="font-semibold hover:text-[#a45747] hover:underline"><OpsMono>{row.shipment_reference}</OpsMono></Link> · {row.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(row.customer_id)}`} className="hover:text-[#a45747] hover:underline">{row.customer_name}</Link> : row.customer_name}</p>
        <p className="mt-1 text-[10px] text-[#938981]">{row.origin} → {row.destination} · {row.mode} · {bytes(row.size_bytes)}</p>
      </div>

      <div className="rounded-[11px] border border-[#e9e2dc] bg-[#faf8f5] p-3">
        <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#8f857d]">Received</p>
        <p className="mt-1 text-[10px] font-semibold text-[#5a514a]">{dateTime(row.uploaded_at)}</p>
        <p className="mt-1 text-[9px] leading-4 text-[#8d837b]">{row.uploaded_by}{row.uploaded_by_email ? ` · ${row.uploaded_by_email}` : ""}</p>
      </div>

      <div className="rounded-[11px] border border-[#e9e2dc] bg-[#faf8f5] p-3">
        <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#8f857d]">Control</p>
        <p className="mt-1 text-[10px] font-semibold text-[#5a514a]">{row.expires_on ? `Expires ${dateOnly(row.expires_on)}` : "No expiry recorded"}</p>
        <p className="mt-1 text-[9px] leading-4 text-[#8d837b]">{row.reviewed_by ? `Reviewed by ${row.reviewed_by} · ${dateTime(row.reviewed_at)}` : "Awaiting first review"}</p>
        {row.review_note ? <p className="mt-1.5 text-[9px] leading-4 text-[#7e746d]">{row.review_note}</p> : null}
        {row.supersedes_document_id ? <p className="mt-1 text-[9px] text-[#8d837b]">Replaces document #{row.supersedes_document_id}</p> : null}
        {row.superseded_by_document_id ? <p className="mt-1 text-[9px] text-[#8d837b]">Superseded by document #{row.superseded_by_document_id}</p> : null}
        {row.storage_delete_pending ? <p className="mt-1 text-[9px] font-semibold text-[#a15f4f]">Storage cleanup pending</p> : null}
      </div>

      <div className="flex flex-wrap gap-2 xl:justify-end">
        {row.review_status !== "deleted" ? <a href={`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`} className="ops-button" data-variant="secondary" data-size="sm"><Download size={11}/>Download</a> : null}
        <Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="ops-button" data-variant="ghost" data-size="sm">Job File</Link>
        {canReview ? <OpsButton variant="secondary" size="sm" onClick={() => setReviewOpen((value) => !value)}><FileCheck2 size={11}/>{reviewOpen ? "Close review" : "Review"}</OpsButton> : null}
        {canDelete ? <OpsButton variant="danger" size="sm" disabled={busy} onClick={onDelete}><Trash2 size={11}/>{busy ? "Deleting…" : "Delete"}</OpsButton> : null}
      </div>
    </div>

    {reviewOpen ? <form onSubmit={saveReview} className="mt-4 grid gap-3 rounded-[12px] border border-[#e8dfd8] bg-[#fcfaf8] p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="grid gap-1.5 text-[10px] font-semibold text-[#6f655d]">Review status<select name="status" defaultValue={row.review_status} className="ops-select"><option value="received">Received</option><option value="under_review">Under review</option>{canSelfVerify ? <option value="verified">Verified</option> : null}<option value="rejected">Rejected</option></select></label>
      <label className="grid gap-1.5 text-[10px] font-semibold text-[#6f655d]">Expiry date<input name="expiresOn" type="date" defaultValue={row.expires_on ?? ""} className="ops-input"/></label>
      <label className="grid gap-1.5 text-[10px] font-semibold text-[#6f655d] md:col-span-2">Review note<input name="reviewNote" defaultValue={row.review_note ?? ""} className="ops-input" placeholder="Required when rejecting; useful for verification notes"/></label>
      <label className="flex items-center gap-2 text-[10px] font-semibold text-[#6f655d]"><input name="customerSafe" type="checkbox" defaultChecked={row.customer_safe}/>Safe for customer-facing use</label>
      <div className="md:col-span-2 xl:col-span-3 flex items-center justify-end"><OpsButton variant="primary" size="sm"><CheckCircle2 size={11}/>Save review</OpsButton></div>
    </form> : null}
  </article>;
}
