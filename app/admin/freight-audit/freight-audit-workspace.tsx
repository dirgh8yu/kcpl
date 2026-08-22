"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, BadgeCheck, CircleDollarSign, RefreshCw, ShieldAlert } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsNotice, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
import { freightAuditStatusLabels, type FreightAuditQueueRow, type FreightAuditStatus, type FreightAuditSummary } from "./freight-audit";

type ApiResponse = { ok: boolean; error?: string; rows?: FreightAuditQueueRow[]; summary?: FreightAuditSummary };

function money(currency: string | null, value: number | null) {
  if (!currency || value === null) return "Not available";
  return `${currency} ${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function tone(status: FreightAuditStatus): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "matched" || status === "approved_variance") return "success";
  if (status === "review_required" || status === "disputed") return "danger";
  if (status === "rejected") return "warning";
  return "neutral";
}

export function FreightAuditWorkspace({ initialRows, initialSummary, isManagement, initialFocus = "" }: { initialRows: FreightAuditQueueRow[]; initialSummary: FreightAuditSummary; isManagement: boolean; initialFocus?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const focus = initialFocus.trim().toLowerCase();
  const focusedRow = focus ? initialRows.find((row) => [row.payable_reference, row.shipment_reference, row.supplier_bill_reference, row.supplier_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(focus))) : null;
  const [selectedReference, setSelectedReference] = useState(focusedRow?.payable_reference ?? initialRows.find((row) => row.status === "review_required" || row.status === "disputed")?.payable_reference ?? initialRows[0]?.payable_reference ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const selected = rows.find((row) => row.payable_reference === selectedReference) ?? null;

  async function refresh() {
    const response = await fetch("/api/admin/freight-audit", { cache: "no-store" });
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Freight Audit could not be refreshed.");
    setRows(data.rows); setSummary(data.summary);
    if (!data.rows.some((row) => row.payable_reference === selectedReference)) setSelectedReference(data.rows[0]?.payable_reference ?? "");
  }

  async function act(action: "recheck" | "dispute" | "approve_variance" | "reject") {
    if (!selected) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/freight-audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference: selected.payable_reference, action, note }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Freight Audit action failed.");
      await refresh();
      setNote("");
      setNotice({ tone: action === "approve_variance" ? "success" : action === "dispute" ? "warning" : action === "reject" ? "warning" : "success", text: action === "approve_variance" ? "Variance approved against the current commercial fingerprint. Accounts can now approve/pay this bill unless the bill or booking changes." : action === "dispute" ? "Supplier invoice moved to Disputed and remains blocked from payment." : action === "reject" ? "Supplier invoice rejected and remains blocked from payment." : "Freight Audit recalculated from the current booking and supplier bill." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Freight Audit action failed." }); }
    finally { setBusy(false); }
  }

  return <div className="ops-content ops-stack">
    <OpsSurface eyebrow="Finance control" title="Freight Audit & Match-Pay" description="Compare supplier invoices against the locked TMS procurement booking before Accounts releases payment. Taxes remain visible but are excluded from the freight-rate comparison, and currencies are never silently converted." action={<OpsButton variant="secondary" size="sm" onClick={() => { setBusy(true); refresh().catch((error) => setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Refresh failed." })).finally(() => setBusy(false)); }} disabled={busy}><RefreshCw size={12}/>Refresh</OpsButton>}>
      <OpsStatStrip>
        <OpsStat label="Bills audited" value={String(summary.total)} detail="Current payable queue"/>
        <OpsStat label="Matched" value={String(summary.matched)} detail="Within tolerance"/>
        <OpsStat label="Review" value={String(summary.review_required)} detail="Blocking discrepancy"/>
        <OpsStat label="Disputed" value={String(summary.disputed)} detail="Supplier resolution pending"/>
        <OpsStat label="Payment blocked" value={String(summary.blocked_from_payment)} detail="Cannot pass Match-Pay"/>
      </OpsStatStrip>
      {notice ? <OpsNotice tone={notice.tone}>{notice.text}</OpsNotice> : null}
    </OpsSurface>

    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <OpsSurface eyebrow="Audit queue" title="Supplier invoices">
        {!rows.length ? <OpsEmptyState icon={<BadgeCheck size={18}/>} title="No supplier bills to audit" description="New supplier bills linked to TMS shipments will appear here automatically."/> : <div className="space-y-2">{rows.map((row) => <button type="button" key={row.payable_reference} onClick={() => setSelectedReference(row.payable_reference)} className={`w-full rounded-[11px] border p-3 text-left transition ${selectedReference === row.payable_reference ? "border-[#d5ae8f] bg-[#fff9f4]" : "border-[#e8e0d9] bg-white hover:bg-[#fcfaf8]"}`}>
          <div className="flex items-start justify-between gap-3"><div><div className="text-[12px] font-bold text-[#443d38]">{row.supplier_name}</div><div className="mt-1 text-[10px] text-[#8b8179]">{row.payable_reference}{row.supplier_bill_reference ? ` · Invoice ${row.supplier_bill_reference}` : ""}</div></div><OpsBadge tone={tone(row.status)}>{freightAuditStatusLabels[row.status]}</OpsBadge></div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#756c65]"><span>Booked {money(row.booked_currency, row.booked_cost)}</span><span>Invoice {money(row.invoice_currency, row.invoice_subtotal)}</span>{row.variance_amount !== null ? <span className={row.variance_amount > 0 ? "text-[#a35b4c]" : "text-[#58725f]"}>Variance {row.variance_amount >= 0 ? "+" : ""}{row.variance_amount.toFixed(2)}</span> : null}</div>
        </button>)}</div>}
      </OpsSurface>

      <OpsSurface eyebrow="Three-way match" title={selected ? selected.payable_reference : "Select a supplier bill"} description={selected ? `${selected.supplier_name}${selected.shipment_reference ? ` · ${selected.shipment_reference}` : ""}` : "Choose an invoice from the audit queue."}>
        {!selected ? <OpsEmptyState icon={<CircleDollarSign size={18}/>} title="No audit selected" description="Select a supplier invoice to inspect its booking match."/> : <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Booked procurement" value={money(selected.booked_currency, selected.booked_cost)}/>
            <Metric label="Supplier subtotal" value={money(selected.invoice_currency, selected.invoice_subtotal)}/>
            <Metric label="Supplier tax" value={money(selected.invoice_currency, selected.invoice_tax)}/>
            <Metric label="Invoice total" value={money(selected.invoice_currency, selected.invoice_total)}/>
            <Metric label="Variance" value={selected.variance_amount === null ? "Not comparable" : `${selected.variance_amount >= 0 ? "+" : ""}${money(selected.invoice_currency, selected.variance_amount)}`}/>
            <Metric label="Tolerance" value={`${selected.tolerance_percent.toFixed(2)}% or ${selected.invoice_currency} ${selected.tolerance_amount.toFixed(2)}`}/>
          </div>

          {selected.expected_linehaul !== null ? <div className="rounded-[11px] border border-[#e4ddd6] bg-[#fcfaf8] p-4"><div className="mb-3"><div className="text-[11px] font-bold text-[#4d453f]">Booked rate-card baseline</div><div className="mt-1 text-[10px] leading-5 text-[#857b73]">Reconstructed from the selected Partner rate card and the booked order quantity. This breakdown is hidden when a negotiated counter-offer replaced the original rate-card economics.</div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Linehaul" value={money(selected.booked_currency, selected.expected_linehaul)}/><Metric label="Fuel surcharge" value={money(selected.booked_currency, selected.expected_fuel_surcharge)}/><Metric label="Accessorials" value={money(selected.booked_currency, selected.expected_accessorials)}/><Metric label="Rating unit" value={selected.expected_rate_unit?.replaceAll("_", " ") ?? "Not available"}/><Metric label="Booked quantity" value={selected.expected_quantity === null ? "Not available" : selected.expected_quantity.toLocaleString("en-AU")}/><Metric label="Minimum charge" value={selected.minimum_applied === null ? "Not available" : selected.minimum_applied ? "Applied" : "Not applied"}/></div></div> : null}

          <div className="rounded-[11px] border border-[#e8e0d9] bg-[#fcfaf8] p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-[11px] font-bold text-[#4d453f]">Match-Pay status</div><div className="mt-1 text-[10px] text-[#857b73]">{selected.booked_partner_name ?? "No TMS carrier snapshot"}{selected.carrier_reference ? ` · Booking ${selected.carrier_reference}` : ""}</div></div><OpsBadge tone={tone(selected.status)}>{freightAuditStatusLabels[selected.status]}</OpsBadge></div></div>

          <div><div className="mb-2 text-[11px] font-bold text-[#4d453f]">Audit findings</div>{selected.issues.length ? <div className="space-y-2">{selected.issues.map((item) => <div key={item.code} className={`rounded-[10px] border p-3 ${item.severity === "blocking" ? "border-[#e8c8bf] bg-[#fff7f4]" : "border-[#eadfca] bg-[#fffaf0]"}`}><div className="flex gap-2"><AlertTriangle size={13} className="mt-0.5 shrink-0"/><div><div className="text-[11px] font-bold text-[#4e4640]">{item.title}</div><div className="mt-1 text-[10px] leading-5 text-[#796f68]">{item.detail}</div></div></div></div>)}</div> : <OpsNotice tone="success">Booked provider, currency and freight subtotal are within the configured match tolerance.</OpsNotice>}</div>

          {selected.dispute_note ? <OpsNotice tone="warning"><strong>Dispute:</strong> {selected.dispute_note}</OpsNotice> : null}
          {selected.resolution_note ? <OpsNotice tone="neutral"><strong>Resolution:</strong> {selected.resolution_note}</OpsNotice> : null}

          <label className="block"><span className="mb-1 block text-[10px] font-semibold text-[#746b64]">Decision / dispute note</span><textarea className="ops-textarea min-h-24" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required for dispute, rejection or approved variance..."/></label>
          <div className="flex flex-wrap gap-2"><OpsButton variant="secondary" onClick={() => act("recheck")} disabled={busy}><RefreshCw size={12}/>Recheck</OpsButton>{selected.status === "review_required" ? <OpsButton variant="secondary" onClick={() => act("dispute")} disabled={busy}><ShieldAlert size={12}/>Dispute</OpsButton> : null}{isManagement && (selected.status === "review_required" || selected.status === "disputed") ? <OpsButton variant="primary" onClick={() => act("approve_variance")} disabled={busy}><BadgeCheck size={12}/>Approve variance</OpsButton> : null}{isManagement && (selected.status === "review_required" || selected.status === "disputed") ? <OpsButton variant="danger" onClick={() => act("reject")} disabled={busy}>Reject invoice</OpsButton> : null}</div>
          <div className="flex flex-wrap gap-2 border-t border-[#eee7e1] pt-3"><Link href={`/admin/payables/bills/${encodeURIComponent(selected.payable_reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Open supplier bill</Link>{selected.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(selected.shipment_reference)}`} className="ops-button" data-variant="ghost" data-size="sm">Open Job File</Link> : null}</div>
        </div>}
      </OpsSurface>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-[10px] border border-[#ebe4de] bg-white p-3"><div className="text-[9px] font-bold uppercase tracking-[.12em] text-[#968b82]">{label}</div><div className="mt-1 text-[12px] font-bold capitalize text-[#4a423c]">{value}</div></div>; }
