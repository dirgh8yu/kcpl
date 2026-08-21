"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Landmark, LoaderCircle, Upload } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsSurface } from "../operations-ui";
import type { ReceivablesImportPreview, ReceivablesImportResult, ReceivablesImportStatus } from "./receivables-import";

function statusTone(status: ReceivablesImportStatus): "success" | "warning" | "danger" {
  if (status === "ready") return "success";
  if (status === "duplicate") return "warning";
  return "danger";
}

function statusLabel(status: ReceivablesImportStatus) {
  if (status === "ready") return "Ready";
  if (status === "duplicate") return "Possible duplicate";
  return "Invalid";
}

function money(value: number | null, currency: string | null) {
  if (value === null) return "Not set";
  if (!currency) return value.toLocaleString("en-AU", { maximumFractionDigits: 2 });
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`; }
}

export function ReceivablesImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReceivablesImportPreview | null>(null);
  const [result, setResult] = useState<ReceivablesImportResult | null>(null);
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
      const response = await fetch("/api/admin/migration/receivables", { method: "POST", body: form });
      const payload = await response.json() as { ok?: boolean; error?: string; preview?: ReceivablesImportPreview; result?: ReceivablesImportResult };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The Stage 3A migration request could not be completed.");
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
      setError(cause instanceof Error ? cause.message : "The Stage 3A migration request could not be completed.");
    } finally {
      setBusy("");
    }
  }

  return <div className="ops-stack">
    {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
    {result ? <OpsNotice tone="success" onDismiss={() => setResult(null)}><strong>{result.imported} receivables imported.</strong> Batch <OpsMono>{result.batch_id}</OpsMono> created {result.invoice_rows_imported} invoice receivable{result.invoice_rows_imported === 1 ? "" : "s"} and {result.opening_balance_rows_imported} opening balance{result.opening_balance_rows_imported === 1 ? "" : "s"}. {result.duplicates} duplicate and {result.invalid} invalid row{result.invalid === 1 ? "" : "s"} were skipped. <Link href="/admin/finance" className="font-bold underline">Open Receivables</Link>.</OpsNotice> : null}

    <OpsSurface eyebrow="Stage 3A · Receivables" title="Current customer money owed to KCPL" description="Import open customer invoices or a controlled opening balance when the paper ledger has a known amount due but the old invoice detail should not be reconstructed." action={<a href="/api/admin/migration/receivables" className="ops-button" data-variant="secondary" data-size="sm" download><Download size={12}/>Download Stage 3A template</a>}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <label className="block rounded-[14px] border border-dashed border-[#d8cec6] bg-[#fbf8f5] p-6 text-center transition hover:border-[#caa797] hover:bg-[#fffaf7]">
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}/>
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-[11px] bg-white text-[#bd654f] shadow-[0_5px_18px_rgba(80,55,40,.06)]"><Landmark size={17}/></span>
            <strong className="mt-3 block text-[12px] text-[#4d453f]">{file ? file.name : "Choose Stage 3A receivables CSV"}</strong>
            <span className="mt-1 block text-[9px] leading-4 text-[#8d837b]">CSV only · maximum 150 rows · maximum 2 MB · preview required before import</span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <OpsButton variant="primary" disabled={!file || Boolean(busy)} onClick={() => void submit("preview")}>{busy === "preview" ? <LoaderCircle size={12} className="animate-spin"/> : <FileSpreadsheet size={12}/>}Preview & validate</OpsButton>
            {file ? <OpsButton variant="ghost" disabled={Boolean(busy)} onClick={() => chooseFile(null)}>Clear file</OpsButton> : null}
          </div>
        </div>

        <div className="rounded-[13px] border border-[#e7dfd8] bg-[#faf8f5] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#9a8e85]">Stage 3A rules</p>
          <ul className="mt-3 space-y-2 text-[9px] leading-4 text-[#746b64]">
            <li>• <strong>invoice</strong> rows preserve a real external invoice number and only import balances still outstanding.</li>
            <li>• <strong>opening_balance</strong> rows create a clearly labelled opening receivable, not a fabricated historical invoice.</li>
            <li>• Every row must resolve to an existing CRM customer from Stage 1.</li>
            <li>• Shipment links are optional for invoice rows, but when supplied they must belong to that customer.</li>
            <li>• Invoice total − amount paid must equal balance due. Currency and all dates are validated server-side.</li>
            <li>• Amount already collected before go-live is recorded as one auditable migration adjustment, not reconstructed payment history.</li>
            <li>• Stage 3B supplier payables are intentionally not included yet.</li>
          </ul>
        </div>
      </div>
    </OpsSurface>

    {preview ? <PreviewPanel preview={preview} confirmed={confirmed} busy={busy} onConfirmed={setConfirmed} onImport={() => void submit("import")}/> : null}
  </div>;
}

function PreviewPanel({ preview, confirmed, busy, onConfirmed, onImport }: { preview: ReceivablesImportPreview; confirmed: boolean; busy: "preview" | "import" | ""; onConfirmed: (value: boolean) => void; onImport: () => void }) {
  return <OpsSurface eyebrow="Stage 3A safe preview" title="Reconcile every receivable before writing" description={`${preview.total} rows detected in ${preview.filename}. Only rows marked Ready will be created.`} flush>
    <div className="grid grid-cols-2 gap-px border-b border-[#e8e1db] bg-[#e8e1db] sm:grid-cols-6">
      <PreviewCount label="Detected" value={preview.total}/>
      <PreviewCount label="Ready" value={preview.ready} tone="success"/>
      <PreviewCount label="Duplicates" value={preview.duplicates} tone="warning"/>
      <PreviewCount label="Invalid" value={preview.invalid} tone="danger"/>
      <PreviewCount label="Invoices" value={preview.invoice_rows}/>
      <PreviewCount label="Opening balances" value={preview.opening_balance_rows}/>
    </div>

    <div className="ops-table-wrap"><table className="ops-table min-w-[1250px]"><thead><tr><th>Row</th><th>Type</th><th>Customer</th><th>Source</th><th>Dates</th><th>Outstanding</th><th>Status</th><th>Validation</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.row_number}><td><OpsMono>{String(row.row_number)}</OpsMono></td><td><OpsBadge tone={row.record_type === "opening_balance" ? "violet" : "info"}>{row.record_type === "opening_balance" ? "Opening balance" : row.record_type === "invoice" ? "Invoice" : "Invalid type"}</OpsBadge></td><td><strong className="text-[10px] text-[#514840]">{row.customer_name}</strong><p className="mt-1 text-[8px] text-[#91877f]">{row.customer_id ? <OpsMono>{row.customer_id}</OpsMono> : "Unresolved"} · {row.branch ?? "No branch"}</p></td><td><span className="text-[9px]">{row.external_invoice_number || "Customer opening balance"}</span><p className="mt-1 text-[8px] text-[#91877f]">{row.shipment_reference ? <OpsMono>{row.shipment_reference}</OpsMono> : "No shipment link"}</p></td><td><span className="block text-[9px]">Due {row.due_date || "invalid"}</span><span className="mt-1 block text-[8px] text-[#91877f]">As at {row.as_of_date || "invalid"}</span></td><td><strong className="text-[10px] text-[#514840]">{money(row.balance_due, row.currency)}</strong>{row.record_type === "invoice" ? <p className="mt-1 text-[8px] text-[#91877f]">Total {money(row.invoice_total, row.currency)} · paid {money(row.amount_paid, row.currency)}</p> : null}</td><td><OpsBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</OpsBadge></td><td><div className="max-w-[380px] text-[9px] leading-4 text-[#7d736b]">{row.issues.length ? row.issues.join(" ") : row.duplicate_matches.length ? row.duplicate_matches.join(" · ") : <span className="inline-flex items-center gap-1 text-[#617765]"><CheckCircle2 size={10}/>Reconciled and ready</span>}</div></td></tr>)}</tbody></table></div>

    <div className="border-t border-[#e8e1db] bg-[#fffdfa] p-4 sm:p-5">
      {preview.ready ? <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><label className="flex max-w-2xl cursor-pointer items-start gap-3 rounded-[11px] border border-[#e7dfd8] bg-[#faf8f5] p-3"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} className="mt-0.5"/><span className="text-[9px] leading-4 text-[#6f665f]"><strong className="block text-[10px] text-[#514840]">I reviewed and reconciled this finance preview.</strong>Import the {preview.ready} Ready receivable{preview.ready === 1 ? "" : "s"} only. Duplicate and invalid rows will remain untouched. Imported balances immediately affect KCPL Receivables and Customer 360.</span></label><OpsButton variant="primary" disabled={!confirmed || Boolean(busy)} onClick={onImport}>{busy === "import" ? <LoaderCircle size={12} className="animate-spin"/> : <Upload size={12}/>}Import {preview.ready} ready receivable{preview.ready === 1 ? "" : "s"}</OpsButton></div> : <OpsEmptyState compact icon={<AlertTriangle size={16}/>} title="Nothing is ready to import" description="Correct the invalid rows or review possible duplicates in the paper ledger, then preview the file again."/>}
    </div>
  </OpsSurface>;
}

function PreviewCount({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-[#5f7864]" : tone === "warning" ? "text-[#94632f]" : tone === "danger" ? "text-[#a74d50]" : "text-[#4d453f]";
  return <div className="bg-[#fffdfa] p-4"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#998f87]">{label}</p><strong className={`mt-1 block text-[20px] font-[740] ${color}`}>{value}</strong></div>;
}
