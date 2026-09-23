"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Archive, Download, FileText, LoaderCircle, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { kcplBranches } from "../../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsInlineAlert, OpsInspectorNote, OpsKpiRail, OpsNotice, OpsPage, OpsPageHeader, OpsRailMetric, OpsSearch, OpsSurface, OpsTableWrap } from "../../operations-ui";
import {
  archiveCategories,
  archiveCategoryLabels,
  archiveEntityHref,
  archiveEntityTypeLabels,
  archiveEntityTypes,
  type ArchiveCategory,
  type ArchiveEntityType,
  type PaperArchiveDashboard,
  type PaperArchiveRecord,
} from "./archive-data";

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date);
}

function dateOnly(value: string | null) {
  if (!value) return "Date not recorded";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

export function PaperArchiveWorkspace({ initialDashboard }: { initialDashboard: PaperArchiveDashboard | null }) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"upload" | "refresh" | "">("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "shipment_file" as ArchiveCategory,
    branch: "Kathmandu",
    documentDate: "",
    physicalReference: "",
    entityType: "general" as ArchiveEntityType,
    entityReference: "",
    notes: "",
  });

  const records = useMemo(() => dashboard?.records ?? [], [dashboard]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) => [
      record.id,
      record.title,
      record.filename,
      record.branch,
      record.entity_reference,
      record.entity_label,
      record.physical_reference,
      record.sha256,
      record.recovery_id,
      record.recovery_original_entity_reference,
      record.recovery_original_entity_label,
    ].some((value) => value?.toLowerCase().includes(needle)));
  }, [query, records]);

  async function refresh() {
    setBusy("refresh");
    setError("");
    try {
      const response = await fetch("/api/admin/migration/archive", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; error?: string; dashboard?: PaperArchiveDashboard };
      if (!response.ok || !payload.ok || !payload.dashboard) throw new Error(payload.error || "Paper archive could not be refreshed.");
      setDashboard(payload.dashboard);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paper archive could not be refreshed.");
    } finally {
      setBusy("");
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy("upload");
    setNotice("");
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("title", form.title);
      body.set("category", form.category);
      body.set("branch", form.branch);
      body.set("documentDate", form.documentDate);
      body.set("physicalReference", form.physicalReference);
      body.set("entityType", form.entityType);
      body.set("entityReference", form.entityReference);
      body.set("notes", form.notes);
      const response = await fetch("/api/admin/migration/archive", { method: "POST", body });
      const payload = await response.json() as { ok?: boolean; error?: string; record?: PaperArchiveRecord };
      if (!response.ok || !payload.ok || !payload.record) throw new Error(payload.error || "Paper file could not be archived.");
      const record = payload.record;
      setDashboard((current) => ({ records: [record, ...(current?.records ?? [])], total: (current?.total ?? 0) + 1, storage_available: true }));
      setNotice(`${record.id} archived with SHA-256 integrity fingerprint.`);
      setFile(null);
      setForm((current) => ({ ...current, title: "", documentDate: "", physicalReference: "", entityReference: "", notes: "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paper file could not be archived.");
    } finally {
      setBusy("");
    }
  }

  const linkedCount = records.filter((record) => record.entity_type !== "general").length;
  const recoveredCount = records.filter((record) => Boolean(record.recovery_id)).length;
  const branchCount = new Set(records.map((record) => record.branch)).size;

  return <OpsPage>
    <OpsPageHeader
      title="Paper Archive"
      description="Historical paper trail with record links and SHA-256 fingerprints. Recovery never deletes it."
      meta={<span>Management only · 20 MB per file · no destructive archive actions</span>}
      actions={<>
        <Link href="/admin/migration" className="ops-button" data-variant="secondary" data-size="md">Migration Hub</Link>
        <Link href="/admin/migration/recovery" className="ops-button" data-variant="secondary" data-size="md">Recovery Centre</Link>
        <OpsButton variant="secondary" disabled={Boolean(busy)} onClick={() => void refresh()}>{busy === "refresh" ? <LoaderCircle size={16} strokeWidth={1.75} className="animate-spin" aria-hidden="true"/> : <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true"/>}Refresh</OpsButton>
      </>}
    />

    <div className="px-4 pb-8 pt-4 md:px-6 org-stack">
      <OpsKpiRail label="Paper archive summary">
        <OpsRailMetric label="Archived files" value={records.length} detail="Evidence retained"/>
        <OpsRailMetric label="Linked records" value={linkedCount} detail="Connected to KCPL records"/>
        <OpsRailMetric label="Recovery preserved" value={recoveredCount} detail="Re-linked by Stage 4C"/>
        <OpsRailMetric label="Branches represented" value={branchCount}/>
        <OpsRailMetric label="Storage" value={dashboard?.storage_available ? "Ready" : "Unavailable"} tone={dashboard?.storage_available ? "success" : "danger"} title="Firebase Storage"/>
      </OpsKpiRail>

      {error || notice || !dashboard || !dashboard.storage_available ? <div className="org-stack org-notices">
        {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
        {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
        {!dashboard ? <OpsInlineAlert>Archive metadata could not be preloaded. Refresh after Firebase is available.</OpsInlineAlert> : null}
        {dashboard && !dashboard.storage_available ? <OpsInlineAlert>Firebase metadata is available, but Storage is not configured. Existing archive metadata can be reviewed; new paper files cannot be uploaded.</OpsInlineAlert> : null}
      </div> : null}

      <OpsSurface density="compact" title="Stage 4B intake" description="Scan → identify → link → preserve. Upload one source document at a time so its provenance stays explicit; operational, customer, partner and finance papers should link to the matching KCPL record.">
        <form onSubmit={upload} className="archive-intake">
          <div className="ops-form-grid archive-fields">
            <OpsField label="Archive title" className="ops-form-full"><input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. 2019 Birgunj customs file · ABC Trading"/></OpsField>
            <OpsField label="Category"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ArchiveCategory })}>{archiveCategories.map((category) => <option key={category} value={category}>{archiveCategoryLabels[category]}</option>)}</select></OpsField>
            <OpsField label="KCPL branch"><select value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })}>{kcplBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></OpsField>
            <OpsField label="Document date"><input type="date" value={form.documentDate} onChange={(event) => setForm({ ...form, documentDate: event.target.value })}/></OpsField>
            <OpsField label="Physical box / folder"><input maxLength={120} value={form.physicalReference} onChange={(event) => setForm({ ...form, physicalReference: event.target.value })} placeholder="Box 12 · Shelf B"/></OpsField>
            <OpsField label="Link to"><select value={form.entityType} onChange={(event) => setForm({ ...form, entityType: event.target.value as ArchiveEntityType, entityReference: "" })}>{archiveEntityTypes.map((type) => <option key={type} value={type}>{archiveEntityTypeLabels[type]}</option>)}</select></OpsField>
            <OpsField label="KCPL record reference"><input disabled={form.entityType === "general"} required={form.entityType !== "general"} value={form.entityReference} onChange={(event) => setForm({ ...form, entityReference: event.target.value })} placeholder={form.entityType === "general" ? "Not required" : "Exact record ID / reference"}/></OpsField>
            <OpsField label="Archive notes" className="ops-form-full"><textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="What the paper is, where it came from, and anything Management should know."/></OpsField>
          </div>

          <div className="archive-side">
            <label className="migration-drop">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)}/>
              <Upload size={16} strokeWidth={1.75} aria-hidden="true"/>
              <strong>{file ? file.name : "Choose scanned paper file"}</strong>
              <span>{file ? `${bytes(file.size)} · ${file.type || "type inferred from extension"}` : "PDF, image, Word, Excel, CSV or TXT · up to 20 MB"}</span>
            </label>
            <OpsInspectorNote tone="neutral" icon={<ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Archive integrity">KCPL stores a SHA-256 fingerprint with every file. Stage 4C cannot erase archived evidence; if its linked record is reversed, the archive keeps the original link metadata and moves its live link to the migration batch.</OpsInspectorNote>
            <OpsButton type="submit" variant="primary" size="sm" disabled={!file || !form.title.trim() || Boolean(busy) || dashboard?.storage_available === false}>{busy === "upload" ? <LoaderCircle size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true"/> : <Archive size={14} strokeWidth={1.75} aria-hidden="true"/>}Archive paper file</OpsButton>
          </div>
        </form>
      </OpsSurface>

      <OpsSurface density="compact" title="Historical evidence" description={`${filtered.length} of ${records.length} archived file${records.length === 1 ? "" : "s"} shown.`} action={<OpsSearch className="org-surface-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search archive…" aria-label="Search paper archive"/>} flush>
        {filtered.length ? <OpsTableWrap><table className="ops-table ops-register-table archive-table" aria-label="Paper archive"><thead><tr><th>Archive ID</th><th>Document</th><th>Linked record</th><th>Branch · folder</th><th>Integrity</th><th>Archived by</th><th><span className="sr-only">Download</span></th></tr></thead><tbody>{filtered.map((record) => {
          const href = archiveEntityHref(record);
          return <tr key={record.id}>
            <td><span className="ops-cell-primary ops-mono ops-cell-id">{record.id}</span><span className="ops-cell-secondary">{dateTime(record.uploaded_at)} NPT</span>{record.recovery_id ? <span className="archive-badge"><OpsBadge tone="warning">Recovery preserved</OpsBadge></span> : null}</td>
            <td><span className="ops-cell-primary ops-cell-clamp" title={record.title}>{record.title}</span><span className="ops-cell-secondary">{archiveCategoryLabels[record.category]} · {dateOnly(record.document_date)} · {bytes(record.size_bytes)}</span><span className="ops-cell-secondary ops-cell-clamp" title={record.filename}>{record.filename}</span></td>
            <td>{record.entity_reference ? <>
              {href ? <Link href={href} className="ops-cell-primary ops-cell-clamp org-link">{record.entity_label || record.entity_reference}</Link> : <span className="ops-cell-primary ops-cell-clamp">{record.entity_label || record.entity_reference}</span>}
              <span className="ops-cell-secondary">{archiveEntityTypeLabels[record.entity_type]} · <span className="ops-mono">{record.entity_reference}</span></span>
              {record.recovery_original_entity_reference ? <span className="archive-original">Original link: {record.recovery_original_entity_label || record.recovery_original_entity_reference}{record.recovery_original_entity_type ? ` · ${archiveEntityTypeLabels[record.recovery_original_entity_type]}` : ""} · <span className="ops-mono">{record.recovery_original_entity_reference}</span>{record.recovery_id ? <> · recovery <span className="ops-mono">{record.recovery_id}</span></> : null}</span> : null}
            </> : <OpsBadge>General archive</OpsBadge>}</td>
            <td><span className="ops-cell-primary">{record.branch}</span><span className="ops-cell-secondary ops-cell-clamp">{record.physical_reference || "No physical reference"}</span>{record.recovery_relinked_at ? <span className="ops-cell-secondary">Re-linked {dateTime(record.recovery_relinked_at)} NPT</span> : null}</td>
            <td><span className="archive-integrity"><ShieldCheck size={12} strokeWidth={1.75} aria-hidden="true"/>SHA-256</span><span className="archive-hash ops-mono" title={record.sha256}>{record.sha256 || "Fingerprint unavailable"}</span></td>
            <td><span className="ops-cell-primary">{record.uploaded_by_name}</span><span className="ops-cell-secondary ops-cell-clamp">{record.uploaded_by_email}</span>{record.recovery_relinked_by_name ? <span className="ops-cell-secondary">Recovery: {record.recovery_relinked_by_name}</span> : null}</td>
            <td className="ops-cell-actions"><a href={`/api/admin/migration/archive/${encodeURIComponent(record.id)}/download`} className="ops-button" data-variant="ghost" data-size="xs"><Download size={14} strokeWidth={1.75} aria-hidden="true"/>Download</a></td>
          </tr>;
        })}</tbody></table></OpsTableWrap> : <OpsEmptyState compact icon={<FileText size={16} strokeWidth={1.75} aria-hidden="true"/>} title={records.length ? "No archive matches" : "Paper archive is empty"} description={records.length ? "Try a different archive ID, title, branch, record reference, recovery ID or physical folder." : "Upload the first historical KCPL paper file above. It will appear here with its provenance and integrity fingerprint."}/>}
      </OpsSurface>
    </div>
  </OpsPage>;
}
