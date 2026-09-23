"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Cable, RefreshCw, Search, Send, ShieldAlert } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsInlineAlert, OpsKpiRail, OpsNotice, OpsPageHeader, OpsRailMetric, OpsSearch, OpsSurface, OpsTableWrap } from "../operations-ui";
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

const dateTimeFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" });

function fmt(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateTimeFormat.format(date) : value;
}

function tone(status: EdiLedgerRow["status"]): "success" | "danger" | "warning" {
  if (status === "processed" || status === "dispatched") return "success";
  if (status === "quarantined" || status === "failed") return "danger";
  return "warning";
}

function statusLabel(status: EdiLedgerRow["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function channelLabel(channel: TmsTender["channel"]) {
  return channel === "edi_204" ? "EDI 204" : channel.charAt(0).toUpperCase() + channel.slice(1).replaceAll("_", " ");
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

  const handoffShown = eligibleTenders.slice(0, 12);

  return <>
    <OpsPageHeader
      title="EDI Gateway"
      description="X12 204 load tenders, 990 carrier responses and 214 shipment status messages."
      actions={<>
        <Link href="/admin/tenders" className="ops-button" data-variant="secondary" data-size="md">Tender & Booking</Link>
        <Link href="/admin/visibility" className="ops-button" data-variant="secondary" data-size="md">Live Visibility</Link>
        <OpsButton variant="secondary" disabled={Boolean(busy)} onClick={() => { setBusy("refresh"); setError(""); refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Refresh failed.")).finally(() => setBusy(null)); }}><RefreshCw size={16} strokeWidth={1.75} className={busy === "refresh" ? "network-spin" : undefined} aria-hidden="true"/>Refresh</OpsButton>
      </>}
    />

    <div className="px-4 pb-8 pt-4 md:px-6">
      <OpsKpiRail label="EDI gateway summary">
        <OpsRailMetric label="Transport" value={configured ? "Authenticated" : "Not configured"} tone={configured ? "success" : "warning"} title={configured ? "VAN/middleware can poll outbound 204s and post inbound 990/214 messages." : undefined}/>
        <OpsRailMetric label="204 queued" value={summary.outbound204Queued}/>
        <OpsRailMetric label="204 dispatched" value={summary.outbound204Dispatched}/>
        <OpsRailMetric label="990 processed" value={summary.inbound990Processed}/>
        <OpsRailMetric label="214 processed" value={summary.inbound214Processed}/>
        <OpsRailMetric label="Quarantine" value={summary.quarantined} tone={summary.quarantined ? "danger" : "neutral"}/>
      </OpsKpiRail>

      {configured ? null : <div className="network-notice"><OpsInlineAlert icon={<ShieldAlert size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>EDI transport not configured.</strong> Set KCPL_EDI_SECRET in Firebase Secret Manager before external EDI transport can connect. The internal ledger and tender workflow remain available.</OpsInlineAlert></div>}
      {message ? <div className="network-notice"><OpsNotice tone="success" onDismiss={() => setMessage("")}>{message}</OpsNotice></div> : null}
      {error ? <div className="network-notice"><OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice></div> : null}

      {canQueue204 ? <OpsSurface
        density="compact"
        title="204 tender handoff"
        description="Sent manual tenders can be converted to EDI 204 before any email dispatch. The tender reference and commercial snapshot stay the same, so the carrier 990 returns to the existing procurement record."
        flush
      >
        {handoffShown.length ? <OpsTableWrap>
          <table className="ops-table ops-register-table edi-handoff-table" aria-label="Tenders eligible for EDI 204">
            <thead><tr><th>Tender</th><th>Partner</th><th>Route</th><th>Channel</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{handoffShown.map((tender) => <tr key={tender.id}>
              <td><Link href={`/admin/tenders?tender=${encodeURIComponent(tender.id)}`} className="ops-cell-primary ops-mono ops-cell-id network-link">{tender.tender_reference}</Link></td>
              <td><span className="ops-cell-clamp" title={tender.partner_name}>{tender.partner_name}</span></td>
              <td><span className="ops-cell-clamp" title={`${tender.origin} → ${tender.destination}`}>{tender.origin} → {tender.destination}</span></td>
              <td><OpsBadge tone={tender.channel === "edi_204" ? "info" : "neutral"}>{channelLabel(tender.channel)}</OpsBadge></td>
              <td className="ops-cell-actions"><OpsButton variant="secondary" size="xs" disabled={busy === tender.id || tender.channel === "edi_204"} onClick={() => queue204(tender)}><Send size={14} strokeWidth={1.75} aria-hidden="true"/>{tender.channel === "edi_204" ? "204 queued" : busy === tender.id ? "Queueing…" : "Queue EDI 204"}</OpsButton></td>
            </tr>)}</tbody>
          </table>
        </OpsTableWrap> : <OpsEmptyState compact kind="healthy" icon={<Cable size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No tenders waiting" description="No sent manual tenders are waiting for an EDI handoff."/>}
        {eligibleTenders.length > handoffShown.length ? <footer className="ops-register-footer"><span>{handoffShown.length} of {eligibleTenders.length} eligible tenders shown</span></footer> : null}
      </OpsSurface> : null}

      <OpsSurface
        className="network-section"
        density="compact"
        title="EDI transaction ledger"
        description="Outbound and inbound message history. Duplicate or unmatched messages are held for review instead of silently changing freight records; raw X12 payloads never reach the browser."
        action={<div className="network-surface-tools">
          <OpsSearch className="network-surface-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, partner, set" aria-label="Search the EDI transaction ledger"/>
          <span className="ops-result-count" aria-live="polite">{filtered.length === rows.length ? `${rows.length} transactions` : `${filtered.length} of ${rows.length}`}</span>
        </div>}
        flush
      >
        {filtered.length ? <OpsTableWrap>
          <table className="ops-table ops-register-table edi-ledger-table" aria-label="EDI transaction ledger">
            <thead><tr><th>Set</th><th>Direction</th><th>Reference</th><th>Partner</th><th>Status</th><th>Control</th><th>Created</th><th>Message</th></tr></thead>
            <tbody>{filtered.map((row) => <tr key={row.id}>
              <td><span className="ops-cell-primary ops-mono">{row.transaction_set}</span></td>
              <td><span className="edi-direction">{row.direction === "inbound" ? <ArrowDownLeft size={14} strokeWidth={1.75} aria-hidden="true"/> : <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true"/>}{row.direction === "inbound" ? "Inbound" : "Outbound"}</span></td>
              <td>{row.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="ops-mono network-link">{row.shipment_reference}</Link> : row.tender_reference ? <Link href={`/admin/tenders?tender=${encodeURIComponent(row.tender_reference)}`} className="ops-mono network-link">{row.tender_reference}</Link> : row.reference ? <span className="ops-mono">{row.reference}</span> : <span className="ops-cell-muted">—</span>}</td>
              <td>{row.partner ? <span className="ops-cell-clamp" title={row.partner}>{row.partner}</span> : <span className="ops-cell-muted">—</span>}</td>
              <td><OpsBadge tone={tone(row.status)}>{statusLabel(row.status)}</OpsBadge></td>
              <td><span className="ops-mono ops-cell-muted">{row.transaction_control || row.interchange_control || "—"}</span></td>
              <td><span className="ops-cell-muted network-nowrap">{fmt(row.created_at)}</span></td>
              <td>{row.message ? <span className="ops-cell-muted ops-cell-clamp edi-message" title={row.message}>{row.message}</span> : <span className="ops-cell-muted">—</span>}</td>
            </tr>)}</tbody>
          </table>
        </OpsTableWrap> : <OpsEmptyState compact kind="search" icon={<Search size={16} strokeWidth={1.75} aria-hidden="true"/>} title={query.trim() ? "No results" : "No EDI transactions"} description={query.trim() ? "No EDI transactions match this search." : "No EDI transactions match this view."}/>}
      </OpsSurface>
    </div>
  </>;
}
