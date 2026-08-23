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

  return <main className="min-h-[calc(100vh-54px)] bg-[#f6f6f3] px-4 pb-10 pt-8 text-[#141414] sm:px-6 lg:px-7">
    <div className="mx-auto w-full max-w-[1152px]">
      <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-4 border-b border-[#e2e2e2] pb-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-[30px]">Operations</h1>
          <p className="mt-1 text-[13px] leading-[19px] text-[#5b5b5b]">{data.totals.active_jobs} active shipments · {data.totals.exception_jobs} exceptions · {data.totals.customs_blockers} customs clearance · {data.totals.deliveries_today} due today</p>
        </div>
        <Link href="/admin/rating" className="inline-flex h-8 items-center justify-center rounded-[8px] bg-[#dc143c] px-3 text-[12px] font-semibold leading-[17px] text-white transition hover:bg-[#c81035]">New transport order</Link>
      </header>

      <section className="grid gap-6 py-6 xl:grid-cols-[minmax(0,760px)_minmax(320px,1fr)]">
        <div className="overflow-hidden rounded-[12px] border border-[#e2e2e2] bg-white shadow-[0_12px_24px_-8px_rgba(0,0,0,.03),0_2px_8px_rgba(0,0,0,.04)]">
          <div className="flex h-11 items-center justify-between border-b border-[#e2e2e2] px-4"><h2 className="text-[15px] font-semibold leading-[22px]">Priority queue</h2><Link href="/admin/alerts" className="text-[12px] font-medium leading-[17px] text-[#5b5b5b] hover:text-[#141414]">{priority.length} requiring action</Link></div>
          {priority.length ? priority.map((job, index) => {
            const issue = issueFor(job);
            const dot = issue.tone === "danger" ? "#b13a43" : issue.tone === "warning" ? "#a46600" : "#2563a6";
            return <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className={`relative flex min-h-[60px] items-center gap-3 border-b border-[#e2e2e2] px-4 py-2.5 transition last:border-b-0 hover:bg-[#fbfbf9] ${index === 0 && issue.tone === "danger" ? "bg-[#fff8f9]" : ""}`}>
              {index === 0 && issue.tone === "danger" ? <span className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-[2px] bg-[#dc143c]"/> : null}
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: dot }}/>
              <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-medium leading-[19px]">{issue.title}</strong><span className="block truncate text-[12px] font-medium leading-[17px] text-[#5b5b5b]">{route(job)} · {job.reference}</span></span>
              <span className="hidden w-[92px] truncate text-right text-[12px] font-medium text-[#5b5b5b] sm:block">{owner(job)}</span>
              <span className="w-[46px] text-right text-[12px] font-semibold text-[#737373]">{relativeAge(job.updated_at)}</span>
            </Link>;
          }) : <div className="grid min-h-[300px] place-items-center px-6 text-center"><div><p className="text-[15px] font-semibold">No priority blockers</p><p className="mt-1 text-[12px] text-[#737373]">Current active shipments do not require escalation.</p></div></div>}
        </div>

        <div className="rounded-[12px] border border-[#e8e8e8] bg-[#fafafa] px-4 py-1">
          <div className="flex h-11 items-center justify-between border-b border-[#e2e2e2]"><h2 className="text-[15px] font-semibold leading-[22px]">Today</h2><span className="text-[12px] font-medium text-[#5b5b5b]">Nepal time</span></div>
          {today.length ? today.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex min-h-[60px] items-center gap-3 border-b border-[#e2e2e2] last:border-b-0 hover:bg-white/70">
            <strong className="w-[50px] text-[12px] font-semibold leading-[17px]">{etaTime(job)}</strong><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium leading-[19px]">{shipmentStatusLabels[job.status]} · {job.reference}</span><span className="block truncate text-[11px] font-medium leading-[15px] text-[#5b5b5b]">{job.destination || job.current_location || route(job)}</span></span>
          </Link>) : <div className="grid min-h-[300px] place-items-center px-5 text-center"><div><p className="text-[14px] font-semibold">Nothing due today</p><p className="mt-1 text-[12px] text-[#737373]">No shipment ETA falls on the current operational date.</p></div></div>}
        </div>
      </section>

      <section className="rounded-[16px] border border-[#e2e2e2] bg-[#f7f7f5] px-5 py-5 shadow-[0_2px_5px_rgba(0,0,0,.04)]">
        <h2 className="text-[15px] font-semibold leading-[22px]">Movement</h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
          {movement.map((item, index) => <Link key={item.label} href={item.href} className={`flex min-h-[74px] flex-col items-center justify-center px-3 py-2.5 transition hover:bg-white/70 ${index < movement.length - 1 ? "xl:border-r xl:border-[#e2e2e2]" : ""}`}><span className="text-[11px] font-medium leading-[15px] text-[#5b5b5b]">{item.label}</span><strong className="mt-0.5 text-[18px] font-semibold leading-[26px]">{item.value}</strong></Link>)}
        </div>
      </section>

      <section className="mt-4 rounded-[12px] border border-[#ececec] bg-[#fafafa] px-5 py-[18px]">
        <div className="flex h-[34px] items-center"><h2 className="text-[15px] font-semibold leading-[22px]">Recent activity</h2><Link href="/admin/shipments" className="ml-auto text-[12px] font-medium leading-[17px] text-[#5b5b5b] hover:text-[#141414]">View all</Link></div>
        {recent.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex min-h-[44px] items-center gap-3 border-b border-[#e2e2e2] text-[12px] last:border-b-0 hover:bg-white/60 sm:gap-4">
          <span className="w-[48px] shrink-0 text-[11px] font-medium text-[#737373]">{timeOnly(job.updated_at)}</span><span className="w-[250px] truncate text-[13px] font-medium">{shipmentStatusLabels[job.status]} · {job.current_location || route(job)}</span><span className="min-w-0 flex-1 truncate font-medium text-[#5b5b5b]">{job.reference} · {job.customer_name}</span><span className="hidden text-[11px] font-medium text-[#737373] sm:block">Shipment update</span>
        </Link>)}
      </section>
    </div>
  </main>;
}
