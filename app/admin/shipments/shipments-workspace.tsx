"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronRight, Download, GripVertical, LayoutGrid, Link2, Map as MapIcon, Plus, RefreshCw, SlidersHorizontal, Table as TableIcon, Upload, X } from "lucide-react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import type { ShipmentActivityItem, ShipmentActivityTimeline } from "../shipment-activity";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob, CommandCentreStaffLoad } from "../command-centre/command-centre-data";
import { shipmentNeedsAttention, shipmentNextAction } from "./shipment-queue-policy";
import { compareWorkQueueImpact, type ReceivableExposure } from "../command-centre/work-queue-impact";
import { suggestOwner, laneKey, type OwnerCandidateEvidence, type OwnerSuggestion } from "../command-centre/owner-recommender";
import { useFreshnessLabel, useRegisterSnapshot } from "../use-register-poll";
import { useWorkspaceQuery } from "../use-workspace-query";
import { ArrangeableGrid } from "../arrangeable-grid";
import "../arrangeable-grid.css";
import {
  presetForStateIn,
  savedLayoutForState,
  WORKSPACE_PRESETS,
} from "../operations-arrangeable";
import { useStaffArrangement } from "../use-staff-arrangement";
import { CustomiseMenu, CustomiseRow } from "../ops-register";
import { OpsBadge, OpsButton, OpsDialog, OpsEmptyState, OpsNotice, OpsPage, OpsPageHeader, OpsPopover, OpsSearch, OpsTableWrap, useAdminPortalContainer } from "../operations-ui";
import {
  ModeIcon,
  ShipmentCards,
  ShipmentMap,
  ShipRoute,
  exportShipmentsCsv,
  ownerLabel as owner,
  priorityTone,
  relativeAge,
  routeText as route,
  shortDate,
  statusTone,
} from "./shipments-views";

type StatusFilter = "all" | "active" | ShipmentStatus;
type RegisterView = "table" | "cards" | "map";
type StatusChange = { reference: string; from: ShipmentStatus; to: ShipmentStatus };

const STATUS_FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Booking confirmed", value: "booking_confirmed" },
  { label: "Preparing", value: "preparing" },
  { label: "In transit", value: "in_transit" },
  { label: "Customs", value: "customs_clearance" },
  { label: "Out for delivery", value: "out_for_delivery" },
  { label: "Attention", value: "exception" },
  { label: "Delivered", value: "delivered" },
];

const VIEW_OPTIONS: Array<{ value: RegisterView; label: string; icon: typeof TableIcon }> = [
  { value: "table", label: "Table", icon: TableIcon },
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "map", label: "Map", icon: MapIcon },
];

type ShipmentSectionId = "rail" | "register";
const SHIPMENT_SECTION_LABELS: Record<ShipmentSectionId, string> = { rail: "Summary rail", register: "Shipment register" };

function formatNepalClock(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit" }).format(parsed);
}

function modeOptions(jobs: CommandCentreJob[]) {
  return [...new Set(jobs.map((job) => job.mode.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function ShipmentsWorkspace({ data: initialData, canStartShipment = false, exposureByCustomer, laneCompletionsByStaff }: { data: CommandCentreData; canStartShipment?: boolean; exposureByCustomer: Map<string, ReceivableExposure>; laneCompletionsByStaff: Map<string, Map<string, OwnerCandidateEvidence>>; }) {
  const { params, search, update } = useWorkspaceQuery();
  // Quiet 60s live refresh shared with the Overview pulse and the Customs and
  // Delivery strips; changes power the toast below.
  const { data, changes: polledChanges } = useRegisterSnapshot(initialData);
  const [statusChanges, setStatusChanges] = useState<StatusChange[] | null>(null);
  const statusChangesTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!polledChanges.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror a poll-delivered external event into visible toast state, then auto-expire
    setStatusChanges(polledChanges.slice(0, 3));
    if (statusChangesTimer.current !== null) window.clearTimeout(statusChangesTimer.current);
    statusChangesTimer.current = window.setTimeout(() => setStatusChanges(null), 6000);
  }, [polledChanges]);
  useEffect(() => () => { if (statusChangesTimer.current !== null) window.clearTimeout(statusChangesTimer.current); }, []);
  const portalContainer = useAdminPortalContainer();
  const query = params.get("q") ?? "";
  const requestedStatus = params.get("status") ?? "all";
  const status: StatusFilter = requestedStatus === "all" || requestedStatus === "active" || shipmentStatuses.includes(requestedStatus as ShipmentStatus)
    ? requestedStatus as StatusFilter
    : "all";
  const requestedBranch = params.get("branch") ?? "all";
  const branch = data.accessible_branches.includes(requestedBranch as KcplBranch) ? requestedBranch : "all";
  const requestedMode = params.get("mode") ?? "all";
  const mode = data.jobs.some((job) => job.mode === requestedMode) ? requestedMode : "all";
  const attention = params.get("attention") === "1";
  const overdue = params.get("overdue") === "1";
  const live = params.get("live") === "1";
  const ownerFilter = params.get("owner") === "unassigned" ? "unassigned" : "all";
  const sort = params.get("sort") === "updated" ? "updated" : "priority";
  const requestedView = params.get("view");
  const view: RegisterView = requestedView === "cards" || requestedView === "map" ? requestedView : "table";
  const selectedReference = params.get("selected");
  const pageSize = 50;
  const requestedPage = Number(params.get("page") || "1");
  const setFilters = (values: Record<string, string | null>) => update({ ...values, page: null, selected: null });
  const setQuery = (value: string) => setFilters({ q: value || null });
  const setStatus = (value: StatusFilter) => setFilters({ status: value === "all" ? null : value });
  const setBranch = (value: string) => setFilters({ branch: value === "all" ? null : value });
  const setMode = (value: string) => setFilters({ mode: value === "all" ? null : value });
  const setOwnerFilter = (value: string) => setFilters({ owner: value === "all" ? null : value });
  const setView = (value: RegisterView) => update({ view: value === "table" ? null : value });
  const setSelectedReference = useCallback((value: string | null) => update({ selected: value }), [update]);

  const modes = useMemo(() => modeOptions(data.jobs), [data.jobs]);
  const overview = useMemo(() => {
    let inTransit = 0;
    let outForDelivery = 0;
    let customs = 0;
    let attentionCount = 0;
    for (const job of data.jobs) {
      if (job.status === "in_transit") inTransit += 1;
      else if (job.status === "out_for_delivery") outForDelivery += 1;
      else if (job.status === "customs_clearance") customs += 1;
      if (shipmentNeedsAttention(job)) attentionCount += 1;
    }
    return { total: data.jobs.length, inTransit, outForDelivery, customs, attention: attentionCount };
  }, [data.jobs]);
  // Live-activity window: shipments whose newest job_activity entry is younger
  // than 15 minutes earn a quiet pulse badge on their register row. The clock
  // comes from the snapshot generation time, keeping render pure.
  const liveActivityRefs = useMemo(() => {
    const now = Date.parse(data.generated_at) || 0;
    const cutoff = now - LIVE_ACTIVITY_WINDOW_MS;
    const refs = new Set<string>();
    for (const job of data.jobs) {
      const at = job.latest_activity_at ? Date.parse(job.latest_activity_at) : Number.NaN;
      if (Number.isFinite(at) && at >= cutoff) refs.add(job.reference);
    }
    return refs;
  }, [data.jobs, data.generated_at]);
  // The register's priority sort shares the Overview's impact ranking: same
  // severity ladder, same exposure/SLA/dwell multipliers, computed against the
  // snapshot's operational date so both surfaces agree.
  const impactContext = useMemo(
    () => ({ exposureByCustomer, operationalDate: data.operational_date, now: new Date(data.generated_at) }),
    [exposureByCustomer, data.operational_date, data.generated_at],
  );
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.jobs.filter((job) => {
      if (status === "active" && job.status === "delivered") return false;
      if (status !== "all" && status !== "active" && job.status !== status) return false;
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch as KcplBranch)) return false;
      if (attention && !shipmentNeedsAttention(job)) return false;
      if (overdue && !(job.overdue_tasks > 0)) return false;
      if (live && !liveActivityRefs.has(job.reference)) return false;
      if (ownerFilter === "unassigned" && owner(job) !== "Unassigned") return false;
      if (mode !== "all" && job.mode !== mode) return false;
      if (!terms.length) return true;
      const haystack = [
        job.reference,
        job.quote_reference,
        job.customer_name,
        job.origin,
        job.destination,
        job.mode,
        job.carrier ?? "",
        owner(job),
        shipmentStatusLabels[job.status],
        job.priority,
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort(sort === "priority"
      ? (a, b) => compareWorkQueueImpact(a, b, impactContext)
      : (a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0) || a.reference.localeCompare(b.reference));
  }, [attention, branch, data.jobs, impactContext, live, liveActivityRefs, mode, overdue, ownerFilter, query, sort, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = selectedReference ? filtered.find((job) => job.reference === selectedReference) ?? null : null;
  const activityHighlightId = params.get("a");
  const returnTo = `/admin/shipments${search}`;
  const advancedCount = Number(branch !== "all") + Number(mode !== "all") + Number(ownerFilter !== "all") + Number(attention) + Number(overdue) + Number(live) + Number(sort !== "priority");
  const hasFilters = Boolean(query) || status !== "all" || advancedCount > 0;

  function resetFilters() {
    update({ q: null, status: null, branch: null, mode: null, owner: null, attention: null, overdue: null, live: null, sort: null, page: null, selected: null });
  }

  /** The menu's Clear: drops only what the menu edits, keeps search + status scope. */
  function clearAdvanced() {
    update({ branch: null, mode: null, owner: null, attention: null, overdue: null, live: null, sort: null, page: null, selected: null });
  }

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (branch !== "all") activeChips.push({ key: "branch", label: branch, clear: () => setBranch("all") });
  if (mode !== "all") activeChips.push({ key: "mode", label: mode, clear: () => setMode("all") });
  if (ownerFilter !== "all") activeChips.push({ key: "owner", label: "Unassigned", clear: () => setOwnerFilter("all") });
  if (attention) activeChips.push({ key: "attention", label: "Needs attention", clear: () => setFilters({ attention: null }) });
  if (overdue) activeChips.push({ key: "overdue", label: "Overdue", clear: () => setFilters({ overdue: null }) });
  if (live) activeChips.push({ key: "live", label: "Live activity", clear: () => setFilters({ live: null }) });
  if (sort !== "priority") activeChips.push({ key: "sort", label: "Recently updated", clear: () => setFilters({ sort: null }) });

  const statusCounts = useMemo(() => {
    const counts = new Map<StatusFilter, number>([["all", data.jobs.length], ["active", 0]]);
    for (const job of data.jobs) {
      counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
      if (job.status !== "delivered") counts.set("active", (counts.get("active") ?? 0) + 1);
    }
    return counts;
  }, [data.jobs]);

  const handleExport = useCallback(() => exportShipmentsCsv(filtered), [filtered]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Per-staff workspace layout: the summary rail and the register are arrangeable
  // sections persisted server-side (same primitive as the Overview).
  const {
    state: arrangement,
    status: arrangeStatus,
    applyState: setArrangement,
    toggleHidden,
    moveSectionToward,
    resetArrangement,
    saved,
    saveCurrentAs,
    deleteSaved,
  } = useStaffArrangement("shipments");
  const [arranging, setArranging] = useState(false);
  const [arrangeMenu, setArrangeMenu] = useState(false);
  const activePreset = presetForStateIn("shipments", arrangement);
  const savedMatch = savedLayoutForState(saved, arrangement);
  const onSectionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, id: ShipmentSectionId) => {
      if (!arranging || event.defaultPrevented) return;
      if ((event.altKey || event.metaKey) && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        // Never steal arrows from text editing inside a section.
        const target = event.target as HTMLElement | null;
        if (target && target.closest("input, textarea, select")) return;
        event.preventDefault();
        moveSectionToward(id, event.key === "ArrowUp" ? "up" : "down");
        return;
      }
      if ((event.key === "h" || event.key === "H") && document.activeElement === event.currentTarget) {
        event.preventDefault();
        toggleHidden(id);
      }
    },
    [arranging, moveSectionToward, toggleHidden],
  );

  // "Refreshed Xs ago": ticks once a minute alongside the poll so staff can
  // trust the register is live. Turns quiet-stale past 90s (hidden tab, or a
  // failed poll) without nagging. Shared with the pulse surfaces.
  const freshness = useFreshnessLabel(Date.parse(data.generated_at) || 0);

  return (
    <OpsPage className="shipments-register">
      {statusChanges ? (
        <div className="shipments-status-toast" role="status" aria-live="polite">
          <RefreshCw size={12} strokeWidth={1.75} aria-hidden="true"/>
          <strong>{statusChanges.length === 1 ? "1 shipment updated" : `${statusChanges.length} shipments updated`}</strong>
          {statusChanges.map((change) => (
            <span key={change.reference} className="shipments-status-toast-change">
              <span className="shipments-live-activity" aria-hidden="true"/>
              <span className="ops-mono">{change.reference}</span> → {shipmentStatusLabels[change.to]}
            </span>
          ))}
        </div>
      ) : null}
      <OpsPageHeader
        title="Shipments"
        description={`Active movements and Digital Job Files · ${data.jobs.length} total record${data.jobs.length === 1 ? "" : "s"}`}
        actions={(
          <div className="shipments-actions">
            <OpsButton variant="secondary" onClick={handleExport} disabled={!filtered.length} title="Download the current view as CSV">
              <Download size={16} strokeWidth={1.75} aria-hidden="true"/> Export
            </OpsButton>
            <OpsButton variant="secondary" disabled aria-disabled="true" title="Bulk import is coming soon">
              <Upload size={16} strokeWidth={1.75} aria-hidden="true"/> Import
            </OpsButton>
            {canStartShipment ? (
              <Link href="/admin/tenders" className="ops-button" data-variant="primary" data-size="md" title="Start a shipment through Tender & Booking">
                <Plus size={16} strokeWidth={1.75} aria-hidden="true"/> New shipment
              </Link>
            ) : null}
          </div>
        )}
      >
      </OpsPageHeader>

      {/* One flat operational rail, not five floating metric cards: the register
          below is the actual working surface, so the summary stays quiet. Segments
          reuse the existing status scopes — no new filtering logic. */}
      <div className="px-4 pt-3 md:px-6">
        <CustomiseRow
          arranging={arranging}
          onToggle={() => { setArranging(v => !v); setArrangeMenu(false); }}
          arrangeMenu={arrangeMenu}
          onToggleMenu={() => setArrangeMenu(v => !v)}
          arrangement={arrangement}
          presets={WORKSPACE_PRESETS.shipments}
          activePreset={activePreset}
          applyPreset={preset => setArrangement(preset.layout)}
          onReset={resetArrangement}
          status={arrangeStatus}
          sectionLabels={SHIPMENT_SECTION_LABELS}
          saved={saved}
          onSaveCurrent={saveCurrentAs}
          onDeleteSaved={deleteSaved}
          savedMatchId={savedMatch?.id ?? null}
          onApplySaved={(layout) => setArrangement({ order: layout.order, hidden: layout.hidden })}
        />
        <CustomiseMenu open={arranging && arrangeMenu} arrangement={arrangement} onToggle={toggleHidden} sectionLabels={SHIPMENT_SECTION_LABELS}/>
      </div>

      {data.partial ? <div className="px-4 py-4 md:px-6"><OpsNotice tone="warning">This snapshot reached a loading limit. Counts may be incomplete; confirm readiness in the Job File.</OpsNotice></div> : null}

      <div className="px-4 py-4 md:px-6">
        <div>
          <div className="shipments-toolbar mb-4">
            <div className="shipments-toolbar-search">
              <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ref, customer, route…" aria-label="Search shipments"/>
            </div>

            <div className="shipments-status-filters" role="group" aria-label="Shipment status filters">
              {STATUS_FILTERS.map((item) => {
                const active = status === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className="shipments-filter-tab"
                    data-active={active || undefined}
                    aria-pressed={active}
                    onClick={() => setStatus(item.value)}
                  >
                    {item.label}
                    <span className="shipments-tab-count" aria-hidden="true">{statusCounts.get(item.value) ?? 0}</span>
                  </button>
                );
              })}
            </div>

            <div className="shipments-toolbar-actions">
              <div className="shipments-view-toggle" role="group" aria-label="Register view">
                {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    data-active={view === value || undefined}
                    aria-pressed={view === value}
                    onClick={() => setView(value)}
                  >
                    <Icon size={16} strokeWidth={1.75} aria-hidden="true"/>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <OpsPopover.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
                <OpsPopover.Trigger asChild>
                  <button type="button" className="shipments-filter-trigger" aria-label="Open shipment filters" aria-expanded={filtersOpen}>
                    <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true"/>
                    <span>Filters</span>{advancedCount ? <span className="shipments-filter-count">{advancedCount}</span> : null}
                  </button>
                </OpsPopover.Trigger>
                <OpsPopover.Portal container={portalContainer ?? undefined}>
                  <OpsPopover.Content sideOffset={8} align="end" className="shipments-filter-menu" collisionPadding={12}>
                  <div className="shipments-filter-head">
                    <strong>Filters</strong>
                    {advancedCount ? <button type="button" className="shipments-filter-clear" onClick={clearAdvanced}>Clear</button> : null}
                  </div>
                  <div className="shipments-filter-row">
                    <span className="shipments-filter-label">Branch</span>
                    <select value={branch} onChange={(event) => setBranch(event.target.value)} aria-label="Filter by branch"><option value="all">All branches</option>{data.accessible_branches.filter((item) => kcplBranches.includes(item)).map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  </div>
                  <div className="shipments-filter-row">
                    <span className="shipments-filter-label">Mode</span>
                    <select value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Filter by mode"><option value="all">All modes</option>{modes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  </div>
                  <div className="shipments-filter-row">
                    <span className="shipments-filter-label">Owner</span>
                    <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} aria-label="Filter by owner"><option value="all">All owners</option><option value="unassigned">Unassigned</option></select>
                  </div>
                  <div className="shipments-filter-row">
                    <span className="shipments-filter-label">Sort</span>
                    <select value={sort} onChange={(event) => setFilters({ sort: event.target.value === "priority" ? null : event.target.value })} aria-label="Sort register"><option value="priority">Priority first</option><option value="updated">Recently updated</option></select>
                  </div>
                  <div className="shipments-filter-toggles">
                    <label className="shipments-filter-toggle" data-active={attention || undefined}>
                      <input type="checkbox" checked={attention} onChange={() => setFilters({ attention: attention ? null : "1" })}/>
                      <span className="shipments-filter-check" aria-hidden="true"><svg aria-hidden="true" fill="none" height="10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 12 12" width="10"><path d="M2 6.5 5 9.5 10 3"/></svg></span>
                      <strong>Needs attention</strong>
                      <small>Exception, overdue work or missing assignment</small>
                    </label>
                    <label className="shipments-filter-toggle" data-active={overdue || undefined}>
                      <input type="checkbox" checked={overdue} onChange={() => setFilters({ overdue: overdue ? null : "1" })}/>
                      <span className="shipments-filter-check" aria-hidden="true"><svg aria-hidden="true" fill="none" height="10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 12 12" width="10"><path d="M2 6.5 5 9.5 10 3"/></svg></span>
                      <strong>Overdue</strong>
                      <small>Any shipment with overdue operational tasks</small>
                    </label>
                    <label className="shipments-filter-toggle" data-active={live || undefined}>
                      <input type="checkbox" checked={live} onChange={() => setFilters({ live: live ? null : "1" })}/>
                      <span className="shipments-filter-check" aria-hidden="true"><svg aria-hidden="true" fill="none" height="10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 12 12" width="10"><path d="M2 6.5 5 9.5 10 3"/></svg></span>
                      <strong>Live activity</strong>
                      <small>New activity logged in the last 15 minutes</small>
                    </label>
                  </div>
                  <div className="shipments-filter-foot">
                    <button type="button" className="shipments-filter-done" onClick={() => setFiltersOpen(false)}>Done</button>
                  </div>
                </OpsPopover.Content>
                </OpsPopover.Portal>
              </OpsPopover.Root>
              <span className="shipments-result-count" aria-live="polite">{filtered.length === data.jobs.length ? `${data.jobs.length} results` : `${filtered.length} of ${data.jobs.length}`}</span>
              <span className="shipments-freshness" data-stale={freshness.stale || undefined} title={`Snapshot ${formatNepalClock(data.generated_at)} NPT`}>{freshness.label}</span>
            </div>
          </div>
        </div>

        {activeChips.length ? (
          <div className="shipments-chip-row mb-3" role="group" aria-label="Active filters">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="shipments-filter-chip"
                onClick={chip.clear}
                title={`Remove filter: ${chip.label}`}
              >
                {chip.label}
                <X size={12} strokeWidth={1.75} aria-hidden="true"/>
              </button>
            ))}
            {hasFilters ? <button type="button" className="shipments-chip-clear" onClick={resetFilters}>Reset all</button> : null}
          </div>
        ) : null}

        <ArrangeableGrid
          workspace="shipments"
          state={arrangement}
          onChange={setArrangement}
          arranging={arranging}
        >
          {(id: ShipmentSectionId, { handleProps, hidden }) => {
            if (hidden) return null;
            const handle = (
              <button
                type="button"
                className="ops-arrange-handle"
                {...handleProps}
                aria-label={`Move ${SHIPMENT_SECTION_LABELS[id]}`}
                tabIndex={arranging ? 0 : -1}
                onKeyDown={(event) => onSectionKeyDown(event, id)}
              >
                <GripVertical size={13} strokeWidth={1.75} aria-hidden="true"/>
              </button>
            );
            if (id === "register") {
              return (
            <>
              {handle}
        {!filtered.length ? (
          <section className="ops-surface p-4" aria-label="Shipment register">
            <OpsEmptyState compact kind="search" title="No shipments" description={hasFilters ? "No shipments match the current filters." : "No shipment records are available in this scope."} action={hasFilters ? <OpsButton type="button" variant="secondary" onClick={resetFilters}>Clear filters</OpsButton> : undefined}/>
          </section>
        ) : view === "cards" ? (
          <ShipmentCards jobs={pageRows} selectedReference={selected?.reference ?? null} onSelect={setSelectedReference} liveActivityRefs={liveActivityRefs}/>
        ) : view === "map" ? (
          <ShipmentMap jobs={pageRows} selectedReference={selected?.reference ?? null} onSelect={setSelectedReference}/>
        ) : (
          <section className="ops-surface overflow-hidden" aria-label="Shipment register">
            <OpsTableWrap>
              <table className="ops-table shipments-register-table" aria-label="Shipments register">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Customer · Route</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Owner</th>
                    <th>ETA</th>
                    <th>Updated</th>
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((job) => {
                    const chosen = selected?.reference === job.reference;
                    const jobOwner = owner(job);
                    const nextAction = shipmentNextAction(job);
                    return (
                      <tr
                        key={job.reference}
                        data-selected={chosen || undefined}
                        tabIndex={0}
                        onClick={() => setSelectedReference(job.reference)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedReference(job.reference);
                          }
                        }}
                        className="cursor-pointer"
                        aria-label={`Open ${job.reference}, ${job.customer_name}, ${shipmentStatusLabels[job.status]}`}
                      >
                        <td><span className="ops-mono text-xs font-medium text-[var(--admin-info)]">{job.reference}</span>{liveActivityRefs.has(job.reference) ? <span className="shipments-live-activity" title="New activity in the last 15 minutes" aria-label="New activity in the last 15 minutes"/> : null}</td>
                        <td><strong className="block text-sm font-medium text-[var(--admin-ink)]">{job.customer_name || "Customer not linked"}</strong><span className="mt-1 block"><ShipRoute origin={job.origin} destination={job.destination}/></span></td>
                        <td><span className="inline-flex items-center gap-1.5 text-sm text-[var(--admin-muted)]"><ModeIcon mode={job.mode} size={14}/>{job.mode || "—"}</span></td>
                        <td><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></td>
                        <td><OpsBadge tone={priorityTone(job.priority)}>{job.priority}</OpsBadge></td>
                        <td><span className={`text-sm ${jobOwner === "Unassigned" ? "font-medium text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>{jobOwner}</span></td>
                        <td><span className="text-sm text-[var(--admin-ink)]">{shortDate(job.eta)}</span></td>
                        <td><span className="text-sm text-[var(--admin-muted)]">{relativeAge(job.updated_at, data.generated_at)}</span></td>
                        <td><span className="shipment-next-action-cell" data-tone={nextAction.tone}>{nextAction.title}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </OpsTableWrap>
            <div className="border-t border-[var(--admin-line)] px-4 py-2.5 text-xs text-[var(--admin-muted)]">{filtered.length} shipment{filtered.length === 1 ? "" : "s"} in this view</div>
          </section>
        )}

        {filtered.length > pageSize ? (
          <div className="ops-pagination mt-3" aria-label="Shipment pages">
            <span aria-live="polite">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="ops-pagination-actions"><OpsButton size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1), selected: null }, "push")}>Previous</OpsButton><span>Page {page} of {pageCount}</span><OpsButton size="sm" disabled={page >= pageCount} onClick={() => update({ page: String(page + 1), selected: null }, "push")}>Next</OpsButton></div>
          </div>
        ) : null}
            </>
          );
            }
            // id === "rail": the summary rail section.
            return (
              <section className="shipments-kpi-rail" role="list" aria-label="Register volume summary" style={{ position: "relative" }}>
                {handle}
                <RailMetric label="Total" value={overview.total}/>
                <RailMetric label="In transit" value={overview.inTransit} tone="info"/>
                <RailMetric label="Delivery" value={overview.outForDelivery} tone="success"/>
                <RailMetric label="Customs" value={overview.customs} tone="warning"/>
                <RailMetric label="Attention" value={overview.attention} tone={overview.attention ? "danger" : "neutral"}/>
              </section>
            );
          }}
        </ArrangeableGrid>
      </div>

      {selected ? <ShipmentPanel job={selected} returnTo={returnTo} container={portalContainer} onClose={() => setSelectedReference(null)} highlightId={activityHighlightId} update={update} generatedAt={data.generated_at} laneCompletionsByStaff={laneCompletionsByStaff} staffDirectory={data.staff_load}/> : null}
    </OpsPage>
  );
}

function RailMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "info" | "success" | "warning" | "danger" }) {
  return (
    <div className="shipments-kpi" role="listitem" data-tone={tone} data-zero={value === 0 || undefined}>
      <span className="shipments-kpi-label">{label}</span>
      <strong className="shipments-kpi-value">{value}</strong>
    </div>
 );
}

function ShipmentPanel({ job, returnTo, container, onClose, highlightId, update, generatedAt, laneCompletionsByStaff, staffDirectory }: { job: CommandCentreJob; returnTo: string; container: HTMLElement | null; onClose: () => void; highlightId: string | null; update: (values: Record<string, string | null>) => void; generatedAt: string; laneCompletionsByStaff: Map<string, Map<string, OwnerCandidateEvidence>>; staffDirectory: CommandCentreStaffLoad[] }) {
  const action = shipmentNextAction(job);
  const jobOwner = owner(job);
  const openException = job.status === "exception";

  function withReturn(href: string) {
    const [path, hash] = href.split("#");
    return `${path}?returnTo=${encodeURIComponent(returnTo)}${hash ? `#${hash}` : ""}`;
  }

  return (
    // Non-blocking record inspector: the register stays live behind the panel
    // (modal={false}), so clicking another row swaps the inspector in place.
    // Escape and the close button still dismiss it.
    <OpsDialog.Root open modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <OpsDialog.Portal container={container ?? undefined}>
        {/* Radix omits its Overlay under modal={false}; this custom scrim only
          * materialises below 900px where the inspector is a modal bottom sheet. */}
        <div className="shipment-sheet-scrim fixed inset-0 z-[70] cursor-default" onClick={onClose} aria-hidden="true"/>
        {/* Right-side slideover on desktop: the register stays visible and scrollable behind the
          * inspector, so selecting the next shipment never costs a full repaint.
          * Full-width bottom sheet below the md breakpoint via .shipment-sheet CSS. */}
        <OpsDialog.Content
          className="shipment-sheet fixed inset-y-0 right-0 z-[80] flex w-full max-w-[560px] flex-col overflow-hidden bg-[var(--admin-surface)] shadow-xl"
          aria-label={`Shipment ${job.reference}`}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <OpsDialog.Title className="sr-only">{job.reference} shipment details</OpsDialog.Title>
          <OpsDialog.Description className="sr-only">Review shipment status, readiness, route and the next permitted action.</OpsDialog.Description>

          <header className="shipment-sheet-header shrink-0 border-b border-[var(--admin-line)]">
            <div className="shipment-sheet-inner flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="ops-mono m-0 text-xs text-[var(--admin-muted)]">{job.reference} · {job.quote_reference}</p>
                <h2 className="mt-1 text-lg font-semibold leading-6">{job.customer_name || "Customer not linked"}</h2>
                <p className="mt-0.5 text-sm text-[var(--admin-muted)]">{route(job)} · {job.mode || "Mode not set"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge>
                <OpsDialog.Close asChild>
                  <button type="button" className="shipment-sheet-close" aria-label="Close shipment panel"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>
                </OpsDialog.Close>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="shipment-sheet-body shipment-sheet-inner">
              {openException ? (
                <div className="shipment-sheet-exception">
                  <AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>
                  <div><strong>Exception</strong><span>{action.detail}</span></div>
                </div>
              ) : null}

              <section className="shipment-sheet-section">
                <h3>Core facts</h3>
                <dl className="shipment-sheet-facts">
                  <div><dt>Workflow status</dt><dd data-warning={openException || undefined}>{shipmentStatusLabels[job.status]}</dd></div>
                  <div><dt>Priority</dt><dd>{job.priority}</dd></div>
                  <div><dt>Assigned to</dt><dd data-warning={jobOwner === "Unassigned" || undefined}>{jobOwner}</dd></div>
                  <div><dt>Branch</dt><dd>{job.primary_branch}</dd></div>
                  <div><dt>Origin</dt><dd>{job.origin || "—"}</dd></div>
                  <div><dt>Destination</dt><dd>{job.destination || "—"}</dd></div>
                  <div><dt>Current location</dt><dd>{job.current_location || "—"}</dd></div>
                  <div><dt>Mode</dt><dd>{job.mode || "—"}</dd></div>
                  <div><dt>Carrier</dt><dd data-warning={!job.carrier || undefined}>{job.carrier || "Not assigned"}</dd></div>
                  <div><dt>ETA</dt><dd>{shortDate(job.eta)}</dd></div>
                </dl>
              </section>

              <section className="shipment-sheet-section shipment-sheet-next">
                <h3>Next action</h3>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block text-sm font-semibold text-[var(--admin-ink)]">{action.title}</strong>
                    <p className="mt-1 text-sm leading-5 text-[var(--admin-muted)]">{action.detail}</p>
                  </div>
                  <Link href={withReturn(action.href)} className="shipment-sheet-next-link">Open<ArrowRight size={12} strokeWidth={1.75} aria-hidden="true"/></Link>
                </div>
              </section>

              <section className="shipment-sheet-section">
                <h3>Readiness</h3>
                <ReadinessRow label="Open work" value={job.open_tasks ? `${job.open_tasks} task${job.open_tasks === 1 ? "" : "s"}` : "Clear"} warning={job.overdue_tasks > 0} href={withReturn(`/admin/jobs/${encodeURIComponent(job.reference)}#shipment-work`)}/>
                <ReadinessRow label="Customs" value={job.required_customs_open ? `${job.required_customs_open} open` : "Clear"} warning={job.required_customs_open > 0} href={withReturn(`/admin/jobs/${encodeURIComponent(job.reference)}#shipment-work`)}/>
                <ReadinessRow label="Exception" value={openException ? "Open" : "None"} warning={openException} href={openException ? withReturn(`/admin/jobs/${encodeURIComponent(job.reference)}#shipment-exceptions`) : undefined}/>
                <ReadinessRow label="Owner" value={jobOwner} warning={jobOwner === "Unassigned"}/>
              </section>

              <SuggestedOwners job={job} staffDirectory={staffDirectory} laneCompletionsByStaff={laneCompletionsByStaff}/>

              <ShipmentInspectorActivity reference={job.reference} highlightId={highlightId} update={update} generatedAt={generatedAt}/>
            </div>
          </div>

          <footer className="shipment-sheet-footer shrink-0 border-t border-[var(--admin-line)] bg-[var(--admin-surface)]">
            <div className="shipment-sheet-inner flex flex-wrap items-center justify-end gap-2">
              <Link href={withReturn(`/admin/jobs/${encodeURIComponent(job.reference)}`)} className="ops-button" data-variant="secondary" data-size="md">Open shipment</Link>
              <Link href={withReturn(action.href)} className="ops-button" data-variant="primary" data-size="md">{action.title}</Link>
            </div>
          </footer>
        </OpsDialog.Content>
      </OpsDialog.Portal>
    </OpsDialog.Root>
  );
}

/**
 * Owner suggestions for an unassigned shipment, drawn from live workload and
 * completed lane history. The recommender is pure and the data arrives with
 * the snapshot; nothing is invented and nothing is auto-assigned — the
 * operator opens the Job File and decides.
 */
function SuggestedOwners({ job, staffDirectory, laneCompletionsByStaff }: { job: CommandCentreJob; staffDirectory: CommandCentreStaffLoad[]; laneCompletionsByStaff: Map<string, Map<string, OwnerCandidateEvidence>> }) {
  const isUnassigned = !job.assigned_to_uid && !job.assigned_to_name && !job.assigned_to_email;
  if (!isUnassigned) return null;
  const suggestion: OwnerSuggestion = suggestOwner({
    job,
    candidates: staffDirectory,
    laneEvidence: laneEvidenceFor(laneCompletionsByStaff, laneKey(job.origin, job.destination)),
  });
  if (!suggestion.available) {
    return <section className="shipment-sheet-section"><h3>Suggested owners</h3><p className="text-sm text-[var(--admin-muted)]">{suggestion.reason}</p></section>;
  }
  return (
    <section className="shipment-sheet-section">
      <h3>Suggested owners</h3>
      <ol className="shipments-owner-suggest">
        {suggestion.recommendations.map((candidate, index) => (
          <li key={candidate.email || candidate.name} data-lead={index === 0 || undefined}>
            <span className="shipments-owner-suggest-name">{candidate.name}</span>
            <span className="shipments-owner-suggest-reason">{candidate.reason}</span>
          </li>
        ))}
      </ol>
      <p className="shipments-owner-suggest-note">Ranked by current workload and completed shipments on {job.origin} → {job.destination}. Assign the owner in the Job File.</p>
    </section>
  );
}

function laneEvidenceFor(map: Map<string, Map<string, OwnerCandidateEvidence>>, lane: string): Map<string, OwnerCandidateEvidence> {
  const evidence = new Map<string, OwnerCandidateEvidence>();
  for (const [staffKey, lanes] of map) {
    const hit = lanes.get(lane);
    if (hit) evidence.set(staffKey, hit);
  }
  return evidence;
}

function ReadinessRow({ label, value, warning = false, href }: { label: string; value: string; warning?: boolean; href?: string }) {
  const row = (<>
    <span className="text-xs text-[var(--admin-muted)]">{label}</span>
    <strong className={`inline-flex items-center gap-1 text-right text-xs font-semibold ${warning ? "text-[var(--admin-danger)]" : "text-[var(--admin-ink)]"}`}>{value}{href ? <ChevronRight size={12} strokeWidth={1.75} className="text-[var(--admin-faint)]" aria-hidden="true"/> : null}</strong>
  </>);
  return (
    <div className="shipment-sheet-ready-row border-b border-[var(--admin-line)] last:border-b-0">
      {href ? <Link href={href} className="shipment-sheet-ready-link">{row}</Link> : row}
    </div>
  );
}

const INSPECTOR_ACTIVITY_LIMIT = 5;
/** Register rows pulse when their newest job_activity entry is younger than this. */
const LIVE_ACTIVITY_WINDOW_MS = 15 * 60 * 1000;
const INSPECTOR_ACTIVITY_POLL_MS = 30_000;

function activityNptTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : `${new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short" }).format(date)} NPT`;
}

type InspectorActivityItem = Pick<ShipmentActivityItem, "id" | "title" | "detail" | "occurred_at" | "tone" | "actor_name" | "actor_email" | "category">;

type InspectorActivityState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "items"; items: InspectorActivityItem[] };

/** Recent activity inside the inspector: reads the existing jobs activity API,
 * shows at most a few quiet rows, and never blocks the drawer on failure.
 * Rows expand in place to reveal the entry's detail, actor and exact NPT time.
 * `highlightId` (the `a=` deep link) expands and marks that entry. */
function ShipmentInspectorActivity({ reference, highlightId, update, generatedAt }: { reference: string; highlightId: string | null; update: (values: Record<string, string | null>) => void; generatedAt: string }) {
  const [state, setState] = useState<InspectorActivityState>({ kind: "loading" });
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // True right after a poll that introduced rows the user has not seen yet.
  const [flash, setFlash] = useState(false);
  const knownIdsRef = useRef<Set<string> | null>(null);

  // Deep link wins: expanding a different row clears the ?a= parameter.
  const toggleRow = useCallback((id: string) => {
    setExpandedId((current) => {
      const next = current === id ? null : id;
      if (next !== highlightId) update({ a: null });
      return next;
    });
  }, [highlightId, update]);

  // Reload whenever the shipment changes; poll quietly every 30s (matching the
  // Job File timeline) so the drawer stays live without blocking anything.
  const load = useCallback((quiet: boolean) => {
    fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/activity`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { timeline?: ShipmentActivityTimeline; error?: string };
        if (!response.ok || !data.timeline) throw new Error(data.error || "unavailable");
        const items = data.timeline.items.slice(0, INSPECTOR_ACTIVITY_LIMIT).map((item) => ({ id: item.id, title: item.title, detail: item.detail, occurred_at: item.occurred_at, tone: item.tone, actor_name: item.actor_name, actor_email: item.actor_email, category: item.category }));
        // A quiet poll that surfaces unseen ids earns the "updated" flash; a
        // new danger-tone entry additionally rings the notifications bell.
        const known = knownIdsRef.current;
        const fresh = quiet && known ? items.filter((item) => !known.has(item.id)) : [];
        if (fresh.length) {
          setFlash(true);
          window.setTimeout(() => setFlash(false), 4000);
          const danger = fresh.find((item) => item.tone === "danger");
          if (danger) {
            // Ring the notifications bell with a real deep link (?selected + ?a)
            // and record a seen receipt so each alert rings once per staff
            // member — across sessions and devices.
            window.dispatchEvent(new CustomEvent("kcpl:activity-danger", { detail: { hint: `${reference} · ${danger.title}`.slice(0, 90), path: `/admin/shipments?selected=${encodeURIComponent(reference)}&a=${encodeURIComponent(danger.id)}` } }));
            fetch("/api/admin/activity-alerts", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ reference, activityId: danger.id }),
            }).catch(() => { /* dedupe receipts are best-effort */ });
          }
        }
        knownIdsRef.current = new Set(items.map((item) => item.id));
        setState({ kind: "items", items });
      })
      .catch(() => { if (!quiet) setState({ kind: "error" }); });
  }, [reference]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale rows while the new shipment loads
    setState({ kind: "loading" });
    load(false);
    const timer = window.setInterval(() => load(true), INSPECTOR_ACTIVITY_POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const copyLink = useCallback((itemId: string) => {
    const url = `${window.location.origin}/admin/shipments?selected=${encodeURIComponent(reference)}&a=${encodeURIComponent(itemId)}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopiedId(itemId);
        window.setTimeout(() => setCopiedId((current) => (current === itemId ? null : current)), 2000);
      },
      () => { /* clipboard unavailable — leave the action silently inert */ },
    );
  }, [reference]);

  return (
    <section className="shipment-sheet-section shipment-sheet-activity" data-flash={flash || undefined}>
      <h3>{flash ? "Updated just now" : "Recent activity"}</h3>
      {state.kind === "loading" ? <p className="shipment-sheet-activity-note">Loading…</p> : null}
      {state.kind === "error" ? (
        <p className="shipment-sheet-activity-note">
          Activity is unavailable here. <Link className="shipment-sheet-activity-more" href={`/admin/jobs/${encodeURIComponent(reference)}#shipment-activity`}>Open the Job File</Link>
        </p>
      ) : null}
      {state.kind === "items" ? (
        state.items.length ? (
          <>
            <ul className="shipment-sheet-activity-list">
              {state.items.map((item) => {
                const expanded = expandedId === item.id;
                const highlighted = highlightId === item.id;
                const hasMore = Boolean(item.detail || item.actor_name || item.actor_email || activityNptTime(item.occurred_at));
                return (
                  <li key={item.id} data-tone={item.tone === "neutral" ? undefined : item.tone} data-expanded={expanded || undefined} data-highlight={highlighted || undefined}>
                    <button
                      type="button"
                      className="shipment-sheet-activity-row"
                      aria-expanded={expanded}
                      disabled={!hasMore}
                      onClick={() => toggleRow(item.id)}
                    >
                      <span className="shipment-sheet-activity-dot" aria-hidden="true"/>
                      <span className="shipment-sheet-activity-title">{item.title}</span>
                      <span className="shipment-sheet-activity-age">{relativeAge(item.occurred_at, generatedAt)}</span>
                      {hasMore ? <ChevronDown size={12} strokeWidth={1.75} className="shipment-sheet-activity-chevron" aria-hidden="true"/> : null}
                    </button>
                    {expanded ? (
                      <div className="shipment-sheet-activity-detail">
                        {activityNptTime(item.occurred_at) ? <p className="shipment-sheet-activity-when">{activityNptTime(item.occurred_at)}</p> : null}
                        {item.detail ? <p>{item.detail}</p> : null}
                        <p className="shipment-sheet-activity-actor">{item.actor_name || item.actor_email || "System"}{item.actor_name && item.actor_email ? ` · ${item.actor_email}` : ""}</p>
                        <button type="button" className="shipment-sheet-activity-copy" onClick={() => copyLink(item.id)}>
                          {copiedId === item.id ? <Check size={11} strokeWidth={2} aria-hidden="true"/> : <Link2 size={11} strokeWidth={1.75} aria-hidden="true"/>}
                          {copiedId === item.id ? "Link copied" : "Copy link"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Link className="shipment-sheet-activity-more" href={`/admin/jobs/${encodeURIComponent(reference)}#shipment-activity`}>View all</Link>
          </>
        ) : (
          <p className="shipment-sheet-activity-note">No recorded activity yet.</p>
        )
      ) : null}
    </section>
  );
}
