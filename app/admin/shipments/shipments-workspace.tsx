"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsTableWrap, OpsToolbar } from "../operations-ui";

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
  return job.assigned_to_name || job.assigned_to_email || "Unassigned";
}

function nextAction(job: CommandCentreJob) {
  if (job.status === "exception") return { title: "Review shipment exception", detail: "Movement is blocked until the exception is resolved." };
  if (job.overdue_tasks > 0) return { title: `Resolve ${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}`, detail: "Operational work is past its due time." };
  if (job.required_customs_open > 0) return { title: "Complete customs requirements", detail: `${job.required_customs_open} required customs item${job.required_customs_open === 1 ? " is" : "s are"} still open.` };
  if (!job.assigned_to_name && !job.assigned_to_email) return { title: "Assign shipment owner", detail: "This active movement currently has no operational owner." };
  if (job.open_tasks > 0) return { title: `Complete ${job.open_tasks} open task${job.open_tasks === 1 ? "" : "s"}`, detail: "Open the Job File for the current operational checklist." };
  return { title: "Review shipment record", detail: "No blocking task is exposed in the shipment register." };
}

function route(job: CommandCentreJob) {
  return `${job.origin || "Origin"} → ${job.destination || "Destination"}`;
}

function modeOptions(jobs: CommandCentreJob[]) {
  return [...new Set(jobs.map((job) => job.mode.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function ShipmentsWorkspace({ data, roleLabel }: { data: CommandCentreData; roleLabel: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "all" | ShipmentStatus>("active");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [mode, setMode] = useState("all");
  const [selectedReference, setSelectedReference] = useState<string | null>(null);

  const modes = useMemo(() => modeOptions(data.jobs), [data.jobs]);
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.jobs.filter((job) => {
      if (status !== "all" && status !== "active" && job.status !== status) return false;
      if (status === "active" && job.status === "delivered") return false;
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch)) return false;
      if (mode !== "all" && job.mode !== mode) return false;
      if (!terms.length) return true;
      const haystack = [job.reference, job.quote_reference, job.customer_name, job.origin, job.destination, job.mode, job.carrier ?? "", owner(job), shipmentStatusLabels[job.status]].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }, [branch, data.jobs, mode, query, status]);

  const selected = (selectedReference ? filtered.find((job) => job.reference === selectedReference) : null) || filtered[0] || null;
  const active = data.jobs.filter((job) => job.status !== "delivered").length;
  const inTransit = data.jobs.filter((job) => job.status === "in_transit").length;
  const customs = data.jobs.filter((job) => job.status === "customs_clearance").length;
  const delivery = data.jobs.filter((job) => job.status === "out_for_delivery").length;
  const exceptions = data.jobs.filter((job) => job.status === "exception").length;

  function resetFilters() {
    setQuery("");
    setStatus("active");
    setBranch("all");
    setMode("all");
  }

  return (
    <OpsPage className="shipments-register">
      <OpsPageHeader
        eyebrow="Operations · Shipment register"
        title="Shipments"
        description="Live shipment ownership, movement state, customs readiness and delivery commitments in one operational register."
        meta={<span>{roleLabel} · {filtered.length} shown</span>}
        actions={<Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations overview</Link>}
      >
        <OpsStatStrip className="shipments-stat-strip">
          <OpsStat label="Active" value={active} detail="Open movements"/>
          <OpsStat label="In transit" value={inTransit} detail="Freight moving" tone="info"/>
          <OpsStat label="Customs" value={customs} detail="Clearance activity" tone={customs ? "warning" : "neutral"}/>
          <OpsStat label="Delivery" value={delivery} detail="Final mile" tone="info"/>
          <OpsStat label="Exceptions" value={exceptions} detail="Requires review" tone={exceptions ? "danger" : "neutral"}/>
        </OpsStatStrip>
      </OpsPageHeader>

      <div className="ops-content ops-content-wide shipments-register-content">
        <OpsToolbar className="shipments-toolbar">
          <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, quote, customer, route or carrier" aria-label="Search shipments"/>
          <select aria-label="Filter by shipment state" value={status} onChange={(event) => setStatus(event.target.value as "active" | "all" | ShipmentStatus)} className="shipments-filter"><option value="active">Active</option><option value="all">All states</option>{shipmentStatuses.map((item) => <option key={item} value={item}>{shipmentStatusLabels[item]}</option>)}</select>
          <select aria-label="Filter by branch" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)} className="shipments-filter"><option value="all">All branches</option>{data.accessible_branches.filter((item) => kcplBranches.includes(item)).map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Filter by freight mode" value={mode} onChange={(event) => setMode(event.target.value)} className="shipments-filter"><option value="all">All modes</option>{modes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <OpsButton type="button" variant="secondary" onClick={resetFilters}>Reset</OpsButton>
          <span className="shipments-result-count" aria-live="polite">{filtered.length} shipment{filtered.length === 1 ? "" : "s"}</span>
        </OpsToolbar>

        <section className="shipments-register-grid" aria-label="Shipment register and selected shipment">
          <OpsTableWrap className="shipments-table-wrap">
            <table className="ops-table shipments-table" aria-label="Shipment register">
              <thead><tr><th>Shipment</th><th>Route</th><th>Customer</th><th>State</th><th>ETA</th><th>Owner</th></tr></thead>
              <tbody>{filtered.length ? filtered.map((job) => {
                const chosen = selected?.reference === job.reference;
                return (
                  <tr
                    key={job.reference}
                    data-selected={chosen || undefined}
                    aria-selected={chosen}
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
            {selected ? <ShipmentPeek job={selected}/> : <OpsEmptyState compact title="No shipment selected" description="Choose a shipment row to inspect its next action and readiness."/>}
          </aside>
        </section>
      </div>
    </OpsPage>
  );
}

function ShipmentPeek({ job }: { job: CommandCentreJob }) {
  const action = nextAction(job);
  const customs = job.required_customs_open > 0 ? `${job.required_customs_open} open` : "No blockers";
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

      <div className="shipment-peek-actions"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-button" data-variant="primary" data-size="md">Open shipment</Link><span>Select a row to inspect it; open the Job File when action is required.</span></div>
    </div>
  );
}

function PeekRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="shipment-peek-row"><span>{label}</span><strong data-warning={warning || undefined}>{value}</strong></div>;
}
