"use client";

import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, RadioTower, ShieldAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsStat,
  OpsStatStrip,
  OpsSearch,
  OpsSurface,
  OpsTableWrap,
  OpsToolbar,
} from "../operations-ui";
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
  return hours > 0 ? `+${Math.round(hours)}h` : `-${Math.abs(Math.round(hours))}h`;
}

function statusTone(row: VisibilityShipment): "neutral" | "info" | "warning" | "success" | "danger" {
  if (row.status === "delivered") return "success";
  if (row.stale || row.status === "exception") return "danger";
  if ((row.eta_delta_hours ?? 0) >= 24 || row.status === "customs_clearance") return "warning";
  return "info";
}

function rowMatchesFocus(row: VisibilityShipment, focus: Focus) {
  if (focus === "delayed") return (row.eta_delta_hours ?? 0) >= 24 && row.status !== "delivered";
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
  const query = params.get("q") ?? "";
  const requestedFocus = params.get("view");
  const focus: Focus = FOCUS_OPTIONS.some((option) => option.value === requestedFocus) ? requestedFocus as Focus : "all";
  const [allowInitialSelection, setAllowInitialSelection] = useState(Boolean(initialShipment));
  const selectedReference = (params.get("selected") ?? (allowInitialSelection ? initialShipment : "") ?? "").trim().toUpperCase();
  const selected = useMemo(() => rows.find((row) => row.reference === selectedReference) ?? null, [rows, selectedReference]);
  const selectedKey = selected?.reference ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (!rowMatchesFocus(row, focus)) return false;
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
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [focus, query, rows]);

  const focusCounts = useMemo(() => ({
    all: rows.length,
    delayed: rows.filter((row) => rowMatchesFocus(row, "delayed")).length,
    stale: rows.filter((row) => rowMatchesFocus(row, "stale")).length,
    customs: rows.filter((row) => rowMatchesFocus(row, "customs")).length,
    delivery: rows.filter((row) => rowMatchesFocus(row, "delivery")).length,
  }), [rows]);
  const attentionCount = focusCounts.delayed + focusCounts.stale - rows.filter((row) => rowMatchesFocus(row, "delayed") && row.stale).length;

  useEffect(() => {
    if (!selectedKey) return;
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
      const response = await fetch("/api/admin/visibility", { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Visibility could not be refreshed.");
      setRows(data.rows);
      setSummary(data.summary);
      if (selectedReference && !data.rows.some((row) => row.reference === selectedReference)) closeInspector();
      if (showNotice) setNotice({ tone: "success", text: "Live visibility refreshed." });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Visibility could not be refreshed." });
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
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tracking health sweep failed.");
      await refresh(false);
      setNotice({
        tone: (data.opened ?? 0) > 0 ? "warning" : "success",
        text: `Checked ${data.checked ?? 0} active shipments. Opened ${data.opened ?? 0} stale-feed exceptions.`,
      });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking health sweep failed." });
    } finally {
      setSweeping(false);
    }
  }

  const returnTo = `/admin/visibility${search}`;
  const hasFilters = Boolean(query) || focus !== "all";

  return (
    <OpsPage>
      <OpsPageHeader
        title="Live Visibility"
        description="Monitor shipment feeds, ETA movement and the latest carrier or counterpart events from one operational register."
        meta={`${summary.active} active · ${summary.delayed} ETA delayed · ${summary.stale} stale feeds · ${summary.delivered_today} delivered today`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/edi" className="ops-button" data-variant="secondary" data-size="md">EDI 214 Gateway</Link>
            <Link href="/admin/carrier-integrations" className="ops-button" data-variant="secondary" data-size="md">Carrier integrations</Link>
            {canSweep ? (
              <OpsButton variant="primary" disabled={sweeping || refreshing} onClick={sweep}>
                <ShieldAlert size={16} strokeWidth={1.75} aria-hidden="true"/>
                {sweeping ? "Sweeping…" : "Run health sweep"}
              </OpsButton>
            ) : null}
          </div>
        }
      />

      <div className="px-4 pb-6 md:px-6">
        {notice ? <div className="mb-4"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

        <OpsStatStrip className="visibility-stat-strip mb-4">
          <OpsStat label="Active shipments" value={summary.active} detail={`${rows.length} visible in this snapshot`} icon={<Activity size={15} strokeWidth={1.75} aria-hidden="true"/>} tone="info" active={focus === "all"} onClick={() => { setAllowInitialSelection(false); update({ view: null, selected: null, shipment: null }); }}/>
          <OpsStat label="Needs attention" value={attentionCount} detail="Delayed or stale feeds" icon={<AlertTriangle size={15} strokeWidth={1.75} aria-hidden="true"/>} tone={attentionCount ? "danger" : "success"} active={focus === "delayed" || focus === "stale"} onClick={() => { setAllowInitialSelection(false); update({ view: attentionCount ? "delayed" : "stale", selected: null, shipment: null }); }}/>
          <OpsStat label="Customs" value={summary.customs} detail="Current customs state" tone="warning" active={focus === "customs"} onClick={() => { setAllowInitialSelection(false); update({ view: "customs", selected: null, shipment: null }); }}/>
          <OpsStat label="Out for delivery" value={summary.out_for_delivery} detail="Last-mile movements" tone="success" active={focus === "delivery"} onClick={() => { setAllowInitialSelection(false); update({ view: "delivery", selected: null, shipment: null }); }}/>
          <OpsStat label="Delivered today" value={summary.delivered_today} detail="Latest normalized events" tone="neutral"/>
        </OpsStatStrip>

        <OpsToolbar className="mb-4">
          <div className="min-w-[240px] flex-1 basis-[320px] max-w-[380px]">
            <OpsSearch
              value={query}
              onChange={(event) => update({ q: event.target.value || null, selected: null, shipment: null })}
              placeholder="Search shipment, customer, route, carrier…"
              aria-label="Search live visibility"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Visibility filters">
            {FOCUS_OPTIONS.map((option) => {
              const active = focus === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setAllowInitialSelection(false);
                    update({ view: option.value === "all" ? null : option.value, selected: null, shipment: null });
                  }}
                  aria-pressed={active}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${active ? "border-[var(--admin-crimson)] bg-[var(--admin-crimson)] text-white" : "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)] hover:border-[var(--admin-line-strong)] hover:text-[var(--admin-ink)]"}`}
                >
                  {option.label} <span className="tabular-nums">{focusCounts[option.value]}</span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <OpsButton
              size="sm"
              disabled={refreshing || sweeping}
              onClick={() => { void refresh(); }}
            >
              <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true"/>
              {refreshing ? "Refreshing…" : "Refresh"}
            </OpsButton>
            {hasFilters ? (
              <OpsButton
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAllowInitialSelection(false);
                  update({ q: null, view: null, selected: null, shipment: null });
                }}
              >
                Reset
              </OpsButton>
            ) : null}
            <span className="whitespace-nowrap text-xs text-[var(--admin-muted)]">{filtered.length} of {rows.length}</span>
          </div>
        </OpsToolbar>

        <OpsSurface flush className="visibility-register">
          {filtered.length ? (
            <OpsTableWrap className="visibility-table-wrap">
              <table className="ops-table min-w-[1040px]" aria-label="Live shipment visibility">
                <thead>
                  <tr>
                    <th>Shipment</th>
                    <th>Customer · route</th>
                    <th>State</th>
                    <th>Last signal</th>
                    <th>ETA</th>
                    <th>Movement</th>
                    <th>Last event</th>
                    <th><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const chosen = selected?.reference === row.reference;
                    const delayed = (row.eta_delta_hours ?? 0) >= 24;
                    return (
                      <tr key={row.reference} data-selected={chosen || undefined}>
                        <td>
                          <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`}>
                            <OpsMono className="text-xs font-medium text-[var(--admin-info)]">{row.reference}</OpsMono>
                          </Link>
                          <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{row.carrier || "Carrier not set"}</span>
                        </td>
                        <td>
                          <strong className="block text-sm font-medium text-[var(--admin-ink)]">{row.customer_name}</strong>
                          <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{row.origin} → {row.destination} · {row.mode || "Mode not set"}</span>
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <OpsBadge tone={statusTone(row)}>{shipmentStatusLabels[row.status]}</OpsBadge>
                            {row.stale ? <OpsBadge tone="danger">Stale feed</OpsBadge> : null}
                          </div>
                        </td>
                        <td>
                          <strong className="block text-sm font-medium text-[var(--admin-ink)]">{row.last_milestone ? trackingMilestoneLabels[row.last_milestone] : "No normalized feed"}</strong>
                          <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{row.current_location || "Location unknown"}</span>
                        </td>
                        <td><span className="text-sm text-[var(--admin-muted)]">{shortDateTime(row.eta)}</span></td>
                        <td><span className={`text-sm font-medium ${delayed ? "text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>{delayText(row.eta_delta_hours)}</span></td>
                        <td><span className="text-sm text-[var(--admin-muted)]">{shortDateTime(row.last_event_at)}</span></td>
                        <td className="text-right"><OpsButton size="sm" variant="secondary" onClick={() => openInspector(row)}>Inspect</OpsButton></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </OpsTableWrap>
          ) : (
            <OpsEmptyState
              compact
              icon={<RadioTower size={20} strokeWidth={1.75} aria-hidden="true"/>}
              kind={hasFilters ? "search" : "neutral"}
              title={hasFilters ? "No shipment feeds match this view" : "No shipment feeds available"}
              description={hasFilters ? "Change the visibility filter or search terms." : "Shipment feeds will appear here when tracking data becomes available."}
              action={hasFilters ? <OpsButton size="sm" onClick={() => update({ q: null, view: null })}>Clear filters</OpsButton> : undefined}
            />
          )}
        </OpsSurface>
      </div>

      {selected ? (
        <TrackingVisibilityPanel
          key={selected.reference}
          row={selected}
          returnTo={returnTo}
          onClose={closeInspector}
          onRefresh={() => refresh(false)}
        />
      ) : null}
    </OpsPage>
  );
}

function TrackingVisibilityPanel({
  row,
  returnTo,
  onClose,
  onRefresh,
}: {
  row: VisibilityShipment;
  returnTo: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [busy, setBusy] = useState(false);
  const [panelNotice, setPanelNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
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
    fetch(`/api/admin/visibility?reference=${encodeURIComponent(row.reference)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as ApiResponse;
        if (!response.ok || !data.ok || !data.events) throw new Error(data.error || "Tracking history could not be loaded.");
        return data.events;
      })
      .then((nextEvents) => {
        if (!active) return;
        setEvents(nextEvents);
        setLoadingEvents(false);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setPanelNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking history could not be loaded." });
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
      const response = await fetch(`/api/admin/visibility?reference=${encodeURIComponent(row.reference)}`, { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.events) throw new Error(data.error || "Tracking history could not be loaded.");
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
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tracking event could not be recorded.");
      setRawStatus("");
      setMilestone("");
      setLocation("");
      setEta("");
      setEventTime("");
      setProvider("");
      setDetails("");
      await Promise.all([onRefresh(), reloadEvents()]);
      const exceptions = data.opened_exceptions?.length ? ` Automatic exceptions opened: ${data.opened_exceptions.join(", ")}.` : "";
      setPanelNotice({ tone: exceptions ? "warning" : "success", text: `Tracking event recorded.${exceptions}` });
    } catch (error) {
      setPanelNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tracking event could not be recorded." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-[70] cursor-default bg-black/15" onClick={onClose} aria-label="Close live visibility panel"/>
      <aside className="fixed inset-y-0 right-0 z-[80] flex w-full flex-col overflow-hidden border-l border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-xl md:w-[640px]" aria-label={`Live visibility for ${row.reference}`}>
        <header className="visibility-panel-header flex shrink-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-xs text-[var(--admin-muted)]"><OpsMono>{row.reference}</OpsMono>{row.carrier_reference ? ` · ${row.carrier_reference}` : ""}</p>
            <h2 className="mt-1 text-base font-semibold leading-6">Movement timeline</h2>
            <p className="mt-0.5 text-sm text-[var(--admin-muted)]">{row.customer_name} · {row.origin} → {row.destination}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <OpsBadge tone={statusTone(row)}>{shipmentStatusLabels[row.status]}</OpsBadge>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)]" onClick={onClose} aria-label="Close live visibility panel">
              <X size={16} strokeWidth={1.75} aria-hidden="true"/>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="visibility-panel-summary border-b border-[var(--admin-line)] px-5 py-4">
            {panelNotice ? <OpsNotice tone={panelNotice.tone} onDismiss={() => setPanelNotice(null)}>{panelNotice.text}</OpsNotice> : null}
            <div className={`${panelNotice ? "mt-3 " : ""}flex flex-wrap items-center gap-2`}>
              <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`} className="ops-button" data-variant="secondary" data-size="sm">Open Job File</Link>
              {row.stale ? <OpsBadge tone="danger">Stale feed</OpsBadge> : <OpsBadge tone="success">Feed current</OpsBadge>}
              <span className="text-xs text-[var(--admin-muted)]">{row.last_source ? row.last_source.replaceAll("_", " ") : "No source recorded"}</span>
            </div>
          </div>

          <PanelSection title="Latest position" description="The newest normalized tracking state visible to KCPL operations.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Location" value={row.current_location || "Location unknown"}/>
              <Detail label="Milestone" value={row.last_milestone ? trackingMilestoneLabels[row.last_milestone] : "No normalized milestone"}/>
              <Detail label="Carrier" value={row.carrier || "Not set"}/>
              <Detail label="Provider" value={row.last_provider || "Not recorded"}/>
              <Detail label="Latest ETA" value={dateTime(row.eta)}/>
              <Detail label="ETA movement" value={delayText(row.eta_delta_hours)} danger={(row.eta_delta_hours ?? 0) >= 24}/>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3 text-sm text-[var(--admin-muted)]">
              {row.stale ? <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--admin-danger)]" aria-hidden="true"/> : <CheckCircle2 size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--admin-success)]" aria-hidden="true"/>}
              <span>{row.stale ? `No fresh tracking signal within the expected window. Last event: ${dateTime(row.last_event_at)}.` : `Latest tracking event: ${dateTime(row.last_event_at)}.`}</span>
            </div>
          </PanelSection>

          <PanelSection title="Event timeline" description="Normalized carrier, EDI, GPS, counterpart and manual updates.">
            {loadingEvents ? (
              <div className="flex items-center gap-2 rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3 text-sm text-[var(--admin-muted)]">
                <RadioTower size={16} strokeWidth={1.75} aria-hidden="true"/> Loading tracking history…
              </div>
            ) : events.length ? (
              <div className="divide-y divide-[var(--admin-line)] border-y border-[var(--admin-line)]">
                {events.map((event) => (
                  <div key={event.id} className="grid gap-2 py-3 sm:grid-cols-[110px_minmax(0,1fr)]">
                    <span className="text-xs text-[var(--admin-muted)]">{shortDateTime(event.event_time)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <OpsBadge tone={event.milestone === "delivery_refused" || event.milestone === "exception" ? "danger" : event.milestone === "delivered" ? "success" : "info"}>{trackingMilestoneLabels[event.milestone]}</OpsBadge>
                        <strong className="text-sm font-medium">{event.title}</strong>
                      </div>
                      <p className="mt-1 text-sm leading-5 text-[var(--admin-muted)]">{event.location || "Location not supplied"}{event.details ? ` · ${event.details}` : ""}</p>
                      <p className="mt-1 text-xs text-[var(--admin-muted)]">{event.provider || event.source.replaceAll("_", " ")}{event.eta ? ` · ETA ${dateTime(event.eta)}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <OpsEmptyState compact title="No normalized tracking events yet" description="Carrier, counterpart or manual events will appear here when recorded."/>
            )}
          </PanelSection>

          <PanelSection title="Manual fallback" description="Record an operational update when the provider has no live integration.">
            <div className="grid gap-3 sm:grid-cols-2">
              <OpsField label="Raw carrier status"><input value={rawStatus} onChange={(event) => setRawStatus(event.target.value)} placeholder="e.g. Vessel departed Singapore"/></OpsField>
              <OpsField label="Milestone override"><select value={milestone} onChange={(event) => setMilestone(event.target.value as TrackingMilestone | "")}><option value="">Auto-detect</option>{trackingMilestones.filter((value) => value !== "unknown").map((value) => <option key={value} value={value}>{trackingMilestoneLabels[value]}</option>)}</select></OpsField>
              <OpsField label="Location"><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Port, airport, border, city…"/></OpsField>
              <OpsField label="Provider / counterpart"><input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Carrier, airline, overseas agent…"/></OpsField>
              <OpsField label="Event time"><input name="visibility-event-time" type="datetime-local" value={eventTime} onChange={(event) => setEventTime(event.target.value)} aria-describedby="visibility-timezone-note"/></OpsField>
              <OpsField label="New ETA"><input name="visibility-new-eta" type="datetime-local" value={eta} onChange={(event) => setEta(event.target.value)} aria-describedby="visibility-timezone-note"/></OpsField>
              <OpsField label="Details" className="sm:col-span-2"><textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Operational context, reason, vehicle, vessel or flight details…"/></OpsField>
            </div>
            <p id="visibility-timezone-note" className="mt-3 text-xs text-[var(--admin-muted)]">Times are saved and displayed in Nepal time (NPT).</p>
          </PanelSection>
        </div>

        <footer className="shrink-0 border-t border-[var(--admin-line)] bg-[var(--admin-surface)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[var(--admin-muted)]">Manual updates are added to the same normalized tracking timeline.</span>
            <OpsButton variant="primary" disabled={busy || !rawStatus.trim()} onClick={recordEvent}>
              <Activity size={16} strokeWidth={1.75} aria-hidden="true"/>
              {busy ? "Recording…" : "Record tracking event"}
            </OpsButton>
          </div>
        </footer>
      </aside>
    </>
  );
}

function PanelSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--admin-line)] px-5 py-5 last:border-b-0">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-[var(--admin-muted)]">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Detail({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-3">
      <p className="m-0 text-xs font-medium text-[var(--admin-muted)]">{label}</p>
      <p className={`mt-1 text-sm font-medium ${danger ? "text-[var(--admin-danger)]" : "text-[var(--admin-ink)]"}`}>{value}</p>
    </div>
  );
}
