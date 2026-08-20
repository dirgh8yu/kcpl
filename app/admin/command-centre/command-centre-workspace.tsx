"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Landmark,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  UsersRound,
} from "lucide-react";
import { shipmentStatusLabels } from "../../shipment-types";
import { jobPriorityLabels } from "../job-file";
import type { KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";

const statusStyle: Record<string, string> = {
  booking_confirmed: "border-sky-200 bg-sky-50 text-sky-700",
  preparing: "border-indigo-200 bg-indigo-50 text-indigo-700",
  in_transit: "border-violet-200 bg-violet-50 text-violet-700",
  customs_clearance: "border-amber-200 bg-amber-50 text-amber-800",
  out_for_delivery: "border-cyan-200 bg-cyan-50 text-cyan-700",
  exception: "border-rose-200 bg-rose-50 text-rose-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function dateOnly(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function attentionScore(job: CommandCentreJob) {
  return (job.status === "exception" ? 100 : 0) +
    (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) +
    job.overdue_tasks * 10 + job.required_customs_open * 4 +
    (!job.assigned_to_name && !job.assigned_to_email ? 3 : 0);
}

export function CommandCentreWorkspace({ data, roleLabel }: { data: CommandCentreData; roleLabel: string }) {
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [focus, setFocus] = useState<"all" | "attention" | "today" | "unassigned">("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.jobs.filter((job) => {
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch)) return false;
      if (focus === "attention" && attentionScore(job) === 0) return false;
      if (focus === "today" && job.eta?.slice(0, 10) !== data.operational_date) return false;
      if (focus === "unassigned" && (job.assigned_to_name || job.assigned_to_email)) return false;
      if (!needle) return true;
      return [job.reference, job.customer_name, job.origin, job.destination, job.current_location ?? "", job.carrier ?? "", job.assigned_to_name ?? "", job.assigned_to_email ?? "", ...job.handling_branches]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [branch, data.jobs, data.operational_date, focus, query]);

  const attention = data.jobs.filter((job) => attentionScore(job) > 0).slice(0, 8);
  const today = data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).slice(0, 8);

  return (
    <main className="min-h-screen bg-[#f3f0e7] text-[#10263f]">
      <header className="bg-[#091624] px-5 py-6 text-white lg:px-8">
        <div className="mx-auto max-w-[1700px]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <Link href="/admin" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 transition hover:bg-white/10 hover:text-white"><ArrowLeft size={16}/></Link>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Operations</p>
                <h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Command Centre</h1>
                <p className="mt-2 text-xs text-white/45">Live operational view · Nepal date {dateOnly(data.operational_date)} · {roleLabel}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[.1em] text-white/55">{data.accessible_branches.length === 6 ? "All branches" : data.accessible_branches.join(" · ")}</span>
              <button type="button" onClick={() => window.location.reload()} className="flex items-center gap-2 rounded-xl bg-[#d4ad62] px-4 py-2.5 text-[10px] font-black uppercase tracking-[.1em] text-[#10263f]"><RefreshCw size={13}/>Refresh</button>
            </div>
          </div>
        </div>
      </header>

      <section className="bg-[#10263f] px-5 pb-6 text-white lg:px-8">
        <div className="mx-auto grid max-w-[1700px] grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Metric label="Active jobs" value={data.totals.active_jobs} icon={<BriefcaseBusiness size={15}/>} />
          <Metric label="Urgent" value={data.totals.urgent_jobs} icon={<AlertTriangle size={15}/>} danger={data.totals.urgent_jobs > 0} />
          <Metric label="Overdue tasks" value={data.totals.overdue_tasks} icon={<Clock3 size={15}/>} danger={data.totals.overdue_tasks > 0} />
          <Metric label="Customs blockers" value={data.totals.customs_blockers} icon={<ShieldAlert size={15}/>} danger={data.totals.customs_blockers > 0} />
          <Metric label="Due today" value={data.totals.deliveries_today} icon={<PackageCheck size={15}/>} accent />
          <Metric label="Unassigned" value={data.totals.unassigned_jobs} icon={<UserRound size={15}/>} danger={data.totals.unassigned_jobs > 0} />
          <Metric label="Exceptions" value={data.totals.exception_jobs} icon={<CircleAlert size={15}/>} danger={data.totals.exception_jobs > 0} />
        </div>
      </section>

      <div className="mx-auto max-w-[1700px] space-y-6 p-5 lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <Panel title="Needs attention" eyebrow="Priority queue" detail="Exceptions, urgent jobs, overdue work, customs blockers and unassigned movements rise here automatically." icon={<AlertTriangle size={18}/>}>
            <div className="space-y-3">{attention.length ? attention.map((job) => <AttentionRow key={job.reference} job={job}/>) : <GoodState text="No active jobs currently need escalation."/>}</div>
          </Panel>

          <Panel title="Today's movement" eyebrow="ETA watch" detail={`Jobs with an ETA on ${dateOnly(data.operational_date)}.`} icon={<CalendarClock size={18}/>}>
            <div className="space-y-3">{today.length ? today.map((job) => <CompactJob key={job.reference} job={job}/>) : <GoodState text="No active jobs are due today."/>}</div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Branch pressure" eyebrow="Network load" detail="Active movements and operational friction across the branches you can access." icon={<Landmark size={18}/>}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.branch_load.map((item) => <div key={item.branch} className="rounded-2xl border border-black/10 bg-[#faf9f5] p-4">
              <div className="flex items-center justify-between gap-3"><strong className="text-sm">{item.branch}</strong><span className="rounded-full bg-[#10263f] px-2.5 py-1 text-[9px] font-black text-white">{item.active_jobs} jobs</span></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><Mini label="Urgent" value={item.urgent_jobs} warn={item.urgent_jobs > 0}/><Mini label="Overdue" value={item.overdue_tasks} warn={item.overdue_tasks > 0}/><Mini label="Customs" value={item.customs_blockers} warn={item.customs_blockers > 0}/><Mini label="Due today" value={item.deliveries_today}/></div>
            </div>)}</div>
          </Panel>

          <Panel title="Staff workload" eyebrow="Ownership" detail="Current job ownership and open operational tasks." icon={<UsersRound size={18}/>}>
            <div className="overflow-hidden rounded-2xl border border-black/10"><table className="w-full text-left text-xs"><thead className="bg-[#f7f5ee] text-[9px] font-black uppercase tracking-[.1em] text-black/35"><tr><th className="px-4 py-3">Staff</th><th className="px-3 py-3">Jobs</th><th className="px-3 py-3">Tasks</th><th className="px-3 py-3">Overdue</th><th className="px-3 py-3">Urgent</th></tr></thead><tbody className="divide-y divide-black/10">{data.staff_load.length ? data.staff_load.slice(0, 12).map((staff) => <tr key={staff.key}><td className="px-4 py-3"><strong>{staff.name}</strong>{staff.email ? <p className="mt-0.5 text-[9px] text-black/35">{staff.email}</p> : null}</td><td className="px-3 py-3 font-black">{staff.active_jobs}</td><td className="px-3 py-3">{staff.open_tasks}</td><td className={`px-3 py-3 font-black ${staff.overdue_tasks ? "text-rose-600" : "text-black/30"}`}>{staff.overdue_tasks}</td><td className={`px-3 py-3 font-black ${staff.urgent_jobs ? "text-amber-700" : "text-black/30"}`}>{staff.urgent_jobs}</td></tr>) : <tr><td colSpan={5} className="p-6 text-center text-black/40">No staff workload data yet.</td></tr>}</tbody></table></div>
          </Panel>
        </div>

        <Panel title="Active job board" eyebrow="All movements" detail={`${filtered.length} of ${data.jobs.length} active jobs shown. Open any row to work the Digital Job File.`} icon={<BriefcaseBusiness size={18}/>}>
          <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_220px_auto]">
            <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#faf9f5] px-3"><Search size={14} className="text-black/30"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent py-3 text-sm outline-none" placeholder="Search shipment, customer, route, staff, carrier…"/></label>
            <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#faf9f5] px-3"><Landmark size={14} className="text-black/30"/><select value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)} className="w-full bg-transparent py-3 text-xs font-bold outline-none"><option value="all">All accessible branches</option>{data.accessible_branches.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <div className="flex flex-wrap gap-2"><FilterButton active={focus === "all"} onClick={() => setFocus("all")} label="All"/><FilterButton active={focus === "attention"} onClick={() => setFocus("attention")} label="Attention"/><FilterButton active={focus === "today"} onClick={() => setFocus("today")} label="Due today"/><FilterButton active={focus === "unassigned"} onClick={() => setFocus("unassigned")} label="Unassigned"/></div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-black/10"><table className="min-w-[1100px] w-full text-left text-xs"><thead className="bg-[#f7f5ee] text-[9px] font-black uppercase tracking-[.1em] text-black/35"><tr><th className="px-4 py-3">Shipment</th><th className="px-3 py-3">Customer / route</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Branch</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">ETA</th><th className="px-3 py-3">Work</th></tr></thead><tbody className="divide-y divide-black/10">{filtered.length ? filtered.map((job) => <JobRow key={job.reference} job={job}/>) : <tr><td colSpan={7} className="p-8 text-center text-black/40">No jobs match the current filters.</td></tr>}</tbody></table></div>
        </Panel>

        <p className="text-right text-[9px] font-bold uppercase tracking-[.1em] text-black/25">Snapshot generated {dateTime(data.generated_at)}</p>
      </div>
    </main>
  );
}

function Metric({ label, value, icon, accent = false, danger = false }: { label: string; value: number; icon: React.ReactNode; accent?: boolean; danger?: boolean }) {
  const style = danger ? "border-rose-300/30 bg-rose-400/10" : accent ? "border-[#d4ad62]/35 bg-[#d4ad62]/10" : "border-white/10 bg-white/[.035]";
  return <div className={`rounded-2xl border p-4 ${style}`}><div className={danger ? "flex items-center gap-2 text-rose-200/70" : accent ? "flex items-center gap-2 text-[#e0bd79]/70" : "flex items-center gap-2 text-white/35"}>{icon}<span className="text-[8px] font-black uppercase tracking-[.12em]">{label}</span></div><p className={danger ? "mt-2 text-2xl font-black text-rose-100" : accent ? "mt-2 text-2xl font-black text-[#e0bd79]" : "mt-2 text-2xl font-black"}>{value}</p></div>;
}

function Panel({ title, eyebrow, detail, icon, children }: { title: string; eyebrow: string; detail: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-7"><div className="mb-5 flex items-start gap-3"><span className="rounded-xl bg-[#10263f] p-2.5 text-white">{icon}</span><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#b78a3e]">{eyebrow}</p><h2 className="mt-1 text-xl font-black tracking-[-.03em]">{title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-black/45">{detail}</p></div></div>{children}</section>;
}

function GoodState({ text }: { text: string }) { return <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-800"><CheckCircle2 size={18}/>{text}</div>; }
function Mini({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) { return <div className={warn ? "rounded-xl bg-rose-50 p-2.5 text-rose-700" : "rounded-xl bg-white p-2.5 text-black/55"}><p className="text-[8px] font-black uppercase tracking-[.08em] opacity-55">{label}</p><p className="mt-1 text-base font-black">{value}</p></div>; }
function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={active ? "rounded-xl bg-[#10263f] px-3 py-2.5 text-[10px] font-black text-white" : "rounded-xl border border-black/10 bg-[#faf9f5] px-3 py-2.5 text-[10px] font-black text-black/45"}>{label}</button>; }

function AttentionRow({ job }: { job: CommandCentreJob }) {
  const reasons = [job.status === "exception" ? "Exception" : "", job.priority === "urgent" ? "Urgent" : job.priority === "high" ? "High priority" : "", job.overdue_tasks ? `${job.overdue_tasks} overdue` : "", job.required_customs_open ? `${job.required_customs_open} customs open` : "", !job.assigned_to_name && !job.assigned_to_email ? "Unassigned" : ""].filter(Boolean);
  return <Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="block rounded-2xl border border-black/10 bg-[#faf9f5] p-4 transition hover:-translate-y-0.5 hover:border-[#b78a3e]/40 hover:shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-sm">{job.reference}</strong><p className="mt-1 text-xs text-black/45">{job.customer_name} · {job.origin || "Origin"} → {job.destination || "Destination"}</p></div><span className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[.08em] ${statusStyle[job.status] ?? "border-black/10 bg-white"}`}>{shipmentStatusLabels[job.status]}</span></div><div className="mt-3 flex flex-wrap gap-2">{reasons.map((reason) => <span key={reason} className="rounded-full bg-rose-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.06em] text-rose-700">{reason}</span>)}</div></Link>;
}

function CompactJob({ job }: { job: CommandCentreJob }) { return <Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex items-start justify-between gap-4 rounded-2xl border border-black/10 p-4 transition hover:bg-[#faf9f5]"><div><strong className="text-sm">{job.customer_name}</strong><p className="mt-1 text-xs text-black/45">{job.origin || "Origin"} → {job.destination || "Destination"}</p><p className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-black/35"><MapPin size={10}/>{job.current_location || "Location not updated"}</p></div><div className="text-right"><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${statusStyle[job.status] ?? ""}`}>{shipmentStatusLabels[job.status]}</span><p className="mt-2 text-[9px] font-bold text-black/35">{job.primary_branch}</p></div></Link>; }

function JobRow({ job }: { job: CommandCentreJob }) {
  return <tr className="transition hover:bg-[#faf9f5]"><td className="px-4 py-4"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="font-black text-[#10263f] hover:underline">{job.reference}</Link><p className="mt-1 text-[9px] font-bold text-black/30">{jobPriorityLabels[job.priority]}</p></td><td className="px-3 py-4"><strong>{job.customer_name}</strong><p className="mt-1 text-[10px] text-black/40">{job.origin || "Origin"} → {job.destination || "Destination"}</p></td><td className="px-3 py-4"><span className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[.06em] ${statusStyle[job.status] ?? ""}`}>{shipmentStatusLabels[job.status]}</span></td><td className="px-3 py-4"><strong>{job.primary_branch}</strong><p className="mt-1 text-[9px] text-black/35">{job.handling_branches.length} handling</p></td><td className="px-3 py-4">{job.assigned_to_name || job.assigned_to_email || <span className="font-black text-rose-600">Unassigned</span>}</td><td className="px-3 py-4"><strong>{dateOnly(job.eta)}</strong><p className="mt-1 text-[9px] text-black/35">{job.current_location || "No location"}</p></td><td className="px-3 py-4"><div className="flex flex-wrap gap-1.5">{job.overdue_tasks ? <span className="rounded-full bg-rose-50 px-2 py-1 text-[8px] font-black text-rose-700">{job.overdue_tasks} overdue</span> : null}{job.required_customs_open ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black text-amber-800">{job.required_customs_open} customs</span> : null}{!job.overdue_tasks && !job.required_customs_open ? <span className="text-[9px] font-bold text-emerald-600">On track</span> : null}</div></td></tr>;
}
