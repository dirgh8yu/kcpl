"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Landmark,
  PackageCheck,
  RefreshCw,
  Settings2,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NepalOperationsMap } from "../../components/operations-map";
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

const defaultSections = {
  attention: true,
  movement: true,
  network: true,
  branch: true,
  staff: true,
  recent: true,
};

type SectionKey = keyof typeof defaultSections;

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
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [sections, setSections] = useState(defaultSections);
  const attention = useMemo(() => [...data.jobs].filter((job) => attentionScore(job) > 0).sort((a, b) => attentionScore(b) - attentionScore(a)).slice(0, 10), [data.jobs]);
  const today = useMemo(() => data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).slice(0, 7), [data.jobs, data.operational_date]);
  const recent = useMemo(() => [...data.jobs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8), [data.jobs]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const raw = window.localStorage.getItem("kcpl-ops-home-sections");
      if (!raw) return;
      try {
        setSections({ ...defaultSections, ...JSON.parse(raw) });
      } catch {
        window.localStorage.removeItem("kcpl-ops-home-sections");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleSection(key: SectionKey) {
    setSections((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem("kcpl-ops-home-sections", JSON.stringify(next));
      return next;
    });
  }

  const metrics = [
    { label: "Active", value: data.totals.active_jobs, icon: <BriefcaseBusiness size={13}/>, tone: "normal" },
    { label: "Urgent", value: data.totals.urgent_jobs, icon: <AlertTriangle size={13}/>, tone: data.totals.urgent_jobs ? "danger" : "normal" },
    { label: "Overdue tasks", value: data.totals.overdue_tasks, icon: <Clock3 size={13}/>, tone: data.totals.overdue_tasks ? "danger" : "normal" },
    { label: "Customs blockers", value: data.totals.customs_blockers, icon: <ShieldAlert size={13}/>, tone: data.totals.customs_blockers ? "danger" : "normal" },
    { label: "Due today", value: data.totals.deliveries_today, icon: <PackageCheck size={13}/>, tone: "normal" },
    { label: "Unassigned", value: data.totals.unassigned_jobs, icon: <UserRound size={13}/>, tone: data.totals.unassigned_jobs ? "warn" : "normal" },
    { label: "Exceptions", value: data.totals.exception_jobs, icon: <AlertTriangle size={13}/>, tone: data.totals.exception_jobs ? "danger" : "normal" },
  ] as const;

  return (
    <main className="kcpl-home text-[#302b27]">
      <section className="kcpl-home-hero">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#c16b50]">{roleLabel} workspace</p>
            <h1 className="kcpl-home-title mt-2">Your operational day, without the noise.</h1>
            <p className="kcpl-home-subtitle">Enquiries, shipments, tasks and exceptions stay close to the surface. The rest can get out of your way. Nepal operational date {dateOnly(data.operational_date)}.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setCustomizeOpen((current) => !current)} className="flex h-10 items-center gap-2 rounded-full border border-[#e6ddd5] bg-white px-4 text-[11px] font-bold text-[#655b53] shadow-[0_2px_8px_rgba(70,50,37,.04)] hover:border-[#d9cbc0]"><Settings2 size={14}/>Customize</button>
              {customizeOpen ? <div className="absolute right-0 top-12 z-30 w-64 rounded-[16px] border border-[#e6ddd5] bg-[#fffdfb] p-2 shadow-[0_20px_60px_rgba(72,52,40,.14)]">
                <p className="px-2 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#a39990]">Your home view</p>
                {(Object.keys(defaultSections) as SectionKey[]).map((key) => <button key={key} type="button" onClick={() => toggleSection(key)} className="flex w-full items-center gap-3 rounded-[11px] px-2.5 py-2 text-left text-[11px] font-semibold capitalize text-[#5d544d] hover:bg-[#faf5f0]"><span className={`grid h-5 w-5 place-items-center rounded-md border ${sections[key] ? "border-[#e0a28c] bg-[#f8e5dd] text-[#bd6348]" : "border-[#e7dfd8] bg-white text-transparent"}`}><Check size={12}/></span>{key === "branch" ? "Branch pressure" : key === "staff" ? "Staff workload" : key === "network" ? "Network map" : key}</button>)}
                <button type="button" onClick={() => { setSections(defaultSections); window.localStorage.setItem("kcpl-ops-home-sections", JSON.stringify(defaultSections)); }} className="mt-1 w-full rounded-[10px] px-2.5 py-2 text-left text-[10px] font-semibold text-[#9a7061] hover:bg-[#faf5f0]">Reset home view</button>
              </div> : null}
            </div>
            <Link href="/admin/shipments" className="h-10 rounded-full border border-[#e6ddd5] bg-white px-4 text-[11px] font-bold leading-10 text-[#655b53] hover:border-[#d9cbc0]">Shipments</Link>
            <button type="button" onClick={() => window.location.reload()} className="flex h-10 items-center gap-2 rounded-full bg-[#e97d5d] px-4 text-[11px] font-bold text-white shadow-[0_7px_20px_rgba(201,106,77,.15)] hover:bg-[#dd7253]"><RefreshCw size={13}/>Refresh</button>
          </div>
        </div>
      </section>

      <section className="kcpl-stat-ribbon" aria-label="Operational snapshot">
        {metrics.map((metric) => <div key={metric.label}>
          <div className={`flex items-center gap-2 ${metric.tone === "danger" ? "text-rose-600" : metric.tone === "warn" ? "text-amber-700" : "text-[#948a81]"}`}>{metric.icon}<span className="text-[9px] font-bold uppercase tracking-[.1em]">{metric.label}</span></div>
          <p className={`mt-1.5 text-[19px] font-[750] tracking-[-.03em] ${metric.tone === "danger" ? "text-rose-700" : "text-[#3b342f]"}`}>{metric.value}</p>
        </div>)}
      </section>

      <div className="kcpl-home-grid">
        {(sections.attention || sections.movement) ? <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.55fr)]">
          {sections.attention ? <HomePanel title="Needs attention" eyebrow="Priority queue" action={<Link href="/admin/shipments" className="text-[10px] font-bold text-[#b7644b] hover:underline">View shipment queue</Link>}>
            {attention.length ? <div className="overflow-x-auto"><table className="min-w-[860px] w-full text-left text-xs"><thead className="border-b border-[#eee8e2] bg-[#fcf9f6] text-[9px] font-bold uppercase tracking-[.1em] text-[#968c83]"><tr><th className="px-4 py-3">Shipment</th><th className="px-3 py-3">Customer / route</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Why it matters</th><th className="px-3 py-3"></th></tr></thead><tbody className="divide-y divide-[#f0eae4]">{attention.map((job) => <AttentionRow key={job.reference} job={job}/>)}</tbody></table></div> : <GoodState text="Nothing currently needs escalation."/>}
          </HomePanel> : null}

          {sections.movement ? <HomePanel title="Today's movement" eyebrow="ETA watch" action={<CalendarDays size={14} className="text-[#c8795e]"/>}>
            {today.length ? <div className="divide-y divide-[#f0eae4]">{today.map((job) => <TodayRow key={job.reference} job={job}/>)}</div> : <GoodState text="No active shipment is due today."/>}
            <div className="border-t border-[#f0eae4] bg-[#fcf9f6] p-3"><div className="grid gap-2"><QuickLink href="/admin" label="Enquiries" detail="Review incoming requests"/><QuickLink href="/admin/alerts" label="Tasks & alerts" detail="Open your attention queue"/></div></div>
          </HomePanel> : null}
        </div> : null}

        {sections.network ? <HomePanel title="KCPL network" eyebrow="Operational map" action={<span className="text-[10px] font-medium text-[#998e85]">Verified branch and counterpart geography</span>}>
          <NepalOperationsMap variant="home" locationLinkHref="/network#confirmed-locations"/>
        </HomePanel> : null}

        {(sections.branch || sections.staff) ? <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_minmax(420px,.8fr)]">
          {sections.branch ? <HomePanel title="Branch pressure" eyebrow="Network load">
            <div className="p-4">
              <div className="space-y-4">{data.branch_load.map((item) => <BranchPressure key={item.branch} item={item}/>)}</div>
            </div>
            <div className="overflow-x-auto border-t border-[#f0eae4]"><table className="min-w-[650px] w-full text-left text-xs"><thead className="bg-[#fcf9f6] text-[9px] font-bold uppercase tracking-[.1em] text-[#968c83]"><tr><th className="px-4 py-3">Branch</th><th className="px-3 py-3">Active</th><th className="px-3 py-3">Urgent</th><th className="px-3 py-3">Overdue</th><th className="px-3 py-3">Customs</th><th className="px-3 py-3">Due today</th></tr></thead><tbody className="divide-y divide-[#f0eae4]">{data.branch_load.map((item) => <tr key={item.branch}><td className="px-4 py-3.5"><span className="flex items-center gap-2 font-semibold"><Landmark size={13} className="text-[#c47155]"/>{item.branch}</span></td><td className="px-3 py-3.5 font-bold">{item.active_jobs}</td><td className={`px-3 py-3.5 font-bold ${item.urgent_jobs ? "text-rose-700" : "text-[#a29990]"}`}>{item.urgent_jobs}</td><td className={`px-3 py-3.5 font-bold ${item.overdue_tasks ? "text-rose-700" : "text-[#a29990]"}`}>{item.overdue_tasks}</td><td className={`px-3 py-3.5 font-bold ${item.customs_blockers ? "text-amber-700" : "text-[#a29990]"}`}>{item.customs_blockers}</td><td className="px-3 py-3.5 font-bold">{item.deliveries_today}</td></tr>)}</tbody></table></div>
          </HomePanel> : null}

          {sections.staff ? <HomePanel title="Staff workload" eyebrow="Ownership">
            <div className="overflow-x-auto"><table className="min-w-[520px] w-full text-left text-xs"><thead className="border-b border-[#eee8e2] bg-[#fcf9f6] text-[9px] font-bold uppercase tracking-[.1em] text-[#968c83]"><tr><th className="px-4 py-3">Staff</th><th className="px-3 py-3">Jobs</th><th className="px-3 py-3">Tasks</th><th className="px-3 py-3">Overdue</th><th className="px-3 py-3">Urgent</th></tr></thead><tbody className="divide-y divide-[#f0eae4]">{data.staff_load.length ? data.staff_load.slice(0, 12).map((staff) => <tr key={staff.key}><td className="px-4 py-3.5"><strong className="block truncate text-[#4b433d]">{staff.name}</strong>{staff.email ? <p className="mt-0.5 max-w-[180px] truncate text-[9px] text-[#a29990]">{staff.email}</p> : null}</td><td className="px-3 py-3.5 font-bold">{staff.active_jobs}</td><td className="px-3 py-3.5">{staff.open_tasks}</td><td className={`px-3 py-3.5 font-bold ${staff.overdue_tasks ? "text-rose-700" : "text-[#a29990]"}`}>{staff.overdue_tasks}</td><td className={`px-3 py-3.5 font-bold ${staff.urgent_jobs ? "text-amber-700" : "text-[#a29990]"}`}>{staff.urgent_jobs}</td></tr>) : <tr><td colSpan={5} className="p-7 text-center text-[#948a81]">No staff workload data yet.</td></tr>}</tbody></table></div>
          </HomePanel> : null}
        </div> : null}

        {sections.recent ? <section className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[#e9e2db] bg-[#fffdfb]/85 px-4 py-3.5 shadow-[0_8px_28px_rgba(83,62,47,.035)]">
          <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.11em] text-[#9d938a]">Recently updated</p><div className="mt-2 flex flex-wrap gap-2">{recent.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="rounded-full border border-[#ebe3dc] bg-white px-3 py-1.5 font-mono text-[9px] font-semibold text-[#655c54] hover:border-[#dfae9c] hover:text-[#a95b43]">{job.reference}</Link>)}</div></div>
          <p className="text-[9px] text-[#aaa097]">Snapshot {dateTime(data.generated_at)}</p>
        </section> : null}
      </div>
    </main>
  );
}

function HomePanel({ title, eyebrow, action, children }: { title: string; eyebrow: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="kcpl-home-panel"><header className="kcpl-home-panel-header"><div><p className="kcpl-home-panel-eyebrow">{eyebrow}</p><h2 className="kcpl-home-panel-title">{title}</h2></div>{action}</header>{children}</section>;
}

function AttentionRow({ job }: { job: CommandCentreJob }) {
  const issue = job.status === "exception" ? "Shipment exception" : job.overdue_tasks > 0 ? `${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}` : job.required_customs_open > 0 ? `${job.required_customs_open} customs blocker${job.required_customs_open === 1 ? "" : "s"}` : !job.assigned_to_name && !job.assigned_to_email ? "Unassigned" : `${job.priority} priority`;
  return <tr><td className="px-4 py-4"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="font-mono text-[10px] font-bold text-[#4b433d] hover:text-[#b45f47]">{job.reference}</Link></td><td className="px-3 py-4"><strong className="block max-w-[200px] truncate text-[#514842]">{job.customer_name}</strong><p className="mt-1 max-w-[220px] truncate text-[10px] text-[#958b82]">{job.origin} → {job.destination}</p></td><td className="px-3 py-4"><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${statusStyle[job.status]}`}>{shipmentStatusLabels[job.status]}</span></td><td className="px-3 py-4"><span className={`${job.assigned_to_name || job.assigned_to_email ? "text-[#6d645c]" : "font-bold text-rose-700"}`}>{job.assigned_to_name || job.assigned_to_email || "Unassigned"}</span></td><td className="px-3 py-4 font-semibold text-[#a85645]">{issue}</td><td className="px-3 py-4 text-right"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e8dfd7] bg-white text-[#837970] hover:border-[#dfae9c] hover:text-[#b45f47]"><ArrowUpRight size={13}/></Link></td></tr>;
}

function TodayRow({ job }: { job: CommandCentreJob }) {
  return <Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex items-start justify-between gap-3 px-4 py-4 transition hover:bg-[#fcf8f4]"><div className="min-w-0"><strong className="block truncate font-mono text-[10px] text-[#4b433d]">{job.reference}</strong><p className="mt-1.5 truncate text-[11px] font-semibold text-[#615850]">{job.customer_name}</p><p className="mt-1 flex items-center gap-1.5 truncate text-[9px] text-[#b66a51]"><CalendarDays size={10}/>{job.current_location || job.primary_branch}</p></div><div className="text-right"><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${statusStyle[job.status]}`}>{shipmentStatusLabels[job.status]}</span><p className="mt-2 text-[9px] text-[#9d938a]">ETA {dateOnly(job.eta)}</p></div></Link>;
}

function QuickLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return <Link href={href} className="flex items-center justify-between gap-3 rounded-[12px] border border-[#ebe3dc] bg-white px-3 py-2.5 transition hover:border-[#dfae9c]"><div><strong className="text-[10px] text-[#514842]">{label}</strong><p className="mt-0.5 text-[9px] text-[#9b9188]">{detail}</p></div><ArrowUpRight size={12} className="text-[#bd6b52]"/></Link>;
}

function BranchPressure({ item }: { item: CommandCentreData["branch_load"][number] }) {
  const max = Math.max(item.active_jobs + item.urgent_jobs + item.overdue_tasks + item.customs_blockers, 1);
  const urgentWidth = Math.min(100, ((item.urgent_jobs + item.overdue_tasks + item.customs_blockers) / max) * 100);
  return <div><div className="mb-1.5 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold text-[#5e554d]">{item.branch}</span><span className="text-[9px] text-[#9b9188]">{item.active_jobs} active · {item.urgent_jobs + item.overdue_tasks + item.customs_blockers} pressure</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#f0e9e2]"><div className="h-full rounded-full bg-[#dfa18a]" style={{ width: `${Math.max(6, urgentWidth)}%` }}/></div></div>;
}

function GoodState({ text }: { text: string }) {
  return <div className="flex items-center gap-2 px-4 py-8 text-sm text-[#6f8c75]"><CheckCircle2 size={16}/><span>{text}</span></div>;
}
