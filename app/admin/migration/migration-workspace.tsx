"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Archive, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsKpiRail, OpsRailMetric, OpsSurface } from "../operations-ui";
import type { CustomerImportPreview, CustomerImportResult, CustomerImportStatus } from "./customer-import";
import { MigrationBatchHistory } from "./migration-batch-history";
import type { MigrationBatchDashboard } from "./migration-batches";
import { PayablesImportPanel } from "./payables-import-panel";
import { ReceivablesImportPanel } from "./receivables-import-panel";
import { ShipmentImportPanel } from "./shipment-import-panel";

function statusTone(status: CustomerImportStatus): "success" | "warning" | "danger" {
  if (status === "ready") return "success";
  if (status === "duplicate") return "warning";
  return "danger";
}

function statusLabel(status: CustomerImportStatus) {
  if (status === "ready") return "Ready";
  if (status === "duplicate") return "Possible duplicate";
  return "Invalid";
}

export function MigrationWorkspace({ initialBatchDashboard, canRecover }: { initialBatchDashboard: MigrationBatchDashboard | null; canRecover: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CustomerImportPreview | null>(null);
  const [result, setResult] = useState<CustomerImportResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | "">("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function chooseFile(next: File | null) {
    setFile(next);
    setPreview(null);
    setResult(null);
    setError("");
    setConfirmed(false);
  }

  async function submit(action: "preview" | "import") {
    if (!file) return;
    setBusy(action);
    setError("");
    try {
      const form = new FormData();
      form.set("action", action);
      form.set("file", file);
      const response = await fetch("/api/admin/migration/customers", { method: "POST", body: form });
      const payload = await response.json() as { ok?: boolean; error?: string; preview?: CustomerImportPreview; result?: CustomerImportResult };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The migration request could not be completed.");
      if (action === "preview" && payload.preview) {
        setPreview(payload.preview);
        setResult(null);
        setConfirmed(false);
      }
      if (action === "import" && payload.result) {
        setResult(payload.result);
        setPreview(null);
        setConfirmed(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The migration request could not be completed.");
    } finally {
      setBusy("");
    }
  }

  return <OpsPage>
    <OpsPageHeader
      title="Paper → KCPL migration"
      description="Staged imports, an authoritative batch ledger, preserved paper evidence and fail-closed rollback recovery."
      meta={<span>Management only · Stages 1–4 live · dry-run recovery, no force delete</span>}
      actions={<>
        <Link href="/admin/migration/archive" className="ops-button" data-variant="secondary" data-size="md"><Archive size={16} strokeWidth={1.75} aria-hidden="true"/>Paper Archive</Link>
        {canRecover ? <Link href="/admin/migration/recovery" className="ops-button" data-variant="secondary" data-size="md"><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true"/>Recovery</Link> : null}
      </>}
    />

    <div className="px-4 pb-8 pt-4 md:px-6 org-stack">
      <OpsSurface
        density="compact"
        title="Migration safety chain"
        description="Import carefully, keep an authoritative batch inventory, preserve source evidence, then allow rollback only when live records prove they are safe to reverse."
        action={<span className="migration-templates"><span>Templates</span>
          <a href="/api/admin/migration/customers" className="ops-button" data-variant="ghost" data-size="xs" download><Download size={14} strokeWidth={1.75} aria-hidden="true"/>Customers</a>
          <a href="/api/admin/migration/shipments" className="ops-button" data-variant="ghost" data-size="xs" download><Download size={14} strokeWidth={1.75} aria-hidden="true"/>Shipments</a>
          <a href="/api/admin/migration/receivables" className="ops-button" data-variant="ghost" data-size="xs" download><Download size={14} strokeWidth={1.75} aria-hidden="true"/>Receivables</a>
          <a href="/api/admin/migration/payables" className="ops-button" data-variant="ghost" data-size="xs" download><Download size={14} strokeWidth={1.75} aria-hidden="true"/>Payables</a>
        </span>}
        flush
      >
        <ol className="migration-stages">
          <Stage number="1" title="Customer master" detail="CSV preview, validation, duplicate detection and confirmed import." state="complete"/>
          <Stage number="2" title="Shipment history" detail="Active movements and completed historical shipments linked to real CRM customers." state="complete"/>
          <Stage number="3A" title="Receivables opening" detail="Open customer invoices and auditable customer opening balances." state="complete"/>
          <Stage number="3B" title="Payables opening" detail="Open supplier bills and auditable supplier opening balances." state="complete"/>
          <Stage number="4A" title="Batch control" detail="Authoritative migration ledger, created-record inventory and failure visibility." state="complete"/>
          <Stage number="4B" title="Paper archive" detail="Scanned historical files with controlled metadata, integrity fingerprints and stable storage." state="complete"/>
          <Stage number="4C" title="Recovery" detail="Expiring dry-run plans, dependency blockers, exact confirmation and audited reversal." state="active"/>
        </ol>
      </OpsSurface>

      <MigrationBatchHistory initialDashboard={initialBatchDashboard}/>
      <PayablesImportPanel/>
      <ReceivablesImportPanel/>
      <ShipmentImportPanel/>

      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
      {result ? <OpsNotice tone="success" onDismiss={() => setResult(null)}><strong>{result.imported} customers imported.</strong> Batch <OpsMono>{result.batch_id}</OpsMono> recorded {result.duplicates} possible duplicate{result.duplicates === 1 ? "" : "s"} and {result.invalid} invalid row{result.invalid === 1 ? "" : "s"}. <Link href="/admin/crm" className="font-bold underline">Open Customers</Link>.</OpsNotice> : null}

      <OpsSurface density="compact" title="Stage 1 · Customer master" description="Customer CSV intake → validate → preview → confirm. Stage 1 stays available because shipment history and receivables still depend on a clean CRM customer master. Supplier finance uses the separate Partner network as its identity source." action={<a href="/api/admin/migration/customers" className="ops-button" data-variant="secondary" data-size="sm" download><Download size={14} strokeWidth={1.75} aria-hidden="true"/>Download customer template</a>}>
        <div className="migration-intake">
          <div>
            <label className="migration-drop">
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}/>
              <Upload size={16} strokeWidth={1.75} aria-hidden="true"/>
              <strong>{file ? file.name : "Choose customer CSV"}</strong>
              <span>CSV only · maximum 250 customer rows · maximum 2 MB</span>
            </label>
            <div className="migration-actions">
              <OpsButton variant="primary" disabled={!file || Boolean(busy)} onClick={() => void submit("preview")}>{busy === "preview" ? <LoaderCircle size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true"/> : <FileSpreadsheet size={14} strokeWidth={1.75} aria-hidden="true"/>}Preview & validate</OpsButton>
              {file ? <OpsButton variant="ghost" disabled={Boolean(busy)} onClick={() => chooseFile(null)}>Clear file</OpsButton> : null}
            </div>
          </div>

          <div className="migration-rules">
            <p className="migration-rules-title">Stage 1 rules</p>
            <ul>
              <li>Required columns: <strong>display_name</strong> and <strong>primary_branch</strong>.</li>
              <li>Branch must match a KCPL branch in the template vocabulary.</li>
              <li>Name, email, phone and tax ID are checked against existing CRM records and earlier rows in the same CSV.</li>
              <li>Invalid and possible-duplicate rows are never imported automatically.</li>
              <li>Every confirmed import receives a migration batch ID and appears in the Migration Control Centre automatically.</li>
            </ul>
          </div>
        </div>
      </OpsSurface>

      {preview ? <PreviewPanel preview={preview} confirmed={confirmed} busy={busy} onConfirmed={setConfirmed} onImport={() => void submit("import")}/> : null}
    </div>
  </OpsPage>;
}

function PreviewPanel({ preview, confirmed, busy, onConfirmed, onImport }: { preview: CustomerImportPreview; confirmed: boolean; busy: "preview" | "import" | ""; onConfirmed: (value: boolean) => void; onImport: () => void }) {
  return <OpsSurface density="compact" title="Review customers before anything is written" description={`${preview.total} rows detected in ${preview.filename}. Only rows marked Ready can be created.`} flush>
    <div className="migration-counts"><OpsKpiRail label="Preview counts">
      <PreviewCount label="Detected" value={preview.total}/>
      <PreviewCount label="Ready" value={preview.ready} tone="success"/>
      <PreviewCount label="Duplicates" value={preview.duplicates} tone="warning"/>
      <PreviewCount label="Invalid" value={preview.invalid} tone="danger"/>
    </OpsKpiRail></div>

    <div className="ops-table-wrap"><table className="ops-table ops-register-table migration-table min-w-[900px]"><thead><tr><th>Row</th><th>Customer</th><th>Branch</th><th>Contact</th><th>Status</th><th>Validation</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.row_number}><td><OpsMono>{String(row.row_number)}</OpsMono></td><td><strong className="text-[11px] text-[var(--admin-ink)]">{row.display_name}</strong>{row.tax_id ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Tax ID {row.tax_id}</p> : null}</td><td>{row.primary_branch ?? <span className="text-[var(--admin-danger)]">Invalid branch</span>}</td><td><span className="block text-[length:var(--app-label-size)]">{row.primary_email || "No email"}</span><span className="mt-1 block text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{row.primary_phone || "No phone"}</span></td><td><OpsBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</OpsBadge></td><td><div className="max-w-[360px] text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">{row.issues.length ? row.issues.join(" ") : row.duplicate_matches.length ? row.duplicate_matches.join(" · ") : <span className="inline-flex items-center gap-1 text-[var(--admin-success)]"><CheckCircle2 size={10}/>No blocking issues</span>}</div></td></tr>)}</tbody></table></div>

    <div className="migration-confirm">
      {preview.ready ? <div className="migration-confirm-row"><label className="migration-confirm-check"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} className="mt-0.5"/><span className="text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]"><strong className="block text-[length:var(--app-label-size)] text-[var(--admin-ink)]">I reviewed this Stage 1 preview.</strong>Import the {preview.ready} Ready row{preview.ready === 1 ? "" : "s"} only. Possible duplicates and invalid rows will remain untouched.</span></label><OpsButton variant="primary" disabled={!confirmed || Boolean(busy)} onClick={onImport}>{busy === "import" ? <LoaderCircle size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true"/> : <Upload size={14} strokeWidth={1.75} aria-hidden="true"/>}Import {preview.ready} ready customer{preview.ready === 1 ? "" : "s"}</OpsButton></div> : <OpsEmptyState compact icon={<AlertTriangle size={16}/>} title="Nothing is ready to import" description="Correct the invalid rows or review possible duplicates in the source CSV, then preview the file again."/>}
    </div>
  </OpsSurface>;
}

function PreviewCount({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <OpsRailMetric label={label} value={value} tone={tone}/>;
}

function Stage({ number, title, detail, state = "later" }: { number: string; title: string; detail: string; state?: "active" | "complete" | "later" }) {
  return <li className="migration-stage">
    <span className="migration-stage-head"><span className="ops-mono">Stage {number}</span><OpsBadge tone={state === "active" ? "info" : state === "complete" ? "success" : "neutral"}>{state === "active" ? "Active" : state === "complete" ? "Complete" : "Later"}</OpsBadge></span>
    <strong>{title}</strong>
    <span className="migration-stage-detail">{detail}</span>
  </li>;
}
