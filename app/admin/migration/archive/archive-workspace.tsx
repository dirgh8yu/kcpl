"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Archive, Building2, Download, FileCheck2, FileText, LoaderCircle, RefreshCw, Search, ShieldCheck, Upload } from "lucide-react";
import { kcplBranches } from "../../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsKpiCard, OpsKpiStrip, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../operations-ui";
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
      eyebrow="Migration Hub · Stage 4B"
      title="Paper Archive"
      description="Preserve KCPL's historical paper trail in Firebase Storage with searchable metadata, record links and a SHA-256 integrity fingerprint. Stage 4C recovery never deletes this evidence; when a linked record is safely reversed, its archive evidence is re-linked to the migration batch."
      meta={<><span>Management only</span><span>20 MB per file</span><span>No destructive archive actions</span></>}
      actions={<><Link href="/admin/migration/recovery" className="ops-button" data-variant="secondary" data-size="md">Recovery Centre</Link><Link href="/admin/migration" className="ops-button" data-variant="secondary" data-size="md">Migration Hub</Link><OpsButton variant="secondary" disabled={Boolean(busy)} onClick={() => void refresh()}>{busy === "refresh" ? <LoaderCircle size={12} className="animate-spin"/> : <RefreshCw size={12}/>}Refresh</OpsButton></>}
    />

    <OpsKpiStrip>
      <OpsKpiCard label="Archived files" value={String(records.length)} detail="Historical evidence retained" icon={<Archive size={18} strokeWidth={1.9} aria-hidden="true"/>} tone="success"/>
      <OpsKpiCard label="Linked records" value={String(linkedCount)} detail="Connected to KCPL entities" icon={<FileCheck2 size={18} strokeWidth={1.9} aria-hidden="true"/>} tone="success"/>
      <OpsKpiCard label="Recovery preserved" value={String(recoveredCount)} detail="Re-linked by Stage 4C" icon={<ShieldCheck size={18} strokeWidth={1.9} aria-hidden="true"/>} tone="success"/>
      <OpsKpiCard label="Branches represented" value={String(branchCount)} detail="Based on archive metadata" icon={<Building2 size={18} strokeWidth={1.9} aria-hidden="true"/>} />
      <OpsKpiCard label="Storage" value={dashboard?.storage_available ? "Ready" : "Unavailable"} detail="Firebase Storage" icon={<ShieldCheck size={18} strokeWidth={1.9} aria-hidden="true"/>} tone={dashboard?.storage_available ? "success" : "danger"}/>
    </OpsKpiStrip>

    <div className="ops-content-wide ops-stack">
      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
      {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {!dashboard ? <OpsNotice tone="warning">Archive metadata could not be preloaded. Refresh after Firebase is available.</OpsNotice> : null}
      {dashboard && !dashboard.storage_available ? <OpsNotice tone="warning">Firebase metadata is available, but Storage is not configured. Existing archive metadata can be reviewed, but new paper files cannot be uploaded.</OpsNotice> : null}

      <OpsSurface eyebrow="Stage 4B intake" title="Scan → identify → link → preserve" description="Upload one source document at a time so its provenance stays explicit. General records may remain unlinked; operational, customer, partner and finance papers should link to the matching KCPL record whenever possible.">
        <form onSubmit={upload} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <OpsField label="Archive title" className="sm:col-span-2"><input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. 2019 Birgunj customs file · ABC Trading"/></OpsField>
            <OpsField label="Category"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ArchiveCategory })}>{archiveCategories.map((category) => <option key={category} value={category}>{archiveCategoryLabels[category]}</option>)}</select></OpsField>
            <OpsField label="KCPL branch"><select value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })}>{kcplBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></OpsField>
            <OpsField label="Document date"><input type="date" value={form.documentDate} onChange={(event) => setForm({ ...form, documentDate: event.target.value })}/></OpsField>
            <OpsField label="Physical box / folder"><input maxLength={120} value={form.physicalReference} onChange={(event) => setForm({ ...form, physicalReference: event.target.value })} placeholder="Box 12 · Shelf B"/></OpsField>
            <OpsField label="Link to"><select value={form.entityType} onChange={(event) => setForm({ ...form, entityType: event.target.value as ArchiveEntityType, entityReference: "" })}>{archiveEntityTypes.map((type) => <option key={type} value={type}>{archiveEntityTypeLabels[type]}</option>)}</select></OpsField>
            <OpsField label="KCPL record reference"><input disabled={form.entityType === "general"} required={form.entityType !== "general"} value={form.entityReference} onChange={(event) => setForm({ ...form, entityReference: event.target.value })} placeholder={form.entityType === "general" ? "Not required" : "Exact record ID / reference"}/></OpsField>
            <OpsField label="Archive notes" className="sm:col-span-2"><textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="What the paper is, where it came from, and anything Management should know."/></OpsField>
          </div>

          <div className="rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4">
            <label className="block cursor-pointer rounded-[var(--app-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-surface)] p-6 text-center transition hover:border-[var(--admin-accent-line)]">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)}/>
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-[var(--app-radius)] bg-[var(--admin-accent-bg)] text-[var(--admin-crimson)]"><Upload size={17}/></span>
              <strong className="mt-3 block text-[11px] text-[var(--admin-ink)]">{file ? file.name : "Choose scanned paper file"}</strong>
              <span className="mt-1 block text-[length:var(--app-label-size)] leading-4 text-[var(--admin-faint)]">PDF, image, Word, Excel, CSV or TXT · up to 20 MB</span>
            </label>
            {file ? <div className="mt-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-white p-3 text-[length:var(--app-label-size)] text-[var(--admin-muted)]"><strong className="block text-[var(--admin-ink)]">{bytes(file.size)}</strong><span>{file.type || "Type inferred from extension"}</span></div> : null}
            <div className="mt-4 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-white p-3 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]"><strong className="block text-[length:var(--app-label-size)] text-[var(--admin-ink)]">Archive integrity</strong>KCPL stores a SHA-256 fingerprint with every file. Stage 4C cannot erase archived evidence. If its linked source record is reversed, the archive keeps the original link metadata and moves its live link to the migration batch.</div>
            <OpsButton type="submit" variant="primary" className="mt-4 w-full justify-center" disabled={!file || !form.title.trim() || Boolean(busy) || dashboard?.storage_available === false}>{busy === "upload" ? <LoaderCircle size={12} className="animate-spin"/> : <Archive size={12}/>}Archive paper file</OpsButton>
          </div>
        </form>
      </OpsSurface>

      <OpsSurface eyebrow="Archive register" title="Historical evidence" description={`${filtered.length} of ${records.length} archived file${records.length === 1 ? "" : "s"} shown.`} action={<label className="relative block min-w-[240px]"><Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-faint)]"/><input aria-label="Search paper archive" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search archive..." className="w-full rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-white py-2 pl-8 pr-3 text-[length:var(--app-label-size)] outline-none focus:border-[var(--admin-accent-line)]"/></label>} flush>
        {filtered.length ? <div className="ops-table-wrap"><table className="ops-table min-w-[1160px]"><thead><tr><th>Archive ID</th><th>Document</th><th>Linked record</th><th>Branch / source</th><th>Integrity</th><th>Archived by</th><th></th></tr></thead><tbody>{filtered.map((record) => {
          const href = archiveEntityHref(record);
          return <tr key={record.id}><td><OpsMono>{record.id}</OpsMono><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{dateTime(record.uploaded_at)} NPT</p>{record.recovery_id ? <p className="mt-1"><OpsBadge tone="warning">Recovery preserved</OpsBadge></p> : null}</td><td><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{record.title}</strong><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{archiveCategoryLabels[record.category]} · {dateOnly(record.document_date)} · {bytes(record.size_bytes)}</p><p className="mt-1 max-w-[280px] truncate text-[length:var(--app-label-size)] text-[var(--admin-faint)]">{record.filename}</p></td><td>{record.entity_reference ? <>{href ? <Link href={href} className="font-bold text-[var(--admin-crimson)] hover:underline">{record.entity_label || record.entity_reference}</Link> : <strong>{record.entity_label || record.entity_reference}</strong>}<p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{archiveEntityTypeLabels[record.entity_type]} · <OpsMono>{record.entity_reference}</OpsMono></p>{record.recovery_original_entity_reference ? <div className="mt-2 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-accent-bg)] px-2 py-1.5 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]"><strong>Original pre-recovery link:</strong> {record.recovery_original_entity_label || record.recovery_original_entity_reference}{record.recovery_original_entity_type ? ` · ${archiveEntityTypeLabels[record.recovery_original_entity_type]}` : ""}<br/><OpsMono>{record.recovery_original_entity_reference}</OpsMono>{record.recovery_id ? <> · Recovery <OpsMono>{record.recovery_id}</OpsMono></> : null}</div> : null}</> : <OpsBadge tone="neutral">General archive</OpsBadge>}</td><td><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{record.branch}</strong><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{record.physical_reference || "No physical reference"}</p>{record.recovery_relinked_at ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Re-linked {dateTime(record.recovery_relinked_at)} NPT</p> : null}</td><td><OpsBadge tone="success"><ShieldCheck size={9}/>SHA-256</OpsBadge><p title={record.sha256} className="mt-1 max-w-[170px] truncate font-mono text-[7px] text-[var(--admin-faint)]">{record.sha256 || "Fingerprint unavailable"}</p></td><td><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{record.uploaded_by_name}</strong><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{record.uploaded_by_email}</p>{record.recovery_relinked_by_name ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Recovery: {record.recovery_relinked_by_name}</p> : null}</td><td><a href={`/api/admin/migration/archive/${encodeURIComponent(record.id)}/download`} className="ops-button" data-variant="secondary" data-size="sm"><Download size={11}/>Download</a></td></tr>;
        })}</tbody></table></div> : <OpsEmptyState icon={<FileText size={17}/>} title={records.length ? "No archive matches" : "Paper archive is empty"} description={records.length ? "Try a different archive ID, title, branch, record reference, recovery ID or physical folder." : "Upload the first historical KCPL paper file above. It will appear here with its provenance and integrity fingerprint."}/>} 
      </OpsSurface>
    </div>
  </OpsPage>;
}
