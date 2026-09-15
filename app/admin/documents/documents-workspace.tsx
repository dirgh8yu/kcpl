"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileCheck2, Folder, Search, Trash2, X } from "lucide-react";
import { canDeleteShipmentDocument, canReviewShipmentDocuments } from "../../shipment-document-policy";
import { shipmentDocumentReviewStatusLabels, shipmentDocumentTypes, shipmentDocumentTypeLabels, type ShipmentDocumentEffectiveStatus, type ShipmentDocumentReviewStatus, type ShipmentDocumentType } from "../../shipment-document-types";
import type { KcplStaffRole } from "../staff-permissions";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage } from "../operations-ui";
import type { DocumentVaultDashboard, DocumentVaultRow } from "./documents-data.server";

type StatusFilter = "all" | "pending" | ShipmentDocumentEffectiveStatus;
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

function statusLabel(status: ShipmentDocumentEffectiveStatus) {
  return status === "expired" ? "Expired" : shipmentDocumentReviewStatusLabels[status];
}

function statusTone(status: ShipmentDocumentEffectiveStatus): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "verified") return "success";
  if (status === "received" || status === "under_review") return "warning";
  if (status === "rejected" || status === "expired") return "danger";
  return "neutral";
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: "var(--app-control-height)",
    padding: "0 12px",
    border: `1px solid ${active ? "var(--admin-crimson)" : "var(--admin-line)"}`,
    borderRadius: "var(--app-radius)",
    background: active ? "var(--admin-crimson)" : "var(--admin-surface)",
    color: active ? "white" : "var(--admin-muted)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
}

function Inspector({
  row,
  role,
  currentUserEmail,
  busyId,
  reviewBusy,
  onClose,
  onDelete,
  onSaveReview,
}: {
  row: DocumentVaultRow;
  role: KcplStaffRole;
  currentUserEmail: string;
  busyId: number | null;
  reviewBusy: boolean;
  onClose: () => void;
  onDelete: (row: DocumentVaultRow) => Promise<void>;
  onSaveReview: (event: FormEvent<HTMLFormElement>, row: DocumentVaultRow) => Promise<void>;
}) {
  const canReview = canReviewShipmentDocuments(role) && !["deleted", "superseded"].includes(row.review_status);
  const canDelete = canDeleteShipmentDocument({ role, actorEmail: currentUserEmail, uploadedByEmail: row.uploaded_by_email, status: row.review_status });
  const canSelfVerify = role === "management" || currentUserEmail.trim().toLowerCase() !== (row.uploaded_by_email ?? "").trim().toLowerCase();
  const inactive = row.review_status === "deleted" || row.review_status === "superseded";

  return <aside style={{ width: 380, flexShrink: 0, border: "1px solid var(--admin-line)", borderRadius: "var(--app-surface-radius)", background: "var(--admin-surface)", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: 16, borderBottom: "1px solid var(--admin-line)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 2, fontSize: 12, color: "var(--admin-muted)" }}><OpsMono>{row.shipment_reference}</OpsMono></div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{shipmentDocumentTypeLabels[row.document_type]}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}><OpsBadge tone={statusTone(row.effective_status)}>{statusLabel(row.effective_status)}</OpsBadge>{inactive ? <OpsBadge>Tombstoned</OpsBadge> : null}{row.customer_safe ? <OpsBadge tone="info">Customer-safe</OpsBadge> : null}</div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close document inspector" style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: 0, borderRadius: "var(--app-radius)", background: "transparent", color: "var(--admin-muted)", cursor: "pointer" }}><X size={16}/></button>
    </div>

    {row.review_status === "deleted" ? <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--admin-line)", borderLeft: "4px solid var(--admin-line-strong)", background: "var(--admin-surface-muted)" }}><div style={{ fontWeight: 600, fontSize: 13 }}>Tombstoned · audit record only</div><div style={{ marginTop: 4, fontSize: 12.5, color: "var(--admin-muted)" }}>Removed {dateTime(row.deleted_at)} by {row.deleted_by || row.deleted_by_email || "recorded operator"}. It no longer counts toward readiness.</div></div> : null}
    {row.review_status === "received" || row.review_status === "under_review" ? <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--admin-line)", borderLeft: "4px solid var(--admin-warning)", background: "var(--admin-warning-bg)" }}><div style={{ fontWeight: 600, fontSize: 13, color: "var(--admin-warning)" }}>Upload ≠ verification</div><div style={{ marginTop: 4, fontSize: 12.5 }}>This file remains under evidence review until an authorised reviewer verifies or rejects it.</div></div> : null}

    <div style={{ display: "grid", gap: 10, padding: "12px 16px" }}>
      <Detail label="Document" value={row.filename}/>
      <Detail label="Customer" value={row.customer_name}/>
      <Detail label="Route" value={`${row.origin} → ${row.destination} · ${row.mode}`}/>
      <Detail label="Uploaded" value={`${dateTime(row.uploaded_at)} · ${row.uploaded_by}`}/>
      <Detail label="Reviewed by" value={row.reviewed_by || row.reviewed_by_email || "Not reviewed"}/>
      <Detail label="Expires" value={dateOnly(row.expires_on)}/>
      <Detail label="Branch" value={row.branch || "Branch repair needed"}/>
    </div>

    <div style={{ padding: "0 16px 12px" }}>
      <div style={{ marginBottom: 4, fontSize: 11.5, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>Integrity fingerprint · SHA-256</div>
      <div style={{ padding: "6px 8px", border: "1px solid var(--admin-line)", borderRadius: "var(--app-radius)", background: "var(--admin-surface-muted)", fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{row.sha256 || "Unavailable"}</div>
    </div>

    {row.review_note ? <div style={{ padding: "0 16px 12px" }}><div style={{ marginBottom: 4, fontSize: 11.5, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>Review note</div><div style={{ padding: "6px 8px", border: "1px solid var(--admin-line)", borderRadius: "var(--app-radius)", background: "var(--admin-surface-muted)", fontSize: 13 }}>{row.review_note}</div></div> : null}

    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 16px 14px" }}>
      {row.review_status !== "deleted" ? <a href={`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`} className="ops-button" data-variant="secondary" data-size="sm"><Download size={12}/>Download</a> : null}
      <Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Job File</Link>
      {canDelete ? <OpsButton variant="danger" size="sm" disabled={busyId === row.id} onClick={() => void onDelete(row)}><Trash2 size={12}/>{busyId === row.id ? "Deleting…" : "Delete"}</OpsButton> : null}
    </div>

    {canReview ? <form key={`${row.shipment_reference}:${row.id}:${row.review_status}`} onSubmit={(event) => void onSaveReview(event, row)} style={{ display: "grid", gap: 10, padding: "12px 16px 14px", borderTop: "1px solid var(--admin-line)" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--admin-muted)" }}><FileCheck2 size={14}/>Review evidence</div>
      <label style={{ display: "grid", gap: 5, fontSize: 12.5, color: "var(--admin-muted)" }}>Review state<select name="status" defaultValue={row.review_status} style={{ minHeight: 38, border: "1px solid var(--admin-line)", borderRadius: "var(--app-radius)", background: "var(--admin-surface)", padding: "0 10px", color: "var(--admin-ink)" }}><option value="received">Received</option><option value="under_review">Under review</option><option value="verified" disabled={!canSelfVerify}>Verified</option><option value="rejected">Rejected</option></select></label>
      {!canSelfVerify ? <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>The uploader cannot verify their own document unless they hold management authority.</div> : null}
      <label style={{ display: "grid", gap: 5, fontSize: 12.5, color: "var(--admin-muted)" }}>Expiry date<input name="expiresOn" type="date" defaultValue={row.expires_on || ""} style={{ minHeight: 38, border: "1px solid var(--admin-line)", borderRadius: "var(--app-radius)", padding: "0 10px" }}/></label>
      <label style={{ display: "grid", gap: 5, fontSize: 12.5, color: "var(--admin-muted)" }}>Review note<textarea name="reviewNote" defaultValue={row.review_note || ""} rows={2} style={{ border: "1px solid var(--admin-line)", borderRadius: "var(--app-radius)", padding: "7px 8px", resize: "vertical", font: "inherit" }}/></label>
      <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5 }}><input name="customerSafe" type="checkbox" defaultChecked={row.customer_safe}/>Customer-safe evidence</label>
      <OpsButton type="submit" variant="primary" disabled={reviewBusy}>{reviewBusy ? "Saving…" : "Save review"}</OpsButton>
    </form> : row.effective_status === "verified" && !inactive ? <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px 14px", borderTop: "1px solid var(--admin-line)", color: "var(--admin-success)", fontSize: 12.5 }}><CheckCircle2 size={14}/>Verified · no further review required.</div> : null}
  </aside>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--admin-muted)" }}>{label}</div><div style={{ marginTop: 2, fontSize: 13 }}>{value}</div></div>;
}

export function DocumentsWorkspace({ dashboard, role, currentUserEmail }: { dashboard: DocumentVaultDashboard; role: KcplStaffRole; currentUserEmail: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const pendingReview = dashboard.rows.filter((row) => row.review_status === "received" || row.review_status === "under_review").length;
  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return dashboard.rows.filter((row) => {
      if (status === "pending" && row.review_status !== "received" && row.review_status !== "under_review") return false;
      if (status !== "all" && status !== "pending" && row.effective_status !== status) return false;
      if (!terms.length) return true;
      const haystack = [row.shipment_reference, row.customer_name, row.filename, shipmentDocumentTypeLabels[row.document_type], row.uploaded_by, row.origin, row.destination, row.sha256 ?? ""].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [dashboard.rows, query, status]);
  const selected = selectedKey ? dashboard.rows.find((row) => `${row.shipment_reference}:${row.id}` === selectedKey) ?? null : null;

  async function deleteDocument(row: DocumentVaultRow) {
    if (!window.confirm(`Delete ${row.filename}? The metadata and audit history will be retained.`)) return;
    setBusyId(row.id); setNotice(null);
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(row.shipment_reference)}/documents/${row.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string; warning?: string | null };
      if (!response.ok) throw new Error(data.error || "Could not delete the document.");
      setNotice({ tone: data.warning ? "warning" : "success", text: data.warning || `${row.filename} was tombstoned and removed from active readiness.` });
      setSelectedKey(null); router.refresh();
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

  return <OpsPage>
    <div style={{ padding: "var(--app-page-gap)", minHeight: "calc(100dvh - var(--app-toolbar-height))" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div><h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: "32px", letterSpacing: "-.02em" }}>Document Vault</h1><p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--admin-muted)" }}>Evidence-control workspace · upload ≠ verification · {dashboard.rows.length} documents · {pendingReview} awaiting review</p></div>
        <div style={{ display: "flex", gap: 8 }}><Link href="/admin/freight-documents" className="ops-button" data-variant="secondary" data-size="sm">Freight Documents</Link></div>
      </header>

      {pendingReview > 0 ? <div style={{ marginBottom: 16 }}><OpsNotice tone="warning"><span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><AlertCircle size={15}/><strong>{pendingReview} document{pendingReview === 1 ? "" : "s"} awaiting review.</strong> Upload alone does not constitute verification.</span></OpsNotice></div> : null}
      {notice ? <div style={{ marginBottom: 16 }}><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, height: "var(--app-control-height)", padding: "0 12px", maxWidth: 300, flex: "1 1 260px", border: "1px solid var(--admin-line)", borderRadius: "var(--app-radius)", background: "var(--admin-surface)" }}><Search size={14} style={{ color: "var(--admin-muted)" }}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ref, shipment, customer, type…" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", font: "inherit", fontSize: 13.5 }}/></label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Status filter">
              <button type="button" style={chipStyle(status === "all")} onClick={() => setStatus("all")}>All</button>
              <button type="button" style={chipStyle(status === "pending")} onClick={() => setStatus("pending")}>Pending review</button>
              <button type="button" style={chipStyle(status === "received")} onClick={() => setStatus("received")}>Received</button>
              <button type="button" style={chipStyle(status === "under_review")} onClick={() => setStatus("under_review")}>Under review</button>
              <button type="button" style={chipStyle(status === "verified")} onClick={() => setStatus("verified")}>Verified</button>
              <button type="button" style={chipStyle(status === "rejected")} onClick={() => setStatus("rejected")}>Rejected</button>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--admin-muted)" }}>{visible.length} documents</span>
          </div>

          <section style={{ border: "1px solid var(--admin-line)", borderRadius: "var(--app-surface-radius)", background: "var(--admin-surface)", overflow: "hidden" }}>
            {visible.length ? <div style={{ overflowX: "auto" }}><table className="ops-table" style={{ minWidth: 920 }}><thead><tr><th>Document</th><th>Type</th><th>Shipment</th><th>Uploaded</th><th>Expiry</th><th>Customer-safe</th><th>Review status</th></tr></thead><tbody>{visible.map((row) => {
              const key = `${row.shipment_reference}:${row.id}`;
              const inactive = row.review_status === "deleted" || row.review_status === "superseded";
              return <tr key={key} data-selected={selectedKey === key ? "true" : undefined} tabIndex={0} onClick={() => setSelectedKey(key)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedKey(key); }} style={{ cursor: "pointer", opacity: inactive ? .55 : 1 }}>
                <td><div style={{ fontWeight: 500 }}>{row.filename}</div><div style={{ marginTop: 2, fontSize: 12, color: "var(--admin-muted)" }}>by {row.uploaded_by}</div></td>
                <td>{shipmentDocumentTypeLabels[row.document_type]}</td>
                <td><OpsMono>{row.shipment_reference}</OpsMono><div style={{ marginTop: 2, fontSize: 12, color: "var(--admin-muted)" }}>{row.customer_name}</div></td>
                <td style={{ color: "var(--admin-muted)", whiteSpace: "nowrap" }}>{dateTime(row.uploaded_at)}</td>
                <td style={{ color: row.expires_on ? "var(--admin-warning)" : "var(--admin-muted)" }}>{row.expires_on ? dateOnly(row.expires_on) : "—"}</td>
                <td>{row.customer_safe ? <CheckCircle2 size={14} style={{ color: "var(--admin-success)" }} aria-label="Customer-safe"/> : <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>Internal</span>}</td>
                <td><OpsBadge tone={statusTone(row.effective_status)}>{statusLabel(row.effective_status)}</OpsBadge></td>
              </tr>;
            })}</tbody></table></div> : <OpsEmptyState kind="search" icon={<Folder size={18}/>} title={query || status !== "all" ? "No results" : "No documents"} description={query || status !== "all" ? "Try changing the filter or search term." : "No documents are available in the vault."}/>} 
          </section>
        </div>

        {selected ? <Inspector row={selected} role={role} currentUserEmail={currentUserEmail} busyId={busyId} reviewBusy={reviewBusy} onClose={() => setSelectedKey(null)} onDelete={deleteDocument} onSaveReview={saveReview}/> : null}
      </div>
    </div>
  </OpsPage>;
}
