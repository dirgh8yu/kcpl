"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Landmark,
  PackageCheck,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NepalOperationsMap } from "../../components/operations-map";
import { shipmentStatusLabels, type ShipmentStatus } from "../../shipment-types";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono } from "../operations-ui";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";

const defaultSections = {
  attention: true,
  movement: true,
  network: true,
  branch: true,
  staff: true,
  recent: true,
};

const NEPAL_TIME_ZONE = "Asia/Kathmandu";
type SectionKey = keyof typeof defaultSections;
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

function dateOnly(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: value.length === 10 ? "UTC" : NEPAL_TIME_ZONE }).format(date);
}

function dateTimeNepal(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: NEPAL_TIME_ZONE }).format(date);
}

function timeOnlyNepal(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: NEPAL_TIME_ZONE }).format(date);
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function attentionScore(job: CommandCentreJob) {
  return (job.status === "exception" ? 100 : 0) +
    (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) +
    job.overdue_tasks * 10 +
    job.required_customs_open * 4 +
    (!job.assigned_to_name && !job.assigned_to_email ? 3 : 0);
}

function statusTone(status: ShipmentStatus): Tone {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "preparing" || status === "customs_clearance") return "warning";
  if (status === "booking_confirmed" || status === "in_transit" || status === "out_for_delivery") return "info";
  return "neutral";
}

function modeLabel(value: string) {
  const mode = value.trim().toLowerCase();
  if (mode.includes("air")) return "Air freight";
  if (mode.includes("sea") || mode.includes("ocean")) return "Sea freight";
  if (mode.includes("road")) return "Road freight";
  if (mode.includes("rail")) return "Rail freight";
  if (mode.includes("multi")) return "Multimodal freight";
  return value || "Freight";
}

function primaryIssue(job: CommandCentreJob) {
  if (job.status === "exception") return { tone: "danger" as const, title: "Shipment exception", detail: "Movement is in exception status and requires review." };
  if (job.overdue_tasks > 0) return { tone: "danger" as const, title: `${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}`, detail: "Operational work is beyond its due time." };
  if (job.required_customs_open > 0) return { tone: "warning" as const, title: `${job.required_customs_open} customs step${job.required_customs_open === 1 ? "" : "s"} open`, detail: "Required customs work remains incomplete." };
  if (!job.assigned_to_name && !job.assigned_to_email) return { tone: "warning" as const, title: "No shipment owner", detail: "This movement has not been assigned." };
  if (job.priority === "urgent" || job.priority === "high") return { tone: "warning" as const, title: `${job.priority === "urgent" ? "Urgent" : "High"} priority`, detail: "This movement has been intentionally prioritised." };
  return { tone: "info" as const, title: "Review movement", detail: "Operational attention is recommended." };
}

export function CommandCentreWorkspace({ data, roleLabel }: { data: CommandCentreData; roleLabel: string }) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [sections, setSections] = useState(defaultSections);

  const attention = useMemo(
    () => [...data.jobs].filter((job) => attentionScore(job) > 0).sort((a, b) => attentionScore(b) - attentionScore(a)).slice(0, 8),
    [data.jobs],
  );
  const today = useMemo(
    () => data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).slice(0, 6),
    [data.jobs, data.operational_date],
  );
  const recent = useMemo(
    () => [...data.jobs].filter((job) => timestamp(job.updated_at) > 0).sort((a, b) => timestamp(b.updated_at) - timestamp(a.updated_at)).slice(0, 8),
    [data.jobs],
  );
  const activeBranchLoad = useMemo(() => data.branch_load.filter((item) => item.active_jobs > 0), [data.branch_load]);
  const staffWithWork = useMemo(
    () => data.staff_load.filter((staff) => staff.active_jobs > 0 || staff.open_tasks > 0 || staff.overdue_tasks > 0 || staff.urgent_jobs > 0),
    [data.staff_load],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const roleKey = `kcpl-ops-home-sections:${roleLabel.toLowerCase()}`;
      const raw = window.localStorage.getItem(roleKey) || window.localStorage.getItem("kcpl-ops-home-sections");
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as Partial<typeof defaultSections>;
        setSections({ ...defaultSections, ...parsed });
      } catch {
        window.localStorage.removeItem(roleKey);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [roleLabel]);

  useEffect(() => {
    if (!customizeOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCustomizeOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [customizeOpen]);

  function toggleSection(key: SectionKey) {
    setSections((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem(`kcpl-ops-home-sections:${roleLabel.toLowerCase()}`, JSON.stringify(next));
      return next;
    });
  }

  const summary = [
    { label: "Active shipments", value: data.totals.active_jobs, detail: data.totals.active_jobs === 1 ? "movement in progress" : "movements in progress", tone: "info" as Tone, emphasis: "normal" },
    { label: "Needs assignment", value: data.totals.unassigned_jobs, detail: data.totals.unassigned_jobs ? "owner required" : "all active work owned", tone: data.totals.unassigned_jobs ? "warning" as Tone : "success" as Tone, emphasis: data.totals.unassigned_jobs ? "medium" : "normal" },
    { label: "Critical exceptions", value: data.totals.exception_jobs, detail: data.totals.exception_jobs ? "movement blocked or exceptional" : "no shipment exceptions", tone: data.totals.exception_jobs ? "danger" as Tone : "success" as Tone, emphasis: data.totals.exception_jobs ? "high" : "normal" },
    { label: "Overdue tasks", value: data.totals.overdue_tasks, detail: data.totals.overdue_tasks ? "work past due" : "no overdue operational work", tone: data.totals.overdue_tasks ? "danger" as Tone : "success" as Tone, emphasis: data.totals.overdue_tasks ? "high" : "normal" },
    { label: "Customs blockers", value: data.totals.customs_blockers, detail: data.totals.customs_blockers ? "required customs work open" : "no customs blockers", tone: data.totals.customs_blockers ? "warning" as Tone : "success" as Tone, emphasis: data.totals.customs_blockers ? "medium" : "normal" },
    { label: "Due today", value: data.totals.deliveries_today, detail: data.totals.deliveries_today ? "ETA falls today" : "nothing due today", tone: "neutral" as Tone, emphasis: "normal" },
  ];

  return (
    <main className="min-h-[calc(100vh-58px)] bg-[#f3f1ee] text-[#26221f]">
      <section className="ops-command-hero">
        <div className="relative z-10 mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-5">
          <div>
            <p className="ops-eyebrow">{roleLabel} · Nepal operations</p>
            <h1 className="ops-command-title mt-1.5">Your operational day, without the noise.</h1>
            <p className="ops-command-subtitle">See what is moving, what is blocked, what needs ownership and what changed. Operational date {dateOnly(data.operational_date)} · Nepal time.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <OpsButton variant="secondary" aria-expanded={customizeOpen} aria-controls="home-section-controls" onClick={() => setCustomizeOpen((current) => !current)}><Settings2 size={13}/>Customize</OpsButton>
              {customizeOpen ? <div id="home-section-controls" className="absolute right-0 top-11 z-30 w-64 rounded-[12px] border border-[#d9d3cd] bg-white p-2 shadow-[0_20px_60px_rgba(54,43,34,.15)]">
                <p className="px-2 pb-2 pt-1 text-[10px] font-bold text-[#817a73]">Home sections</p>
                {(Object.keys(defaultSections) as SectionKey[]).map((key) => <button key={key} type="button" onClick={() => toggleSection(key)} className="flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left text-[11px] font-semibold capitalize text-[#504a45] hover:bg-[#f7f5f2]"><span className={`grid h-5 w-5 place-items-center rounded-[5px] border ${sections[key] ? "border-[#d99b88] bg-[#fbe9e3] text-[#ad5844]" : "border-[#dcd6d0] bg-white text-transparent"}`}><Check size={12}/></span>{key === "branch" ? "Branch pressure" : key === "staff" ? "Staff workload" : key === "network" ? "Network map" : key === "recent" ? "Recent movement" : key}</button>)}
                <button type="button" onClick={() => { setSections(defaultSections); window.localStorage.setItem(`kcpl-ops-home-sections:${roleLabel.toLowerCase()}`, JSON.stringify(defaultSections)); }} className="mt-1 w-full rounded-[8px] px-2.5 py-2 text-left text-[10px] font-semibold text-[#8b6257] hover:bg-[#f7f5f2]">Reset view</button>
              </div> : null}
            </div>
            <Link href="/admin/shipments" className="ops-button" data-variant="secondary" data-size="md">Shipments</Link>
            <OpsButton variant="primary" onClick={() => window.location.reload()}><RefreshCw size={13}/>Refresh</OpsButton>
          </div>
        </div>
      </section>

      <div className="ops-command-grid">
        <section className="ops-summary-grid" aria-label="Operational summary">
          {summary.map((item) => <div key={item.label} className="ops-summary-card" data-tone={item.tone} data-emphasis={item.emphasis} data-zero={item.value === 0 || undefined}>
            <small>{item.label}</small><strong>{item.value}</strong><p>{item.detail}</p>
          </div>)}
        </section>

        {(sections.attention || sections.movement) ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,.55fr)]">
          {sections.attention ? <HomePanel title="Needs attention" eyebrow="Priority queue" action={<Link href="/admin/shipments" className="text-[11px] font-bold text-[#9e5948] hover:underline">View all shipments</Link>}>
            {attention.length ? <div>{attention.map((job) => <AttentionItem key={job.reference} job={job}/>)}</div> : <OpsEmptyState compact kind="healthy" icon={<CheckCircle2 size={16}/>} title="All clear" description="No active movement currently needs escalation or ownership attention."/>}
          </HomePanel> : null}

          {sections.movement ? <HomePanel title="Today's movement" eyebrow="ETA watch" action={<CalendarDays size={15} className="text-[#3f7295]"/>}>
            {today.length ? <div>{today.map((job) => <TodayItem key={job.reference} job={job}/>)}</div> : <OpsEmptyState compact kind="healthy" icon={<PackageCheck size={16}/>} title="Nothing due today" description="No active shipment has an ETA falling on today’s Nepal operational date."/>}
            <div className="border-t border-[#e9e5e0] bg-[#faf9f7] p-3"><div className="grid gap-1"><QuickLink href="/admin" label="Review enquiries" detail="Price and convert freight requests"/><QuickLink href="/admin/alerts" label="Tasks & alerts" detail="Open the operational attention inbox"/></div></div>
          </HomePanel> : null}
        </div> : null}

        {sections.network ? <HomePanel title="KCPL operating network" eyebrow="Branches & movement" action={<span className="text-[10px] font-medium text-[#766f68]">Recorded operational location, not GPS tracking</span>}>
          <NepalOperationsMap variant="home" locationLinkHref="/network#confirmed-locations"/>
        </HomePanel> : null}

        {(sections.branch || sections.staff) ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(390px,.75fr)]">
          {sections.branch ? <HomePanel title="Branch pressure" eyebrow="Network load">
            {activeBranchLoad.length ? <div className="p-4"><div className="space-y-3">{activeBranchLoad.map((item) => <BranchPressure key={item.branch} item={item}/>)}</div></div> : <OpsEmptyState compact kind="healthy" title="Network clear" description="There is no active shipment pressure across your accessible branches."/>}
          </HomePanel> : null}

          {sections.staff ? <HomePanel title="Ownership load" eyebrow="Staff workload">
            {staffWithWork.length ? <div className="overflow-x-auto"><table className="ops-table min-w-[500px] w-full"><thead><tr><th>Staff</th><th>Jobs</th><th>Open tasks</th><th>Overdue</th><th>Urgent</th></tr></thead><tbody>{staffWithWork.slice(0, 12).map((staff) => <tr key={staff.key}><td><strong className="block max-w-[180px] truncate">{staff.name}</strong>{staff.email ? <span className="mt-0.5 block max-w-[180px] truncate text-[10px] text-[#817a73]">{staff.email}</span> : null}</td><td>{staff.active_jobs}</td><td>{staff.open_tasks}</td><td className={staff.overdue_tasks ? "font-bold text-[#ae434a]" : "text-[#817a73]"}>{staff.overdue_tasks}</td><td className={staff.urgent_jobs ? "font-bold text-[#9b682b]" : "text-[#817a73]"}>{staff.urgent_jobs}</td></tr>)}</tbody></table></div> : <OpsEmptyState compact kind="healthy" title="No staff pressure" description="No accessible active jobs or open tasks are currently assigned to staff."/>}
          </HomePanel> : null}
        </div> : null}

        {sections.recent ? <HomePanel title="Recently updated movements" eyebrow="What changed" action={<span className="text-[10px] text-[#817a73]">Snapshot {dateTimeNepal(data.generated_at)} NPT</span>}>
          {recent.length ? <div className="ops-activity-feed">{recent.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-activity-item hover:bg-[#faf9f7]"><span className={`mt-1.5 h-2 w-2 rounded-full ${job.status === "exception" ? "bg-[#ae434a]" : "bg-[#3f7295]"}`}/><span className="min-w-0"><strong className="block truncate text-[12px] text-[#403a36]">{job.customer_name} · {job.origin || "Origin"} → {job.destination || "Destination"}</strong><span className="mt-0.5 block truncate text-[10px] text-[#817a73]">{shipmentStatusLabels[job.status]} · {job.current_location || job.primary_branch} · <OpsMono>{job.reference}</OpsMono></span></span><span className="whitespace-nowrap text-[10px] text-[#8e8780]">{timeOnlyNepal(job.updated_at)} NPT</span></Link>)}</div> : <OpsEmptyState compact kind="neutral" title="No movement updates yet" description="Recent shipment changes will appear here as operational records are updated."/>}
        </HomePanel> : null}
      </div>
    </main>
  );
}

function HomePanel({ title, eyebrow, action, children }: { title: string; eyebrow: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="ops-home-panel"><header className="ops-home-panel-header"><div><p className="ops-home-panel-eyebrow">{eyebrow}</p><h2 className="ops-home-panel-title mt-0.5">{title}</h2></div>{action}</header>{children}</section>;
}

function AttentionItem({ job }: { job: CommandCentreJob }) {
  const issue = primaryIssue(job);
  const owner = job.assigned_to_name || job.assigned_to_email;
  return <article className="ops-attention-item"><span className="ops-priority-rail" data-tone={issue.tone}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="ops-route text-[13px]"><span>{job.origin || "Origin"}</span><ArrowRight size={12} className="ops-route-arrow"/><span>{job.destination || "Destination"}</span></strong><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge></div><p className="mt-1 text-[11px] text-[#716a64]">{job.customer_name} · {modeLabel(job.mode)} · <OpsMono>{job.reference}</OpsMono></p><div className="mt-2 flex flex-wrap items-start gap-x-5 gap-y-1"><div><p className={`text-[11px] font-bold ${issue.tone === "danger" ? "text-[#a63d44]" : issue.tone === "warning" ? "text-[#8d5d22]" : "text-[#3f7295]"}`}>{issue.title}</p><p className="mt-0.5 text-[10px] text-[#817a73]">{issue.detail}</p></div><div><p className="text-[10px] font-semibold text-[#8c857e]">Owner</p><p className={`mt-0.5 text-[11px] font-semibold ${owner ? "text-[#514b46]" : "text-[#8d5d22]"}`}>{owner || "Unassigned"}</p></div></div></div><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-button" data-variant={owner ? "secondary" : "primary"} data-size="sm">{owner ? "Open job" : "Assign owner"}<ArrowUpRight size={11}/></Link></article>;
}

function TodayItem({ job }: { job: CommandCentreJob }) {
  return <Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex items-center justify-between gap-3 border-b border-[#e9e5e0] px-4 py-3.5 last:border-b-0 hover:bg-[#faf9f7]"><div className="min-w-0"><strong className="ops-route text-[12px]"><span>{job.origin || "Origin"}</span><ArrowRight size={11} className="ops-route-arrow"/><span>{job.destination || "Destination"}</span></strong><p className="mt-1 truncate text-[10px] text-[#817a73]">{job.customer_name} · {job.current_location || job.primary_branch}</p></div><div className="shrink-0 text-right"><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge><p className="mt-1.5 text-[10px] text-[#817a73]">ETA {dateOnly(job.eta)}</p></div></Link>;
}

function QuickLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return <Link href={href} className="flex items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 hover:bg-white"><div><strong className="text-[11px] text-[#45403c]">{label}</strong><p className="mt-0.5 text-[10px] text-[#817a73]">{detail}</p></div><ArrowUpRight size={12} className="text-[#3f7295]"/></Link>;
}

function BranchPressure({ item }: { item: CommandCentreData["branch_load"][number] }) {
  const pressure = item.urgent_jobs + item.overdue_tasks + item.customs_blockers;
  const max = Math.max(item.active_jobs, 1);
  const pressureWidth = Math.min(100, (pressure / max) * 100);
  const activeWidth = Math.min(100, Math.max(12, (item.active_jobs / max) * 100));
  return <Link href={`/admin/branches/${encodeURIComponent(item.branch)}`} aria-label={`Open ${item.branch} branch operations`} className="grid grid-cols-[118px_minmax(0,1fr)_auto_16px] items-center gap-3 rounded-[9px] px-2 py-2 -mx-2 hover:bg-[#faf9f7] focus-visible:bg-[#faf9f7]"><span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4e4944]"><Landmark size={12} className="text-[#7c756e]"/>{item.branch}</span><div className="h-1.5 overflow-hidden rounded-full bg-[#e9e5e0]"><div className={`h-full rounded-full ${pressure ? "bg-[#d29a4b]" : "bg-[#89ae94]"}`} style={{ width: `${pressure ? Math.max(12, pressureWidth) : activeWidth}%` }}/></div><span className="text-[10px] text-[#817a73]">{item.active_jobs} active{pressure ? ` · ${pressure} pressure` : " · clear"}</span><ArrowUpRight size={12} className="text-[#817a73]"/></Link>;
}
