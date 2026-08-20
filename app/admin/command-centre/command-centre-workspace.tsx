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
import {
  OpsButton,
  OpsEmptyState,
  OpsMetric,
  OpsMetricStrip,
  OpsPageHeader,
  OpsPanel,
  OpsStatusBadge,
} from "../operations-ui";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";

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

function statusTone(status: CommandCentreJob["status"]): "neutral" | "info" | "success" | "warning" | "danger" | "accent" {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "preparing" || status === "customs_clearance") return "warning";
  if (status === "in_transit" || status === "out_for_delivery") return "accent";
  return "info";
}

export function CommandCentreWorkspace({ data, roleLabel }: { data: CommandCentreData; roleLabel: string }) {
  const attention = [...data.jobs].filter((job) => attentionScore(job) > 0).sort((a, b) => attentionScore(b) - attentionScore(a)).slice(0, 10);
  const today = data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).slice(0, 7);
  const recent = [...data.jobs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);

  return (
    <main>
      <OpsPageHeader
        eyebrow="KCPL Operations"
        title="Operations Home"
        description="A compact live view of shipment pressure, customs blockers, due movements and ownership across the network."
        breadcrumbs={[{ label: "Workspace" }, { label: "Operations Home" }]}
        meta={<>Nepal operational date <strong className="font-medium text-[#555d65]">{dateOnly(data.operational_date)}</strong> · {roleLabel}</>}
        actions={<><OpsButton href="/admin/shipments">Open shipments</OpsButton><OpsButton tone="primary" onClick={() => window.location.reload()}><RefreshCw size={13}/>Refresh</OpsButton></>}
      />

      <div className="ops-page-body ops-stack">
        <OpsMetricStrip columns={7}>
          <OpsMetric label="Active" value={data.totals.active_jobs} icon={<BriefcaseBusiness size={13}/>} />
          <OpsMetric label="Urgent" value={data.totals.urgent_jobs} icon={<AlertTriangle size={13}/>} tone={data.totals.urgent_jobs ? "danger" : "neutral"}/>
          <OpsMetric label="Overdue tasks" value={data.totals.overdue_tasks} icon={<Clock3 size={13}/>} tone={data.totals.overdue_tasks ? "danger" : "neutral"}/>
          <OpsMetric label="Customs blockers" value={data.totals.customs_blockers} icon={<ShieldAlert size={13}/>} tone={data.totals.customs_blockers ? "warning" : "neutral"}/>
          <OpsMetric label="Due today" value={data.totals.deliveries_today} icon={<PackageCheck size={13}/>} />
          <OpsMetric label="Unassigned" value={data.totals.unassigned_jobs} icon={<UserRound size={13}/>} tone={data.totals.unassigned_jobs ? "warning" : "neutral"}/>
          <OpsMetric label="Exceptions" value={data.totals.exception_jobs} icon={<AlertTriangle size={13}/>} tone={data.totals.exception_jobs ? "danger" : "neutral"}/>
        </OpsMetricStrip>

        <div className="ops-grid-2">
          <OpsPanel title="Needs attention" eyebrow="Priority queue" description="Operational exceptions are sorted before routine work." action={<Link href="/admin/shipments" className="text-[11px] font-medium text-[#5367d9] hover:underline">View all</Link>}>
            {attention.length ? <div className="overflow-x-auto">
              <table className="ops-dense-table min-w-[900px] text-left">
                <thead><tr><th className="px-4">Shipment</th><th className="px-3">Customer / route</th><th className="px-3">Status</th><th className="px-3">Owner</th><th className="px-3">Attention</th><th className="w-12 px-3"><span className="sr-only">Open</span></th></tr></thead>
                <tbody>{attention.map((job) => <AttentionRow key={job.reference} job={job}/>)}</tbody>
              </table>
            </div> : <OpsEmptyState compact title="Nothing needs escalation" detail="No active shipment currently has an exception, overdue task, customs blocker or ownership gap."/>}
          </OpsPanel>

          <div className="ops-stack">
            <OpsPanel title="Today's movement" eyebrow="ETA watch" description="Shipments with an ETA on the current Nepal operational date.">
              {today.length ? <div>{today.map((job) => <TodayRow key={job.reference} job={job}/>)}</div> : <OpsEmptyState compact title="No movement due today" detail="There are no active shipments with today's ETA."/>}
            </OpsPanel>

            <OpsPanel title="Quick access" eyebrow="Workspaces">
              <div className="grid gap-1 p-1.5">
                <QuickLink href="/admin" label="Enquiry desk" detail="Review, price and progress incoming quote enquiries"/>
                <QuickLink href="/admin/customs" label="Customs workspace" detail="Focus on declaration and clearance blockers"/>
                <QuickLink href="/admin/crm" label="Customer records" detail="Open CRM and Customer 360 histories"/>
              </div>
            </OpsPanel>
          </div>
        </div>

        <div className="ops-grid-even">
          <OpsPanel title="Branch pressure" eyebrow="Network load" description="Active work and exceptions by accessible branch.">
            <div className="overflow-x-auto"><table className="ops-dense-table min-w-[650px] text-left"><thead><tr><th className="px-4">Branch</th><th className="px-3">Active</th><th className="px-3">Urgent</th><th className="px-3">Overdue</th><th className="px-3">Customs</th><th className="px-3">Due today</th></tr></thead><tbody>{data.branch_load.map((item) => <tr key={item.branch}><td className="px-4"><span className="flex items-center gap-2 font-medium text-[#3d444c]"><Landmark size={13} className="text-[#6e78ad]"/>{item.branch}</span></td><td className="px-3 font-semibold">{item.active_jobs}</td><td className={`px-3 font-semibold ${item.urgent_jobs ? "text-[#9f5059]" : "text-[#9aa0a7]"}`}>{item.urgent_jobs}</td><td className={`px-3 font-semibold ${item.overdue_tasks ? "text-[#9f5059]" : "text-[#9aa0a7]"}`}>{item.overdue_tasks}</td><td className={`px-3 font-semibold ${item.customs_blockers ? "text-[#8b6938]" : "text-[#9aa0a7]"}`}>{item.customs_blockers}</td><td className="px-3 font-semibold">{item.deliveries_today}</td></tr>)}</tbody></table></div>
          </OpsPanel>

          <OpsPanel title="Staff workload" eyebrow="Ownership" description="Operational jobs and outstanding tasks by assignee.">
            <div className="overflow-x-auto"><table className="ops-dense-table min-w-[560px] text-left"><thead><tr><th className="px-4">Staff</th><th className="px-3">Jobs</th><th className="px-3">Tasks</th><th className="px-3">Overdue</th><th className="px-3">Urgent</th></tr></thead><tbody>{data.staff_load.length ? data.staff_load.slice(0, 12).map((staff) => <tr key={staff.key}><td className="px-4"><strong className="block max-w-[230px] truncate font-medium text-[#3e454d]">{staff.name}</strong>{staff.email ? <p className="mt-0.5 max-w-[230px] truncate text-[9px] text-[#9aa0a7]">{staff.email}</p> : null}</td><td className="px-3 font-semibold">{staff.active_jobs}</td><td className="px-3">{staff.open_tasks}</td><td className={`px-3 font-semibold ${staff.overdue_tasks ? "text-[#9f5059]" : "text-[#9aa0a7]"}`}>{staff.overdue_tasks}</td><td className={`px-3 font-semibold ${staff.urgent_jobs ? "text-[#8b6938]" : "text-[#9aa0a7]"}`}>{staff.urgent_jobs}</td></tr>) : <tr><td colSpan={5}><OpsEmptyState compact title="No workload data yet"/></td></tr>}</tbody></table></div>
          </OpsPanel>
        </div>

        <OpsPanel title="Recently updated" eyebrow="Latest activity" action={<span className="text-[9px] text-[#9aa0a7]">Snapshot {dateTime(data.generated_at)}</span>}>
          <div className="flex flex-wrap gap-1.5 p-3">{recent.length ? recent.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e5e8] bg-[#fafafa] px-2.5 py-1.5 text-[10px] font-medium text-[#59616a] hover:border-[#cbd1df] hover:bg-white hover:text-[#3445a3]">{job.reference}<ArrowUpRight size={11}/></Link>) : <span className="text-[11px] text-[#8d949b]">No recent shipment updates.</span>}</div>
        </OpsPanel>
      </div>
    </main>
  );
}

function AttentionRow({ job }: { job: CommandCentreJob }) {
  const issue = job.status === "exception" ? "Shipment exception" : job.overdue_tasks > 0 ? `${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}` : job.required_customs_open > 0 ? `${job.required_customs_open} customs blocker${job.required_customs_open === 1 ? "" : "s"}` : !job.assigned_to_name && !job.assigned_to_email ? "Unassigned" : `${job.priority} priority`;
  const issueTone = job.status === "exception" || job.overdue_tasks > 0 ? "danger" : "warning";
  return <tr><td className="px-4"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-row-link">{job.reference}</Link><p className="mt-0.5 text-[9px] text-[#9ba1a7]">{job.primary_branch}</p></td><td className="px-3"><strong className="block max-w-[210px] truncate font-medium text-[#434a52]">{job.customer_name}</strong><p className="mt-0.5 max-w-[240px] truncate text-[10px] text-[#858c94]">{job.origin} → {job.destination}</p></td><td className="px-3"><OpsStatusBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsStatusBadge></td><td className="px-3"><span className={job.assigned_to_name || job.assigned_to_email ? "text-[#59616a]" : "font-semibold text-[#9f5059]"}>{job.assigned_to_name || job.assigned_to_email || "Unassigned"}</span></td><td className="px-3"><OpsStatusBadge tone={issueTone}>{issue}</OpsStatusBadge></td><td className="px-3 text-right"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#858d96] hover:bg-[#f1f2f3] hover:text-[#3445a3]" aria-label={`Open ${job.reference}`}><ArrowUpRight size={13}/></Link></td></tr>;
}

function TodayRow({ job }: { job: CommandCentreJob }) {
  return <Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="group flex items-center justify-between gap-3 border-b border-[#eceef0] px-4 py-3 last:border-b-0 hover:bg-[#fafbfc]"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate text-[11px] font-semibold text-[#3b4249]">{job.reference}</strong><OpsStatusBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsStatusBadge></div><p className="mt-1 truncate text-[10px] text-[#858c94]">{job.customer_name} · {job.origin} → {job.destination}</p></div><div className="shrink-0 text-right"><p className="flex items-center justify-end gap-1 text-[10px] font-medium text-[#5e6670]"><CalendarDays size={11}/>{dateOnly(job.eta)}</p><p className="mt-1 text-[9px] text-[#a0a6ac]">{job.current_location || job.primary_branch}</p></div></Link>;
}

function QuickLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return <Link href={href} className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-[#f6f7f8]"><div className="min-w-0"><strong className="block text-[11px] font-semibold text-[#414850]">{label}</strong><p className="mt-0.5 text-[10px] leading-4 text-[#8a9198]">{detail}</p></div><ArrowUpRight size={13} className="shrink-0 text-[#a3a9af] transition group-hover:text-[#5367d9]"/></Link>;
}
