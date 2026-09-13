import Link from "next/link";
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
  if (job.status === "exception") return { title: "Shipment exception requires review", tone: "danger" as const };
  if (job.overdue_tasks > 0) return { title: `${job.overdue_tasks} overdue operational task${job.overdue_tasks === 1 ? "" : "s"}`, tone: "danger" as const };
  if (job.required_customs_open > 0) return { title: `${job.required_customs_open} customs requirement${job.required_customs_open === 1 ? "" : "s"} open`, tone: "warning" as const };
  if (!job.assigned_to_name && !job.assigned_to_email) return { title: "Shipment has no assigned owner", tone: "info" as const };
  if (job.priority === "urgent") return { title: "Urgent shipment needs attention", tone: "warning" as const };
  if (job.priority === "high") return { title: "High-priority shipment needs attention", tone: "warning" as const };
  return { title: `${shipmentStatusLabels[job.status]} movement`, tone: "info" as const };
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

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || "Unassigned";
}

function route(job: CommandCentreJob) {
  const origin = job.origin || "Origin";
  const destination = job.destination || "Destination";
  return `${origin} → ${destination}`;
}

function movementCounts(data: CommandCentreData, overview: WorkflowOverview) {
  const orderCount = overview.planning
    ? overview.planning.needs_rate_or_selection + overview.planning.selected_for_procurement + overview.planning.booked_orders
    : 0;
  const tenderCount = overview.tendering?.active ?? 0;
  const bookedCount = overview.tendering?.booked ?? overview.planning?.booked_orders ?? 0;
  const pickupCount = overview.pickup
    ? overview.pickup.unscheduled + overview.pickup.requested + overview.pickup.confirmed
    : 0;
  return [
    { label: "Orders", value: orderCount, href: "/admin/rating" },
    { label: "Tender", value: tenderCount, href: "/admin/tenders" },
    { label: "Booked", value: bookedCount, href: "/admin/tenders" },
    { label: "Pickup", value: pickupCount, href: "/admin/pickups" },
    { label: "In transit", value: data.jobs.filter((job) => job.status === "in_transit").length, href: "/admin/shipments" },
    { label: "Customs", value: data.jobs.filter((job) => job.status === "customs_clearance").length, href: "/admin/customs" },
    { label: "Delivery", value: data.jobs.filter((job) => job.status === "out_for_delivery").length, href: "/admin/delivery" },
  ];
}

export function V4OperationsOverview({ data, overview }: { data: CommandCentreData; overview: WorkflowOverview }) {
  const priority = [...data.jobs].filter((job) => score(job) > 0).sort((a, b) => score(b) - score(a) || Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 5);
  const today = data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).sort((a, b) => String(a.eta).localeCompare(String(b.eta))).slice(0, 5);
  const recent = [...data.jobs].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 3);
  const movement = movementCounts(data, overview);

  return <main className="min-h-[calc(100vh-56px)] bg-[#F6F6F3] px-4 pb-12 pt-8 text-[#101010] sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-[1180px]">
      <header className="flex min-h-[96px] flex-wrap items-end justify-between gap-5 border-b border-[#E2E2DD] pb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#DC143C]">KCPL Operations</p>
          <h1 className="mt-1 text-[28px] font-extrabold leading-[36px] tracking-[-0.035em]">Overview</h1>
          <p className="mt-1.5 text-[13px] font-medium leading-[20px] text-[#60605B]">{data.totals.active_jobs} active shipments · {data.totals.exception_jobs} exceptions · {data.totals.customs_blockers} customs clearance · {data.totals.deliveries_today} due today</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/shipments" className="inline-flex h-10 items-center justify-center rounded-[9px] border border-[#DCDCD7] bg-white px-4 text-[12px] font-semibold text-[#101010] transition hover:border-[#C7C7C1]">View shipments</Link>
          <Link href="/admin/rating" className="inline-flex h-10 items-center justify-center rounded-[9px] bg-[#DC143C] px-4 text-[12px] font-semibold text-white shadow-[0_8px_20px_rgba(220,20,60,.14)] transition hover:bg-[#C41235]">Open Rate Desk</Link>
        </div>
      </header>

      <section className="grid gap-5 py-6 xl:grid-cols-[minmax(0,760px)_minmax(320px,1fr)]">
        <div className="overflow-hidden rounded-[16px] border border-[#E2E2DD] bg-white shadow-[0_12px_32px_rgba(16,16,16,.035)]">
          <div className="flex h-12 items-center justify-between border-b border-[#E8E8E3] px-5"><h2 className="text-[14px] font-bold leading-[20px]">Priority queue</h2><Link href="/admin/alerts" className="text-[11px] font-semibold leading-[17px] text-[#6A6A64] transition hover:text-[#DC143C]">{priority.length} requiring action</Link></div>
          {priority.length ? priority.map((job, index) => {
            const issue = issueFor(job);
            const dot = issue.tone === "danger" ? "#DC143C" : issue.tone === "warning" ? "#9B6100" : "#346AA0";
            return <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className={`relative flex min-h-[66px] items-center gap-3 border-b border-[#ECECE7] px-5 py-3 transition last:border-b-0 hover:bg-[#FAFAF7] ${index === 0 && issue.tone === "danger" ? "bg-[#DC143C]/[0.025]" : ""}`}>
              {index === 0 && issue.tone === "danger" ? <span className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-[#DC143C]"/> : null}
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: dot }}/>
              <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-semibold leading-[19px]">{issue.title}</strong><span className="block truncate text-[11px] font-medium leading-[17px] text-[#666660]">{route(job)} · {job.reference}</span></span>
              <span className="hidden w-[100px] truncate text-right text-[11px] font-semibold text-[#666660] sm:block">{owner(job)}</span>
              <span className="w-[46px] text-right text-[11px] font-bold text-[#85857F]">{relativeAge(job.updated_at)}</span>
            </Link>;
          }) : <div className="grid min-h-[300px] place-items-center px-6 text-center"><div><p className="text-[14px] font-bold">No priority blockers</p><p className="mt-1 text-[12px] font-medium text-[#777771]">Current active shipments do not require escalation.</p></div></div>}
        </div>

        <div className="overflow-hidden rounded-[16px] border border-[#E2E2DD] bg-white px-5 shadow-[0_12px_32px_rgba(16,16,16,.025)]">
          <div className="flex h-12 items-center justify-between border-b border-[#E8E8E3]"><h2 className="text-[14px] font-bold leading-[20px]">Today</h2><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#85857F]">Nepal time</span></div>
          {today.length ? today.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex min-h-[66px] items-center gap-3 border-b border-[#ECECE7] last:border-b-0 hover:bg-[#FAFAF7]">
            <strong className="w-[50px] text-[11px] font-bold leading-[17px]">{etaTime(job)}</strong><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold leading-[19px]">{shipmentStatusLabels[job.status]} · {job.reference}</span><span className="block truncate text-[11px] font-medium leading-[15px] text-[#666660]">{job.destination || job.current_location || route(job)}</span></span>
          </Link>) : <div className="grid min-h-[300px] place-items-center px-5 text-center"><div><p className="text-[14px] font-bold">Nothing due today</p><p className="mt-1 text-[12px] font-medium text-[#777771]">No shipment ETA falls on the current operational date.</p></div></div>}
        </div>
      </section>

      <section className="rounded-[16px] border border-[#E2E2DD] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(16,16,16,.025)]">
        <div className="flex items-center justify-between"><h2 className="text-[14px] font-bold leading-[20px]">Movement</h2><Link href="/admin/shipments" className="text-[11px] font-semibold text-[#666660] transition hover:text-[#DC143C]">Open shipments</Link></div>
        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-[12px] border border-[#ECECE7] sm:grid-cols-4 xl:grid-cols-7">
          {movement.map((item, index) => <Link key={item.label} href={item.href} className={`flex min-h-[82px] flex-col items-center justify-center bg-[#FAFAF7] px-3 py-3 transition hover:bg-white ${index < movement.length - 1 ? "xl:border-r xl:border-[#E8E8E3]" : ""}`}><span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#72726C]">{item.label}</span><strong className="mt-1 text-[20px] font-extrabold leading-[26px] tracking-[-0.02em]">{item.value}</strong></Link>)}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[16px] border border-[#E2E2DD] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(16,16,16,.02)]">
        <div className="flex h-9 items-center"><h2 className="text-[14px] font-bold leading-[20px]">Recent activity</h2><Link href="/admin/shipments" className="ml-auto text-[11px] font-semibold leading-[17px] text-[#666660] transition hover:text-[#DC143C]">View all shipments</Link></div>
        {recent.length ? recent.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex min-h-[48px] items-center gap-3 border-b border-[#ECECE7] text-[12px] last:border-b-0 hover:bg-[#FAFAF7] sm:gap-4">
          <span className="w-[48px] shrink-0 text-[10px] font-semibold text-[#85857F]">{timeOnly(job.updated_at)}</span><span className="w-[250px] truncate text-[12px] font-semibold">{shipmentStatusLabels[job.status]} · {job.current_location || route(job)}</span><span className="min-w-0 flex-1 truncate font-medium text-[#666660]">{job.reference} · {job.customer_name}</span><span className="hidden text-[10px] font-semibold uppercase tracking-[0.05em] text-[#85857F] sm:block">Shipment update</span>
        </Link>) : <div className="py-8 text-center"><p className="text-[13px] font-semibold text-[#666660]">No recent shipment activity.</p></div>}
      </section>
    </div>
  </main>;
}
