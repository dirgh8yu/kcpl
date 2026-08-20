"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Landmark,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { shipmentStatusLabels } from "../../shipment-types";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";

const statusStyle: Record<string, string> = {
  booking_confirmed: "border-sky-200 bg-sky-50 text-sky-700",
  preparing: "border-amber-200 bg-amber-50 text-amber-800",
  in_transit: "border-indigo-200 bg-indigo-50 text-indigo-700",
  customs_clearance: "border-violet-200 bg-violet-50 text-violet-700",
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
  const attention = [...data.jobs].filter((job) => attentionScore(job) > 0).sort((a, b) => attentionScore(b) - attentionScore(a)).slice(0, 10);
  const today = data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).slice(0, 7);
  const recent = [...data.jobs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);

  return (
    <main className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
      <header className="border-b border-[#dfe3e8] bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Operations</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-.035em]">Operations Home</h1>
              <p className="mt-1 text-xs text-[#7d8791]">Nepal operational date {dateOnly(data.operational_date)} · {roleLabel}</p>
            </div>
            <div className="flex items-center gap-2"><Link href="/admin/shipments" className="h-9 rounded-lg border border-[#dfe3e8] bg-white px-3 text-xs font-semibold leading-9 hover:bg-[#f7f8f9]">Open shipments</Link><button type="button" onClick={() => window.location.reload()} className="flex h-9 items-center gap-2 rounded-lg bg-[#10263f] px-3 text-xs font-semibold text-white hover:bg-[#183651]"><RefreshCw size={13}/>Refresh</button></div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <section className="grid gap-px overflow-hidden rounded-xl border border-[#dfe3e8] bg-[#dfe3e8] sm:grid-cols-2 xl:grid-cols-7">
          <Metric label="Active" value={data.totals.active_jobs} icon={<BriefcaseBusiness size={14}/>} />
          <Metric label="Urgent" value={data.totals.urgent_jobs} icon={<AlertTriangle size={14}/>} danger={data.totals.urgent_jobs > 0}/>
          <Metric label="Overdue tasks" value={data.totals.overdue_tasks} icon={<Clock3 size={14}/>} danger={data.totals.overdue_tasks > 0}/>
          <Metric label="Customs blockers" value={data.totals.customs_blockers} icon={<ShieldAlert size={14}/>} danger={data.totals.customs_blockers > 0}/>
          <Metric label="Due today" value={data.totals.deliveries_today} icon={<PackageCheck size={14}/>} />
          <Metric label="Unassigned" value={data.totals.unassigned_jobs} icon={<UserRound size={14}/>} danger={data.totals.unassigned_jobs > 0}/>
          <Metric label="Exceptions" value={data.totals.exception_jobs} icon={<AlertTriangle size={14}/>} danger={data.totals.exception_jobs > 0}/>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,.55fr)]">
          <Panel title="Needs attention" eyebrow="Priority queue" action={<Link href="/admin/shipments" className="text-xs font-semibold text-[#785c2d] hover:underline">View all shipments</Link>}>
            {attention.length ? (
              <div className="overflow-x-auto"><table className="min-w-[860px] w-full text-left text-xs"><thead className="border-b border-[#e8ebee] bg-[#f8f9fa] text-[9px] font-bold uppercase tracking-[.1em] text-[#8b949c]"><tr><th className="px-4 py-3">Shipment</th><th className="px-3 py-3">Customer / route</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Problem</th><th className="px-3 py-3"></th></tr></thead><tbody className="divide-y divide-[#edf0f2]">{attention.map((job) => <AttentionRow key={job.reference} job={job}/>)}</tbody></table></div>
            ) : <GoodState text="No active shipment currently needs escalation."/>}
          </Panel>

          <div className="space-y-4">
            <Panel title="Today's movement" eyebrow="ETA watch">
              {today.length ? <div className="divide-y divide-[#edf0f2]">{today.map((job) => <TodayRow key={job.reference} job={job}/>)}</div> : <GoodState text="No active shipment is due today."/>}
            </Panel>

            <Panel title="Quick access" eyebrow="Workspaces">
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1"><QuickLink href="/admin" label="New enquiries" detail="Review and price incoming freight enquiries"/><QuickLink href="/admin/shipments" label="Shipment queue" detail="Filter and work every active movement"/><QuickLink href="/admin/crm" label="Customers" detail="Open CRM and Customer 360 records"/></div>
            </Panel>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,.8fr)]">
          <Panel title="Branch pressure" eyebrow="Network load">
            <div className="overflow-x-auto"><table className="min-w-[650px] w-full text-left text-xs"><thead className="border-b border-[#e8ebee] bg-[#f8f9fa] text-[9px] font-bold uppercase tracking-[.1em] text-[#8b949c]"><tr><th className="px-4 py-3">Branch</th><th className="px-3 py-3">Active</th><th className="px-3 py-3">Urgent</th><th className="px-3 py-3">Overdue</th><th className="px-3 py-3">Customs</th><th className="px-3 py-3">Due today</th></tr></thead><tbody className="divide-y divide-[#edf0f2]">{data.branch_load.map((item) => <tr key={item.branch}><td className="px-4 py-3.5"><span className="flex items-center gap-2 font-semibold"><Landmark size={13} className="text-[#9a783d]"/>{item.branch}</span></td><td className="px-3 py-3.5 font-bold">{item.active_jobs}</td><td className={`px-3 py-3.5 font-bold ${item.urgent_jobs ? "text-rose-700" : "text-[#9aa2aa]"}`}>{item.urgent_jobs}</td><td className={`px-3 py-3.5 font-bold ${item.overdue_tasks ? "text-rose-700" : "text-[#9aa2aa]"}`}>{item.overdue_tasks}</td><td className={`px-3 py-3.5 font-bold ${item.customs_blockers ? "text-amber-700" : "text-[#9aa2aa]"}`}>{item.customs_blockers}</td><td className="px-3 py-3.5 font-bold">{item.deliveries_today}</td></tr>)}</tbody></table></div>
          </Panel>

          <Panel title="Staff workload" eyebrow="Ownership">
            <div className="overflow-x-auto"><table className="min-w-[520px] w-full text-left text-xs"><thead className="border-b border-[#e8ebee] bg-[#f8f9fa] text-[9px] font-bold uppercase tracking-[.1em] text-[#8b949c]"><tr><th className="px-4 py-3">Staff</th><th className="px-3 py-3">Jobs</th><th className="px-3 py-3">Tasks</th><th className="px-3 py-3">Overdue</th><th className="px-3 py-3">Urgent</th></tr></thead><tbody className="divide-y divide-[#edf0f2]">{data.staff_load.length ? data.staff_load.slice(0, 12).map((staff) => <tr key={staff.key}><td className="px-4 py-3.5"><strong className="block truncate">{staff.name}</strong>{staff.email ? <p className="mt-0.5 max-w-[180px] truncate text-[9px] text-[#9aa2aa]">{staff.email}</p> : null}</td><td className="px-3 py-3.5 font-bold">{staff.active_jobs}</td><td className="px-3 py-3.5">{staff.open_tasks}</td><td className={`px-3 py-3.5 font-bold ${staff.overdue_tasks ? "text-rose-700" : "text-[#9aa2aa]"}`}>{staff.overdue_tasks}</td><td className={`px-3 py-3.5 font-bold ${staff.urgent_jobs ? "text-amber-700" : "text-[#9aa2aa]"}`}>{staff.urgent_jobs}</td></tr>) : <tr><td colSpan={5} className="p-6 text-center text-[#8b949c]">No staff workload data yet.</td></tr>}</tbody></table></div>
          </Panel>
        </div>

        <div className="mt-4 rounded-xl border border-[#dfe3e8] bg-white px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8b949c]">Recently updated</p><div className="mt-2 flex flex-wrap gap-2">{recent.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="rounded-lg border border-[#e1e5e8] bg-[#fafbfb] px-2.5 py-1.5 text-[10px] font-semibold text-[#53616e] hover:border-[#b78a3e] hover:text-[#10263f]">{job.reference}</Link>)}</div></div><p className="text-[9px] text-[#a0a8af]">Snapshot generated {dateTime(data.generated_at)}</p></div></div>
      </div>
    </main>
  );
}

function Metric({ label, value, icon, danger = false }: { label: string; value: number; icon: React.ReactNode; danger?: boolean }) {
  return <div className="bg-white p-4"><div className={`flex items-center gap-2 ${danger ? "text-rose-600" : "text-[#8c969e]"}`}>{icon}<span className="text-[9px] font-bold uppercase tracking-[.1em]">{label}</span></div><p className={`mt-1.5 text-xl font-bold ${danger ? "text-rose-700" : "text-[#10263f]"}`}>{value}</p></div>;
}

function Panel({ title, eyebrow, action, children }: { title: string; eyebrow: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-[#dfe3e8] bg-white"><div className="flex items-center justify-between gap-3 border-b border-[#e8ebee] px-4 py-3.5"><div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8a6c36]">{eyebrow}</p><h2 className="mt-0.5 text-sm font-bold">{title}</h2></div>{action}</div>{children}</section>;
}

function AttentionRow({ job }: { job: CommandCentreJob }) {
  const issue = job.status === "exception" ? "Shipment exception" : job.overdue_tasks > 0 ? `${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}` : job.required_customs_open > 0 ? `${job.required_customs_open} customs blocker${job.required_customs_open === 1 ? "" : "s"}` : !job.assigned_to_name && !job.assigned_to_email ? "Unassigned" : `${job.priority} priority`;
  return <tr className="hover:bg-[#fafbfb]"><td className="px-4 py-3.5"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="font-bold hover:underline">{job.reference}</Link></td><td className="px-3 py-3.5"><strong className="block max-w-[200px] truncate text-[#42515e]">{job.customer_name}</strong><p className="mt-1 max-w-[220px] truncate text-[10px] text-[#8e979f]">{job.origin} → {job.destination}</p></td><td className="px-3 py-3.5"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyle[job.status]}`}>{shipmentStatusLabels[job.status]}</span></td><td className="px-3 py-3.5"><span className={`${job.assigned_to_name || job.assigned_to_email ? "text-[#56636f]" : "font-bold text-rose-700"}`}>{job.assigned_to_name || job.assigned_to_email || "Unassigned"}</span></td><td className="px-3 py-3.5 font-semibold text-rose-700">{issue}</td><td className="px-3 py-3.5 text-right"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe3e8] text-[#68747e] hover:border-[#b78a3e]"><ArrowUpRight size={13}/></Link></td></tr>;
}

function TodayRow({ job }: { job: CommandCentreJob }) {
  return <Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex items-start justify-between gap-3 px-4 py-3.5 transition hover:bg-[#fafbfb]"><div className="min-w-0"><strong className="block truncate text-xs">{job.reference}</strong><p className="mt-1 truncate text-[10px] text-[#7e8992]">{job.customer_name}</p><p className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-[#9a783d]"><CalendarDays size={11}/>{job.current_location || job.primary_branch}</p></div><div className="text-right"><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${statusStyle[job.status]}`}>{shipmentStatusLabels[job.status]}</span><p className="mt-2 text-[9px] text-[#929ba3]">ETA {dateOnly(job.eta)}</p></div></Link>;
}

function QuickLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return <Link href={href} className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e6e9] bg-[#fafbfb] p-3 transition hover:border-[#c5aa78] hover:bg-white"><div><strong className="text-xs">{label}</strong><p className="mt-1 text-[10px] leading-4 text-[#8a949c]">{detail}</p></div><ArrowUpRight size={13} className="shrink-0 text-[#9a783d]"/></Link>;
}

function GoodState({ text }: { text: string }) {
  return <div className="flex items-center gap-2 px-4 py-7 text-sm text-emerald-700"><CheckCircle2 size={16}/><span>{text}</span></div>;
}
