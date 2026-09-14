"use client";

import Link from "next/link";
import { useMemo } from "react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";
import { compareShipmentPriority, shipmentNeedsAttention, shipmentNextAction } from "./shipment-queue-policy";
import { useWorkspaceQuery } from "../use-workspace-query";
import { OpsBadge, OpsButton, OpsEmptyState, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsTableWrap, OpsToolbar } from "../operations-ui";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

function statusTone(status: ShipmentStatus): StatusTone {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance" || status === "out_for_delivery") return "warning";
  if (status === "in_transit" || status === "booking_confirmed") return "info";
  return "neutral";
}

function shortDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: value.length === 10 ? "UTC" : NEPAL_TIME_ZONE }).format(date);
}

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || (job.assigned_to_uid ? "Assigned staff" : "Unassigned");
}


function route(job: CommandCentreJob) {
  return `${job.origin || "Origin"} → ${job.destination || "Destination"}`;
}

function modeOptions(jobs: CommandCentreJob[]) {
  return [...new Set(jobs.map((job) => job.mode.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function ShipmentsWorkspace({ data, roleLabel }: { data: CommandCentreData; roleLabel: string }) {
  const { params, search, update } = useWorkspaceQuery();
  const query = params.get("q") ?? "";
  const requestedStatus = params.get("status") ?? "active";
  const status = ["active", "all", ...shipmentStatuses].includes(requestedStatus) ? requestedStatus : "active";
  const requestedBranch = params.get("branch") ?? "all";
  const branch = data.accessible_branches.includes(requestedBranch as KcplBranch) ? requestedBranch : "all";
  const requestedMode = params.get("mode") ?? "all";
  const mode = data.jobs.some((job) => job.mode === requestedMode) ? requestedMode : "all";
  const attention = params.get("attention") === "1";
  const sort = params.get("sort") === "updated" ? "updated" : "priority";
  const selectedReference = params.get("selected");
  const pageSize = 50;
  const requestedPage = Number(params.get("page") || "1");
  const setFilters = (values: Record<string, string | null>) => update({ ...values, page: null, selected: null });
  const setQuery = (value: string) => setFilters({ q: value });
  const setStatus = (value: string) => setFilters({ status: value === "active" ? null : value });
  const setBranch = (value: string) => setFilters({ branch: value === "all" ? null : value });
  const setMode = (value: string) => setFilters({ mode: value === "all" ? null : value });
  const setSelectedReference = (value: string) => update({ selected: value });

  const modes = useMemo(() => modeOptions(data.jobs), [data.jobs]);
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.jobs.filter((job) => {
      if (status !== "all" && status !== "active" && job.status !== status) return false;
      if (status === "active" && job.status === "delivered") return false;
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch as KcplBranch)) return false;
      if (attention && !shipmentNeedsAttention(job)) return false;
      if (mode !== "all" && job.mode !== mode) return false;
      if (!terms.length) return true;
      const haystack = [job.reference, job.quote_reference, job.customer_name, job.origin, job.destination, job.mode, job.carrier ?? "", owner(job), shipmentStatusLabels[job.status]].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort(sort === "priority" ? compareShipmentPriority : (a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0) || a.reference.localeCompare(b.reference));
  }, [attention, branch, data.jobs, mode, query, sort, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const selected = (selectedReference ? pageRows.find((job) => job.reference === selectedReference) : null) || pageRows[0] || null;
  // Counts respect the same branch/mode/query scope; each metric selects its own state.
  const metricScope = data.jobs.filter((job) => {
    if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch as KcplBranch)) return false;
    if (mode !== "all" && job.mode !== mode) return false;
    if (attention && !shipmentNeedsAttention(job)) return false;
    const haystack = [job.reference, job.quote_reference, job.customer_name, job.origin, job.destination, job.mode, job.carrier ?? "", owner(job), shipmentStatusLabels[job.status]].join(" ").toLowerCase();
    return query.trim().toLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
  });
  const active = metricScope.filter((job) => job.status !== "delivered").length;
  const inTransit = metricScope.filter((job) => job.status === "in_transit").length;
  const customs = metricScope.filter((job) => job.status === "customs_clearance").length;
  const delivery = metricScope.filter((job) => job.status === "out_for_delivery").length;
  const exceptions = metricScope.filter((job) => job.status === "exception").length;
  const returnTo = `/admin/shipments${search}`;

  function resetFilters() {
    update({ q: null, status: null, branch: null, mode: null, attention: null, sort: null, page: null, selected: null });
  }

  return (
    <OpsPage className="shipments-register">
      <OpsPageHeader
        eyebrow="Operations · Shipment register"
        title="Shipments"
        description="Select a shipment to inspect its next action. Exceptions and overdue work appear first."
        meta={<span>{roleLabel} · {filtered.length} shown</span>}
        actions={<Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations overview</Link>}
      >
        <OpsStatStrip className="shipments-stat-strip">
          <OpsStat active={status === "active"} onClick={() => setStatus("active")} label="Active" value={active} detail="Open movements"/>
          <OpsStat active={status === "in_transit"} onClick={() => setStatus("in_transit")} label="In transit" value={inTransit} detail="Freight moving" tone="info"/>
          <OpsStat active={status === "customs_clearance"} onClick={() => setStatus("customs_clearance")} label="Customs" value={customs} detail="Clearance activity" tone={customs ? "warning" : "neutral"}/>
          <OpsStat active={status === "out_for_delivery"} onClick={() => setStatus("out_for_delivery")} label="Delivery" value={delivery} detail="Final mile" tone="info"/>
          <OpsStat active={status === "exception"} onClick={() => setStatus("exception")} label="Exceptions" value={exceptions} detail="Requires review" tone={exceptions ? "danger" : "neutral"}/>
        </OpsStatStrip>
      </OpsPageHeader>

      <div className="ops-content ops-content-wide shipments-register-content">
        {data.partial ? <OpsNotice tone="warning">This snapshot reached a loading limit. Counts may be incomplete; confirm readiness in the shipment record.</OpsNotice> : null}
        <OpsToolbar className="shipments-toolbar">
          <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, quote, customer, route or carrier" aria-label="Search shipments"/>
          <select aria-label="Filter by shipment state" value={status} onChange={(event) => setStatus(event.target.value as "active" | "all" | ShipmentStatus)} className="shipments-filter"><option value="active">Active</option><option value="all">All states</option>{shipmentStatuses.map((item) => <option key={item} value={item}>{shipmentStatusLabels[item]}</option>)}</select>
          <select aria-label="Filter by branch" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)} className="shipments-filter"><option value="all">All branches</option>{data.accessible_branches.filter((item) => kcplBranches.includes(item)).map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Filter by freight mode" value={mode} onChange={(event) => setMode(event.target.value)} className="shipments-filter"><option value="all">All modes</option>{modes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Sort shipments" className="shipments-filter" value={sort} onChange={(event) => setFilters({ sort: event.target.value === "priority" ? null : event.target.value })}><option value="priority">Priority first</option><option value="updated">Recently updated</option></select>
          <OpsButton aria-pressed={attention} variant={attention ? "primary" : "secondary"} onClick={() => setFilters({ attention: attention ? null : "1" })}>Needs attention</OpsButton>
          <OpsButton type="button" variant="ghost" onClick={resetFilters}>Reset</OpsButton>
          <span className="shipments-result-count" aria-live="polite">{filtered.length} shipment{filtered.length === 1 ? "" : "s"}</span>
        </OpsToolbar>

        <section className="shipments-register-grid" aria-label="Shipment register and selected shipment">
          <OpsTableWrap className="shipments-table-wrap">
            <table className="ops-table shipments-table" aria-label="Shipment register">
              <thead><tr><th>Shipment</th><th>Route</th><th>Customer</th><th>State</th><th>ETA</th><th>Owner</th></tr></thead>
              <tbody>{filtered.length ? pageRows.map((job) => {
                const chosen = selected?.reference === job.reference;
                return (
                  <tr
                    key={job.reference}
                    data-selected={chosen || undefined}
                    aria-label={`${job.reference}, ${shipmentStatusLabels[job.status]}, ${chosen ? "selected" : "select to inspect"}`}
                    tabIndex={0}
                    onClick={() => setSelectedReference(job.reference)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedReference(job.reference);
                      }
                    }}
                  >
                    <td><button type="button" className="shipment-select-button" onClick={(event) => { event.stopPropagation(); setSelectedReference(job.reference); }}>{job.reference}</button></td>
                    <td><span className="shipment-cell-muted">{job.origin || "—"} → {job.destination || "—"}</span></td>
                    <td><span className="shipment-cell-muted">{job.customer_name}</span></td>
                    <td><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></td>
                    <td><span className="shipment-cell-muted">{shortDate(job.eta)}</span></td>
                    <td><span className="shipment-cell-muted">{owner(job)}</span></td>
                  </tr>
                );
              }) : <tr><td colSpan={6}><OpsEmptyState compact kind="search" title="No shipments match this view" description="Change the filters or reset the workspace." action={<OpsButton type="button" variant="secondary" onClick={resetFilters}>Reset filters</OpsButton>}/></td></tr>}</tbody>
            </table>
          </OpsTableWrap>

          <aside className="shipment-peek-panel" aria-label="Selected shipment summary">
            {selected ? <ShipmentPeek job={selected} returnTo={returnTo}/> : <OpsEmptyState compact title="No shipment selected" description="Choose a shipment row to inspect its next action and readiness."/>}
          </aside>
        </section>
        <div className="ops-pagination" aria-label="Shipment pages"><span aria-live="polite">{filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}` : "0 shipments"}</span><div className="ops-pagination-actions"><OpsButton size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1), selected: null }, "push")}>Previous</OpsButton><span>Page {page} of {pageCount}</span><OpsButton size="sm" disabled={page >= pageCount} onClick={() => update({ page: String(page + 1), selected: null }, "push")}>Next</OpsButton></div></div>
      </div>
    </OpsPage>
  );
}

function ShipmentPeek({ job, returnTo }: { job: CommandCentreJob; returnTo: string }) {
  const action = shipmentNextAction(job);
  function withReturn(href: string) {
    const [path, hash] = href.split("#");
    return `${path}?returnTo=${encodeURIComponent(returnTo)}${hash ? `#${hash}` : ""}`;
  }
  const customs = job.required_customs_open > 0 ? `${job.required_customs_open} open` : "No open items in snapshot";
  const exception = job.status === "exception" ? "Open" : "None";
  return (
    <div className="shipment-peek">
      <div className="shipment-peek-head">
        <p className="shipment-peek-kicker">{job.reference}</p>
        <h2>{route(job)}</h2>
        <p>{job.customer_name} · {job.carrier || "Carrier not set"} · {job.mode || "Mode not set"}</p>
        <OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge>
      </div>

      <section className="shipment-peek-section" data-priority={job.status === "exception" || job.overdue_tasks > 0 ? "danger" : "normal"}>
        <p className="shipment-peek-label">Next action</p>
        <strong>{action.title}</strong>
        <p>{action.detail}</p>
      </section>

      <section className="shipment-peek-section">
        <p className="shipment-peek-label">Route</p>
        <strong>{job.origin || "Origin"} → {job.current_location ? `${job.current_location} → ` : ""}{job.destination || "Destination"}</strong>
        {job.current_location ? <p>Current · {job.current_location}</p> : null}
        <p>ETA · {shortDate(job.eta)}</p>
      </section>

      <section className="shipment-peek-section">
        <p className="shipment-peek-label">Readiness</p>
        <PeekRow label="Open work" value={job.open_tasks ? `${job.open_tasks} tasks` : "Clear"}/>
        <PeekRow label="Customs" value={customs} warning={job.required_customs_open > 0}/>
        <PeekRow label="POD" value="See delivery control"/>
        <PeekRow label="Exception" value={exception} warning={exception === "Open"}/>
        <PeekRow label="Owner" value={owner(job)}/>
      </section>

      <div className="shipment-peek-actions"><Link href={withReturn(action.href)} className="ops-button" data-variant="primary" data-size="md">{action.title}</Link><Link href={withReturn(`/admin/jobs/${encodeURIComponent(job.reference)}`)} className="ops-button" data-variant="secondary">Open shipment</Link><span>Select a row to inspect it; open the Job File when action is required.</span></div>
    </div>
  );
}

function PeekRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="shipment-peek-row"><span>{label}</span><strong data-warning={warning || undefined}>{value}</strong></div>;
}
