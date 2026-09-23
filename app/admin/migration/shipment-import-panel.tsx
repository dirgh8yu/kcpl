"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, PackageCheck, Upload } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsKpiRail, OpsRailMetric, OpsSurface } from "../operations-ui";
import { shipmentStatusLabels } from "../../shipment-types";
import type { ShipmentImportPreview, ShipmentImportResult, ShipmentImportStatus } from "./shipment-import";

function statusTone(status: ShipmentImportStatus): "success" | "warning" | "danger" {
  if (status === "ready") return "success";
  if (status === "duplicate") return "warning";
  return "danger";
}

function statusLabel(status: ShipmentImportStatus) {
  if (status === "ready") return "Ready";
  if (status === "duplicate") return "Possible duplicate";
  return "Invalid";
}

export function ShipmentImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ShipmentImportPreview | null>(null);
  const [result, setResult] = useState<ShipmentImportResult | null>(null);
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
      const response = await fetch("/api/admin/migration/shipments", { method: "POST", body: form });
      const payload = await response.json() as { ok?: boolean; error?: string; preview?: ShipmentImportPreview; result?: ShipmentImportResult };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The shipment migration request could not be completed.");
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
      setError(cause instanceof Error ? cause.message : "The shipment migration request could not be completed.");
    } finally {
      setBusy("");
    }
  }

  return <div className="ops-stack">
    {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
    {result ? <OpsNotice tone="success" onDismiss={() => setResult(null)}><strong>{result.imported} shipments imported.</strong> Batch <OpsMono>{result.batch_id}</OpsMono> created {result.active_imported} active operational record{result.active_imported === 1 ? "" : "s"} and {result.historical_imported} historical record{result.historical_imported === 1 ? "" : "s"}. {result.duplicates} possible duplicate{result.duplicates === 1 ? "" : "s"} and {result.invalid} invalid row{result.invalid === 1 ? "" : "s"} were skipped. <Link href="/admin/shipments" className="font-bold underline">Open active shipments</Link>.</OpsNotice> : null}

    <OpsSurface density="compact" title="Stage 2 · Shipment history" description="CSV intake → resolve customers → validate → preview → confirm. Stage 2 imports shipment records only. It does not import invoices, supplier bills, scanned documents or paper Job File archives." action={<a href="/api/admin/migration/shipments" className="ops-button" data-variant="secondary" data-size="sm" download><Download size={14} strokeWidth={1.75} aria-hidden="true"/>Download shipment template</a>}>
      <div className="migration-intake">
        <div>
          <label className="migration-drop">
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}/>
            <Upload size={16} strokeWidth={1.75} aria-hidden="true"/>
            <strong>{file ? file.name : "Choose shipment CSV"}</strong>
            <span>CSV only · maximum 200 shipment rows · maximum 2 MB</span>
          </label>
          <div className="migration-actions">
            <OpsButton variant="primary" disabled={!file || Boolean(busy)} onClick={() => void submit("preview")}>{busy === "preview" ? <LoaderCircle size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true"/> : <FileSpreadsheet size={14} strokeWidth={1.75} aria-hidden="true"/>}Preview & validate</OpsButton>
            {file ? <OpsButton variant="ghost" disabled={Boolean(busy)} onClick={() => chooseFile(null)}>Clear file</OpsButton> : null}
          </div>
        </div>

        <div className="migration-rules">
          <p className="migration-rules-title">Stage 2 rules</p>
          <ul>
            <li>Every shipment must link to an existing Stage 1 / CRM customer by <strong>customer_id</strong> or one exact, unique customer name.</li>
            <li><strong>active</strong> rows enter live Operations and receive the standard KCPL task, customs and document workflow.</li>
            <li><strong>historical</strong> rows must be Delivered and are imported as completed migration records without generating live operational work.</li>
            <li>Shipment reference and carrier reference duplicates are blocked before import.</li>
            <li>Active owners, when supplied, must resolve to an eligible People & branches staff member.</li>
            <li>Dates use <strong>YYYY-MM-DD</strong>. Historical rows require a delivered date.</li>
          </ul>
        </div>
      </div>
    </OpsSurface>

    {preview ? <ShipmentPreview preview={preview} confirmed={confirmed} busy={busy} onConfirmed={setConfirmed} onImport={() => void submit("import")}/> : null}
  </div>;
}

function ShipmentPreview({ preview, confirmed, busy, onConfirmed, onImport }: { preview: ShipmentImportPreview; confirmed: boolean; busy: "preview" | "import" | ""; onConfirmed: (value: boolean) => void; onImport: () => void }) {
  return <OpsSurface density="compact" title="Review shipment history before writing" description={`${preview.total} rows detected in ${preview.filename}. Ready rows include ${preview.active} active and ${preview.historical} historical shipments.`} flush>
    <div className="migration-counts"><OpsKpiRail label="Preview counts">
      <PreviewCount label="Detected" value={preview.total}/>
      <PreviewCount label="Ready" value={preview.ready} tone="success"/>
      <PreviewCount label="Active" value={preview.active}/>
      <PreviewCount label="Historical" value={preview.historical}/>
      <PreviewCount label="Duplicates" value={preview.duplicates} tone="warning"/>
      <PreviewCount label="Invalid" value={preview.invalid} tone="danger"/>
    </OpsKpiRail></div>

    <div className="ops-table-wrap"><table className="ops-table ops-register-table migration-table min-w-[1260px]"><thead><tr><th>Row</th><th>Shipment</th><th>Class</th><th>Customer</th><th>Route</th><th>Movement</th><th>Dates</th><th>Owner</th><th>Status</th><th>Validation</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.row_number}><td><OpsMono>{String(row.row_number)}</OpsMono></td><td><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]"><OpsMono>{row.shipment_reference}</OpsMono></strong>{row.carrier_reference ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Carrier ref {row.carrier_reference}</p> : null}</td><td>{row.record_class ? <OpsBadge tone={row.record_class === "active" ? "info" : "neutral"}>{row.record_class}</OpsBadge> : <span className="text-[var(--admin-danger)]">Invalid</span>}</td><td><strong className="text-[length:var(--app-label-size)]">{row.customer_name}</strong><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{row.customer_id || "Unresolved"}</p></td><td><span className="text-[length:var(--app-label-size)]">{row.origin || "?"} → {row.destination || "?"}</span><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{row.primary_branch || "Invalid branch"}</p></td><td><span className="text-[length:var(--app-label-size)]">{row.mode || "Invalid mode"}</span><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{row.shipment_status ? shipmentStatusLabels[row.shipment_status] : "Invalid status"}</p></td><td><span className="block text-[length:var(--app-label-size)]">Ship {row.shipment_date || "missing"}</span><span className="mt-1 block text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{row.record_class === "historical" ? `Delivered ${row.delivered_date || "missing"}` : `ETA ${row.eta || "not set"}`}</span></td><td><span className="text-[length:var(--app-label-size)]">{row.owner}</span></td><td><OpsBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</OpsBadge></td><td><div className="max-w-[420px] text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">{row.issues.length ? row.issues.join(" ") : row.duplicate_matches.length ? row.duplicate_matches.join(" · ") : <span className="inline-flex items-center gap-1 text-[var(--admin-success)]"><CheckCircle2 size={10}/>No blocking issues</span>}</div></td></tr>)}</tbody></table></div>

    <div className="migration-confirm">
      {preview.ready ? <div className="migration-confirm-row"><label className="migration-confirm-check"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} className="mt-0.5"/><span className="text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]"><strong className="block text-[length:var(--app-label-size)] text-[var(--admin-ink)]">I reviewed this Stage 2 preview.</strong>Import the {preview.ready} Ready shipment{preview.ready === 1 ? "" : "s"} only. Active rows become live operational records. Historical rows are stored as completed history. Duplicate and invalid rows remain untouched.</span></label><OpsButton variant="primary" disabled={!confirmed || Boolean(busy)} onClick={onImport}>{busy === "import" ? <LoaderCircle size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true"/> : <PackageCheck size={12}/>}Import {preview.ready} ready shipment{preview.ready === 1 ? "" : "s"}</OpsButton></div> : <OpsEmptyState compact icon={<AlertTriangle size={16}/>} title="Nothing is ready to import" description="Correct invalid shipment data or duplicate references in the source CSV, then preview it again."/>}
    </div>
  </OpsSurface>;
}

function PreviewCount({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <OpsRailMetric label={label} value={value} tone={tone}/>;
}
