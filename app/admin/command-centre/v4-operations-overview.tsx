import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  Package,
  ShieldAlert,
  Truck,
  User,
} from "lucide-react";
import { shipmentStatusLabels } from "../../shipment-types";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";
import type { WorkflowOverview } from "./workflow-overview.server";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

function score(job: CommandCentreJob) {
  return (job.status === "exception" ? 100 : 0) +
    (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) +
    job.overdue_tasks * 10 +
    job.required_customs_open * 4 +
    (!job.assigned_to_name && !job.assigned_to_email ? 3 : 0);
}

function issueFor(job: CommandCentreJob) {
  if (job.status === "exception") return { title: "Shipment exception requires review", tone: "danger" as const, label: "Exception" };
  if (job.overdue_tasks > 0) return { title: `${job.overdue_tasks} overdue operational task${job.overdue_tasks === 1 ? "" : "s"}`, tone: "danger" as const, label: "Overdue" };
  if (job.required_customs_open > 0) return { title: `${job.required_customs_open} customs requirement${job.required_customs_open === 1 ? "" : "s"} open`, tone: "warning" as const, label: "Customs" };
  if (!job.assigned_to_name && !job.assigned_to_email) return { title: "Shipment has no assigned owner", tone: "info" as const, label: "Unassigned" };
  if (job.priority === "urgent") return { title: "Urgent shipment needs attention", tone: "warning" as const, label: "Urgent" };
  if (job.priority === "high") return { title: "High-priority shipment needs attention", tone: "warning" as const, label: "High priority" };
  return { title: `${shipmentStatusLabels[job.status]} movement`, tone: "info" as const, label: "Active" };
}

function relativeAge(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Updated";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function timeOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: NEPAL_TIME_ZONE }).format(date);
}

function etaTime(job: CommandCentreJob) {
  if (!job.eta) return "—";
  const date = new Date(job.eta);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: NEPAL_TIME_ZONE }).format(date);
}

function formatOperationalDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || "Unassigned";
}

function route(job: CommandCentreJob) {
  const origin = job.origin || "Origin";
  const destination = job.destination || "Destination";
  return `${origin} → ${destination}`;
}

function movementCounts(data: CommandCentreData, overview: WorkflowOverview) {
  const pickupCount = overview.pickup
    ? overview.pickup.unscheduled + overview.pickup.requested + overview.pickup.confirmed
    : 0;

  return [
    { label: "Pickup", value: pickupCount, href: "/admin/pickups", detail: "Scheduled and awaiting collection" },
    { label: "In transit", value: data.jobs.filter((job) => job.status === "in_transit").length, href: "/admin/shipments", detail: "Freight currently moving" },
    { label: "Customs", value: data.jobs.filter((job) => job.status === "customs_clearance").length, href: "/admin/customs", detail: "Clearance in progress" },
    { label: "Delivery", value: data.jobs.filter((job) => job.status === "out_for_delivery").length, href: "/admin/delivery", detail: "Final-mile activity" },
  ];
}

function toneClasses(tone: "danger" | "warning" | "info") {
  if (tone === "danger") return "border-[#F2C6CF] bg-[#FFF7F8] text-[#B81031]";
  if (tone === "warning") return "border-[#ECD9B2] bg-[#FFF9EF] text-[#805300]";
  return "border-[#E0E0DB] bg-[#F7F7F4] text-[#666660]";
}

export function V4OperationsOverview({ data, overview }: { data: CommandCentreData; overview: WorkflowOverview }) {
  const attentionJobs = [...data.jobs]
    .filter((job) => score(job) > 0)
    .sort((a, b) => score(b) - score(a) || Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const priority = attentionJobs.slice(0, 6);
  const today = data.jobs
    .filter((job) => job.eta?.slice(0, 10) === data.operational_date)
    .sort((a, b) => String(a.eta).localeCompare(String(b.eta)))
    .slice(0, 6);
  const recent = [...data.jobs]
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, 4);
  const movement = movementCounts(data, overview);

  const kpis = [
    {
      label: "Active shipments",
      value: data.totals.active_jobs,
      detail: "Open job files",
      href: "/admin/shipments",
      icon: Truck,
      accent: "neutral" as const,
    },
    {
      label: "Exceptions",
      value: data.totals.exception_jobs,
      detail: data.totals.exception_jobs === 1 ? "Shipment needs review" : "Shipments need review",
      href: "/admin/alerts",
      icon: ShieldAlert,
      accent: "danger" as const,
    },
    {
      label: "Customs blockers",
      value: data.totals.customs_blockers,
      detail: "Requirements outstanding",
      href: "/admin/customs",
      icon: Package,
      accent: "warning" as const,
    },
    {
      label: "Due today",
      value: data.totals.deliveries_today,
      detail: "Delivery commitments",
      href: "/admin/delivery",
      icon: CalendarDays,
      accent: "neutral" as const,
    },
  ];

  return (
    <main className="min-h-[calc(100vh-56px)] bg-[#F6F6F3] px-4 pb-14 pt-7 text-[#101010] sm:px-6 sm:pt-9 lg:px-8">
      <div className="mx-auto w-full max-w-[1240px]">
        <header className="flex flex-col gap-6 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#DC143C]">KCPL Operations</p>
              <span className="h-1 w-1 rounded-full bg-[#B9B9B3]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#7A7A74]">Nepal time</p>
            </div>
            <h1 className="mt-2 text-[30px] font-extrabold leading-[36px] tracking-[-0.04em] sm:text-[34px] sm:leading-[40px]">Operations overview</h1>
            <p className="mt-2 max-w-xl text-[13px] font-medium leading-6 text-[#60605B]">A live operating picture of active freight, exceptions, customs blockers and today&apos;s delivery commitments.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#DEDED8] bg-white px-3.5 text-[11px] font-semibold text-[#62625D] shadow-[0_1px_2px_rgba(16,16,16,.02)]">
              <CalendarDays size={14} aria-hidden="true" />
              {formatOperationalDate(data.operational_date)}
            </span>
            <Link href="/admin/shipments" className="group inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#101010] px-4 text-[12px] font-bold text-white shadow-[0_8px_20px_rgba(16,16,16,.10)] transition hover:-translate-y-px hover:bg-[#232323] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC143C] focus-visible:ring-offset-2">
              Open shipments
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section aria-label="Operational status" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((item) => {
            const Icon = item.icon;
            const danger = item.accent === "danger" && item.value > 0;
            const warning = item.accent === "warning" && item.value > 0;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`group min-h-[132px] rounded-[15px] border p-4 shadow-[0_8px_24px_rgba(16,16,16,.025)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,16,16,.055)] sm:p-5 ${danger ? "border-[#EDC3CC] bg-[#FFF8F9]" : warning ? "border-[#E9D7B4] bg-[#FFFBF3]" : "border-[#E2E2DD] bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-[9px] ${danger ? "bg-[#DC143C] text-white" : warning ? "bg-[#FFF0D0] text-[#7D5200]" : "bg-[#F1F1ED] text-[#4F4F4A]"}`}>
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <ChevronRight size={14} className="mt-1 text-[#B0B0AA] transition group-hover:translate-x-0.5 group-hover:text-[#60605B]" aria-hidden="true" />
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#73736D]">{item.label}</p>
                    <p className={`mt-1 text-[28px] font-extrabold leading-none tracking-[-0.04em] ${danger ? "text-[#B81031]" : "text-[#101010]"}`}>{item.value}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] font-medium leading-[16px] text-[#777771]">{item.detail}</p>
              </Link>
            );
          })}
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
          <div className="overflow-hidden rounded-[17px] border border-[#E2E2DD] bg-white shadow-[0_12px_34px_rgba(16,16,16,.03)]">
            <div className="flex min-h-[64px] items-center gap-4 border-b border-[#E9E9E4] px-5 sm:px-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-extrabold tracking-[-0.015em]">Action required</h2>
                  {attentionJobs.length > 0 ? <span className="rounded-full bg-[#DC143C] px-2 py-0.5 text-[9px] font-extrabold text-white">{attentionJobs.length}</span> : null}
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-[#7A7A74]">Highest-risk operational items, sorted by urgency</p>
              </div>
              <Link href="/admin/alerts" className="hidden text-[11px] font-bold text-[#5F5F5A] transition hover:text-[#DC143C] sm:inline-flex">View all alerts</Link>
            </div>

            {priority.length ? (
              <div>
                {priority.map((job, index) => {
                  const issue = issueFor(job);
                  return (
                    <Link
                      key={job.reference}
                      href={`/admin/jobs/${encodeURIComponent(job.reference)}`}
                      className={`group relative grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[#ECECE7] px-5 py-3.5 transition last:border-b-0 hover:bg-[#FAFAF7] sm:px-6 ${index === 0 && issue.tone === "danger" ? "bg-[#DC143C]/[0.022]" : ""}`}
                    >
                      {index === 0 && issue.tone === "danger" ? <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[#DC143C]" /> : null}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em] ${toneClasses(issue.tone)}`}>{issue.label}</span>
                          <span className="text-[10px] font-semibold text-[#90908A]">{relativeAge(job.updated_at)} ago</span>
                        </div>
                        <p className="mt-1.5 truncate text-[13px] font-bold leading-[19px] text-[#171717]">{issue.title}</p>
                        <p className="mt-0.5 truncate text-[11px] font-medium leading-[17px] text-[#70706A]">{job.reference} · {route(job)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden max-w-[140px] text-right sm:block">
                          <p className="truncate text-[10px] font-semibold text-[#777771]">{owner(job)}</p>
                          <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.05em] text-[#A0A09A]">Owner</p>
                        </div>
                        <ChevronRight size={15} className="text-[#B0B0AA] transition group-hover:translate-x-0.5 group-hover:text-[#DC143C]" aria-hidden="true" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[230px] items-center justify-center px-6 py-10 text-center">
                <div className="max-w-sm">
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#F1F1ED] text-[#5F5F5A]"><ShieldAlert size={17} aria-hidden="true" /></span>
                  <p className="mt-4 text-[14px] font-extrabold">No priority blockers</p>
                  <p className="mt-1.5 text-[12px] font-medium leading-5 text-[#777771]">Active shipments have no overdue tasks, exceptions, open customs requirements or ownership gaps.</p>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[17px] border border-[#E2E2DD] bg-white shadow-[0_12px_34px_rgba(16,16,16,.025)]">
            <div className="flex min-h-[64px] items-center border-b border-[#E9E9E4] px-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-extrabold tracking-[-0.015em]">Today</h2>
                <p className="mt-0.5 text-[11px] font-medium text-[#7A7A74]">ETA commitments in Nepal time</p>
              </div>
              <Clock size={15} className="text-[#8B8B85]" aria-hidden="true" />
            </div>

            {today.length ? today.map((job) => (
              <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="group flex min-h-[72px] items-center gap-3 border-b border-[#ECECE7] px-5 py-3 last:border-b-0 hover:bg-[#FAFAF7]">
                <span className="grid h-9 min-w-[52px] place-items-center rounded-[9px] bg-[#F4F4F0] px-2 text-[11px] font-extrabold text-[#31312E]">{etaTime(job)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold leading-[18px]">{shipmentStatusLabels[job.status]}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-semibold leading-[15px] text-[#777771]">{job.reference} · {job.destination || job.current_location || route(job)}</span>
                </span>
                <ChevronRight size={14} className="text-[#B0B0AA] transition group-hover:translate-x-0.5 group-hover:text-[#60605B]" aria-hidden="true" />
              </Link>
            )) : (
              <div className="flex min-h-[230px] items-center justify-center px-6 py-10 text-center">
                <div>
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#F1F1ED] text-[#5F5F5A]"><CalendarDays size={17} aria-hidden="true" /></span>
                  <p className="mt-4 text-[14px] font-extrabold">Nothing due today</p>
                  <p className="mt-1.5 text-[12px] font-medium leading-5 text-[#777771]">No active shipment ETA falls on the current operational date.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[17px] border border-[#E2E2DD] bg-white p-5 shadow-[0_10px_28px_rgba(16,16,16,.025)] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-extrabold tracking-[-0.015em]">Operational flow</h2>
              <p className="mt-1 text-[11px] font-medium text-[#7A7A74]">Current workload from pickup through final delivery</p>
            </div>
            <Link href="/admin/shipments" className="group inline-flex items-center gap-1.5 text-[11px] font-bold text-[#61615C] transition hover:text-[#DC143C]">All shipments <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {movement.map((item, index) => (
              <Link key={item.label} href={item.href} className="group relative overflow-hidden rounded-[13px] border border-[#E7E7E2] bg-[#FAFAF7] p-4 transition hover:-translate-y-0.5 hover:border-[#D5D5CF] hover:bg-white hover:shadow-[0_8px_20px_rgba(16,16,16,.04)]">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#74746E]">0{index + 1} · {item.label}</span>
                  <ChevronRight size={14} className="text-[#B0B0AA] transition group-hover:translate-x-0.5 group-hover:text-[#DC143C]" aria-hidden="true" />
                </div>
                <p className="mt-4 text-[26px] font-extrabold leading-none tracking-[-0.04em]">{item.value}</p>
                <p className="mt-2 text-[10px] font-medium leading-[16px] text-[#7A7A74]">{item.detail}</p>
                <span className="absolute bottom-0 left-0 h-[3px] w-0 bg-[#DC143C] transition-all duration-200 group-hover:w-full" />
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[17px] border border-[#E2E2DD] bg-white shadow-[0_10px_28px_rgba(16,16,16,.02)]">
          <div className="flex min-h-[62px] items-center gap-3 border-b border-[#E9E9E4] px-5 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-extrabold tracking-[-0.015em]">Recent activity</h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#7A7A74]">Latest updates across active job files</p>
            </div>
            <Link href="/admin/shipments" className="text-[11px] font-bold text-[#61615C] transition hover:text-[#DC143C]">View all</Link>
          </div>

          {recent.length ? recent.map((job) => (
            <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="group grid min-h-[62px] grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#ECECE7] px-5 py-3 last:border-b-0 hover:bg-[#FAFAF7] sm:grid-cols-[60px_220px_minmax(0,1fr)_130px_auto] sm:px-6">
              <span className="text-[10px] font-bold text-[#8A8A84]">{timeOnly(job.updated_at)}</span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-bold">{shipmentStatusLabels[job.status]}</span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#7B7B75] sm:hidden">{job.reference}</span>
              </span>
              <span className="hidden min-w-0 truncate text-[11px] font-medium text-[#666660] sm:block">{job.reference} · {job.customer_name}</span>
              <span className="hidden min-w-0 items-center gap-1.5 truncate text-[10px] font-semibold text-[#777771] sm:flex"><User size={11} aria-hidden="true" />{owner(job)}</span>
              <ChevronRight size={14} className="text-[#B0B0AA] transition group-hover:translate-x-0.5 group-hover:text-[#DC143C]" aria-hidden="true" />
            </Link>
          )) : (
            <div className="py-10 text-center"><p className="text-[13px] font-semibold text-[#666660]">No recent shipment activity.</p></div>
          )}
        </section>
      </div>
    </main>
  );
}
