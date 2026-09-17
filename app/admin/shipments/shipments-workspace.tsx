"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { AlertTriangle, Download, FileText, LayoutGrid, Map as MapIcon, Navigation, Package, Plus, SlidersHorizontal, Table as TableIcon, Truck, Upload, X } from "lucide-react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";
import { compareShipmentPriority, shipmentNeedsAttention, shipmentNextAction } from "./shipment-queue-policy";
import { useWorkspaceQuery } from "../use-workspace-query";
import { OpsBadge, OpsButton, OpsDialog, OpsEmptyState, OpsKpiCard, OpsKpiStrip, OpsNotice, OpsPage, OpsPageHeader, OpsPopover, OpsSearch, OpsTableWrap, OpsTabs, useAdminPortalContainer } from "../operations-ui";
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

function modeOptions(jobs: CommandCentreJob[]) {
  return [...new Set(jobs.map((job) => job.mode.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function ShipmentsWorkspace({ data, canStartShipment = false }: { data: CommandCentreData; canStartShipment?: boolean }) {
  const { params, search, update } = useWorkspaceQuery();
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
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.jobs.filter((job) => {
      if (status === "active" && job.status === "delivered") return false;
      if (status !== "all" && status !== "active" && job.status !== status) return false;
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch as KcplBranch)) return false;
      if (attention && !shipmentNeedsAttention(job)) return false;
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
      ? compareShipmentPriority
      : (a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0) || a.reference.localeCompare(b.reference));
  }, [attention, branch, data.jobs, mode, ownerFilter, query, sort, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = selectedReference ? filtered.find((job) => job.reference === selectedReference) ?? null : null;
  const returnTo = `/admin/shipments${search}`;
  const advancedCount = Number(branch !== "all") + Number(mode !== "all") + Number(ownerFilter !== "all") + Number(attention) + Number(sort !== "priority");
  const hasFilters = Boolean(query) || status !== "all" || advancedCount > 0;

  function resetFilters() {
    update({ q: null, status: null, branch: null, mode: null, owner: null, attention: null, sort: null, page: null, selected: null });
  }

  const handleExport = useCallback(() => exportShipmentsCsv(filtered), [filtered]);

  return (
    <OpsPage className="shipments-register">
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

      <div className="px-4 pt-4 md:px-6">
        <OpsKpiStrip>
          <OpsKpiCard
            icon={<Package size={18} strokeWidth={1.9} aria-hidden="true"/>}
            label="Total shipments"
            value={overview.total}
            tone="accent"
            active={status === "all" && !attention}
            onClick={() => setFilters({ status: null, attention: null })}
          />
          <OpsKpiCard
            icon={<Navigation size={18} strokeWidth={1.9} aria-hidden="true"/>}
            label="In transit"
            value={overview.inTransit}
            tone="info"
            active={status === "in_transit" && !attention}
            onClick={() => setFilters({ status: "in_transit", attention: null })}
          />
          <OpsKpiCard
            icon={<Truck size={18} strokeWidth={1.9} aria-hidden="true"/>}
            label="Out for delivery"
            value={overview.outForDelivery}
            tone="success"
            active={status === "out_for_delivery" && !attention}
            onClick={() => setFilters({ status: "out_for_delivery", attention: null })}
          />
          <OpsKpiCard
            icon={<FileText size={18} strokeWidth={1.9} aria-hidden="true"/>}
            label="Customs clearance"
            value={overview.customs}
            tone="warning"
            active={status === "customs_clearance" && !attention}
            onClick={() => setFilters({ status: "customs_clearance", attention: null })}
          />
          <OpsKpiCard
            icon={<AlertTriangle size={18} strokeWidth={1.9} aria-hidden="true"/>}
            label="Requires attention"
            value={overview.attention}
            tone="danger"
            active={attention}
            onClick={() => setFilters({ status: null, attention: "1" })}
          />
        </OpsKpiStrip>
      </div>

      {data.partial ? <div className="px-4 py-4 md:px-6"><OpsNotice tone="warning">This snapshot reached a loading limit. Counts may be incomplete; confirm readiness in the Job File.</OpsNotice></div> : null}

      <div className="px-4 py-4 md:px-6">
        <OpsTabs.Root value={status === "all" ? "all" : status} onValueChange={(value) => setStatus((value as StatusFilter) || "all")}>
          <div className="shipments-toolbar mb-4">
            <div className="shipments-toolbar-search">
              <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ref, customer, route…" aria-label="Search shipments"/>
            </div>

            <OpsTabs.List className="shipments-status-filters" aria-label="Shipment status filters">
              {STATUS_FILTERS.map((item) => {
                const active = status === item.value;
                return (
                  <OpsTabs.Trigger
                    key={item.value}
                    value={item.value}
                    className="shipments-filter-tab"
                    data-active={active || undefined}
                    aria-label={item.label}
                  >
                    {item.label}
                  </OpsTabs.Trigger>
                );
              })}
            </OpsTabs.List>

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
                    <Icon size={14} strokeWidth={1.75} aria-hidden="true"/>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <OpsPopover.Root>
                <OpsPopover.Trigger asChild>
                  <button type="button" className="shipments-filter-trigger" aria-label="Open shipment filters">
                    <SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden="true"/>
                    <span>Filters</span>{advancedCount ? <span className="shipments-filter-count">{advancedCount}</span> : null}
                  </button>
                </OpsPopover.Trigger>
                <OpsPopover.Portal container={portalContainer ?? undefined}>
                  <OpsPopover.Content sideOffset={8} align="end" className="shipments-filter-menu" collisionPadding={12}>
                    <label>Branch<select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="all">All branches</option>{data.accessible_branches.filter((item) => kcplBranches.includes(item)).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                    <label>Mode<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="all">All modes</option>{modes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                    <label>Owner<select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option value="all">All owners</option><option value="unassigned">Unassigned</option></select></label>
                    <label>Sort<select value={sort} onChange={(event) => setFilters({ sort: event.target.value === "priority" ? null : event.target.value })} ><option value="priority">Priority first</option><option value="updated">Recently updated</option></select></label>
                    <button type="button" aria-pressed={attention} onClick={() => setFilters({ attention: attention ? null : "1" })} className="shipments-attention-filter" data-active={attention || undefined}>
                      <AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/> Needs attention
                    </button>
                  </OpsPopover.Content>
                </OpsPopover.Portal>
              </OpsPopover.Root>
              {hasFilters ? <button type="button" className="shipments-reset" onClick={resetFilters}>Reset</button> : null}
              <span className="shipments-result-count">{filtered.length} of {data.jobs.length}</span>
            </div>
          </div>
        </OpsTabs.Root>

        {!filtered.length ? (
          <section className="ops-surface p-4" aria-label="Shipment register">
            <OpsEmptyState compact kind="search" title="No shipments" description={hasFilters ? "No shipments match the current filters." : "No shipment records are available in this scope."} action={hasFilters ? <OpsButton type="button" variant="secondary" onClick={resetFilters}>Clear filters</OpsButton> : undefined}/>
          </section>
        ) : view === "cards" ? (
          <ShipmentCards jobs={pageRows} selectedReference={selected?.reference ?? null} onSelect={setSelectedReference}/>
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
                        <td><span className="ops-mono text-xs font-medium text-[var(--admin-info)]">{job.reference}</span></td>
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
      </div>

      {selected ? <ShipmentPanel job={selected} returnTo={returnTo} container={portalContainer} onClose={() => setSelectedReference(null)}/> : null}
    </OpsPage>
  );
}

function ShipmentPanel({ job, returnTo, container, onClose }: { job: CommandCentreJob; returnTo: string; container: HTMLElement | null; onClose: () => void }) {
  const action = shipmentNextAction(job);
  const jobOwner = owner(job);
  const openException = job.status === "exception";
  const hasBlockingWork = openException || job.overdue_tasks > 0 || job.required_customs_open > 0 || jobOwner === "Unassigned";

  function withReturn(href: string) {
    const [path, hash] = href.split("#");
    return `${path}?returnTo=${encodeURIComponent(returnTo)}${hash ? `#${hash}` : ""}`;
  }

  return (
    <OpsDialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <OpsDialog.Portal container={container ?? undefined}>
        <OpsDialog.Overlay className="ops-dialog-overlay fixed inset-0 z-[70] cursor-default bg-black/15" />
        <OpsDialog.Content className="shipment-inspector fixed inset-y-0 right-0 z-[80] flex w-full flex-col overflow-hidden border-l border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-xl md:w-[480px]" aria-label={`Shipment ${job.reference}`}>
          <OpsDialog.Title className="sr-only">{job.reference} shipment details</OpsDialog.Title>
          <OpsDialog.Description className="sr-only">Review shipment status, readiness, route and the next permitted action.</OpsDialog.Description>
          <header className="shipment-inspector-header flex shrink-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
            <div className="min-w-0">
              <p className="ops-mono m-0 text-xs text-[var(--admin-muted)]">{job.reference} · {job.quote_reference}</p>
              <h2 className="mt-1 text-base font-semibold leading-6">{job.customer_name || "Customer not linked"}</h2>
              <p className="mt-0.5 text-sm text-[var(--admin-muted)]">{route(job)} · {job.mode || "Mode not set"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge>
              <OpsDialog.Close asChild>
                <button type="button" className="shipment-inspector-close" aria-label="Close shipment panel"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>
              </OpsDialog.Close>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {hasBlockingWork ? (
              <section className="border-b border-[var(--admin-line)] px-5 py-4">
                <div className="flex items-start gap-2 rounded-md border border-[var(--admin-line)] bg-[var(--admin-danger-bg)] px-3 py-2.5 text-[var(--admin-danger)]">
                  <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>
                  <div><strong className="block text-sm">Attention required</strong><span className="mt-0.5 block text-xs">{action.detail}</span></div>
                </div>
              </section>
            ) : null}

            <PanelSection title="Job status">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Detail label="Workflow status"><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></Detail>
                <Detail label="Priority"><OpsBadge tone={priorityTone(job.priority)}>{job.priority}</OpsBadge></Detail>
                <Detail label="Assigned to" warning={jobOwner === "Unassigned"}>{jobOwner}</Detail>
                <Detail label="Branch">{job.primary_branch}</Detail>
              </div>
            </PanelSection>

            <PanelSection title="Next action">
              <strong className="block text-sm font-semibold text-[var(--admin-ink)]">{action.title}</strong>
              <p className="mt-1 text-sm leading-5 text-[var(--admin-muted)]">{action.detail}</p>
            </PanelSection>

            <PanelSection title="Route">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Detail label="Origin">{job.origin || "—"}</Detail>
                <Detail label="Destination">{job.destination || "—"}</Detail>
                <Detail label="Current location">{job.current_location || "—"}</Detail>
                <Detail label="Mode">{job.mode || "—"}</Detail>
                <Detail label="ETA">{shortDate(job.eta)}</Detail>
                <Detail label="Carrier" warning={!job.carrier}>{job.carrier || "Not assigned"}</Detail>
              </div>
            </PanelSection>

            <PanelSection title="Readiness">
              <ReadinessRow label="Open work" value={job.open_tasks ? `${job.open_tasks} task${job.open_tasks === 1 ? "" : "s"}` : "Clear"} warning={job.overdue_tasks > 0}/>
              <ReadinessRow label="Customs" value={job.required_customs_open ? `${job.required_customs_open} open` : "Clear"} warning={job.required_customs_open > 0}/>
              <ReadinessRow label="Exception" value={openException ? "Open" : "None"} warning={openException}/>
              <ReadinessRow label="Owner" value={jobOwner} warning={jobOwner === "Unassigned"}/>
            </PanelSection>
          </div>

          <footer className="shipment-inspector-footer flex shrink-0 flex-wrap gap-2 border-t border-[var(--admin-line)] bg-[var(--admin-surface)] px-5 py-3">
            <Link href={withReturn(action.href)} className="ops-button flex-1" data-variant="primary" data-size="md">{action.title}</Link>
            <Link href={withReturn(`/admin/jobs/${encodeURIComponent(job.reference)}`)} className="ops-button" data-variant="secondary" data-size="md">Open shipment</Link>
          </footer>
        </OpsDialog.Content>
      </OpsDialog.Portal>
    </OpsDialog.Root>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-[var(--admin-line)] px-5 py-4"><h3 className="mb-3 text-xs font-semibold uppercase tracking-[.06em] text-[var(--admin-line-strong)]">{title}</h3>{children}</section>;
}

function Detail({ label, children, warning = false }: { label: string; children: React.ReactNode; warning?: boolean }) {
  return <div><p className="m-0 text-xs font-medium text-[var(--admin-muted)]">{label}</p><div className={`mt-0.5 text-sm ${warning ? "font-medium text-[var(--admin-danger)]" : "text-[var(--admin-ink)]"}`}>{children}</div></div>;
}

function ReadinessRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[var(--admin-line)] py-2.5 last:border-b-0"><span className="text-xs text-[var(--admin-muted)]">{label}</span><strong className={`text-right text-xs font-semibold ${warning ? "text-[var(--admin-danger)]" : "text-[var(--admin-ink)]"}`}>{value}</strong></div>;
}
