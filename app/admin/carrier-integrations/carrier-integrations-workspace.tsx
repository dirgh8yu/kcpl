"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, Cable, RefreshCw, Route, Search, Ship, Truck } from "lucide-react";
import { OpsBadge, OpsKpiCard, OpsKpiStrip, OpsPage, OpsPageHeader } from "../operations-ui";
import type { CarrierProviderDashboard, CarrierShipmentCandidate } from "./carrier-integrations.server";

function stateTone(state: CarrierProviderDashboard["state"]) {
  return state === "healthy" ? "success" : state === "degraded" ? "danger" : state === "partial" ? "warning" : "neutral";
}

const connectionLabels = { healthy: "Connected", degraded: "Needs attention", configured: "Ready to verify", partial: "Setup incomplete", unconfigured: "Not connected" };
const connectionGuidance = {
  healthy: "The last request succeeded. Review shipment updates below.",
  degraded: "The last request failed. Review the connection details before retrying.",
  configured: "Credentials are present. Run a supported action to verify the connection.",
  partial: "Some connection settings are missing. Ask your administrator to finish setup.",
  unconfigured: "Ask your administrator to connect this carrier before requesting updates.",
};

function fmt(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
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

  const stats: Array<{ label: string; value: number; detail: string; Icon: typeof Cable }> = [
    { label: "Configured carriers", value: summary.configured, detail: "Connection settings present", Icon: Cable },
    { label: "Need attention", value: summary.degraded, detail: "Last request failed", Icon: Activity },
    { label: "Linked shipments", value: summary.linked_shipments, detail: "Assigned to a carrier", Icon: Route },
    { label: "DHL references", value: summary.dhl_sync_ready, detail: "Shipments eligible for tracking", Icon: Truck },
    { label: "Maersk shipments", value: summary.maersk_linked, detail: "Linked ocean movements", Icon: Ship },
  ];

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

  return <OpsPage>
    <OpsPageHeader title="Carrier integrations" description="Connect carrier services, check connection health and update shipment tracking." actions={<>
      <Link href="/admin/visibility" className="ops-button" data-variant="secondary" data-size="sm">Live visibility</Link>
      <Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="sm">Partners & vendors</Link>
      <button className="ops-button" data-variant="secondary" data-size="sm" disabled={Boolean(busy)} onClick={() => { setBusy("refresh"); setError(""); refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Refresh failed.")).finally(() => setBusy(null)); }}><RefreshCw size={16}/>Refresh</button>
    </>}/>
    <div className="ops-content-wide">
    {message ? <div className="mt-4 rounded-[var(--app-radius)] border border-[var(--admin-success-line)] bg-[var(--admin-success-bg)] px-3 py-2 text-[length:var(--app-label-size)] text-[var(--admin-success)]">{message}</div> : null}
    {error ? <div className="mt-4 rounded-[var(--app-radius)] border border-[var(--admin-danger-line)] bg-[var(--admin-danger-bg)] px-3 py-2 text-[length:var(--app-label-size)] text-[var(--admin-danger)]">{error}</div> : null}

    <OpsKpiStrip>
      {stats.map(({ label, value, detail, Icon }) => <OpsKpiCard key={label} label={label} value={value} detail={detail} icon={<Icon size={16}/>} tone={label === "Need attention" ? "danger" : "neutral"}/>)}
    </OpsKpiStrip>

    <section className="ops-integration-grid" aria-label="Carrier connections">
      {providers.map((provider) => <article key={provider.id} className="ops-surface ops-integration-card">
        <div className="ops-surface-header">
          <div className="ops-integration-heading">
            <span className="ops-integration-symbol">{provider.id === "maersk_ocean" ? <Ship size={20} aria-hidden="true"/> : <Truck size={20} aria-hidden="true"/>}</span>
            <div><h2>{provider.label}</h2><p className="ops-surface-description">{provider.id === "maersk_ocean" ? "Ocean schedules and tracking" : "Express shipment tracking"}</p></div>
          </div>
          <OpsBadge tone={stateTone(provider.state)} dot>{connectionLabels[provider.state]}</OpsBadge>
        </div>
        <div className="ops-surface-body">
          <p className="ops-integration-guidance">{connectionGuidance[provider.state]}</p>
          <div className="ops-integration-capabilities">{provider.capabilities.map((capability) => <span key={capability}><span>{capability === "pod" ? "Proof of delivery" : capability === "webhook" ? "Automatic updates" : capability.replace(/^./, (letter) => letter.toUpperCase())}</span><OpsBadge tone="neutral">{provider.active_capabilities.includes(capability) ? "Supported" : "Not enabled"}</OpsBadge></span>)}</div>
          <p className="ops-integration-note">Supported features require a configured connection.</p>
          <dl className="ops-integration-health"><div><dt>Last successful request</dt><dd>{fmt(provider.last_success_at)}</dd></div><div><dt>Last failed request</dt><dd>{fmt(provider.last_failure_at)}</dd></div></dl>
          <details className="ops-integration-details"><summary>Connection details</summary>
            <p>{provider.auth}</p><p>{provider.docs_note}</p>
            <p>Last action: {provider.last_action || "None"} · Response time: {provider.last_latency_ms === null ? "Not measured" : `${provider.last_latency_ms} ms`}</p>
            {provider.last_message ? <p>{provider.last_message}</p> : null}
            {provider.id === "maersk_ocean" ? <p>Webhook endpoint: <code>/api/integrations/carriers/maersk</code></p> : null}
          </details>
        </div>
      </article>)}
    </section>

    {canViewCommercial ? <section className="mt-5 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-white p-4">
      <div className="flex items-center gap-2 text-[var(--admin-crimson)]"><Ship size={14}/><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em]">Maersk commercial schedules</p></div>
      <p className="mt-2 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Use five-character UN/LOCODEs. Results are live planning data and are not persisted into KCPL rate history.</p>
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={searchSchedules}><input className="ops-input w-36" value={origin} onChange={(event) => setOrigin(event.target.value.toUpperCase())} maxLength={5} aria-label="Origin port code" placeholder="Origin e.g. INCCU"/><input className="ops-input w-36" value={destination} onChange={(event) => setDestination(event.target.value.toUpperCase())} maxLength={5} aria-label="Destination port code" placeholder="Destination e.g. SGSIN"/><button className="ops-button" data-variant="primary" data-size="sm" disabled={busy === "maersk"}>{busy === "maersk" ? "Searching…" : "Search Maersk"}</button></form>
      {scheduleRows.length ? <div className="ops-scroll-x mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[length:var(--app-label-size)]"><thead className="border-b border-[var(--admin-line)] text-[var(--admin-muted)]"><tr><th className="py-2">#</th><th>Origin</th><th>Destination</th><th>Departure</th><th>Arrival</th><th>Vessel / voyage</th><th>Service</th></tr></thead><tbody>{scheduleRows.map((row) => <tr key={row.index} className="border-b border-[var(--admin-line)]"><td className="py-2.5">{row.index}</td><td>{row.origin || origin}</td><td>{row.destination || destination}</td><td>{row.departure || "—"}</td><td>{row.arrival || "—"}</td><td>{[row.vessel, row.voyage].filter(Boolean).join(" · ") || "—"}</td><td>{row.service || "—"}</td></tr>)}</tbody></table></div> : null}
    </section> : null}

    <section className="mt-5 overflow-hidden rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-line)] px-4 py-3"><div><p className="text-[11px] font-[730] text-[var(--admin-ink)]">Shipment integration queue</p><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Carrier-linked jobs and references eligible for provider synchronization.</p></div><div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--admin-faint)]"/><input className="ops-input w-64 pl-8" aria-label="Search carrier-linked shipments" placeholder="Search shipment, carrier, reference" value={query} onChange={(event) => setQuery(event.target.value)}/></div></div>
      <div className="ops-scroll-x overflow-x-auto"><table className="w-full min-w-[900px] text-left text-[length:var(--app-label-size)]"><thead className="border-b border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)]"><tr><th className="px-4 py-2.5">Shipment</th><th>Provider</th><th>Carrier reference</th><th>Status</th><th>Last tracking</th><th>Integration</th><th className="pr-4 text-right">Action</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.reference} className="border-b border-[var(--admin-line)]"><td className="px-4 py-3"><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="font-bold text-[var(--admin-crimson)] hover:underline">{row.reference}</Link><p className="mt-0.5 text-[var(--admin-faint)]">{row.branch} · {row.mode || "mode not set"}</p></td><td>{row.provider === "dhl_express" ? "DHL Express" : row.provider === "maersk_ocean" ? "Maersk Ocean" : row.carrier || "Unmapped"}</td><td>{row.carrier_reference || row.booking_reference || "—"}</td><td>{row.status.replaceAll("_", " ")}</td><td>{fmt(row.last_tracking_at)}{row.last_tracking_provider ? <p className="mt-0.5 text-[var(--admin-faint)]">{row.last_tracking_provider}</p> : null}</td><td>{row.sync_error ? <span className="text-[var(--admin-danger)]">{row.sync_error}</span> : row.last_sync_at ? `Synced ${fmt(row.last_sync_at)}` : "Not synced"}</td><td className="pr-4 text-right">{row.provider === "dhl_express" && row.carrier_reference ? <button className="ops-button" data-variant="secondary" data-size="sm" disabled={busy === row.reference} onClick={() => syncDhl(row.reference)}>{busy === row.reference ? "Syncing…" : "Sync DHL"}</button> : row.provider === "maersk_ocean" ? <Link href={`/admin/visibility?shipment=${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">View feed</Link> : "—"}</td></tr>)}</tbody></table></div>
      {!filtered.length ? <div className="p-8 text-center text-[length:var(--app-label-size)] text-[var(--admin-muted)]">No carrier-linked shipments match this view.</div> : null}
    </section>
    </div>
  </OpsPage>;
}
