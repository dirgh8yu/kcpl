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
} from "lucide-react";
import { useMemo, useState } from "react";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";
import type { KcplBranch } from "../crm/crm-data";
import type { NnswIntegrationState } from "./customs-integration.server";

type Focus = "open" | "all" | "cleared";

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function attentionScore(job: CommandCentreJob) {
  return (
    job.required_customs_open * 20 +
    (job.status === "exception" ? 100 : 0) +
    (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) +
    job.overdue_tasks * 8
  );
}

function CustomsProgress({ job }: { job: CommandCentreJob }) {
  const completed = Math.max(0, job.required_customs_total - job.required_customs_open);
  const percent = job.required_customs_total > 0
    ? Math.round((completed / job.required_customs_total) * 100)
    : 0;

  return (
    <div className="min-w-[132px]">
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
        <span>{completed}/{job.required_customs_total} complete</span>
        <span className="text-[#7a858f]">{percent}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8ebee]">
        <div className="h-full rounded-full bg-[#b78a3e]" style={{ width: `${percent}%` }}/>
      </div>
    </div>
  );
}

export function CustomsWorkspace({
  data,
  roleLabel,
  integration,
}: {
  data: CommandCentreData;
  roleLabel: string;
  integration: NnswIntegrationState;
}) {
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [focus, setFocus] = useState<Focus>("open");

  const customsJobs = useMemo(
    () => data.jobs.filter((job) => job.required_customs_total > 0),
    [data.jobs],
  );

  const openJobs = useMemo(
    () => customsJobs.filter((job) => job.required_customs_open > 0),
    [customsJobs],
  );

  const clearedJobs = useMemo(
    () => customsJobs.filter((job) => job.required_customs_open === 0),
    [customsJobs],
  );

  const openSteps = useMemo(
    () => customsJobs.reduce((sum, job) => sum + job.required_customs_open, 0),
    [customsJobs],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customsJobs
      .filter((job) => {
        if (focus === "open" && job.required_customs_open === 0) return false;
        if (focus === "cleared" && job.required_customs_open > 0) return false;
        if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch)) return false;
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
      })
      .sort((a, b) => attentionScore(b) - attentionScore(a) || b.updated_at.localeCompare(a.updated_at));
  }, [branch, customsJobs, focus, query]);

  const noChecklistCount = data.jobs.filter((job) => job.required_customs_total === 0).length;

  return (
    <main className="min-h-screen bg-[#f5f6f7] p-4 text-[#10263f] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-4 border-b border-[#dfe3e8] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">
              <ShieldCheck size={14}/>
              Customs Desk
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-[-.035em] sm:text-3xl">Nepal customs control queue</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#68747f]">
              One operational view for required customs steps across active KCPL shipments. Open the Digital Job File to complete clearance actions and keep branch ownership auditable.
            </p>
          </div>
          <div className="text-left text-xs text-[#68747f] xl:text-right">
            <p><span className="font-semibold text-[#10263f]">{roleLabel}</span> · Nepal operational date {data.operational_date}</p>
            <p className="mt-1">Snapshot {formatDateTime(data.generated_at)}</p>
          </div>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Customs jobs" value={customsJobs.length} detail="Active jobs with a customs checklist" icon={<FileCheck2 size={17}/>}/>
          <Metric label="Blocked jobs" value={openJobs.length} detail="At least one required step open" danger={openJobs.length > 0} icon={<TriangleAlert size={17}/>}/>
          <Metric label="Open required steps" value={openSteps} detail="Across accessible branches" danger={openSteps > 0} icon={<Landmark size={17}/>}/>
          <Metric label="Cleared checklists" value={clearedJobs.length} detail="All required steps completed" icon={<CheckCircle2 size={17}/>}/>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-xl border border-[#dfe3e8] bg-white">
            <div className="border-b border-[#e8ebee] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-bold">Clearance queue</h2>
                  <p className="mt-1 text-xs text-[#7a858f]">{filtered.length} jobs shown · {noChecklistCount} active shipments currently have no customs checklist</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ["open", "Needs action", openJobs.length],
                    ["all", "All customs", customsJobs.length],
                    ["cleared", "Cleared", clearedJobs.length],
                  ] as const).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFocus(value)}
                      className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition ${focus === value ? "border-[#10263f] bg-[#10263f] text-white" : "border-[#dfe3e8] bg-white text-[#56636f] hover:bg-[#f5f6f7]"}`}
                    >
                      {label} <span className={focus === value ? "text-white/55" : "text-[#9aa3ab]"}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#84909b]" size={15}/>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search shipment, customer, route, carrier or owner"
                    className="h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#f8f9fa] pl-9 pr-3 text-sm outline-none transition focus:border-[#9e7b3e] focus:bg-white"
                  />
                </label>
                <select
                  value={branch}
                  onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)}
                  className="h-10 rounded-lg border border-[#dfe3e8] bg-white px-3 text-sm outline-none focus:border-[#9e7b3e]"
                >
                  <option value="all">All accessible branches</option>
                  {data.accessible_branches.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <thead className="bg-[#fafbfb] text-[10px] font-bold uppercase tracking-[.08em] text-[#7a858f]">
                  <tr>
                    <th className="px-4 py-3">Shipment</th>
                    <th className="px-4 py-3">Customer / route</th>
                    <th className="px-4 py-3">Customs progress</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Shipment state</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => {
                    const blocked = job.required_customs_open > 0;
                    return (
                      <tr key={job.reference} className="border-t border-[#edf0f2] align-top hover:bg-[#fbfbfa]">
                        <td className="px-4 py-3.5">
                          <p className="text-xs font-bold">{job.reference}</p>
                          <p className="mt-1 text-[10px] text-[#8a949d]">{job.quote_reference || "No quote reference"}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="max-w-[230px] truncate text-xs font-semibold">{job.customer_name}</p>
                          <p className="mt-1 max-w-[280px] truncate text-[11px] text-[#72808b]">{job.origin || "—"} → {job.destination || "—"}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <CustomsProgress job={job}/>
                          <p className={`mt-2 text-[10px] font-semibold ${blocked ? "text-amber-700" : "text-emerald-700"}`}>
                            {blocked ? `${job.required_customs_open} required step${job.required_customs_open === 1 ? "" : "s"} open` : "Required checklist complete"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs font-semibold">{job.primary_branch}</p>
                          {job.handling_branches.length > 1 ? <p className="mt-1 text-[10px] text-[#8a949d]">+ {job.handling_branches.length - 1} handling branch{job.handling_branches.length === 2 ? "" : "es"}</p> : null}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="max-w-[170px] truncate text-xs font-semibold">{job.assigned_to_name || "Unassigned"}</p>
                          <p className="mt-1 max-w-[170px] truncate text-[10px] text-[#8a949d]">{job.assigned_to_email || "No staff email"}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold ${job.status === "exception" ? "border-rose-200 bg-rose-50 text-rose-700" : blocked ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                            {job.status === "exception" ? "Exception" : humanize(job.status)}
                          </span>
                          {job.current_location ? <p className="mt-2 max-w-[180px] truncate text-[10px] text-[#7a858f]">{job.current_location}</p> : null}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#10263f] px-3 py-2 text-[10px] font-bold text-white transition hover:bg-[#173958]">
                            Open Job File <ArrowUpRight size={12}/>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#7a858f]">No customs jobs match this view.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#dfe3e8] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a6c36]">NNSW / NECAS</p>
                  <h2 className="mt-1 text-sm font-bold">Integration status</h2>
                </div>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-amber-800">Portal bridge</span>
              </div>
              <p className="mt-3 text-xs font-semibold text-[#10263f]">{integration.label}</p>
              <p className="mt-2 text-xs leading-5 text-[#6d7984]">{integration.detail}</p>
              <div className="mt-4 rounded-lg border border-[#e6dfd0] bg-[#fcfaf5] p-3 text-[11px] leading-5 text-[#6e6046]">
                Automated NECAS/NNSW status sync stays off until KCPL receives authorised endpoint documentation and credentials. No unofficial scraping or browser-stored secrets.
              </div>
            </section>

            <section className="rounded-xl border border-[#dfe3e8] bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a6c36]">Official tools</p>
              <div className="mt-3 space-y-2">
                {integration.resources.map((resource) => (
                  <a
                    key={resource.href}
                    href={resource.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e8eb] px-3 py-3 transition hover:border-[#c8b58f] hover:bg-[#fcfaf5]"
                  >
                    <span>
                      <strong className="block text-xs">{resource.label}</strong>
                      <span className="mt-0.5 block text-[10px] text-[#84909b]">{resource.detail}</span>
                    </span>
                    <ArrowUpRight size={14} className="shrink-0 text-[#8a6c36]"/>
                  </a>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-[#dfe3e8] bg-[#10263f] p-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#d4ad62]">Next connector step</p>
              <p className="mt-2 text-sm font-semibold">Request authorised NNSW/NECAS integration access for KCPL.</p>
              <p className="mt-2 text-xs leading-5 text-white/55">Once endpoint documentation is supplied, the server connector can map declaration status, customs office, reference numbers and clearance milestones into the same Job File checklist.</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  danger = false,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#dfe3e8] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#7c8791]">{label}</p>
        <span className={danger ? "text-amber-700" : "text-[#8a6c36]"}>{icon}</span>
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-[-.04em] ${danger ? "text-amber-800" : "text-[#10263f]"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[#84909b]">{detail}</p>
    </div>
  );
}
