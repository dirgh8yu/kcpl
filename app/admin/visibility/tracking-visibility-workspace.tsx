"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  OpsActiveFilters,
  OpsBadge,
  OpsButton,
  OpsDialog,
  OpsEmptyState,
  OpsFact,
  OpsFacts,
  OpsField,
  OpsFilterSelect,
  OpsInspectorHeader,
  OpsInspectorNote,
  OpsInspectorSection,
  OpsKpiRail,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsRailMetric,
  OpsRegisterToolbar,
  OpsScopeTabs,
  OpsSearch,
  OpsSurface,
  OpsTableWrap,
  useAdminPortalContainer,
  type OpsActiveFilter,
} from "../operations-ui";
import { statusTone as shipmentStatusTone } from "../shipments/shipments-views";
import { useWorkspaceQuery } from "../use-workspace-query";
import { shipmentStatusLabels } from "../../shipment-types";
import {
  trackingMilestoneLabels,
  trackingMilestones,
  type TrackingEvent,
  type TrackingMilestone,
  type VisibilityShipment,
  type VisibilitySummary,
} from "./tracking-visibility";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

type ApiResponse = {
  ok: boolean;
  error?: string;
  rows?: VisibilityShipment[];
  summary?: VisibilitySummary;
  events?: TrackingEvent[];
  opened_exceptions?: string[];
  checked?: number;
  opened?: number;
};

type Focus = "all" | "delayed" | "stale" | "customs" | "delivery";

const FOCUS_OPTIONS: Array<{ value: Focus; label: string }> = [
  { value: "all", label: "All feeds" },
  { value: "delayed", label: "ETA delayed" },
  { value: "stale", label: "Stale feeds" },
  { value: "customs", label: "Customs" },
  { value: "delivery", label: "Out for delivery" },
];

// Module scope, not component scope: a Set built during render has a new identity
// every time, so listing it in a dependency array would make the memo recompute on
// every render anyway, and omitting it is what the lint rule flags. The milestones
// are a fixed list, so they belong next to the other module constants.
const DESTINATION_MILESTONES: ReadonlySet<TrackingMilestone> = new Set<TrackingMilestone>([
  "arrived_destination",
  "import_customs",
  "out_for_delivery",
  "delivery_attempted",
  "delivery_refused",
]);

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: NEPAL_TIME_ZONE }).format(date)} NPT`;
}

function shortDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: NEPAL_TIME_ZONE,
      }).format(date);
}

function nepalInputToIso(value: string) {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/.exec(value);
  if (!match) return "";
  const date = new Date(`${match[1]}:00+05:45`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function delayText(hours: number | null) {
  if (hours === null) return "No baseline";
  if (Math.abs(hours) < 1) return "On baseline";
  return hours > 0
    ? `+${Math.round(hours)}h`
    : `-${Math.abs(Math.round(hours))}h`;
}

function sourceLabel(source: VisibilityShipment["last_source"]) {
  if (!source) return null;
  const labels = {
    manual: "KCPL manual",
    carrier_api: "Carrier API",
    webhook: "Webhook",
    edi_214: "EDI 214",
    gps: "GPS",
    counterpart: "Counterpart",
  } as const;
  return labels[source];
}

function relativeSignal(value: string | null) {
  if (!value) return "No signal";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function rowMatchesFocus(row: VisibilityShipment, focus: Focus) {
  if (focus === "delayed")
    return (row.eta_delta_hours ?? 0) >= 24 && row.status !== "delivered";
  if (focus === "stale") return row.stale && row.status !== "delivered";
  if (focus === "customs") return row.status === "customs_clearance";
  if (focus === "delivery") return row.status === "out_for_delivery";
  return true;
}

export function TrackingVisibilityWorkspace({
  initialRows,
  initialSummary,
  canSweep,
  initialShipment = "",
}: {
  initialRows: VisibilityShipment[];
  initialSummary: VisibilitySummary;
  canSweep: boolean;
  initialShipment?: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const { params, search, update } = useWorkspaceQuery();
  const portalContainer = useAdminPortalContainer();
  const query = params.get("q") ?? "";
  const requestedFocus = params.get("view");
  const focus: Focus = FOCUS_OPTIONS.some(
    (option) => option.value === requestedFocus,
  )
    ? (requestedFocus as Focus)
    : "all";
  const modeFilter = params.get("mode") ?? "all";
  const originFilter = params.get("origin") ?? "all";
  const destinationFilter = params.get("destination") ?? "all";
  const requestedPage = Number(params.get("page") || "1");

  const pageSize = 10;
  const [allowInitialSelection, setAllowInitialSelection] = useState(
    Boolean(initialShipment),
  );
  const selectedReference = (
    params.get("selected") ??
    (allowInitialSelection ? initialShipment : "") ??
    ""
  )
    .trim()
    .toUpperCase();
  const selected = useMemo(
    () => rows.find((row) => row.reference === selectedReference) ?? null,
    [rows, selectedReference],
  );
  const selectedKey = selected?.reference ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "warning" | "danger";
    text: string;
  } | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const modes = useMemo(
    () =>
      [...new Set(rows.map((row) => row.mode).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  const origins = useMemo(
    () =>
      [...new Set(rows.map((row) => row.origin).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  const destinations = useMemo(
    () =>
      [...new Set(rows.map((row) => row.destination).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return rows.filter((row) => {
      if (!rowMatchesFocus(row, focus)) return false;

      if (modeFilter !== "all" && row.mode !== modeFilter) return false;
      if (originFilter !== "all" && row.origin !== originFilter) return false;
      if (destinationFilter !== "all" && row.destination !== destinationFilter)
        return false;
      if (!terms.length) return true;

      const haystack = [
        row.reference,
        row.customer_name,
        row.origin,
        row.destination,
        row.mode,
        row.primary_branch,
        row.carrier ?? "",
        row.carrier_reference ?? "",
        row.current_location ?? "",
        row.last_provider ?? "",
        row.last_milestone ?? "",
        shipmentStatusLabels[row.status],
      ]
        .join(" ")
        .toLowerCase();

      return terms.every((term) => haystack.includes(term));
    });
  }, [destinationFilter, focus, modeFilter, originFilter, query, rows]);

  const focusCounts = useMemo(
    () => ({
      all: rows.length,
      delayed: rows.filter((row) => rowMatchesFocus(row, "delayed")).length,
      stale: rows.filter((row) => rowMatchesFocus(row, "stale")).length,
      customs: rows.filter((row) => rowMatchesFocus(row, "customs")).length,
      delivery: rows.filter((row) => rowMatchesFocus(row, "delivery")).length,
    }),
    [rows],
  );

  const atDestination = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.status !== "delivered" &&
          row.last_milestone &&
          DESTINATION_MILESTONES.has(row.last_milestone),
      ).length,
    [rows],
  );

  const freshFeeds = Math.max(0, summary.active - summary.stale);

  const providerHealth = useMemo(() => {
    const providers = new Map<
      string,
      {
        provider: string;
        shipments: number;
        stale: number;
        lastReceivedAt: string | null;
      }
    >();
    for (const row of rows) {
      const provider =
        row.last_provider ||
        sourceLabel(row.last_source) ||
        "No provider reported";
      const current = providers.get(provider) ?? {
        provider,
        shipments: 0,
        stale: 0,
        lastReceivedAt: null,
      };
      current.shipments += 1;
      if (row.stale) current.stale += 1;
      if (
        row.last_received_at &&
        (!current.lastReceivedAt ||
          Date.parse(row.last_received_at) > Date.parse(current.lastReceivedAt))
      )
        current.lastReceivedAt = row.last_received_at;
      providers.set(provider, current);
    }
    return [...providers.values()]
      .sort((a, b) => b.stale - a.stale || b.shipments - a.shipments)
      .slice(0, 5);
  }, [rows]);

  const recentSignals = useMemo(
    () =>
      [...rows]
        .filter((row) => row.last_event_at)
        .sort(
          (a, b) =>
            Date.parse(b.last_event_at ?? "") -
            Date.parse(a.last_event_at ?? ""),
        )
        .slice(0, 5),
    [rows],
  );

  const featured = useMemo(() => {
    if (selected) return selected;
    return (
      [...filtered].sort((a, b) => {
        if (a.stale !== b.stale) return Number(b.stale) - Number(a.stale);
        const aDelay = a.eta_delta_hours ?? 0;
        const bDelay = b.eta_delta_hours ?? 0;
        if (aDelay !== bDelay) return bDelay - aDelay;
        return (
          Date.parse(b.last_event_at ?? "") - Date.parse(a.last_event_at ?? "")
        );
      })[0] ??
      rows[0] ??
      null
    );
  }, [filtered, rows, selected]);

  const lastUpdated = useMemo(() => {
    const latest = rows
      .map((row) => row.last_received_at || row.last_event_at || row.updated_at)
      .filter(Boolean)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    return latest ?? null;
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(
    pageCount,
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1,
  );
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (!selectedKey) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return;
    }
    // The inspector is non-modal (as on Shipments), so the register keeps
    // scrolling behind it; Escape still dismisses it.
    const onKeyDown = (event: KeyboardEvent) => {
      // Popovers and the sheet's own dismiss layer mark the event they handle.
      if (event.key === "Escape" && !event.defaultPrevented) {
        setAllowInitialSelection(false);
        update({ selected: null, shipment: null });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedKey, update]);

  function openInspector(row: VisibilityShipment) {
    if (document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }
    setAllowInitialSelection(false);
    update({ selected: row.reference, shipment: null }, "push");
  }

  function closeInspector() {
    setAllowInitialSelection(false);
    update({ selected: null, shipment: null });
  }

  async function refresh(showNotice = true) {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/visibility", {
        cache: "no-store",
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok || !data.rows || !data.summary)
        throw new Error(data.error || "Visibility could not be refreshed.");
      setRows(data.rows);
      setSummary(data.summary);
      if (
        selectedReference &&
        !data.rows.some((row) => row.reference === selectedReference)
      )
        closeInspector();
      if (showNotice)
        setNotice({ tone: "success", text: "Live visibility refreshed." });
    } catch (error) {
      setNotice({
        tone: "danger",
        text:
          error instanceof Error
            ? error.message
            : "Visibility could not be refreshed.",
      });
      throw error;
    } finally {
      setRefreshing(false);
    }
  }

  async function sweep() {
    setSweeping(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sweep" }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok)
        throw new Error(data.error || "Tracking health sweep failed.");
      await refresh(false);
      setNotice({
        tone: (data.opened ?? 0) > 0 ? "warning" : "success",
        text: `Checked ${data.checked ?? 0} active shipments. Opened ${data.opened ?? 0} stale-feed exceptions.`,
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        text:
          error instanceof Error
            ? error.message
            : "Tracking health sweep failed.",
      });
    } finally {
      setSweeping(false);
    }
  }

  const returnTo = `/admin/visibility${search}`;
  const hasFilters =
    Boolean(query) ||
    focus !== "all" ||
    modeFilter !== "all" ||
    originFilter !== "all" ||
    destinationFilter !== "all";

  const setFocus = (next: Focus) => update({ view: next === "all" ? null : next, page: null, selected: null });
  const activeFilters: OpsActiveFilter[] = [];
  if (modeFilter !== "all") activeFilters.push({ key: "mode", label: modeFilter, title: `Mode: ${modeFilter}`, onRemove: () => update({ mode: null, page: null, selected: null }) });
  if (originFilter !== "all") activeFilters.push({ key: "origin", label: originFilter, title: `Origin: ${originFilter}`, onRemove: () => update({ origin: null, page: null, selected: null }) });
  if (destinationFilter !== "all") activeFilters.push({ key: "destination", label: destinationFilter, title: `Destination: ${destinationFilter}`, onRemove: () => update({ destination: null, page: null, selected: null }) });
  const resetFilters = () => update({ q: null, view: null, mode: null, origin: null, destination: null, page: null, selected: null, shipment: null });

  return (
    <OpsPage className="visibility-v2">
      <OpsPageHeader
        title="Live Visibility"
        description="Monitor shipment feeds, ETA movement and the latest carrier or counterpart events from one operational register."
        meta={<span className="visibility-last-updated">Last updated <strong>{lastUpdated ? dateTime(lastUpdated) : "No tracking signal"}</strong></span>}
        actions={(
          <>
            <OpsButton variant="secondary" disabled={refreshing || sweeping} onClick={() => { void refresh(); }}>
              <RefreshCw size={16} strokeWidth={1.75} className={refreshing ? "app-refreshing" : ""} aria-hidden="true"/>
              Refresh
            </OpsButton>
            {canSweep ? (
              <OpsButton variant="primary" disabled={sweeping || refreshing} onClick={sweep}>
                <Activity size={16} strokeWidth={1.75} aria-hidden="true"/>
                {sweeping ? "Sweeping…" : "Run health sweep"}
              </OpsButton>
            ) : null}
          </>
        )}
      />

      {/* One rail instead of six icon cards. Segments that already mapped to a
          visibility scope keep exactly that behaviour; the rest are statistics. */}
      <div className="px-4 pt-3 md:px-6">
        <OpsKpiRail label="Live visibility summary">
          <OpsRailMetric label="Active shipments" value={summary.active} active={focus === "all"} onClick={() => update({ view: null, page: null, selected: null })}/>
          <OpsRailMetric label="Fresh feeds" value={freshFeeds} tone="success"/>
          <OpsRailMetric label="ETA delayed" value={summary.delayed} tone="warning" active={focus === "delayed"} onClick={() => update({ view: focus === "delayed" ? null : "delayed", page: null, selected: null })}/>
          <OpsRailMetric label="Stale feeds" value={summary.stale} tone="danger" active={focus === "stale"} onClick={() => update({ view: focus === "stale" ? null : "stale", page: null, selected: null })}/>
          <OpsRailMetric label="At destination" value={atDestination}/>
          <OpsRailMetric label="Out for delivery" value={summary.out_for_delivery} tone="info" active={focus === "delivery"} onClick={() => update({ view: focus === "delivery" ? null : "delivery", page: null, selected: null })}/>
        </OpsKpiRail>
      </div>

      <div className="px-4 pb-8 pt-4 md:px-6">
        {notice ? <div className="mb-3"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null, page: null, selected: null, shipment: null })} placeholder="Search reference, customer, carrier, location…" aria-label="Search live visibility"/>}
          actions={(
            <>
              <OpsFilterSelect label="Mode" value={modeFilter} allLabel="All modes" options={modes.map((mode) => ({ value: mode, label: mode }))} onChange={(value) => update({ mode: value === "all" ? null : value, page: null, selected: null })}/>
              <OpsFilterSelect label="Origin" value={originFilter} allLabel="All origins" options={origins.map((origin) => ({ value: origin, label: origin }))} onChange={(value) => update({ origin: value === "all" ? null : value, page: null, selected: null })}/>
              <OpsFilterSelect label="Destination" value={destinationFilter} allLabel="All destinations" options={destinations.map((destination) => ({ value: destination, label: destination }))} onChange={(value) => update({ destination: value === "all" ? null : value, page: null, selected: null })}/>
              {hasFilters ? <OpsButton size="xs" variant="ghost" onClick={resetFilters}>Reset</OpsButton> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{filtered.length === rows.length ? `${rows.length} shipments` : `${filtered.length} of ${rows.length}`}</span>
            </>
          )}
          tabs={<OpsScopeTabs label="Shipment visibility state" items={FOCUS_OPTIONS.map((option) => ({ ...option, count: focusCounts[option.value] }))} value={focus} onChange={setFocus}/>}
        />

        <OpsActiveFilters chips={activeFilters} onReset={resetFilters}/>

        <section className="ops-surface" aria-label="Live shipments">
          {filtered.length ? (
            <>
              <OpsTableWrap>
                <table className="ops-table ops-register-table visibility-table" aria-label="Live shipment visibility">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Customer · Route</th>
                      <th>Mode</th>
                      <th>Last signal</th>
                      <th>ETA</th>
                      <th>Status</th>
                      <th>Latest milestone</th>
                      <th className="ops-cell-open"><span className="sr-only">Inspect</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const chosen = selected?.reference === row.reference;
                      const delayed = (row.eta_delta_hours ?? 0) >= 24;
                      return (
                        <tr
                          key={row.reference}
                          data-selected={chosen || undefined}
                          aria-current={chosen || undefined}
                          tabIndex={0}
                          onClick={() => openInspector(row)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openInspector(row); } }}
                        >
                          <td><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`} className="ops-cell-ref ops-mono" onClick={(event) => event.stopPropagation()}>{row.reference}</Link></td>
                          <td>
                            <span className="ops-cell-primary ops-cell-clamp">{row.customer_name || "Customer not linked"}</span>
                            <span className="ops-cell-secondary ops-cell-clamp">{row.origin} → {row.destination}</span>
                          </td>
                          <td><span className="ops-cell-muted">{row.mode || "Not set"}</span></td>
                          <td>
                            <span className="ops-cell-primary">{shortDateTime(row.last_event_at)}</span>
                            <span className="ops-cell-secondary ops-cell-clamp">{row.current_location || "Location unknown"}</span>
                          </td>
                          <td>
                            <span className="ops-cell-primary" data-delayed={delayed || undefined}>{shortDateTime(row.eta)}</span>
                            {delayed ? <span className="ops-cell-secondary visibility-delayed">{delayText(row.eta_delta_hours)} vs baseline</span> : null}
                          </td>
                          <td>
                            <span className="visibility-status">
                              <OpsBadge tone={shipmentStatusTone(row.status)}>{shipmentStatusLabels[row.status]}</OpsBadge>
                              {row.stale ? <OpsBadge tone="danger" dot>Stale</OpsBadge> : null}
                            </span>
                          </td>
                          <td><span className="ops-cell-muted">{row.last_milestone ? trackingMilestoneLabels[row.last_milestone] : "Awaiting feed"}</span></td>
                          <td className="ops-cell-open">
                            <button type="button" className="ops-row-open" tabIndex={-1} aria-label={`Inspect ${row.reference}`} onClick={(event) => { event.stopPropagation(); openInspector(row); }}>
                              <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </OpsTableWrap>
              <footer className="ops-register-footer">
                <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} shipments</span>
                {pageCount > 1 ? (
                  <nav className="ops-pager" aria-label="Live visibility pages">
                    <button type="button" className="ops-pager-button" disabled={page <= 1} onClick={() => update({ page: String(page - 1), selected: null })} aria-label="Previous page"><ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true"/></button>
                    <span className="px-1">Page {page} of {pageCount}</span>
                    <button type="button" className="ops-pager-button" disabled={page >= pageCount} onClick={() => update({ page: String(page + 1), selected: null })} aria-label="Next page"><ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/></button>
                  </nav>
                ) : null}
              </footer>
            </>
          ) : (
            <OpsEmptyState compact kind={hasFilters ? "search" : "neutral"} title="No visible shipments" description={hasFilters ? "No shipments match the current visibility filters." : "Tracking feeds will appear when active shipments produce visibility events."} action={hasFilters ? <OpsButton size="sm" variant="secondary" onClick={resetFilters}>Clear filters</OpsButton> : undefined}/>
          )}
        </section>

        {/* Context below the register: the most urgent movement, provider
            health and the newest signals. */}
        <div className="visibility-context">
          <OpsSurface density="compact" title="Priority movement" description="The most urgent visible movement: stale feeds first, then the largest ETA slip." action={featured ? <OpsButton size="xs" variant="secondary" onClick={() => openInspector(featured)}>Inspect<ChevronRight size={13} strokeWidth={1.75} aria-hidden="true"/></OpsButton> : undefined}>
            {featured ? (
              <>
                <div className="visibility-spotlight-head">
                  <OpsMono>{featured.reference}</OpsMono>
                  <OpsBadge tone={shipmentStatusTone(featured.status)}>{shipmentStatusLabels[featured.status]}</OpsBadge>
                  {featured.stale ? <OpsBadge tone="danger" dot>Stale feed</OpsBadge> : null}
                </div>
                <p className="visibility-spotlight-customer">{featured.customer_name || "Customer not linked"}</p>
                <OpsFacts>
                  <OpsFact label="Route">{featured.origin} → {featured.destination}</OpsFact>
                  <OpsFact label="Carrier" warning={!featured.carrier}>{featured.carrier || "Not assigned"}</OpsFact>
                  <OpsFact label="Last signal">{shortDateTime(featured.last_event_at)} · {featured.current_location || "Location unknown"}</OpsFact>
                  <OpsFact label="Milestone">{featured.last_milestone ? trackingMilestoneLabels[featured.last_milestone] : "Awaiting normalized event"}</OpsFact>
                  <OpsFact label="ETA">{shortDateTime(featured.eta)}</OpsFact>
                  <OpsFact label="Movement" warning={(featured.eta_delta_hours ?? 0) >= 24}>{delayText(featured.eta_delta_hours)}</OpsFact>
                  <OpsFact label="Provider">{featured.last_provider || sourceLabel(featured.last_source) || "Not reported"}</OpsFact>
                </OpsFacts>
              </>
            ) : <OpsEmptyState compact title="No active movement" description="Tracking movement will appear here when shipment visibility becomes available."/>}
          </OpsSurface>

          <OpsSurface density="compact" title="Feed health" description="Providers currently represented in shipment feeds." action={<Link href="/admin/carrier-integrations" className="ops-button" data-variant="ghost" data-size="xs">Manage integrations</Link>}>
            {providerHealth.length ? (
              <ul className="visibility-list">
                {providerHealth.map((provider) => {
                  const degraded = provider.stale > 0;
                  return (
                    <li key={provider.provider}>
                      <div className="visibility-list-main">
                        <span className="visibility-list-title">{provider.provider}</span>
                        <span className="visibility-list-meta">{provider.shipments} shipment{provider.shipments === 1 ? "" : "s"} · {relativeSignal(provider.lastReceivedAt)}</span>
                      </div>
                      <span className="visibility-state" data-tone={degraded ? "danger" : "success"}>{degraded ? `${provider.stale} stale` : "Fresh"}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <OpsEmptyState compact title="No provider signals yet" description="Feeds appear here once a carrier, EDI or counterpart update is received."/>}
            <div className="visibility-links"><Link href="/admin/edi">EDI 214 Gateway</Link><Link href="/admin/carrier-integrations">Carrier integrations</Link></div>
          </OpsSurface>

          <OpsSurface density="compact" title="Recent signals" description="Latest shipment-level tracking state.">
            {recentSignals.length ? (
              <ul className="visibility-list">
                {recentSignals.map((row) => (
                  <li key={row.reference}>
                    <button type="button" className="visibility-list-button" onClick={() => openInspector(row)} aria-label={`Inspect ${row.reference}: ${row.last_milestone ? trackingMilestoneLabels[row.last_milestone] : "Tracking signal"}${row.stale ? ", stale feed" : ""}`}>
                      <span className="visibility-signal-dot" data-tone={signalTone(row)} aria-hidden="true"/>
                      <span className="visibility-list-main">
                        <span className="visibility-list-title">{row.last_milestone ? trackingMilestoneLabels[row.last_milestone] : "Tracking signal"}</span>
                        <span className="visibility-list-meta ops-mono">{row.reference}</span>
                      </span>
                      <time className="visibility-list-time">{relativeSignal(row.last_event_at)}</time>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <OpsEmptyState compact title="No recent tracking signals" description="Signals appear as carriers and counterparts report movement."/>}
          </OpsSurface>
        </div>
      </div>

      {selected ? (
        <TrackingVisibilityPanel
          key={selected.reference}
          row={selected}
          returnTo={returnTo}
          container={portalContainer}
          onClose={closeInspector}
          onRefresh={() => refresh(false)}
        />
      ) : null}
    </OpsPage>
  );
}

/** A state dot for signal rows: red stale, green delivered, amber out for delivery, blue otherwise. */
function signalTone(row: VisibilityShipment) {
  if (row.stale) return "danger";
  if (row.status === "delivered") return "success";
  if (row.status === "out_for_delivery") return "warning";
  return "info";
}

function TrackingVisibilityPanel({
  row,
  returnTo,
  container,
  onClose,
  onRefresh,
}: {
  row: VisibilityShipment;
  returnTo: string;
  container: HTMLElement | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [busy, setBusy] = useState(false);
  const [panelNotice, setPanelNotice] = useState<{
    tone: "success" | "warning" | "danger";
    text: string;
  } | null>(null);
  const [rawStatus, setRawStatus] = useState("");
  const [milestone, setMilestone] = useState<TrackingMilestone | "">("");
  const [location, setLocation] = useState("");
  const [eta, setEta] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [provider, setProvider] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch(
      `/api/admin/visibility?reference=${encodeURIComponent(row.reference)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || !data.ok || !data.events)
          throw new Error(
            data.error || "Tracking history could not be loaded.",
          );
        return data.events;
      })
      .then((nextEvents) => {
        if (!active) return;
        setEvents(nextEvents);
        setLoadingEvents(false);
      })
      .catch((error: unknown) => {
        if (
          !active ||
          (error instanceof DOMException && error.name === "AbortError")
        )
          return;
        setPanelNotice({
          tone: "danger",
          text:
            error instanceof Error
              ? error.message
              : "Tracking history could not be loaded.",
        });
        setLoadingEvents(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [row.reference]);

  async function reloadEvents() {
    setLoadingEvents(true);
    try {
      const response = await fetch(
        `/api/admin/visibility?reference=${encodeURIComponent(row.reference)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok || !data.events)
        throw new Error(data.error || "Tracking history could not be loaded.");
      setEvents(data.events);
    } finally {
      setLoadingEvents(false);
    }
  }

  async function recordEvent() {
    if (!rawStatus.trim()) return;
    setBusy(true);
    setPanelNotice(null);
    try {
      const response = await fetch("/api/admin/visibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "record",
          reference: row.reference,
          rawStatus,
          milestone: milestone || null,
          location,
          eta: nepalInputToIso(eta),
          eventTime: nepalInputToIso(eventTime),
          provider,
          details,
        }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok)
        throw new Error(data.error || "Tracking event could not be recorded.");
      setRawStatus("");
      setMilestone("");
      setLocation("");
      setEta("");
      setEventTime("");
      setProvider("");
      setDetails("");
      await Promise.all([onRefresh(), reloadEvents()]);
      const exceptions = data.opened_exceptions?.length
        ? ` Automatic exceptions opened: ${data.opened_exceptions.join(", ")}.`
        : "";
      setPanelNotice({
        tone: exceptions ? "warning" : "success",
        text: `Tracking event recorded.${exceptions}`,
      });
    } catch (error) {
      setPanelNotice({
        tone: "danger",
        text:
          error instanceof Error
            ? error.message
            : "Tracking event could not be recorded.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    // Non-blocking slide-over, like the Shipments inspector: the register stays
    // visible and live behind it (modal={false}); Escape and Close dismiss it.
    <OpsDialog.Root open modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <OpsDialog.Portal container={container ?? undefined}>
        {/* Scrim only materialises below 900px, where the sheet is a modal bottom sheet. */}
        <div className="ops-sheet-scrim" onClick={onClose} aria-hidden="true"/>
        <OpsDialog.Content className="ops-sheet visibility-sheet" aria-label={`Live visibility for ${row.reference}`} onInteractOutside={(event) => event.preventDefault()}>
          <OpsDialog.Title className="sr-only">{row.reference} live visibility</OpsDialog.Title>
          <OpsDialog.Description className="sr-only">Movement timeline, tracking events and manual event recording for this shipment.</OpsDialog.Description>
          <OpsInspectorHeader
            kicker={`${row.reference}${row.carrier_reference ? ` · ${row.carrier_reference}` : ""}`}
            title={row.customer_name || "Customer not linked"}
            subtitle={`${row.origin} → ${row.destination} · ${row.mode || "Mode not set"}`}
            actions={(
              <>
                <OpsBadge tone={shipmentStatusTone(row.status)}>{shipmentStatusLabels[row.status]}</OpsBadge>
                <OpsDialog.Close asChild>
                  <button type="button" className="ops-inspector-close" aria-label="Close live visibility panel"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>
                </OpsDialog.Close>
              </>
            )}
          />

          <div className="ops-inspector-scroll">
            <div className="ops-inspector-body">
              {panelNotice ? <OpsNotice tone={panelNotice.tone} onDismiss={() => setPanelNotice(null)}>{panelNotice.text}</OpsNotice> : null}

              {row.stale
                ? <OpsInspectorNote tone="danger" icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Stale feed">No fresh tracking signal within the expected window. Last event {dateTime(row.last_event_at)}.</OpsInspectorNote>
                : <OpsInspectorNote tone="success" icon={<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Feed current">Latest tracking event {dateTime(row.last_event_at)}.</OpsInspectorNote>}

              <OpsInspectorSection title="Latest position" action={<Link href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`} className="ops-button" data-variant="ghost" data-size="xs">Open Job File</Link>}>
                <OpsFacts columns={2}>
                  <OpsFact label="Location">{row.current_location || "Location unknown"}</OpsFact>
                  <OpsFact label="Milestone">{row.last_milestone ? trackingMilestoneLabels[row.last_milestone] : "No normalized milestone"}</OpsFact>
                  <OpsFact label="Carrier" warning={!row.carrier}>{row.carrier || "Not set"}</OpsFact>
                  <OpsFact label="Provider">{row.last_provider || "Not recorded"}</OpsFact>
                  <OpsFact label="Latest ETA">{dateTime(row.eta)}</OpsFact>
                  <OpsFact label="ETA movement" warning={(row.eta_delta_hours ?? 0) >= 24}>{delayText(row.eta_delta_hours)}</OpsFact>
                  <OpsFact label="Source">{row.last_source ? row.last_source.replaceAll("_", " ") : "No source recorded"}</OpsFact>
                </OpsFacts>
              </OpsInspectorSection>

              <OpsInspectorSection title="Event timeline">
                {loadingEvents ? <p className="ops-inspector-hint">Loading tracking history…</p> : events.length ? (
                  <ol className="visibility-events">
                    {events.map((event) => (
                      <li key={event.id} data-tone={event.milestone === "delivery_refused" || event.milestone === "exception" ? "danger" : event.milestone === "delivered" ? "success" : "info"}>
                        <time>{shortDateTime(event.event_time)}</time>
                        <div className="min-w-0">
                          <div className="visibility-event-head"><span className="visibility-event-title">{event.title}</span><span className="visibility-event-milestone">{trackingMilestoneLabels[event.milestone]}</span></div>
                          <p className="visibility-event-detail">{event.location || "Location not supplied"}{event.details ? ` · ${event.details}` : ""}</p>
                          <p className="visibility-event-meta">{event.provider || event.source.replaceAll("_", " ")}{event.eta ? ` · ETA ${dateTime(event.eta)}` : ""}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : <p className="ops-inspector-hint">No normalized tracking events yet. Carrier, counterpart or manual events will appear here when recorded.</p>}
              </OpsInspectorSection>

              <OpsInspectorSection tinted title="Manual fallback">
                <p className="ops-inspector-hint mb-3">Record an operational update when the provider has no live integration.</p>
                <div className="ops-inspector-form">
                  <OpsField label="Raw carrier status"><input value={rawStatus} onChange={(event) => setRawStatus(event.target.value)} placeholder="e.g. Vessel departed Singapore"/></OpsField>
                  <OpsField label="Milestone override">
                    <select value={milestone} onChange={(event) => setMilestone(event.target.value as TrackingMilestone | "")}>
                      <option value="">Auto-detect</option>
                      {trackingMilestones.filter((value) => value !== "unknown").map((value) => <option key={value} value={value}>{trackingMilestoneLabels[value]}</option>)}
                    </select>
                  </OpsField>
                  <OpsField label="Location"><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Port, airport, border, city…"/></OpsField>
                  <OpsField label="Provider / counterpart"><input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Carrier, airline, overseas agent…"/></OpsField>
                  <OpsField label="Event time"><input name="visibility-event-time" type="datetime-local" value={eventTime} onChange={(event) => setEventTime(event.target.value)} aria-describedby="visibility-timezone-note"/></OpsField>
                  <OpsField label="New ETA"><input name="visibility-new-eta" type="datetime-local" value={eta} onChange={(event) => setEta(event.target.value)} aria-describedby="visibility-timezone-note"/></OpsField>
                  <OpsField label="Details" className="col-span-full"><textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Operational context, reason, vehicle, vessel or flight details…"/></OpsField>
                </div>
                <p id="visibility-timezone-note" className="ops-inspector-hint mt-2">Times are saved and displayed in Nepal time (NPT).</p>
              </OpsInspectorSection>
            </div>
          </div>

          <footer className="ops-inspector-footer visibility-sheet-footer">
            <span className="ops-inspector-hint">Manual updates join the same normalized tracking timeline.</span>
            <OpsButton variant="primary" disabled={busy || !rawStatus.trim()} onClick={recordEvent}>
              <Activity size={16} strokeWidth={1.75} aria-hidden="true"/>
              {busy ? "Recording…" : "Record tracking event"}
            </OpsButton>
          </footer>
        </OpsDialog.Content>
      </OpsDialog.Portal>
    </OpsDialog.Root>
  );
}
