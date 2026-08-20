"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Filter,
  Landmark,
  MapPin,
  PackageCheck,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import type { KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";
import {
  OpsButton,
  OpsEmptyState,
  OpsFilterBar,
  OpsMetric,
  OpsMetricStrip,
  OpsPageHeader,
  OpsStatusBadge,
  OpsTableFrame,
} from "../operations-ui";

function dateOnly(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function dateTime(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function attentionScore(job: CommandCentreJob) {
  return (job.status === "exception" ? 100 : 0) +
    (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) +
    job.overdue_tasks * 10 + job.required_customs_open * 4 +
    (!job.assigned_to_name && !job.assigned_to_email ? 3 : 0);
}

function statusTone(status: ShipmentStatus): "neutral" | "info" | "success" | "warning" | "danger" | "accent" {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "preparing" || status === "customs_clearance") return "warning";
  if (status === "in_transit" || status === "out_for_delivery") return "accent";
  return "info";
}

type Focus = "active" | "attention" | "customs" | "today" | "unassigned";

export function ShipmentsWorkspace({ data, roleLabel }: { data: CommandCentreData; roleLabel: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ShipmentStatus>("all");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [focus, setFocus] = useState<Focus>("active");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.jobs.filter((job) => {
      if (status !== "all" && job.status !== status) return false;
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch)) return false;
      if (focus === "attention" && attentionScore(job) === 0) return false;
      if (focus === "customs" && job.required_customs_open === 0) return false;
      if (focus === "today" && job.eta?.slice(0, 10) !== data.operational_date) return false;
      if (focus === "unassigned" && (job.assigned_to_name || job.assigned_to_email)) return false;
      if (!needle) return true;
      return [job.reference, job.quote_reference, job.customer_name, job.origin, job.destination, job.current_location ?? "", job.carrier ?? "", job.assigned_to_name ?? "", job.assigned_to_email ?? "", job.primary_branch, ...job.handling_branches].join(" ").toLowerCase().includes(needle);
    }).sort((a, b) => attentionScore(b) - attentionScore(a) || b.updated_at.localeCompare(a.updated_at));
  }, [branch, data.jobs, data.operational_date, focus, query, status]);

  const attention = data.jobs.filter((job) => attentionScore(job) > 0).length;
  const customs = data.jobs.filter((job) => job.required_customs_open > 0).length;
  const today = data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).length;
  const unassigned = data.jobs.filter((job) => !job.assigned_to_name && !job.assigned_to_email).length;
  const filtersActive = focus !== "active" || status !== "all" || branch !== "all" || Boolean(query.trim());

  function reset() {
    setFocus("active");
    setStatus("all");
    setBranch("all");
    setQuery("");
  }

  return (
    <main>
      <OpsPageHeader
        eyebrow="Operations"
        title="Shipments"
        description="Work active movements from one dense queue. Exceptions and blockers stay visible without burying routine shipments."
        breadcrumbs={[{ label: "Operations", href: "/admin/command-centre" }, { label: "Shipments" }]}
        meta={<>{data.jobs.length} active shipment{data.jobs.length === 1 ? "" : "s"} · {roleLabel}</>}
        actions={<OpsButton href="/admin/command-centre">Operations Home</OpsButton>}
      />

      <div className="ops-page-body ops-stack">
        <OpsMetricStrip columns={5}>
          <OpsMetric active={focus === "active"} onClick={() => setFocus("active")} label="Active shipments" value={data.jobs.length} icon={<PackageCheck size={13}/>} />
          <OpsMetric active={focus === "attention"} onClick={() => setFocus("attention")} label="Needs attention" value={attention} icon={<AlertTriangle size={13}/>} tone={attention ? "danger" : "neutral"}/>
          <OpsMetric active={focus === "customs"} onClick={() => setFocus("customs")} label="Customs blockers" value={customs} icon={<ShieldAlert size={13}/>} tone={customs ? "warning" : "neutral"}/>
          <OpsMetric active={focus === "today"} onClick={() => setFocus("today")} label="Due today" value={today} icon={<CalendarDays size={13}/>} />
          <OpsMetric active={focus === "unassigned"} onClick={() => setFocus("unassigned")} label="Unassigned" value={unassigned} icon={<UserRound size={13}/>} tone={unassigned ? "warning" : "neutral"}/>
        </OpsMetricStrip>

        <OpsTableFrame
          toolbar={<OpsFilterBar
            count={<><strong className="font-semibold text-[#353b42]">{filtered.length}</strong> shown</>}
            reset={filtersActive ? <button type="button" onClick={reset} className="inline-flex items-center gap-1 font-medium text-[#5968bb] hover:underline"><X size={11}/>Clear filters</button> : null}
          >
            <label className="ops-search-field flex-1 lg:max-w-[430px]"><Search size={14} className="shrink-0 text-[#8b9299]"/><span className="sr-only">Search shipments</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, route, carrier or staff"/></label>
            <label className="ops-filter-control"><Filter size={13}/><span className="sr-only">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as "all" | ShipmentStatus)}><option value="all">All statuses</option>{shipmentStatuses.filter((item) => item !== "delivered").map((item) => <option value={item} key={item}>{shipmentStatusLabels[item]}</option>)}</select></label>
            <label className="ops-filter-control"><Landmark size={13}/><span className="sr-only">Branch</span><select value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)}><option value="all">All branches</option>{data.accessible_branches.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          </OpsFilterBar>}
          footer={<div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#8c939a]"><span>Sorted by operational attention, then most recently updated.</span><span>Nepal operational date {dateOnly(data.operational_date)}</span></div>}
        >
          <table className="ops-dense-table min-w-[1180px] text-left">
            <thead><tr><th className="px-4">Shipment</th><th className="px-3">Customer / route</th><th className="px-3">Status</th><th className="px-3">Current location</th><th className="px-3">Branch</th><th className="px-3">Owner</th><th className="px-3">ETA</th><th className="px-3">Open work</th><th className="w-14 px-3"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{filtered.length ? filtered.map((job) => <ShipmentRow key={job.reference} job={job}/>) : <tr><td colSpan={9}><OpsEmptyState title="No shipments match these filters" detail="Clear one or more filters, or search using a different shipment reference, customer, route, carrier or staff member." action={filtersActive ? <OpsButton tone="secondary" onClick={reset}>Clear filters</OpsButton> : undefined}/></td></tr>}</tbody>
          </table>
        </OpsTableFrame>
      </div>
    </main>
  );
}

function ShipmentRow({ job }: { job: CommandCentreJob }) {
  const needsAttention = attentionScore(job) > 0;
  const owner = job.assigned_to_name || job.assigned_to_email || "Unassigned";
  const work = job.overdue_tasks > 0 ? `${job.overdue_tasks} overdue` : job.required_customs_open > 0 ? `${job.required_customs_open} customs` : job.open_tasks > 0 ? `${job.open_tasks} tasks` : "Clear";
  const workTone = job.overdue_tasks > 0 ? "danger" : job.required_customs_open > 0 ? "warning" : job.open_tasks > 0 ? "info" : "success";

  return <tr>
    <td className="px-4"><div className="flex items-center gap-2.5"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${needsAttention ? "bg-[#b45a64]" : "bg-[#6a9579]"}`}/><div className="min-w-0"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-row-link">{job.reference}</Link><p className="mt-0.5 text-[9px] text-[#9ca2a8]">Quote {job.quote_reference || "—"}</p></div></div></td>
    <td className="px-3"><strong className="block max-w-[220px] truncate font-medium text-[#3f464e]">{job.customer_name}</strong><p className="mt-0.5 max-w-[250px] truncate text-[10px] text-[#828a92]">{job.origin || "Origin not set"} → {job.destination || "Destination not set"}</p></td>
    <td className="px-3"><OpsStatusBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsStatusBadge></td>
    <td className="px-3"><span className="flex max-w-[190px] items-center gap-1.5 truncate text-[#56606a]"><MapPin size={12} className="shrink-0 text-[#7d86ad]"/>{job.current_location || "Not set"}</span>{job.carrier ? <p className="mt-0.5 max-w-[190px] truncate text-[9px] text-[#9ca2a8]">{job.carrier}</p> : null}</td>
    <td className="px-3"><strong className="font-medium text-[#56606a]">{job.primary_branch}</strong>{job.handling_branches.length > 1 ? <p className="mt-0.5 text-[9px] text-[#9ca2a8]">+{job.handling_branches.length - 1} handling</p> : null}</td>
    <td className="px-3"><span className={owner === "Unassigned" ? "font-semibold text-[#9f5059]" : "text-[#56606a]"}>{owner}</span></td>
    <td className="px-3 text-[#56606a]">{dateOnly(job.eta)}</td>
    <td className="px-3"><OpsStatusBadge tone={workTone}><ClipboardList size={11} className="mr-1"/>{work}</OpsStatusBadge></td>
    <td className="px-3 text-right"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#858d96] hover:bg-[#f1f2f3] hover:text-[#3445a3]" aria-label={`Open ${job.reference}`} title={`Updated ${dateTime(job.updated_at)}`}><ArrowUpRight size={13}/></Link></td>
  </tr>;
}
