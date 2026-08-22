"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Cable, CheckCircle2, Clock3, RefreshCw, Search, Send, ShieldAlert, Truck } from "lucide-react";
import type { TmsTender } from "../tenders/tms-tendering";
import type { EdiLedgerRow } from "./edi-gateway.server";

type Summary = { outbound204Queued: number; outbound204Dispatched: number; inbound990Processed: number; inbound214Processed: number; quarantined: number };

type ApiResponse = {
  ok?: boolean;
  error?: string;
  rows?: EdiLedgerRow[];
  summary?: Summary;
  configured?: boolean;
  eligibleTenders?: TmsTender[];
  canQueue204?: boolean;
  transactionId?: string;
};

function fmt(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function tone(status: EdiLedgerRow["status"]) {
  if (status === "processed" || status === "dispatched") return "border-[#cfe1d3] bg-[#f4faf5] text-[#55755d]";
  if (status === "quarantined" || status === "failed") return "border-[#edc8c4] bg-[#fff4f2] text-[#a6534d]";
  return "border-[#eadcc2] bg-[#fffaf0] text-[#8d6b38]";
}

export function EdiWorkspace({ initialRows, initialSummary, initialConfigured, initialEligibleTenders, canQueue204 }: {
  initialRows: EdiLedgerRow[];
  initialSummary: Summary;
  initialConfigured: boolean;
  initialEligibleTenders: TmsTender[];
  canQueue204: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [configured, setConfigured] = useState(initialConfigured);
  const [eligibleTenders, setEligibleTenders] = useState(initialEligibleTenders);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.transaction_set, row.status, row.partner, row.reference, row.tender_reference, row.shipment_reference, row.transaction_control, row.message, row.branch].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [query, rows]);

  async function refresh() {
    const response = await fetch("/api/admin/edi", { cache: "no-store" });
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok || !data.rows || !data.summary || !data.eligibleTenders) throw new Error(data.error || "EDI Gateway could not be refreshed.");
    setRows(data.rows); setSummary(data.summary); setConfigured(Boolean(data.configured)); setEligibleTenders(data.eligibleTenders);
  }

  async function queue204(tender: TmsTender) {
    setBusy(tender.id); setMessage(""); setError("");
    try {
      const response = await fetch("/api/admin/edi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "queue_204", tenderId: tender.id }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "EDI 204 could not be queued.");
      setMessage(`${tender.tender_reference} is queued as EDI 204${data.transactionId ? ` · ${data.transactionId}` : ""}.`);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "EDI 204 could not be queued."); }
    finally { setBusy(null); }
  }

  return <div className="ops-content-wide py-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="ops-eyebrow">Freight EDI</p><h1 className="mt-1 text-[27px] font-[760] tracking-[-.04em] text-[#37312d]">EDI Gateway</h1><p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#7d746d]">ANSI X12 204 load tenders, 990 carrier responses and 214 shipment status messages stitched into KCPL Tender & Booking and Live Visibility. Duplicate or unmatched messages are retained for review instead of silently mutating freight records.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/admin/tenders" className="ops-button" data-variant="primary" data-size="sm">Tender & Booking</Link><Link href="/admin/visibility" className="ops-button" data-variant="secondary" data-size="sm">Live Visibility</Link><button className="ops-button" data-variant="secondary" data-size="sm" disabled={Boolean(busy)} onClick={() => { setBusy("refresh"); setError(""); refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Refresh failed.")).finally(() => setBusy(null)); }}><RefreshCw size={12}/>Refresh</button></div>
    </div>

    <div className={`mt-4 rounded-[11px] border px-3 py-2.5 text-[10px] ${configured ? "border-[#cfe1d3] bg-[#f4faf5] text-[#55755d]" : "border-[#eadcc2] bg-[#fffaf0] text-[#8d6b38]"}`}><strong>{configured ? "EDI transport authenticated" : "EDI transport not configured"}</strong> · {configured ? "VAN/middleware can poll outbound 204s and post inbound 990/214 messages." : "Set KCPL_EDI_SECRET in Firebase Secret Manager before external EDI transport can connect. Internal ledger and tender workflow remain available."}</div>
    {message ? <div className="mt-3 rounded-[10px] border border-[#cfe1d3] bg-[#f4faf5] px-3 py-2 text-[10px] text-[#55755d]">{message}</div> : null}
    {error ? <div className="mt-3 rounded-[10px] border border-[#edc8c4] bg-[#fff4f2] px-3 py-2 text-[10px] text-[#a6534d]">{error}</div> : null}

    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <Stat label="204 queued" value={summary.outbound204Queued} icon={<Clock3 size={13}/>}/>
      <Stat label="204 dispatched" value={summary.outbound204Dispatched} icon={<Send size={13}/>}/>
      <Stat label="990 processed" value={summary.inbound990Processed} icon={<CheckCircle2 size={13}/>}/>
      <Stat label="214 processed" value={summary.inbound214Processed} icon={<Truck size={13}/>}/>
      <Stat label="Quarantine" value={summary.quarantined} icon={<ShieldAlert size={13}/>}/>
    </div>

    {canQueue204 ? <section className="mt-5 rounded-[15px] border border-[#e2dbd5] bg-white p-4">
      <div className="flex items-center gap-2 text-[#b45f4b]"><Cable size={14}/><p className="text-[10px] font-bold uppercase tracking-[.08em]">204 tender handoff</p></div>
      <p className="mt-2 text-[9px] leading-4 text-[#81776f]">Sent manual tenders can be converted to EDI 204 before any email dispatch. The tender reference and commercial snapshot remain the same, so the carrier's 990 response returns to the existing procurement record.</p>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">{eligibleTenders.length ? eligibleTenders.slice(0, 12).map((tender) => <div key={tender.id} className="rounded-[11px] border border-[#e8e1db] bg-[#fffdfa] p-3"><div className="flex items-start justify-between gap-3"><div><Link href={`/admin/tenders?tender=${encodeURIComponent(tender.id)}`} className="text-[11px] font-bold text-[#a65f4c] hover:underline">{tender.tender_reference}</Link><p className="mt-1 text-[9px] text-[#877d75]">{tender.partner_name} · {tender.origin} → {tender.destination}</p></div><span className="rounded-full border border-[#e7ddd6] bg-white px-2 py-1 text-[8px] font-bold uppercase text-[#877d75]">{tender.channel.replaceAll("_", " ")}</span></div><div className="mt-3 flex justify-end"><button className="ops-button" data-variant="primary" data-size="sm" disabled={busy === tender.id || tender.channel === "edi_204"} onClick={() => queue204(tender)}>{tender.channel === "edi_204" ? "204 queued" : busy === tender.id ? "Queueing…" : "Queue EDI 204"}</button></div></div>) : <p className="text-[10px] text-[#8b8179]">No sent manual tenders are waiting for an EDI handoff.</p>}</div>
    </section> : null}

    <section className="mt-5 overflow-hidden rounded-[15px] border border-[#e2dbd5] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe5df] px-4 py-3"><div><p className="text-[11px] font-[730] text-[#4a423d]">EDI transaction ledger</p><p className="mt-1 text-[9px] text-[#887e76]">Outbound and inbound message history without exposing raw X12 payloads to the browser.</p></div><div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9a9088]"/><input className="ops-input w-64 pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, partner, set"/></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-[9px]"><thead className="border-b border-[#ebe5df] bg-[#fcfaf8] text-[#8b8179]"><tr><th className="px-4 py-2.5">Set</th><th>Direction</th><th>Reference</th><th>Partner</th><th>Status</th><th>Control</th><th>Created</th><th className="pr-4">Message</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-b border-[#f0ebe7]"><td className="px-4 py-3 font-bold text-[#4a423d]">{row.transaction_set}</td><td>{row.direction}</td><td>{row.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="text-[#a65f4c] hover:underline">{row.shipment_reference}</Link> : row.tender_reference ? <Link href={`/admin/tenders?tender=${encodeURIComponent(row.tender_reference)}`} className="text-[#a65f4c] hover:underline">{row.tender_reference}</Link> : row.reference || "—"}</td><td>{row.partner || "—"}</td><td><span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${tone(row.status)}`}>{row.status}</span></td><td>{row.transaction_control || row.interchange_control || "—"}</td><td>{fmt(row.created_at)}</td><td className="max-w-[280px] pr-4 text-[#756c65]">{row.message || "—"}</td></tr>)}</tbody></table></div>
      {!filtered.length ? <div className="p-8 text-center text-[10px] text-[#8b8179]">No EDI transactions match this view.</div> : null}
    </section>
  </div>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-[13px] border border-[#e3ddd7] bg-white p-3.5"><div className="flex items-center gap-2 text-[#b45f4b]">{icon}<span className="text-[9px] font-bold uppercase tracking-[.08em]">{label}</span></div><p className="mt-2 text-[22px] font-[760] tracking-[-.04em] text-[#443d38]">{value}</p></div>;
}
