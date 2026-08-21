"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, PackageCheck, Upload } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsSurface } from "../operations-ui";
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

    <OpsSurface eyebrow="Stage 2 · Shipment history" title="CSV intake → resolve customers → validate → preview → confirm" description="Stage 2 imports shipment records only. It does not import invoices, supplier bills, scanned documents or paper Job File archives." action={<a href="/api/admin/migration/shipments" className="ops-button" data-variant="secondary" data-size="sm" download><Download size={12}/>Download shipment template</a>}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <label className="block rounded-[14px] border border-dashed border-[#d8cec6] bg-[#fbf8f5] p-6 text-center transition hover:border-[#caa797] hover:bg-[#fffaf7]">
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}/>
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-[11px] bg-white text-[#bd654f] shadow-[0_5px_18px_rgba(80,55,40,.06)]"><Upload size={17}/></span>
            <strong className="mt-3 block text-[12px] text-[#4d453f]">{file ? file.name : "Choose shipment CSV"}</strong>
            <span className="mt-1 block text-[9px] leading-4 text-[#8d837b]">CSV only · maximum 200 shipment rows · maximum 2 MB</span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <OpsButton variant="primary" disabled={!file || Boolean(busy)} onClick={() => void submit("preview")}>{busy === "preview" ? <LoaderCircle size={12} className="animate-spin"/> : <FileSpreadsheet size={12}/>}Preview & validate</OpsButton>
            {file ? <OpsButton variant="ghost" disabled={Boolean(busy)} onClick={() => chooseFile(null)}>Clear file</OpsButton> : null}
          </div>
        </div>

        <div className="rounded-[13px] border border-[#e7dfd8] bg-[#faf8f5] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#9a8e85]">Stage 2 rules</p>
          <ul className="mt-3 space-y-2 text-[9px] leading-4 text-[#746b64]">
            <li>• Every shipment must link to an existing Stage 1 / CRM customer by <strong>customer_id</strong> or one exact, unique customer name.</li>
            <li>• <strong>active</strong> rows enter live Operations and receive the standard KCPL task, customs and document workflow.</li>
            <li>• <strong>historical</strong> rows must be Delivered and are imported as completed migration records without generating live operational work.</li>
            <li>• Shipment reference and carrier reference duplicates are blocked before import.</li>
            <li>• Active owners, when supplied, must resolve to an eligible People & branches staff member.</li>
            <li>• Dates use <strong>YYYY-MM-DD</strong>. Historical rows require a delivered date.</li>
          </ul>
        </div>
      </div>
    </OpsSurface>

    {preview ? <ShipmentPreview preview={preview} confirmed={confirmed} busy={busy} onConfirmed={setConfirmed} onImport={() => void submit("import")}/> : null}
  </div>;
}

function ShipmentPreview({ preview, confirmed, busy, onConfirmed, onImport }: { preview: ShipmentImportPreview; confirmed: boolean; busy: "preview" | "import" | ""; onConfirmed: (value: boolean) => void; onImport: () => void }) {
  return <OpsSurface eyebrow="Stage 2 safe preview" title="Review shipment history before writing" description={`${preview.total} rows detected in ${preview.filename}. Ready rows include ${preview.active} active and ${preview.historical} historical shipments.`} flush>
    <div className="grid grid-cols-2 gap-px border-b border-[#e8e1db] bg-[#e8e1db] sm:grid-cols-6">
      <PreviewCount label="Detected" value={preview.total}/>
      <PreviewCount label="Ready" value={preview.ready} tone="success"/>
      <PreviewCount label="Active" value={preview.active}/>
      <PreviewCount label="Historical" value={preview.historical}/>
      <PreviewCount label="Duplicates" value={preview.duplicates} tone="warning"/>
      <PreviewCount label="Invalid" value={preview.invalid} tone="danger"/>
    </div>

    <div className="ops-table-wrap"><table className="ops-table min-w-[1260px]"><thead><tr><th>Row</th><th>Shipment</th><th>Class</th><th>Customer</th><th>Route</th><th>Movement</th><th>Dates</th><th>Owner</th><th>Status</th><th>Validation</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.row_number}><td><OpsMono>{String(row.row_number)}</OpsMono></td><td><strong className="text-[10px] text-[#493f39]"><OpsMono>{row.shipment_reference}</OpsMono></strong>{row.carrier_reference ? <p className="mt-1 text-[8px] text-[#948a82]">Carrier ref {row.carrier_reference}</p> : null}</td><td>{row.record_class ? <OpsBadge tone={row.record_class === "active" ? "info" : "neutral"}>{row.record_class}</OpsBadge> : <span className="text-[#a64d4f]">Invalid</span>}</td><td><strong className="text-[10px]">{row.customer_name}</strong><p className="mt-1 text-[8px] text-[#948a82]">{row.customer_id || "Unresolved"}</p></td><td><span className="text-[9px]">{row.origin || "?"} → {row.destination || "?"}</span><p className="mt-1 text-[8px] text-[#948a82]">{row.primary_branch || "Invalid branch"}</p></td><td><span className="text-[9px]">{row.mode || "Invalid mode"}</span><p className="mt-1 text-[8px] text-[#948a82]">{row.shipment_status ? shipmentStatusLabels[row.shipment_status] : "Invalid status"}</p></td><td><span className="block text-[9px]">Ship {row.shipment_date || "missing"}</span><span className="mt-1 block text-[8px] text-[#948a82]">{row.record_class === "historical" ? `Delivered ${row.delivered_date || "missing"}` : `ETA ${row.eta || "not set"}`}</span></td><td><span className="text-[9px]">{row.owner}</span></td><td><OpsBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</OpsBadge></td><td><div className="max-w-[420px] text-[9px] leading-4 text-[#7d736b]">{row.issues.length ? row.issues.join(" ") : row.duplicate_matches.length ? row.duplicate_matches.join(" · ") : <span className="inline-flex items-center gap-1 text-[#617765]"><CheckCircle2 size={10}/>No blocking issues</span>}</div></td></tr>)}</tbody></table></div>

    <div className="border-t border-[#e8e1db] bg-[#fffdfa] p-4 sm:p-5">
      {preview.ready ? <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><label className="flex max-w-2xl cursor-pointer items-start gap-3 rounded-[11px] border border-[#e7dfd8] bg-[#faf8f5] p-3"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} className="mt-0.5"/><span className="text-[9px] leading-4 text-[#6f665f]"><strong className="block text-[10px] text-[#514840]">I reviewed this Stage 2 preview.</strong>Import the {preview.ready} Ready shipment{preview.ready === 1 ? "" : "s"} only. Active rows become live operational records. Historical rows are stored as completed history. Duplicate and invalid rows remain untouched.</span></label><OpsButton variant="primary" disabled={!confirmed || Boolean(busy)} onClick={onImport}>{busy === "import" ? <LoaderCircle size={12} className="animate-spin"/> : <PackageCheck size={12}/>}Import {preview.ready} ready shipment{preview.ready === 1 ? "" : "s"}</OpsButton></div> : <OpsEmptyState compact icon={<AlertTriangle size={16}/>} title="Nothing is ready to import" description="Correct invalid shipment data or duplicate references in the source CSV, then preview it again."/>}
    </div>
  </OpsSurface>;
}

function PreviewCount({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-[#5f7864]" : tone === "warning" ? "text-[#94632f]" : tone === "danger" ? "text-[#a74d50]" : "text-[#4d453f]";
  return <div className="bg-[#fffdfa] p-4"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#998f87]">{label}</p><strong className={`mt-1 block text-[20px] font-[740] ${color}`}>{value}</strong></div>;
}
