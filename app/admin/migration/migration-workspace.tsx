"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, PackageCheck, Upload, UsersRound } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
import type { CustomerImportPreview, CustomerImportResult, CustomerImportStatus } from "./customer-import";
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

export function MigrationWorkspace() {
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
      eyebrow="Organisation · Migration Hub"
      title="Paper → KCPL migration"
      description="Move KCPL records into the operating system in controlled stages. Stage 1 customer migration remains available and Stage 2 now adds safe active and historical shipment migration without touching finance or paper archives."
      meta={<><span>Management only</span><span>Stage 2 of 4</span><span>No writes before preview</span></>}
      actions={<><a href="/api/admin/migration/customers" className="ops-button" data-variant="secondary" data-size="md" download><Download size={13}/>Customer template</a><a href="/api/admin/migration/shipments" className="ops-button" data-variant="primary" data-size="md" download><Download size={13}/>Shipment template</a></>}
    />

    <OpsStatStrip>
      <OpsStat label="Stage 1" value="Customers" detail="Complete · still available" icon={<UsersRound size={13}/>} tone="success"/>
      <OpsStat label="Stage 2" value="Shipments" detail="Active now" icon={<PackageCheck size={13}/>} tone="success"/>
      <OpsStat label="Stage 3" value="Finance" detail="Not built yet" />
      <OpsStat label="Stage 4" value="Archive" detail="Paper files + rollback" />
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      <OpsSurface eyebrow="Stage plan" title="One migration layer at a time" description="Customer master data is established first. Stage 2 can now attach real shipment history to those customers while finance and scanned paper archives remain isolated for later releases.">
        <div className="grid gap-2 md:grid-cols-4">
          <Stage number="01" title="Customer master" detail="CSV preview, validation, duplicate detection and confirmed import." state="complete"/>
          <Stage number="02" title="Shipment history" detail="Active movements and completed historical shipments linked to real CRM customers." state="active"/>
          <Stage number="03" title="Finance opening data" detail="Receivables, supplier bills and opening balances with finance controls."/>
          <Stage number="04" title="Paper archive" detail="Archived Job Files, scanned documents, batch history and rollback tools."/>
        </div>
      </OpsSurface>

      <ShipmentImportPanel/>

      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
      {result ? <OpsNotice tone="success" onDismiss={() => setResult(null)}><strong>{result.imported} customers imported.</strong> Batch <OpsMono>{result.batch_id}</OpsMono> recorded {result.duplicates} possible duplicate{result.duplicates === 1 ? "" : "s"} and {result.invalid} invalid row{result.invalid === 1 ? "" : "s"}. <Link href="/admin/crm" className="font-bold underline">Open Customers</Link>.</OpsNotice> : null}

      <OpsSurface eyebrow="Stage 1 · Customer master" title="Customer CSV intake → validate → preview → confirm" description="Stage 1 stays available because every Stage 2 shipment must resolve to an existing CRM customer. Import missing customers here first." action={<a href="/api/admin/migration/customers" className="ops-button" data-variant="secondary" data-size="sm" download><Download size={12}/>Download customer template</a>}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <label className="block rounded-[14px] border border-dashed border-[#d8cec6] bg-[#fbf8f5] p-6 text-center transition hover:border-[#caa797] hover:bg-[#fffaf7]">
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}/>
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-[11px] bg-white text-[#bd654f] shadow-[0_5px_18px_rgba(80,55,40,.06)]"><Upload size={17}/></span>
              <strong className="mt-3 block text-[12px] text-[#4d453f]">{file ? file.name : "Choose customer CSV"}</strong>
              <span className="mt-1 block text-[9px] leading-4 text-[#8d837b]">CSV only · maximum 250 customer rows · maximum 2 MB</span>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <OpsButton variant="primary" disabled={!file || Boolean(busy)} onClick={() => void submit("preview")}>{busy === "preview" ? <LoaderCircle size={12} className="animate-spin"/> : <FileSpreadsheet size={12}/>}Preview & validate</OpsButton>
              {file ? <OpsButton variant="ghost" disabled={Boolean(busy)} onClick={() => chooseFile(null)}>Clear file</OpsButton> : null}
            </div>
          </div>

          <div className="rounded-[13px] border border-[#e7dfd8] bg-[#faf8f5] p-4">
            <p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#9a8e85]">Stage 1 rules</p>
            <ul className="mt-3 space-y-2 text-[9px] leading-4 text-[#746b64]">
              <li>• Required columns: <strong>display_name</strong> and <strong>primary_branch</strong>.</li>
              <li>• Branch must match a KCPL branch in the template vocabulary.</li>
              <li>• Name, email, phone and tax ID are checked against existing CRM records and earlier rows in the same CSV.</li>
              <li>• Invalid and possible-duplicate rows are never imported automatically.</li>
              <li>• Every confirmed import receives a migration batch ID for later audit and rollback work.</li>
            </ul>
          </div>
        </div>
      </OpsSurface>

      {preview ? <PreviewPanel preview={preview} confirmed={confirmed} busy={busy} onConfirmed={setConfirmed} onImport={() => void submit("import")}/> : null}
    </div>
  </OpsPage>;
}

function PreviewPanel({ preview, confirmed, busy, onConfirmed, onImport }: { preview: CustomerImportPreview; confirmed: boolean; busy: "preview" | "import" | ""; onConfirmed: (value: boolean) => void; onImport: () => void }) {
  return <OpsSurface eyebrow="Stage 1 safe preview" title="Review customers before anything is written" description={`${preview.total} rows detected in ${preview.filename}. Only rows marked Ready can be created.`} flush>
    <div className="grid grid-cols-2 gap-px border-b border-[#e8e1db] bg-[#e8e1db] sm:grid-cols-4">
      <PreviewCount label="Detected" value={preview.total}/>
      <PreviewCount label="Ready" value={preview.ready} tone="success"/>
      <PreviewCount label="Duplicates" value={preview.duplicates} tone="warning"/>
      <PreviewCount label="Invalid" value={preview.invalid} tone="danger"/>
    </div>

    <div className="ops-table-wrap"><table className="ops-table min-w-[900px]"><thead><tr><th>Row</th><th>Customer</th><th>Branch</th><th>Contact</th><th>Status</th><th>Validation</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.row_number}><td><OpsMono>{String(row.row_number)}</OpsMono></td><td><strong className="text-[11px] text-[#493f39]">{row.display_name}</strong>{row.tax_id ? <p className="mt-1 text-[9px] text-[#948a82]">Tax ID {row.tax_id}</p> : null}</td><td>{row.primary_branch ?? <span className="text-[#a64d4f]">Invalid branch</span>}</td><td><span className="block text-[10px]">{row.primary_email || "No email"}</span><span className="mt-1 block text-[9px] text-[#948a82]">{row.primary_phone || "No phone"}</span></td><td><OpsBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</OpsBadge></td><td><div className="max-w-[360px] text-[9px] leading-4 text-[#7d736b]">{row.issues.length ? row.issues.join(" ") : row.duplicate_matches.length ? row.duplicate_matches.join(" · ") : <span className="inline-flex items-center gap-1 text-[#617765]"><CheckCircle2 size={10}/>No blocking issues</span>}</div></td></tr>)}</tbody></table></div>

    <div className="border-t border-[#e8e1db] bg-[#fffdfa] p-4 sm:p-5">
      {preview.ready ? <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><label className="flex max-w-2xl cursor-pointer items-start gap-3 rounded-[11px] border border-[#e7dfd8] bg-[#faf8f5] p-3"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} className="mt-0.5"/><span className="text-[9px] leading-4 text-[#6f665f]"><strong className="block text-[10px] text-[#514840]">I reviewed this Stage 1 preview.</strong>Import the {preview.ready} Ready row{preview.ready === 1 ? "" : "s"} only. Possible duplicates and invalid rows will remain untouched.</span></label><OpsButton variant="primary" disabled={!confirmed || Boolean(busy)} onClick={onImport}>{busy === "import" ? <LoaderCircle size={12} className="animate-spin"/> : <Upload size={12}/>}Import {preview.ready} ready customer{preview.ready === 1 ? "" : "s"}</OpsButton></div> : <OpsEmptyState compact icon={<AlertTriangle size={16}/>} title="Nothing is ready to import" description="Correct the invalid rows or review possible duplicates in the source CSV, then preview the file again."/>}
    </div>
  </OpsSurface>;
}

function PreviewCount({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-[#5f7864]" : tone === "warning" ? "text-[#94632f]" : tone === "danger" ? "text-[#a74d50]" : "text-[#4d453f]";
  return <div className="bg-[#fffdfa] p-4"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#998f87]">{label}</p><strong className={`mt-1 block text-[20px] font-[740] ${color}`}>{value}</strong></div>;
}

function Stage({ number, title, detail, state = "later" }: { number: string; title: string; detail: string; state?: "active" | "complete" | "later" }) {
  const highlighted = state !== "later";
  return <div className={`rounded-[12px] border p-4 ${highlighted ? "border-[#d7c2b8] bg-[#fff7f2]" : "border-[#e7dfd8] bg-[#faf8f5]"}`}><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-black tracking-[.08em] text-[#b96650]">{number}</span><OpsBadge tone={state === "active" ? "info" : state === "complete" ? "success" : "neutral"}>{state === "active" ? "Active" : state === "complete" ? "Complete" : "Later"}</OpsBadge></div><strong className="mt-3 block text-[11px] text-[#514840]">{title}</strong><p className="mt-1.5 text-[8px] leading-4 text-[#8c827a]">{detail}</p></div>;
}
