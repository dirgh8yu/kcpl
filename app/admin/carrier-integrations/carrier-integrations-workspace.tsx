"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, Cable, RefreshCw, Route, Search, Ship, Truck } from "lucide-react";
import type { CarrierProviderDashboard, CarrierShipmentCandidate } from "./carrier-integrations.server";

function stateTone(state: CarrierProviderDashboard["state"]) {
  if (state === "healthy") return "border-[#cfe1d3] bg-[#f3faf4] text-[#4d7958]";
  if (state === "degraded") return "border-[#edc8c4] bg-[#fff4f2] text-[#a6534d]";
  if (state === "configured") return "border-[#d8d6ea] bg-[#f8f7ff] text-[#68639b]";
  if (state === "partial") return "border-[#eadcc2] bg-[#fffaf0] text-[#8d6b38]";
  return "border-[#e5ded8] bg-[#faf8f6] text-[#81776f]";
}

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

  return <div className="ops-content-wide py-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="ops-eyebrow">Carrier network</p><h1 className="mt-1 text-[27px] font-[760] tracking-[-.04em] text-[#37312d]">Carrier integrations</h1><p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#7d746d]">One provider layer for carrier APIs, DCSA webhooks and tracking synchronization. Credentials remain server-only; provider data feeds the existing KCPL workflow rather than creating parallel records.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/admin/visibility" className="ops-button" data-variant="primary" data-size="sm">Live visibility</Link><Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="sm">Partners & vendors</Link><button className="ops-button" data-variant="secondary" data-size="sm" disabled={Boolean(busy)} onClick={() => { setBusy("refresh"); refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Refresh failed.")).finally(() => setBusy(null)); }}><RefreshCw size={12}/>Refresh</button></div>
    </div>

    {message ? <div className="mt-4 rounded-[10px] border border-[#cfe1d3] bg-[#f4faf5] px-3 py-2 text-[10px] text-[#55755d]">{message}</div> : null}
    {error ? <div className="mt-4 rounded-[10px] border border-[#edc8c4] bg-[#fff4f2] px-3 py-2 text-[10px] text-[#a6534d]">{error}</div> : null}

    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {[['Configured', summary.configured, Cable], ['Degraded', summary.degraded, Activity], ['Linked shipments', summary.linked_shipments, Route], ['DHL sync ready', summary.dhl_sync_ready, Truck], ['Maersk linked', summary.maersk_linked, Ship]].map(([label, value, Icon]) => <div key={String(label)} className="rounded-[13px] border border-[#e3ddd7] bg-white p-3.5"><div className="flex items-center gap-2 text-[#b45f4b]"><Icon size={13}/><span className="text-[9px] font-bold uppercase tracking-[.08em]">{String(label)}</span></div><p className="mt-2 text-[22px] font-[760] tracking-[-.04em] text-[#443d38]">{Number(value)}</p></div>)}
    </div>

    <section className="mt-5 grid gap-3 lg:grid-cols-2">
      {providers.map((provider) => <article key={provider.id} className="rounded-[15px] border border-[#e2dbd5] bg-[#fffdfa] p-4 shadow-[0_8px_24px_rgba(54,43,34,.035)]">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[13px] font-[740] text-[#443d38]">{provider.label}</p><p className="mt-1 text-[9px] text-[#8b8179]">{provider.modes.join(" / ")} · {provider.auth}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-bold ${stateTone(provider.state)}`}>{provider.state.replaceAll("_", " ")}</span></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{provider.capabilities.map((capability) => <span key={capability} className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[.06em] ${provider.active_capabilities.includes(capability) ? "border-[#dfc9bd] bg-[#fff8f3] text-[#a65f4c]" : "border-[#e7e1dc] bg-white text-[#91877f]"}`}>{capability}</span>)}</div>
        <p className="mt-3 text-[9px] leading-4 text-[#81776f]">{provider.docs_note}</p>
        <div className="mt-3 grid gap-1.5 text-[9px] text-[#746b64] sm:grid-cols-2"><p>Last success: <strong>{fmt(provider.last_success_at)}</strong></p><p>Last failure: <strong>{fmt(provider.last_failure_at)}</strong></p><p>Last action: <strong>{provider.last_action || "None"}</strong></p><p>Latency: <strong>{provider.last_latency_ms === null ? "—" : `${provider.last_latency_ms} ms`}</strong></p></div>
        {provider.last_message ? <p className="mt-3 rounded-[8px] border border-[#ebe5df] bg-white px-2.5 py-2 text-[9px] leading-4 text-[#756c65]">{provider.last_message}</p> : null}
        {provider.id === "maersk_ocean" ? <p className="mt-3 text-[9px] text-[#8a8078]">Webhook endpoint: <code className="rounded bg-[#f4f0ec] px-1 py-0.5">/api/integrations/carriers/maersk</code></p> : null}
      </article>)}
    </section>

    {canViewCommercial ? <section className="mt-5 rounded-[15px] border border-[#e2dbd5] bg-white p-4">
      <div className="flex items-center gap-2 text-[#b45f4b]"><Ship size={14}/><p className="text-[10px] font-bold uppercase tracking-[.08em]">Maersk commercial schedules</p></div>
      <p className="mt-2 text-[9px] leading-4 text-[#81776f]">Use five-character UN/LOCODEs. Results are live planning data and are not persisted into KCPL rate history.</p>
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={searchSchedules}><input className="ops-input w-36" value={origin} onChange={(event) => setOrigin(event.target.value.toUpperCase())} maxLength={5} placeholder="Origin e.g. INCCU"/><input className="ops-input w-36" value={destination} onChange={(event) => setDestination(event.target.value.toUpperCase())} maxLength={5} placeholder="Destination e.g. SGSIN"/><button className="ops-button" data-variant="primary" data-size="sm" disabled={busy === "maersk"}>{busy === "maersk" ? "Searching…" : "Search Maersk"}</button></form>
      {scheduleRows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[9px]"><thead className="border-b border-[#e9e3dd] text-[#8a8078]"><tr><th className="py-2">#</th><th>Origin</th><th>Destination</th><th>Departure</th><th>Arrival</th><th>Vessel / voyage</th><th>Service</th></tr></thead><tbody>{scheduleRows.map((row) => <tr key={row.index} className="border-b border-[#f0ebe7]"><td className="py-2.5">{row.index}</td><td>{row.origin || origin}</td><td>{row.destination || destination}</td><td>{row.departure || "—"}</td><td>{row.arrival || "—"}</td><td>{[row.vessel, row.voyage].filter(Boolean).join(" · ") || "—"}</td><td>{row.service || "—"}</td></tr>)}</tbody></table></div> : null}
    </section> : null}

    <section className="mt-5 overflow-hidden rounded-[15px] border border-[#e2dbd5] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe5df] px-4 py-3"><div><p className="text-[11px] font-[730] text-[#4a423d]">Shipment integration queue</p><p className="mt-1 text-[9px] text-[#887e76]">Carrier-linked jobs and references eligible for provider synchronization.</p></div><div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9a9088]"/><input className="ops-input w-64 pl-8" placeholder="Search shipment, carrier, reference" value={query} onChange={(event) => setQuery(event.target.value)}/></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-[9px]"><thead className="border-b border-[#ebe5df] bg-[#fcfaf8] text-[#8b8179]"><tr><th className="px-4 py-2.5">Shipment</th><th>Provider</th><th>Carrier reference</th><th>Status</th><th>Last tracking</th><th>Integration</th><th className="pr-4 text-right">Action</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.reference} className="border-b border-[#f0ebe7]"><td className="px-4 py-3"><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="font-bold text-[#a65f4c] hover:underline">{row.reference}</Link><p className="mt-0.5 text-[#8c827a]">{row.branch} · {row.mode || "mode not set"}</p></td><td>{row.provider === "dhl_express" ? "DHL Express" : row.provider === "maersk_ocean" ? "Maersk Ocean" : row.carrier || "Unmapped"}</td><td>{row.carrier_reference || row.booking_reference || "—"}</td><td>{row.status.replaceAll("_", " ")}</td><td>{fmt(row.last_tracking_at)}{row.last_tracking_provider ? <p className="mt-0.5 text-[#8c827a]">{row.last_tracking_provider}</p> : null}</td><td>{row.sync_error ? <span className="text-[#a6534d]">{row.sync_error}</span> : row.last_sync_at ? `Synced ${fmt(row.last_sync_at)}` : "Not synced"}</td><td className="pr-4 text-right">{row.provider === "dhl_express" && row.carrier_reference ? <button className="ops-button" data-variant="secondary" data-size="sm" disabled={busy === row.reference} onClick={() => syncDhl(row.reference)}>{busy === row.reference ? "Syncing…" : "Sync DHL"}</button> : row.provider === "maersk_ocean" ? <Link href={`/admin/visibility?shipment=${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">View feed</Link> : "—"}</td></tr>)}</tbody></table></div>
      {!filtered.length ? <div className="p-8 text-center text-[10px] text-[#8b8179]">No carrier-linked shipments match this view.</div> : null}
    </section>
  </div>;
}
