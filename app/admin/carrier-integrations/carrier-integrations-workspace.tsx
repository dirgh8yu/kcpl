"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Cable, Check, RefreshCw, Route, Ship } from "lucide-react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { OpsBadge, OpsButton, OpsEmptyState, OpsKpiRail, OpsNotice, OpsPageHeader, OpsRailMetric, OpsSearch, OpsSurface, OpsTableWrap } from "../operations-ui";
import { statusTone as shipmentStatusTone } from "../shipments/shipments-views";
import type { CarrierProviderDashboard, CarrierShipmentCandidate } from "./carrier-integrations.server";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

function stateTone(state: CarrierProviderDashboard["state"]): Tone {
  if (state === "healthy") return "success";
  if (state === "degraded") return "danger";
  if (state === "configured") return "info";
  if (state === "partial") return "warning";
  return "neutral";
}

function stateLabel(state: CarrierProviderDashboard["state"]) {
  const words = state.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function shipmentTone(status: string): Tone {
  return (shipmentStatuses as readonly string[]).includes(status) ? shipmentStatusTone(status as ShipmentStatus) : "neutral";
}

function shipmentLabel(status: string) {
  return (shipmentStatuses as readonly string[]).includes(status) ? shipmentStatusLabels[status as ShipmentStatus] : status.replaceAll("_", " ");
}

function providerLabel(row: CarrierShipmentCandidate) {
  return row.provider === "dhl_express" ? "DHL Express" : row.provider === "maersk_ocean" ? "Maersk Ocean" : row.carrier || "Unmapped";
}

const dateTimeFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" });

const shortDateTimeFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kathmandu" });

function fmt(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateTimeFormat.format(date) : value;
}

/** In-row timestamp: day, month and time; the full date stays in the tooltip. */
function short(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? shortDateTimeFormat.format(date) : value;
}

export function CarrierIntegrationsWorkspace({
  initialProviders,
  initialRows,
  initialSummary,
  canViewCommercial,
}: {
  initialProviders: CarrierProviderDashboard[];
  initialRows: CarrierShipmentCandidate[];
  initialSummary: { configured: number; degraded: number; linked_shipments: number; dhl_sync_ready: number; maersk_linked: number };
  canViewCommercial: boolean;
}) {
  const [providers, setProviders] = useState(initialProviders);
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [scheduleRows, setScheduleRows] = useState<Array<{ index: number; origin: string; destination: string; departure: string; arrival: string; vessel: string; voyage: string; service: string }>>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.reference, row.carrier, row.carrier_reference, row.booking_reference, row.mode, row.status, row.branch].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [query, rows]);

  async function refresh() {
    const response = await fetch("/api/admin/carrier-integrations", { cache: "no-store" });
    const data = await response.json() as { ok?: boolean; providers?: CarrierProviderDashboard[]; rows?: CarrierShipmentCandidate[]; summary?: typeof initialSummary; error?: string };
    if (!response.ok || !data.ok || !data.providers || !data.rows || !data.summary) throw new Error(data.error || "Carrier integrations could not be refreshed.");
    setProviders(data.providers);
    setRows(data.rows);
    setSummary(data.summary);
  }

  async function syncDhl(reference: string) {
    setBusy(reference); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/carrier-integrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sync_dhl_tracking", reference }) });
      const data = await response.json() as { ok?: boolean; result?: { received: number; created: number; duplicates: number }; error?: string };
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error || "DHL tracking sync failed.");
      setMessage(`${reference}: ${data.result.received} DHL checkpoints received, ${data.result.created} new.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "DHL tracking sync failed.");
    } finally { setBusy(null); }
  }

  async function searchSchedules(event: React.FormEvent) {
    event.preventDefault();
    setBusy("maersk"); setError(""); setMessage(""); setScheduleRows([]);
    try {
      const response = await fetch("/api/admin/carrier-integrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "maersk_schedules", origin, destination }) });
      const data = await response.json() as { ok?: boolean; result?: { rows: typeof scheduleRows }; error?: string };
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error || "Maersk schedule search failed.");
      setScheduleRows(data.result.rows);
      setMessage(`${data.result.rows.length} Maersk schedule option${data.result.rows.length === 1 ? "" : "s"} normalized.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Maersk schedule search failed.");
    } finally { setBusy(null); }
  }

  const refreshBusy = busy === "refresh";

  return <>
    <OpsPageHeader
      title="Carrier integrations"
      description="Carrier APIs, DCSA webhooks and tracking sync. Credentials stay server-only."
      actions={<>
        <Link href="/admin/visibility" className="ops-button" data-variant="secondary" data-size="md">Live visibility</Link>
        <Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="md">Partners & vendors</Link>
        <OpsButton variant="secondary" disabled={Boolean(busy)} onClick={() => { setBusy("refresh"); refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Refresh failed.")).finally(() => setBusy(null)); }}><RefreshCw size={16} strokeWidth={1.75} className={refreshBusy ? "network-spin" : undefined} aria-hidden="true"/>Refresh</OpsButton>
      </>}
    />

    <div className="px-4 pb-8 pt-4 md:px-6">
      <OpsKpiRail label="Carrier integration summary">
        <OpsRailMetric label="Configured" value={summary.configured}/>
        <OpsRailMetric label="Degraded" value={summary.degraded} tone={summary.degraded ? "danger" : "neutral"}/>
        <OpsRailMetric label="Linked shipments" value={summary.linked_shipments}/>
        <OpsRailMetric label="DHL sync ready" value={summary.dhl_sync_ready}/>
        <OpsRailMetric label="Maersk linked" value={summary.maersk_linked}/>
      </OpsKpiRail>

      {message ? <div className="network-notice"><OpsNotice tone="success" onDismiss={() => setMessage("")}>{message}</OpsNotice></div> : null}
      {error ? <div className="network-notice"><OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice></div> : null}

      <OpsSurface density="compact" title="Provider health" description={`${providers.length} provider${providers.length === 1 ? "" : "s"} · last poll outcome, capabilities and latency`} flush>
        {providers.length ? <ul className="network-providers">
          {providers.map((provider) => <li key={provider.id} className="network-provider">
            <div className="network-provider-main">
              <div className="network-provider-head">
                <strong>{provider.label}</strong>
                <OpsBadge tone={stateTone(provider.state)}>{stateLabel(provider.state)}</OpsBadge>
              </div>
              <p className="network-provider-meta">{provider.modes.join(" / ")} · {provider.auth}</p>
              <p className="network-provider-note">{provider.docs_note}</p>
              {provider.last_message ? <p className="network-provider-message"><span>Last message</span>{provider.last_message}</p> : null}
              {provider.id === "maersk_ocean" ? <p className="network-provider-message"><span>Webhook endpoint</span><code className="ops-mono">/api/integrations/carriers/maersk</code></p> : null}
            </div>
            <ul className="network-capabilities" aria-label={`${provider.label} capabilities`}>
              {provider.capabilities.map((capability) => {
                const enabled = provider.active_capabilities.includes(capability);
                return <li key={capability} data-active={enabled || undefined}>
                  {enabled ? <Check size={12} strokeWidth={2} aria-hidden="true"/> : null}
                  {capability}
                  <span className="sr-only">{enabled ? " (active)" : " (not active)"}</span>
                </li>;
              })}
            </ul>
            <dl className="network-provider-facts">
              <div><dt>Last success</dt><dd>{fmt(provider.last_success_at)}</dd></div>
              <div><dt>Last failure</dt><dd>{fmt(provider.last_failure_at)}</dd></div>
              <div><dt>Last action</dt><dd>{provider.last_action || "None"}</dd></div>
              <div><dt>Latency</dt><dd>{provider.last_latency_ms === null ? "—" : `${provider.last_latency_ms} ms`}</dd></div>
            </dl>
          </li>)}
        </ul> : <OpsEmptyState compact kind="setup" icon={<Cable size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No carrier providers" description="No carrier integration providers are defined for this deployment."/>}
      </OpsSurface>

      <OpsSurface
        className="network-section"
        density="compact"
        title="Shipment integration queue"
        description="Carrier-linked jobs eligible for provider sync. Provider data feeds the existing Job File; it never creates parallel records."
        action={<div className="network-surface-tools">
          <OpsSearch className="network-surface-search" placeholder="Search shipment or reference" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search the shipment integration queue"/>
          <span className="ops-result-count" aria-live="polite">{filtered.length === rows.length ? `${rows.length} shipments` : `${filtered.length} of ${rows.length}`}</span>
        </div>}
        flush
      >
        {filtered.length ? <OpsTableWrap>
          <table className="ops-table ops-register-table carrier-queue-table" aria-label="Shipment integration queue">
            <thead><tr><th>Shipment</th><th>Provider</th><th>Carrier reference</th><th>Status</th><th>Last tracking</th><th>Integration</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{filtered.map((row) => <tr key={row.reference}>
              <td>
                <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="ops-cell-primary ops-mono ops-cell-id network-link">{row.reference}</Link>
                <span className="ops-cell-secondary">{row.branch} · {row.mode || "mode not set"}</span>
              </td>
              <td className="network-nowrap">{providerLabel(row)}</td>
              <td>{row.carrier_reference || row.booking_reference ? <span className="ops-mono ops-cell-muted network-nowrap">{row.carrier_reference || row.booking_reference}</span> : <span className="ops-cell-muted">—</span>}</td>
              <td><OpsBadge tone={shipmentTone(row.status)}>{shipmentLabel(row.status)}</OpsBadge></td>
              <td>
                {row.last_tracking_at ? <span className="ops-cell-primary network-nowrap" title={fmt(row.last_tracking_at)}>{short(row.last_tracking_at)}</span> : <span className="ops-cell-muted">Never</span>}
                {row.last_tracking_provider ? <span className="ops-cell-secondary">{row.last_tracking_provider}</span> : null}
              </td>
              <td>{row.sync_error ? <span className="network-error ops-cell-clamp" title={row.sync_error}>{row.sync_error}</span> : row.last_sync_at ? <span className="ops-cell-muted network-nowrap" title={`Synced ${fmt(row.last_sync_at)}`}>Synced {short(row.last_sync_at)}</span> : <span className="ops-cell-muted">Not synced</span>}</td>
              <td className="ops-cell-actions">{row.provider === "dhl_express" && row.carrier_reference ? <OpsButton variant="secondary" size="xs" disabled={busy === row.reference} onClick={() => syncDhl(row.reference)}><RefreshCw size={14} strokeWidth={1.75} aria-hidden="true"/>{busy === row.reference ? "Syncing…" : "Sync DHL"}</OpsButton> : row.provider === "maersk_ocean" ? <Link href={`/admin/visibility?shipment=${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="ghost" data-size="xs">View feed</Link> : <span className="ops-cell-muted">—</span>}</td>
            </tr>)}</tbody>
          </table>
        </OpsTableWrap> : <OpsEmptyState compact kind="search" icon={<Route size={16} strokeWidth={1.75} aria-hidden="true"/>} title={query.trim() ? "No results" : "No carrier-linked shipments"} description={query.trim() ? "No carrier-linked shipments match this search." : "No carrier-linked shipments match this view."}/>}
      </OpsSurface>

      {canViewCommercial ? <OpsSurface className="network-section" density="compact" title="Maersk commercial schedules" description="Use five-character UN/LOCODEs. Results are live planning data and are not persisted into KCPL rate history.">
        <form className="network-inline-form" onSubmit={searchSchedules}>
          <label className="network-inline-field"><span className="sr-only">Origin UN/LOCODE</span><input className="ops-input" value={origin} onChange={(event) => setOrigin(event.target.value.toUpperCase())} maxLength={5} placeholder="Origin e.g. INCCU"/></label>
          <label className="network-inline-field"><span className="sr-only">Destination UN/LOCODE</span><input className="ops-input" value={destination} onChange={(event) => setDestination(event.target.value.toUpperCase())} maxLength={5} placeholder="Destination e.g. SGSIN"/></label>
          <OpsButton type="submit" variant="primary" size="sm" disabled={busy === "maersk"}><Ship size={14} strokeWidth={1.75} aria-hidden="true"/>{busy === "maersk" ? "Searching…" : "Search Maersk"}</OpsButton>
        </form>
        {scheduleRows.length ? <div className="network-schedule-results"><OpsTableWrap>
          <table className="ops-table ops-register-table carrier-schedule-table" aria-label="Maersk schedule options">
            <thead><tr><th>#</th><th>Origin</th><th>Destination</th><th>Departure</th><th>Arrival</th><th>Vessel / voyage</th><th>Service</th></tr></thead>
            <tbody>{scheduleRows.map((row) => <tr key={row.index}><td className="ops-cell-muted">{row.index}</td><td className="ops-mono">{row.origin || origin}</td><td className="ops-mono">{row.destination || destination}</td><td>{row.departure || "—"}</td><td>{row.arrival || "—"}</td><td>{[row.vessel, row.voyage].filter(Boolean).join(" · ") || "—"}</td><td>{row.service || "—"}</td></tr>)}</tbody>
          </table>
        </OpsTableWrap></div> : null}
      </OpsSurface> : null}
    </div>
  </>;
}
