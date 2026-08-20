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
} from "lucide-react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import type { KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";

const statusStyle: Record<ShipmentStatus, string> = {
  booking_confirmed: "border-sky-200 bg-sky-50 text-sky-700",
  preparing: "border-amber-200 bg-amber-50 text-amber-800",
  in_transit: "border-indigo-200 bg-indigo-50 text-indigo-700",
  customs_clearance: "border-violet-200 bg-violet-50 text-violet-700",
  out_for_delivery: "border-cyan-200 bg-cyan-50 text-cyan-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  exception: "border-rose-200 bg-rose-50 text-rose-700",
};

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
      return [
        job.reference,
        job.quote_reference,
        job.customer_name,
        job.origin,
        job.destination,
        job.current_location ?? "",
        job.carrier ?? "",
        job.assigned_to_name ?? "",
        job.assigned_to_email ?? "",
        job.primary_branch,
        ...job.handling_branches,
      ].join(" ").toLowerCase().includes(needle);
    }).sort((a, b) => attentionScore(b) - attentionScore(a) || b.updated_at.localeCompare(a.updated_at));
  }, [branch, data.jobs, data.operational_date, focus, query, status]);

  const attention = data.jobs.filter((job) => attentionScore(job) > 0).length;
  const customs = data.jobs.filter((job) => job.required_customs_open > 0).length;
  const today = data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).length;
  const unassigned = data.jobs.filter((job) => !job.assigned_to_name && !job.assigned_to_email).length;

  return (
    <main className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
      <header className="border-b border-[#dfe3e8] bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Operations</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-.035em]">Shipments</h1>
              <p className="mt-1 text-xs text-[#7d8791]">Active operational movements · {roleLabel}</p>
            </div>
            <Link href="/admin/command-centre" className="text-xs font-semibold text-[#775b2c] hover:underline">Back to Operations Home</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <section className="grid gap-px overflow-hidden rounded-xl border border-[#dfe3e8] bg-[#dfe3e8] sm:grid-cols-2 xl:grid-cols-5">
          <MetricButton active={focus === "active"} onClick={() => setFocus("active")} label="Active shipments" value={data.jobs.length} icon={<PackageCheck size={15}/>} />
          <MetricButton active={focus === "attention"} onClick={() => setFocus("attention")} label="Needs attention" value={attention} icon={<AlertTriangle size={15}/>} danger={attention > 0} />
          <MetricButton active={focus === "customs"} onClick={() => setFocus("customs")} label="Customs blockers" value={customs} icon={<ShieldAlert size={15}/>} danger={customs > 0} />
          <MetricButton active={focus === "today"} onClick={() => setFocus("today")} label="Due today" value={today} icon={<CalendarDays size={15}/>} />
          <MetricButton active={focus === "unassigned"} onClick={() => setFocus("unassigned")} label="Unassigned" value={unassigned} icon={<UserRound size={15}/>} danger={unassigned > 0} />
        </section>

        <section className="mt-4 overflow-hidden rounded-xl border border-[#dfe3e8] bg-white">
          <div className="border-b border-[#e7eaed] p-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(300px,1fr)_210px_210px_auto]">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 focus-within:border-[#aa8748] focus-within:bg-white"><Search size={15} className="text-[#8e979f]"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search shipment, customer, route, carrier or staff"/></label>
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3"><Filter size={14} className="text-[#8e979f]"/><select value={status} onChange={(event) => setStatus(event.target.value as "all" | ShipmentStatus)} className="w-full bg-transparent text-xs font-semibold outline-none"><option value="all">All statuses</option>{shipmentStatuses.filter((item) => item !== "delivered").map((item) => <option value={item} key={item}>{shipmentStatusLabels[item]}</option>)}</select></label>
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3"><Landmark size={14} className="text-[#8e979f]"/><select value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)} className="w-full bg-transparent text-xs font-semibold outline-none"><option value="all">All accessible branches</option>{data.accessible_branches.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
              <div className="flex items-center justify-end gap-2 text-xs text-[#7c8790]"><strong className="text-[#10263f]">{filtered.length}</strong> shown{focus !== "active" || status !== "all" || branch !== "all" || query ? <button type="button" onClick={() => { setFocus("active"); setStatus("all"); setBranch("all"); setQuery(""); }} className="ml-2 font-semibold text-[#7c5e2d] hover:underline">Reset</button> : null}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-xs">
              <thead className="bg-[#f8f9fa] text-[9px] font-bold uppercase tracking-[.1em] text-[#8a949d]"><tr><th className="px-4 py-3">Shipment</th><th className="px-3 py-3">Customer & route</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Current location</th><th className="px-3 py-3">Branch</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">ETA</th><th className="px-3 py-3">Open work</th><th className="px-3 py-3"></th></tr></thead>
              <tbody className="divide-y divide-[#edf0f2]">
                {filtered.length ? filtered.map((job) => <ShipmentRow key={job.reference} job={job}/>) : <tr><td colSpan={9} className="p-10 text-center text-sm text-[#8b949c]">No shipments match the current filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricButton({ active, onClick, label, value, icon, danger = false }: { active: boolean; onClick: () => void; label: string; value: number; icon: React.ReactNode; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`bg-white p-4 text-left transition hover:bg-[#fafbfb] ${active ? "shadow-[inset_0_-3px_0_#b78a3e]" : ""}`}><div className={`flex items-center gap-2 ${danger ? "text-rose-600" : "text-[#87919a]"}`}>{icon}<span className="text-[9px] font-bold uppercase tracking-[.1em]">{label}</span></div><p className={`mt-1.5 text-xl font-bold ${danger ? "text-rose-700" : "text-[#10263f]"}`}>{value}</p></button>;
}

function ShipmentRow({ job }: { job: CommandCentreJob }) {
  const attention = attentionScore(job) > 0;
  const owner = job.assigned_to_name || job.assigned_to_email || "Unassigned";
  const work = job.overdue_tasks > 0 ? `${job.overdue_tasks} overdue` : job.required_customs_open > 0 ? `${job.required_customs_open} customs` : job.open_tasks > 0 ? `${job.open_tasks} tasks` : "Clear";
  return (
    <tr className="group hover:bg-[#fafbfb]">
      <td className="px-4 py-3.5"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${attention ? "bg-rose-500" : "bg-emerald-500"}`}/><div><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="font-bold text-[#10263f] hover:underline">{job.reference}</Link><p className="mt-0.5 text-[9px] text-[#9aa2a9]">Quote {job.quote_reference || "—"}</p></div></div></td>
      <td className="px-3 py-3.5"><strong className="block max-w-[220px] truncate text-[#344556]">{job.customer_name}</strong><p className="mt-1 max-w-[240px] truncate text-[10px] text-[#7c8790]">{job.origin || "Origin?"} → {job.destination || "Destination?"}</p></td>
      <td className="px-3 py-3.5"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyle[job.status]}`}>{shipmentStatusLabels[job.status]}</span></td>
      <td className="px-3 py-3.5"><span className="flex max-w-[180px] items-center gap-1.5 truncate text-[#52606d]"><MapPin size={12} className="shrink-0 text-[#9b7a40]"/>{job.current_location || "Not set"}</span>{job.carrier ? <p className="mt-1 max-w-[180px] truncate text-[9px] text-[#9aa2a9]">{job.carrier}</p> : null}</td>
      <td className="px-3 py-3.5"><strong className="text-[#52606d]">{job.primary_branch}</strong>{job.handling_branches.length > 1 ? <p className="mt-1 text-[9px] text-[#9aa2a9]">+{job.handling_branches.length - 1} handling</p> : null}</td>
      <td className="px-3 py-3.5"><span className={`text-[#52606d] ${owner === "Unassigned" ? "font-bold text-rose-700" : ""}`}>{owner}</span></td>
      <td className="px-3 py-3.5"><span className="text-[#52606d]">{dateOnly(job.eta)}</span></td>
      <td className="px-3 py-3.5"><span className={`inline-flex items-center gap-1.5 ${work === "Clear" ? "text-emerald-700" : attention ? "font-bold text-rose-700" : "text-amber-700"}`}><ClipboardList size={12}/>{work}</span></td>
      <td className="px-3 py-3.5 text-right"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe3e8] text-[#6f7a83] transition hover:border-[#b78a3e] hover:text-[#10263f]" aria-label={`Open ${job.reference}`}><ArrowUpRight size={13}/></Link><p className="mt-1 text-[8px] text-[#a4abb1]">{dateTime(job.updated_at)}</p></td>
    </tr>
  );
}
