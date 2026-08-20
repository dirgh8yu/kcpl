"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  Landmark,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";
import type { KcplBranch } from "../crm/crm-data";
import {
  OpsButton,
  OpsEmptyState,
  OpsFilterBar,
  OpsMetric,
  OpsMetricStrip,
  OpsPageHeader,
  OpsPanel,
  OpsStatusBadge,
  OpsTableFrame,
} from "../operations-ui";
import type { NnswIntegrationState } from "./customs-integration.server";

type Focus = "open" | "all" | "cleared";

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function attentionScore(job: CommandCentreJob) {
  return job.required_customs_open * 20 + (job.status === "exception" ? 100 : 0) + (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) + job.overdue_tasks * 8;
}

function CustomsProgress({ job }: { job: CommandCentreJob }) {
  const completed = Math.max(0, job.required_customs_total - job.required_customs_open);
  const percent = job.required_customs_total > 0 ? Math.round((completed / job.required_customs_total) * 100) : 0;
  return <div className="min-w-[145px]"><div className="flex items-center justify-between gap-3 text-[10px]"><span className="font-medium text-[#535b64]">{completed}/{job.required_customs_total} complete</span><span className="text-[#92989f]">{percent}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-[#e9ebed]"><div className={`h-full rounded-full ${job.required_customs_open ? "bg-[#a78a5b]" : "bg-[#5f8b70]"}`} style={{ width: `${percent}%` }}/></div></div>;
}

export function CustomsWorkspace({ data, roleLabel, integration }: { data: CommandCentreData; roleLabel: string; integration: NnswIntegrationState }) {
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [focus, setFocus] = useState<Focus>("open");

  const customsJobs = useMemo(() => data.jobs.filter((job) => job.required_customs_total > 0), [data.jobs]);
  const openJobs = useMemo(() => customsJobs.filter((job) => job.required_customs_open > 0), [customsJobs]);
  const clearedJobs = useMemo(() => customsJobs.filter((job) => job.required_customs_open === 0), [customsJobs]);
  const openSteps = useMemo(() => customsJobs.reduce((sum, job) => sum + job.required_customs_open, 0), [customsJobs]);
  const noChecklistCount = data.jobs.filter((job) => job.required_customs_total === 0).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customsJobs.filter((job) => {
      if (focus === "open" && job.required_customs_open === 0) return false;
      if (focus === "cleared" && job.required_customs_open > 0) return false;
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch)) return false;
      if (!needle) return true;
      return [job.reference, job.quote_reference, job.customer_name, job.origin, job.destination, job.current_location ?? "", job.carrier ?? "", job.assigned_to_name ?? "", job.assigned_to_email ?? "", job.primary_branch, ...job.handling_branches].join(" ").toLowerCase().includes(needle);
    }).sort((a, b) => attentionScore(b) - attentionScore(a) || b.updated_at.localeCompare(a.updated_at));
  }, [branch, customsJobs, focus, query]);

  const filtersActive = focus !== "open" || branch !== "all" || Boolean(query.trim());
  const reset = () => { setFocus("open"); setBranch("all"); setQuery(""); };

  return <main>
    <OpsPageHeader
      eyebrow="Operations"
      title="Customs"
      description="A focused clearance queue for required customs actions across active KCPL job files. Blocked work is surfaced before completed checklists."
      breadcrumbs={[{ label: "Operations", href: "/admin/command-centre" }, { label: "Customs" }]}
      meta={<>{roleLabel} · Nepal operational date {data.operational_date} · Snapshot {formatDateTime(data.generated_at)}</>}
      actions={<OpsButton href="/admin/shipments">Open shipments</OpsButton>}
    />

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={4}>
        <OpsMetric label="Customs jobs" value={customsJobs.length} icon={<FileCheck2 size={13}/>} hint="with checklist"/>
        <OpsMetric label="Blocked jobs" value={openJobs.length} icon={<TriangleAlert size={13}/>} tone={openJobs.length ? "warning" : "neutral"}/>
        <OpsMetric label="Open steps" value={openSteps} icon={<Landmark size={13}/>} tone={openSteps ? "warning" : "neutral"}/>
        <OpsMetric label="Cleared" value={clearedJobs.length} icon={<CheckCircle2 size={13}/>} tone="success"/>
      </OpsMetricStrip>

      <div className="ops-grid-2">
        <OpsTableFrame
          toolbar={<div className="space-y-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[11px] font-semibold text-[#3d444b]">Clearance queue</p><p className="mt-0.5 text-[10px] text-[#8b9299]">{noChecklistCount} active shipment{noChecklistCount === 1 ? "" : "s"} currently have no customs checklist.</p></div><div className="flex items-center gap-1 rounded-lg bg-[#f3f4f5] p-1">{([ ["open", "Needs action", openJobs.length], ["all", "All", customsJobs.length], ["cleared", "Cleared", clearedJobs.length] ] as const).map(([value, label, count]) => <button key={value} type="button" onClick={() => setFocus(value)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium transition ${focus === value ? "bg-white text-[#343a41] shadow-sm" : "text-[#7b838b] hover:text-[#444b52]"}`}>{label} <span className="ml-1 text-[#9da3a9]">{count}</span></button>)}</div></div><OpsFilterBar count={<><strong className="font-semibold text-[#3b4249]">{filtered.length}</strong> shown</>} reset={filtersActive ? <button type="button" onClick={reset} className="inline-flex items-center gap-1 font-medium text-[#5968bb] hover:underline"><X size={11}/>Clear</button> : null}><label className="ops-search-field flex-1"><Search size={13} className="text-[#8e959c]"/><span className="sr-only">Search customs jobs</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, route, carrier or owner"/></label><label className="ops-filter-control"><Landmark size={13}/><span className="sr-only">Branch</span><select value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)}><option value="all">All branches</option>{data.accessible_branches.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></OpsFilterBar></div>}
          footer={<span className="text-[10px] text-[#8f969d]">Open required customs steps remain controlled inside each Digital Job File.</span>}
        >
          <table className="ops-dense-table min-w-[1040px] text-left"><thead><tr><th className="px-4">Shipment</th><th className="px-3">Customer / route</th><th className="px-3">Progress</th><th className="px-3">Branch</th><th className="px-3">Owner</th><th className="px-3">State</th><th className="w-28 px-3 text-right">Action</th></tr></thead><tbody>{filtered.length ? filtered.map((job) => { const blocked = job.required_customs_open > 0; return <tr key={job.reference}><td className="px-4"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-row-link">{job.reference}</Link><p className="mt-0.5 text-[9px] text-[#9aa0a7]">{job.quote_reference || "No quote ref"}</p></td><td className="px-3"><p className="max-w-[220px] truncate font-medium text-[#414850]">{job.customer_name}</p><p className="mt-0.5 max-w-[270px] truncate text-[10px] text-[#818990]">{job.origin || "Origin not set"} → {job.destination || "Destination not set"}</p></td><td className="px-3"><CustomsProgress job={job}/><div className="mt-1.5"><OpsStatusBadge tone={blocked ? "warning" : "success"}>{blocked ? `${job.required_customs_open} required open` : "Checklist complete"}</OpsStatusBadge></div></td><td className="px-3"><span className="font-medium text-[#56606a]">{job.primary_branch}</span>{job.handling_branches.length > 1 ? <p className="mt-0.5 text-[9px] text-[#9ba1a7]">+{job.handling_branches.length - 1} handling</p> : null}</td><td className="px-3"><p className={`max-w-[170px] truncate ${job.assigned_to_name ? "text-[#56606a]" : "font-semibold text-[#9f5059]"}`}>{job.assigned_to_name || "Unassigned"}</p><p className="mt-0.5 max-w-[170px] truncate text-[9px] text-[#9ba1a7]">{job.assigned_to_email || "No staff email"}</p></td><td className="px-3"><OpsStatusBadge tone={job.status === "exception" ? "danger" : blocked ? "warning" : "success"}>{job.status === "exception" ? "Exception" : humanize(job.status)}</OpsStatusBadge>{job.current_location ? <p className="mt-1.5 max-w-[180px] truncate text-[9px] text-[#8e959c]">{job.current_location}</p> : null}</td><td className="px-3 text-right"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="inline-flex items-center gap-1.5 rounded-md border border-[#dfe2e6] bg-white px-2.5 py-1.5 text-[10px] font-medium text-[#4d5660] hover:border-[#cbd1dc] hover:text-[#3445a3]">Job File<ArrowUpRight size={11}/></Link></td></tr>; }) : <tr><td colSpan={7}><OpsEmptyState title="No customs jobs match this view" detail="Try clearing the search, branch or queue filter." action={filtersActive ? <OpsButton onClick={reset}>Clear filters</OpsButton> : undefined}/></td></tr>}</tbody></table>
        </OpsTableFrame>

        <aside className="ops-stack">
          <OpsPanel title="Integration status" eyebrow="NNSW / NECAS" action={<OpsStatusBadge tone="warning">Portal bridge</OpsStatusBadge>}>
            <div className="p-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f3f4f8] text-[#5968a7]"><ShieldCheck size={15}/></span><div><p className="text-xs font-semibold text-[#3d444b]">{integration.label}</p><p className="mt-1.5 text-[11px] leading-5 text-[#747c84]">{integration.detail}</p></div></div><div className="mt-3 rounded-lg border border-[#e7dfcf] bg-[#fbf8f1] px-3 py-2.5 text-[10px] leading-5 text-[#77684f]">Automated NECAS/NNSW sync remains disabled until KCPL receives authorised endpoint documentation and credentials. No browser-stored secrets or unofficial scraping are used.</div></div>
          </OpsPanel>

          <OpsPanel title="Official tools" eyebrow="Customs resources">
            <div className="p-1.5">{integration.resources.map((resource) => <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-[#f6f7f8]"><span className="min-w-0"><strong className="block text-[11px] font-semibold text-[#414850]">{resource.label}</strong><span className="mt-0.5 block text-[10px] leading-4 text-[#8b9299]">{resource.detail}</span></span><ArrowUpRight size={12} className="shrink-0 text-[#9aa0a7] group-hover:text-[#5367d9]"/></a>)}</div>
          </OpsPanel>

          <OpsPanel title="Connector readiness" eyebrow="Next step">
            <div className="p-4"><p className="text-[11px] font-medium leading-5 text-[#4d555e]">Request authorised NNSW/NECAS integration access for KCPL.</p><p className="mt-2 text-[10px] leading-5 text-[#858c94]">Once official endpoint documentation is available, declaration status, customs office, reference numbers and clearance milestones can map into the existing Job File checklist without changing staff workflow.</p></div>
          </OpsPanel>
        </aside>
      </div>
    </div>
  </main>;
}
