"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock3,
  MapPin,
  Plane,
  RadioTower,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  OpsBadge,
  OpsButton,
  OpsDialog,
  OpsEmptyState,
  OpsField,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsSearch,
  OpsTableWrap,
  useAdminPortalContainer,
} from "../operations-ui";
import { AppKpiStrip } from "../kpi-strip";
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

function statusTone(
  row: VisibilityShipment,
): "neutral" | "info" | "warning" | "success" | "danger" {
  if (row.status === "delivered") return "success";
  if (row.stale || row.status === "exception") return "danger";
  if ((row.eta_delta_hours ?? 0) >= 24 || row.status === "customs_clearance")
    return "warning";
  return "info";
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAllowInitialSelection(false);
        update({ selected: null, shipment: null });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
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

  return (
    <OpsPage className="visibility-v2">
      <div className="visibility-page">
        {/* HEADER */}
        <OpsPageHeader
          eyebrow="Operate"
          title="Live Visibility"
          description="Monitor shipment feeds, ETA movement and the latest carrier or counterpart events from one operational register."
          meta={
            <span className="visibility-last-updated">
              Last updated{" "}
              <strong>
                {lastUpdated ? dateTime(lastUpdated) : "No tracking signal"}
              </strong>
            </span>
          }
          actions={
            <>
              <OpsButton
                variant="secondary"
                disabled={refreshing || sweeping}
                onClick={() => {
                  void refresh();
                }}
              >
                <RefreshCw
                  size={15}
                  strokeWidth={1.75}
                  className={refreshing ? "app-refreshing" : ""}
                />
                Refresh
              </OpsButton>

              {canSweep ? (
                <OpsButton
                  variant="primary"
                  disabled={sweeping || refreshing}
                  onClick={sweep}
                >
                  <Activity size={15} strokeWidth={1.75} />

                  {sweeping ? "Sweeping…" : "Run health sweep"}
                </OpsButton>
              ) : null}
            </>
          }
        />

        {/* SUMMARY STRIP */}
        <AppKpiStrip
          tight
          className="visibility-summary-grid"
          items={[
            {
              key: "active",
              icon: Truck,
              label: "Active shipments",
              value: summary.active,
              tone: "accent",
              active: focus === "all",
              onSelect: () => update({ view: null, page: null, selected: null }),
            },
            { key: "fresh", icon: RadioTower, label: "Fresh feeds", value: freshFeeds, tone: "success" },
            {
              key: "delayed",
              icon: Clock3,
              label: "ETA delayed",
              value: summary.delayed,
              tone: summary.delayed ? "warning" : "neutral",
              active: focus === "delayed",
              onSelect: () => update({ view: focus === "delayed" ? null : "delayed", page: null, selected: null }),
            },
            {
              key: "stale",
              icon: AlertTriangle,
              label: "Stale feeds",
              value: summary.stale,
              tone: summary.stale ? "danger" : "neutral",
              active: focus === "stale",
              onSelect: () => update({ view: focus === "stale" ? null : "stale", page: null, selected: null }),
            },
            { key: "at-destination", icon: Box, label: "At destination", value: atDestination },
            {
              key: "delivery",
              icon: Truck,
              label: "Out for delivery",
              value: summary.out_for_delivery,
              tone: "info",
              active: focus === "delivery",
              onSelect: () => update({ view: focus === "delivery" ? null : "delivery", page: null, selected: null }),
            },
          ]}
        />

        {notice ? (
          <div className="visibility-notice">
            <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>
              {notice.text}
            </OpsNotice>
          </div>
        ) : null}

        {/* MAIN CONTROL TOWER */}
        <div className="visibility-control-tower">
          <main className="visibility-main">
            {/* MOVEMENT */}
            <section className="visibility-panel visibility-movement-panel">
              <header className="visibility-panel-heading">
                <div>
                  <h2>Shipment movements</h2>

                  <p>
                    Latest normalized movement and location context from current
                    feeds.
                  </p>
                </div>

                <Link
                  href="/admin/shipments"
                  className="visibility-text-action"
                >
                  View all shipments →
                </Link>
              </header>

              {featured ? (
                <div className="visibility-movement-layout">
                  <VisibilityRouteBoard row={featured} />

                  <div className="visibility-featured-shipment">
                    <div className="visibility-featured-title">
                      <div>
                        <OpsMono>{featured.reference}</OpsMono>

                        <p>{featured.customer_name || "Customer not linked"}</p>
                      </div>

                      <OpsBadge tone={statusTone(featured)}>
                        {shipmentStatusLabels[featured.status]}
                      </OpsBadge>
                    </div>

                    <dl className="visibility-facts">
                      <VisibilityFact
                        label="Route"
                        value={`${featured.origin} → ${featured.destination}`}
                      />

                      <VisibilityFact
                        label="Carrier"
                        value={featured.carrier || "Not assigned"}
                      />

                      <VisibilityFact
                        label="Last signal"
                        value={shortDateTime(featured.last_event_at)}
                        detail={featured.current_location || "Location unknown"}
                      />

                      <VisibilityFact
                        label="Estimated arrival"
                        value={shortDateTime(featured.eta)}
                      />

                      <VisibilityFact
                        label="Movement"
                        value={delayText(featured.eta_delta_hours)}
                        danger={(featured.eta_delta_hours ?? 0) >= 24}
                      />

                      <VisibilityFact
                        label="Provider"
                        value={
                          featured.last_provider ||
                          sourceLabel(featured.last_source) ||
                          "Not reported"
                        }
                      />
                    </dl>

                    <button
                      type="button"
                      className="visibility-featured-action"
                      onClick={() => openInspector(featured)}
                    >
                      Inspect visibility
                      <span>→</span>
                    </button>
                  </div>
                </div>
              ) : (
                <OpsEmptyState
                  compact
                  title="No active movement"
                  description="Tracking movement will appear here when shipment visibility becomes available."
                />
              )}
            </section>

            {/* REGISTER */}
            <section className="visibility-panel visibility-register-v2">
              <header className="visibility-register-header">
                <div>
                  <h2>Live shipments</h2>

                  <p>
                    Shipments with current carrier or counterpart visibility.
                  </p>
                </div>
              </header>

              <div className="visibility-filterbar">
                <div className="visibility-search">
                  <OpsSearch
                    value={query}
                    onChange={(event) =>
                      update({
                        q: event.target.value || null,
                        page: null,
                        selected: null,
                        shipment: null,
                      })
                    }
                    placeholder="Search shipments…"
                    aria-label="Search live visibility"
                  />
                </div>

                <select
                  aria-label="Shipment visibility state"
                  value={focus}
                  onChange={(event) =>
                    update({
                      view:
                        event.target.value === "all"
                          ? null
                          : event.target.value,
                      page: null,
                      selected: null,
                    })
                  }
                >
                  {FOCUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({focusCounts[option.value]})
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Shipment mode"
                  value={modeFilter}
                  onChange={(event) =>
                    update({
                      mode:
                        event.target.value === "all"
                          ? null
                          : event.target.value,
                      page: null,
                      selected: null,
                    })
                  }
                >
                  <option value="all">All modes</option>

                  {modes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Origin"
                  value={originFilter}
                  onChange={(event) =>
                    update({
                      origin:
                        event.target.value === "all"
                          ? null
                          : event.target.value,
                      page: null,
                      selected: null,
                    })
                  }
                >
                  <option value="all">All origins</option>

                  {origins.map((origin) => (
                    <option key={origin} value={origin}>
                      {origin}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Destination"
                  value={destinationFilter}
                  onChange={(event) =>
                    update({
                      destination:
                        event.target.value === "all"
                          ? null
                          : event.target.value,
                      page: null,
                      selected: null,
                    })
                  }
                >
                  <option value="all">All destinations</option>

                  {destinations.map((destination) => (
                    <option key={destination} value={destination}>
                      {destination}
                    </option>
                  ))}
                </select>

                {hasFilters ? (
                  <OpsButton
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update({
                        q: null,
                        view: null,
                        mode: null,
                        origin: null,
                        destination: null,
                        page: null,
                        selected: null,
                        shipment: null,
                      })
                    }
                  >
                    Reset
                  </OpsButton>
                ) : null}
              </div>

              {filtered.length ? (
                <>
                  <OpsTableWrap className="visibility-table-wrap">
                    <table
                      className="ops-table visibility-table-v2"
                      aria-label="Live shipment visibility"
                    >
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Customer</th>
                          <th>Route</th>
                          <th>Mode</th>
                          <th>Last signal</th>
                          <th>ETA</th>
                          <th>Status</th>
                          <th>Next signal</th>
                          <th>
                            <span className="sr-only">Actions</span>
                          </th>
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
                              tabIndex={0}
                              onClick={() => openInspector(row)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  openInspector(row);
                                }
                              }}
                            >
                              <td>
                                <Link
                                  href={`/admin/jobs/${encodeURIComponent(
                                    row.reference,
                                  )}?returnTo=${encodeURIComponent(returnTo)}`}
                                  className="visibility-reference"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {row.reference}
                                </Link>
                              </td>

                              <td>
                                <strong className="visibility-customer">
                                  {row.customer_name || "Customer not linked"}
                                </strong>
                              </td>

                              <td>
                                <span className="visibility-route">
                                  {row.origin}
                                  <span>→</span>
                                  {row.destination}
                                </span>
                              </td>

                              <td>
                                <span className="visibility-mode">
                                  {row.mode || "Not set"}
                                </span>
                              </td>

                              <td>
                                <div className="visibility-signal-cell">
                                  <strong>
                                    {shortDateTime(row.last_event_at)}
                                  </strong>

                                  <small>
                                    {row.current_location || "Location unknown"}
                                  </small>
                                </div>
                              </td>

                              <td>
                                <span
                                  className={
                                    delayed
                                      ? "visibility-delay is-delayed"
                                      : "visibility-delay"
                                  }
                                >
                                  {shortDateTime(row.eta)}
                                </span>
                              </td>

                              <td>
                                <div className="visibility-status-cell">
                                  <OpsBadge tone={statusTone(row)}>
                                    {shipmentStatusLabels[row.status]}
                                  </OpsBadge>

                                  {row.stale ? (
                                    <OpsBadge tone="danger">Stale</OpsBadge>
                                  ) : null}
                                </div>
                              </td>

                              <td>
                                <span className="visibility-next-event">
                                  {row.last_milestone
                                    ? trackingMilestoneLabels[
                                        row.last_milestone
                                      ]
                                    : "Awaiting feed"}
                                </span>
                              </td>

                              <td className="visibility-row-action">
                                <button
                                  type="button"
                                  aria-label={`Inspect ${row.reference}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openInspector(row);
                                  }}
                                >
                                  •••
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </OpsTableWrap>

                  <footer className="visibility-pagination">
                    <span>
                      Showing {(page - 1) * pageSize + 1}–
                      {Math.min(page * pageSize, filtered.length)} of{" "}
                      {filtered.length}
                    </span>

                    <div>
                      <OpsButton
                        size="sm"
                        variant="secondary"
                        disabled={page <= 1}
                        onClick={() =>
                          update({
                            page: String(page - 1),
                            selected: null,
                          })
                        }
                      >
                        Previous
                      </OpsButton>

                      <span className="visibility-page-number">{page}</span>

                      <OpsButton
                        size="sm"
                        variant="secondary"
                        disabled={page >= pageCount}
                        onClick={() =>
                          update({
                            page: String(page + 1),
                            selected: null,
                          })
                        }
                      >
                        Next
                      </OpsButton>
                    </div>
                  </footer>
                </>
              ) : (
                <OpsEmptyState
                  compact
                  kind={hasFilters ? "search" : "neutral"}
                  title="No visible shipments"
                  description={
                    hasFilters
                      ? "No shipments match the current visibility filters."
                      : "Tracking feeds will appear when active shipments produce visibility events."
                  }
                />
              )}
            </section>
          </main>

          {/* RIGHT RAIL */}
          <aside className="visibility-right-rail">
            <section className="visibility-panel visibility-feed-health">
              <header className="visibility-panel-heading">
                <div>
                  <h2>Feed health</h2>

                  <p>
                    Health of providers currently represented in shipment feeds.
                  </p>
                </div>

                <Link
                  href="/admin/carrier-integrations"
                  className="visibility-text-action"
                >
                  Manage integrations
                </Link>
              </header>

              <div className="visibility-provider-list">
                {providerHealth.length ? (
                  providerHealth.map((provider) => {
                    const degraded = provider.stale > 0;

                    return (
                      <div
                        key={provider.provider}
                        className="visibility-provider"
                      >
                        <span className="visibility-provider-icon">
                          <RadioTower size={15} />
                        </span>

                        <div>
                          <strong>{provider.provider}</strong>

                          <small>
                            {provider.shipments} shipment
                            {provider.shipments === 1 ? "" : "s"}
                          </small>
                        </div>

                        <span
                          className={
                            degraded
                              ? "visibility-provider-state is-degraded"
                              : "visibility-provider-state"
                          }
                        >
                          <i />
                          {degraded ? `${provider.stale} stale` : "Fresh"}
                        </span>

                        <time>{relativeSignal(provider.lastReceivedAt)}</time>
                      </div>
                    );
                  })
                ) : (
                  <div className="visibility-provider-empty">
                    No provider signals yet.
                  </div>
                )}
              </div>

              <div className="visibility-feed-links">
                <Link href="/admin/edi">EDI 214 Gateway</Link>

                <Link href="/admin/carrier-integrations">
                  Carrier integrations
                </Link>
              </div>
            </section>

            <section className="visibility-panel visibility-recent-signals">
              <header className="visibility-panel-heading">
                <div>
                  <h2>Recent signals</h2>

                  <p>Latest shipment-level tracking state.</p>
                </div>
              </header>

              <div className="visibility-signal-list">
                {recentSignals.length ? (
                  recentSignals.map((row) => (
                    <button
                      key={row.reference}
                      type="button"
                      onClick={() => openInspector(row)}
                    >
                      <SignalIcon row={row} />

                      <div>
                        <strong>
                          {row.last_milestone
                            ? trackingMilestoneLabels[row.last_milestone]
                            : "Tracking signal"}
                        </strong>

                        <span>{row.reference}</span>
                      </div>

                      <time>{relativeSignal(row.last_event_at)}</time>
                    </button>
                  ))
                ) : (
                  <div className="visibility-provider-empty">
                    No recent tracking signals.
                  </div>
                )}
              </div>
            </section>
          </aside>
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

function VisibilityFact({
  label,
  value,
  detail,
  danger = false,
}: {
  label: string;
  value: string;
  detail?: string;
  danger?: boolean;
}) {
  return (
    <div className="visibility-fact">
      <dt>{label}</dt>

      <dd data-danger={danger || undefined}>{value}</dd>

      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function SignalIcon({ row }: { row: VisibilityShipment }) {
  if (row.stale) {
    return (
      <span className="visibility-signal-icon" data-tone="danger">
        <AlertTriangle size={15} />
      </span>
    );
  }

  if (row.status === "delivered") {
    return (
      <span className="visibility-signal-icon" data-tone="success">
        <CheckCircle2 size={15} />
      </span>
    );
  }

  if (row.status === "out_for_delivery") {
    return (
      <span className="visibility-signal-icon" data-tone="warning">
        <Truck size={15} />
      </span>
    );
  }

  return (
    <span className="visibility-signal-icon" data-tone="info">
      <RadioTower size={15} />
    </span>
  );
}

function VisibilityRouteBoard({ row }: { row: VisibilityShipment }) {
  return (
    <div
      className="visibility-route-board"
      aria-label={`Operational route overview from ${row.origin} to ${row.destination}. Not geographic scale.`}
    >
      <div className="visibility-route-board-label">
        <MapPin size={13} />
        Operational route
      </div>

      <div className="visibility-route-track">
        <span className="visibility-route-origin">
          <i />
          <strong>{row.origin}</strong>
          <small>Origin</small>
        </span>

        <span className="visibility-route-line-graphic">
          <span
            className="visibility-route-progress"
            data-stale={row.stale || undefined}
          />

          <span className="visibility-route-vehicle">
            {row.mode.toLowerCase().includes("air") ? (
              <Plane size={17} />
            ) : (
              <Truck size={17} />
            )}
          </span>
        </span>

        <span className="visibility-route-destination">
          <i />
          <strong>{row.destination}</strong>
          <small>Destination</small>
        </span>
      </div>

      <div className="visibility-route-current">
        <span>Current signal</span>

        <strong>{row.current_location || "Location not reported"}</strong>

        <small>
          {row.last_milestone
            ? trackingMilestoneLabels[row.last_milestone]
            : "Awaiting normalized tracking event"}
        </small>
      </div>

      {row.stale ? (
        <div className="visibility-route-warning">
          <AlertTriangle size={14} />
          Tracking feed is stale
        </div>
      ) : null}
    </div>
  );
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
    <OpsDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <OpsDialog.Portal container={container ?? undefined}>
        <OpsDialog.Overlay className="ops-dialog-overlay fixed inset-0 z-[70] cursor-default bg-black/15" />
        <OpsDialog.Content
          className="visibility-inspector fixed inset-y-0 right-0 z-[80] flex w-full flex-col overflow-hidden border-l border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-xl md:w-[640px]"
          aria-label={`Live visibility for ${row.reference}`}
        >
          <OpsDialog.Title className="sr-only">
            {row.reference} live visibility
          </OpsDialog.Title>
          <OpsDialog.Description className="sr-only">
            Movement timeline, tracking events and manual event recording for
            this shipment.
          </OpsDialog.Description>
        <header className="visibility-panel-header flex shrink-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-xs text-[var(--admin-muted)]">
              <OpsMono>{row.reference}</OpsMono>
              {row.carrier_reference ? ` · ${row.carrier_reference}` : ""}
            </p>
            <h2
              id={`visibility-panel-title-${row.reference}`}
              className="mt-1 text-base font-semibold leading-6"
            >
              Movement timeline
            </h2>
            <p className="mt-0.5 text-sm text-[var(--admin-muted)]">
              {row.customer_name} · {row.origin} → {row.destination}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <OpsBadge tone={statusTone(row)}>
              {shipmentStatusLabels[row.status]}
            </OpsBadge>
            <OpsDialog.Close asChild>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)]"
                aria-label="Close live visibility panel"
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </OpsDialog.Close>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="visibility-panel-summary border-b border-[var(--admin-line)] px-5 py-4">
            {panelNotice ? (
              <OpsNotice
                tone={panelNotice.tone}
                onDismiss={() => setPanelNotice(null)}
              >
                {panelNotice.text}
              </OpsNotice>
            ) : null}
            <div
              className={`${panelNotice ? "mt-3 " : ""}flex flex-wrap items-center gap-2`}
            >
              <Link
                href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`}
                className="ops-button"
                data-variant="secondary"
                data-size="sm"
              >
                Open Job File
              </Link>
              {row.stale ? (
                <OpsBadge tone="danger">Stale feed</OpsBadge>
              ) : (
                <OpsBadge tone="success">Feed current</OpsBadge>
              )}
              <span className="text-xs text-[var(--admin-muted)]">
                {row.last_source
                  ? row.last_source.replaceAll("_", " ")
                  : "No source recorded"}
              </span>
            </div>
          </div>

          <PanelSection
            title="Latest position"
            description="The newest normalized tracking state visible to KCPL operations."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail
                label="Location"
                value={row.current_location || "Location unknown"}
              />
              <Detail
                label="Milestone"
                value={
                  row.last_milestone
                    ? trackingMilestoneLabels[row.last_milestone]
                    : "No normalized milestone"
                }
              />
              <Detail label="Carrier" value={row.carrier || "Not set"} />
              <Detail
                label="Provider"
                value={row.last_provider || "Not recorded"}
              />
              <Detail label="Latest ETA" value={dateTime(row.eta)} />
              <Detail
                label="ETA movement"
                value={delayText(row.eta_delta_hours)}
                danger={(row.eta_delta_hours ?? 0) >= 24}
              />
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3 text-sm text-[var(--admin-muted)]">
              {row.stale ? (
                <AlertTriangle
                  size={16}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-[var(--admin-danger)]"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  size={16}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-[var(--admin-success)]"
                  aria-hidden="true"
                />
              )}
              <span>
                {row.stale
                  ? `No fresh tracking signal within the expected window. Last event: ${dateTime(row.last_event_at)}.`
                  : `Latest tracking event: ${dateTime(row.last_event_at)}.`}
              </span>
            </div>
          </PanelSection>

          <PanelSection
            title="Event timeline"
            description="Normalized carrier, EDI, GPS, counterpart and manual updates."
          >
            {loadingEvents ? (
              <div className="flex items-center gap-2 rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3 text-sm text-[var(--admin-muted)]">
                <RadioTower size={16} strokeWidth={1.75} aria-hidden="true" />{" "}
                Loading tracking history…
              </div>
            ) : events.length ? (
              <div className="divide-y divide-[var(--admin-line)] border-y border-[var(--admin-line)]">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-2 py-3 sm:grid-cols-[110px_minmax(0,1fr)]"
                  >
                    <span className="text-xs text-[var(--admin-muted)]">
                      {shortDateTime(event.event_time)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <OpsBadge
                          tone={
                            event.milestone === "delivery_refused" ||
                            event.milestone === "exception"
                              ? "danger"
                              : event.milestone === "delivered"
                                ? "success"
                                : "info"
                          }
                        >
                          {trackingMilestoneLabels[event.milestone]}
                        </OpsBadge>
                        <strong className="text-sm font-medium">
                          {event.title}
                        </strong>
                      </div>
                      <p className="mt-1 text-sm leading-5 text-[var(--admin-muted)]">
                        {event.location || "Location not supplied"}
                        {event.details ? ` · ${event.details}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-[var(--admin-muted)]">
                        {event.provider || event.source.replaceAll("_", " ")}
                        {event.eta ? ` · ETA ${dateTime(event.eta)}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <OpsEmptyState
                compact
                title="No normalized tracking events yet"
                description="Carrier, counterpart or manual events will appear here when recorded."
              />
            )}
          </PanelSection>

          <PanelSection
            title="Manual fallback"
            description="Record an operational update when the provider has no live integration."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <OpsField label="Raw carrier status">
                <input
                  value={rawStatus}
                  onChange={(event) => setRawStatus(event.target.value)}
                  placeholder="e.g. Vessel departed Singapore"
                />
              </OpsField>
              <OpsField label="Milestone override">
                <select
                  value={milestone}
                  onChange={(event) =>
                    setMilestone(event.target.value as TrackingMilestone | "")
                  }
                >
                  <option value="">Auto-detect</option>
                  {trackingMilestones
                    .filter((value) => value !== "unknown")
                    .map((value) => (
                      <option key={value} value={value}>
                        {trackingMilestoneLabels[value]}
                      </option>
                    ))}
                </select>
              </OpsField>
              <OpsField label="Location">
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Port, airport, border, city…"
                />
              </OpsField>
              <OpsField label="Provider / counterpart">
                <input
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  placeholder="Carrier, airline, overseas agent…"
                />
              </OpsField>
              <OpsField label="Event time">
                <input
                  name="visibility-event-time"
                  type="datetime-local"
                  value={eventTime}
                  onChange={(event) => setEventTime(event.target.value)}
                  aria-describedby="visibility-timezone-note"
                />
              </OpsField>
              <OpsField label="New ETA">
                <input
                  name="visibility-new-eta"
                  type="datetime-local"
                  value={eta}
                  onChange={(event) => setEta(event.target.value)}
                  aria-describedby="visibility-timezone-note"
                />
              </OpsField>
              <OpsField label="Details" className="sm:col-span-2">
                <textarea
                  rows={3}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Operational context, reason, vehicle, vessel or flight details…"
                />
              </OpsField>
            </div>
            <p
              id="visibility-timezone-note"
              className="mt-3 text-xs text-[var(--admin-muted)]"
            >
              Times are saved and displayed in Nepal time (NPT).
            </p>
          </PanelSection>
        </div>

        <footer className="shrink-0 border-t border-[var(--admin-line)] bg-[var(--admin-surface)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[var(--admin-muted)]">
              Manual updates are added to the same normalized tracking timeline.
            </span>
            <OpsButton
              variant="primary"
              disabled={busy || !rawStatus.trim()}
              onClick={recordEvent}
            >
              <Activity size={16} strokeWidth={1.75} aria-hidden="true" />
              {busy ? "Recording…" : "Record tracking event"}
            </OpsButton>
          </div>
        </footer>
        </OpsDialog.Content>
      </OpsDialog.Portal>
    </OpsDialog.Root>
  );
}

function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[var(--admin-line)] px-5 py-5 last:border-b-0">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-[var(--admin-muted)]">
        {description}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Detail({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-3">
      <p className="m-0 text-xs font-medium text-[var(--admin-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${danger ? "text-[var(--admin-danger)]" : "text-[var(--admin-ink)]"}`}
      >
        {value}
      </p>
    </div>
  );
}
