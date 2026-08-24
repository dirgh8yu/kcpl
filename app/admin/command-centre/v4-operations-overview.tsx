import Link from "next/link";
import { shipmentStatusLabels } from "../../shipment-types";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";
import type { WorkflowOverview } from "./workflow-overview.server";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

type Tone = "danger" | "warning" | "info";
type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  age: string;
  href: string;
  tone: Tone;
  score: number;
};

type MovementItem = { label: string; value: number; href: string };

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

function operationalDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00+05:45`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: NEPAL_TIME_ZONE }).format(date);
}

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || "Unassigned";
}

function route(job: CommandCentreJob) {
  const origin = job.origin || "Origin";
  const destination = job.destination || "Destination";
  return `${origin} → ${destination}`;
}

function workflowAttention(overview: WorkflowOverview): AttentionItem[] {
  const items: AttentionItem[] = [];
  const add = (condition: number | undefined, item: Omit<AttentionItem, "id"> & { id: string }) => {
    if ((condition ?? 0) > 0) items.push(item);
  };

  add(overview.pickup?.missed, {
    id: "pickup-missed",
    title: `${overview.pickup?.missed ?? 0} missed pickup${overview.pickup?.missed === 1 ? "" : "s"}`,
    detail: "Pickup exceptions need rescheduling or operational follow-up",
    meta: "Pickup desk",
    age: "Open",
    href: "/admin/pickups",
    tone: "danger",
    score: 94,
  });
  add(overview.delivery?.failed_or_refused, {
    id: "delivery-failed",
    title: `${overview.delivery?.failed_or_refused ?? 0} failed or refused deliver${overview.delivery?.failed_or_refused === 1 ? "y" : "ies"}`,
    detail: "Final-mile attempts require review before completion",
    meta: "Delivery control",
    age: "Open",
    href: "/admin/delivery",
    tone: "danger",
    score: 92,
  });
  add(overview.finance?.payment_blocked, {
    id: "payment-blocked",
    title: `${overview.finance?.payment_blocked ?? 0} supplier payment${overview.finance?.payment_blocked === 1 ? "" : "s"} blocked`,
    detail: "Freight Audit has unresolved payment authority blockers",
    meta: "Freight audit",
    age: "Open",
    href: "/admin/freight-audit",
    tone: "danger",
    score: 90,
  });
  add(overview.delivery?.pod_pending, {
    id: "pod-pending",
    title: `${overview.delivery?.pod_pending ?? 0} delivered shipment${overview.delivery?.pod_pending === 1 ? "" : "s"} awaiting POD`,
    detail: "Physical delivery exists but canonical completion is still pending verified evidence",
    meta: "Delivery control",
    age: "Open",
    href: "/admin/delivery",
    tone: "warning",
    score: 84,
  });
  add(overview.documents?.missing_primary, {
    id: "documents-missing",
    title: `${overview.documents?.missing_primary ?? 0} shipment${overview.documents?.missing_primary === 1 ? "" : "s"} missing a primary freight document`,
    detail: "Execution document set is incomplete",
    meta: "Documents",
    age: "Open",
    href: "/admin/freight-documents",
    tone: "warning",
    score: 78,
  });
  add(overview.visibility?.delayed, {
    id: "visibility-delayed",
    title: `${overview.visibility?.delayed ?? 0} delayed shipment${overview.visibility?.delayed === 1 ? "" : "s"}`,
    detail: "Tracking visibility reports movement behind the current plan",
    meta: "Live visibility",
    age: "Open",
    href: "/admin/visibility",
    tone: "warning",
    score: 76,
  });
  add(overview.visibility?.stale, {
    id: "visibility-stale",
    title: `${overview.visibility?.stale ?? 0} stale tracking feed${overview.visibility?.stale === 1 ? "" : "s"}`,
    detail: "Carrier observations have not refreshed within the expected window",
    meta: "Live visibility",
    age: "Open",
    href: "/admin/visibility",
    tone: "warning",
    score: 70,
  });
  add(overview.finance?.disputed, {
    id: "finance-disputed",
    title: `${overview.finance?.disputed ?? 0} freight audit dispute${overview.finance?.disputed === 1 ? "" : "s"}`,
    detail: "Supplier cost variance remains disputed",
    meta: "Freight audit",
    age: "Open",
    href: "/admin/freight-audit",
    tone: "warning",
    score: 68,
  });
  add(overview.documents?.review_pending, {
    id: "documents-review",
    title: `${overview.documents?.review_pending ?? 0} freight document${overview.documents?.review_pending === 1 ? "" : "s"} awaiting review`,
    detail: "Generated or received documents still need document authority review",
    meta: "Documents",
    age: "Open",
    href: "/admin/freight-documents",
    tone: "info",
    score: 58,
  });
  add(overview.finance?.review_required, {
    id: "finance-review",
    title: `${overview.finance?.review_required ?? 0} supplier bill${overview.finance?.review_required === 1 ? "" : "s"} require review`,
    detail: "Match-Pay could not clear these supplier obligations automatically",
    meta: "Freight audit",
    age: "Open",
    href: "/admin/freight-audit",
    tone: "info",
    score: 56,
  });

  return items;
}

function shipmentAttention(data: CommandCentreData): AttentionItem[] {
  return data.jobs.filter((job) => score(job) > 0).map((job) => {
    const issue = issueFor(job);
    return {
      id: `shipment-${job.reference}`,
      title: issue.title,
      detail: `${route(job)} · ${job.reference}`,
      meta: owner(job),
      age: relativeAge(job.updated_at),
      href: `/admin/jobs/${encodeURIComponent(job.reference)}`,
      tone: issue.tone,
      score: score(job),
    };
  });
}

function movementCounts(data: CommandCentreData, overview: WorkflowOverview): MovementItem[] {
  const items: MovementItem[] = [];
  if (overview.planning) {
    items.push({
      label: "Orders",
      value: overview.planning.needs_rate_or_selection + overview.planning.selected_for_procurement + overview.planning.booked_orders,
      href: "/admin/rating",
    });
  }
  if (overview.tendering) {
    items.push({ label: "Tender", value: overview.tendering.active, href: "/admin/tenders" });
    items.push({ label: "Booked", value: overview.tendering.booked, href: "/admin/tenders" });
  }
  if (overview.pickup) {
    items.push({ label: "Pickup", value: overview.pickup.unscheduled + overview.pickup.requested + overview.pickup.confirmed, href: "/admin/pickups" });
  }
  items.push({ label: "In transit", value: data.jobs.filter((job) => job.status === "in_transit").length, href: "/admin/shipments" });
  items.push({ label: "Customs", value: overview.visibility?.customs ?? data.jobs.filter((job) => job.status === "customs_clearance").length, href: "/admin/customs" });
  items.push({ label: "Delivery", value: overview.delivery?.active ?? data.jobs.filter((job) => job.status === "out_for_delivery").length, href: "/admin/delivery" });
  return items;
}

function toneDot(tone: Tone) {
  if (tone === "danger") return "#b13a43";
  if (tone === "warning") return "#a46600";
  return "#2563a6";
}

export function V4OperationsOverview({ data, overview }: { data: CommandCentreData; overview: WorkflowOverview }) {
  const allAttention = [...shipmentAttention(data), ...workflowAttention(overview)]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const priority = allAttention.slice(0, 5);
  const today = data.jobs
    .filter((job) => job.eta?.slice(0, 10) === data.operational_date)
    .sort((a, b) => String(a.eta).localeCompare(String(b.eta)))
    .slice(0, 5);
  const recent = [...data.jobs].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 3);
  const movement = movementCounts(data, overview);
  const canCreateTransportOrder = overview.planning !== null;

  return <main className="min-h-[calc(100vh-54px)] bg-[#f6f6f3] px-4 pb-10 pt-8 text-[#141414] sm:px-6 lg:px-7">
    <div className="mx-auto w-full max-w-[1152px]">
      <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-4 border-b border-[#e2e2e2] pb-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-[30px]">Operations</h1>
          <p className="mt-1 text-[13px] leading-[19px] text-[#5b5b5b]">{data.totals.active_jobs} active shipments · {data.totals.exception_jobs} exceptions · {data.totals.customs_blockers} customs blockers · {data.totals.deliveries_today} due today</p>
        </div>
        <Link href={canCreateTransportOrder ? "/admin/rating" : "/admin/shipments"} className="inline-flex h-8 items-center justify-center rounded-[8px] bg-[#dc143c] px-3 text-[12px] font-semibold leading-[17px] text-white transition hover:bg-[#c81035]">
          {canCreateTransportOrder ? "New transport order" : "Open shipments"}
        </Link>
      </header>

      <section className="grid gap-6 py-6 xl:grid-cols-[minmax(0,760px)_minmax(320px,1fr)]">
        <div className="overflow-hidden rounded-[12px] border border-[#e2e2e2] bg-white shadow-[0_12px_24px_-8px_rgba(0,0,0,.03),0_2px_8px_rgba(0,0,0,.04)]">
          <div className="flex h-11 items-center justify-between border-b border-[#e2e2e2] px-4">
            <h2 className="text-[15px] font-semibold leading-[22px]">Priority queue</h2>
            <Link href="/admin/alerts" className="text-[12px] font-medium leading-[17px] text-[#5b5b5b] hover:text-[#141414]">{allAttention.length} requiring action</Link>
          </div>
          {priority.length ? priority.map((item, index) => <Link key={item.id} href={item.href} className={`relative flex min-h-[60px] items-center gap-3 border-b border-[#e2e2e2] px-4 py-2.5 transition last:border-b-0 hover:bg-[#fbfbf9] ${index === 0 && item.tone === "danger" ? "bg-[#fff8f9]" : ""}`}>
            {index === 0 && item.tone === "danger" ? <span className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-[2px] bg-[#dc143c]"/> : null}
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: toneDot(item.tone) }}/>
            <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-medium leading-[19px]">{item.title}</strong><span className="block truncate text-[12px] font-medium leading-[17px] text-[#5b5b5b]">{item.detail}</span></span>
            <span className="hidden w-[104px] truncate text-right text-[12px] font-medium text-[#5b5b5b] sm:block">{item.meta}</span>
            <span className="w-[46px] text-right text-[12px] font-semibold text-[#737373]">{item.age}</span>
          </Link>) : <div className="grid min-h-[300px] place-items-center px-6 text-center"><div><p className="text-[15px] font-semibold">No priority blockers</p><p className="mt-1 text-[12px] text-[#737373]">Current accessible workflows do not require escalation.</p></div></div>}
        </div>

        <div className="rounded-[12px] border border-[#e8e8e8] bg-[#fafafa] px-4 py-1">
          <div className="flex h-11 items-center justify-between border-b border-[#e2e2e2]"><h2 className="text-[15px] font-semibold leading-[22px]">Today&apos;s ETA watch</h2><span className="text-[12px] font-medium text-[#5b5b5b]">{operationalDateLabel(data.operational_date)}</span></div>
          {today.length ? today.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex min-h-[60px] items-center gap-3 border-b border-[#e2e2e2] last:border-b-0 hover:bg-white/70">
            <strong className="w-[50px] text-[12px] font-semibold leading-[17px]">{etaTime(job)}</strong><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium leading-[19px]">{shipmentStatusLabels[job.status]} · {job.reference}</span><span className="block truncate text-[11px] font-medium leading-[15px] text-[#5b5b5b]">{job.destination || job.current_location || route(job)}</span></span>
          </Link>) : <div className="grid min-h-[300px] place-items-center px-5 text-center"><div><p className="text-[14px] font-semibold">No shipment ETA today</p><p className="mt-1 text-[12px] text-[#737373]">No accessible shipment has an ETA on the current Nepal operational date.</p></div></div>}
        </div>
      </section>

      <section className="rounded-[16px] border border-[#e2e2e2] bg-[#f7f7f5] px-5 py-5 shadow-[0_2px_5px_rgba(0,0,0,.04)]">
        <div className="flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold leading-[22px]">Movement</h2><span className="text-[11px] font-medium text-[#737373]">Accessible workflow stages only</span></div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
          {movement.map((item, index) => <Link key={item.label} href={item.href} className={`flex min-h-[74px] flex-col items-center justify-center px-3 py-2.5 transition hover:bg-white/70 ${index < movement.length - 1 ? "xl:border-r xl:border-[#e2e2e2]" : ""}`}><span className="text-[11px] font-medium leading-[15px] text-[#5b5b5b]">{item.label}</span><strong className="mt-0.5 text-[18px] font-semibold leading-[26px]">{item.value}</strong></Link>)}
        </div>
      </section>

      <section className="mt-4 rounded-[12px] border border-[#ececec] bg-[#fafafa] px-5 py-[18px]">
        <div className="flex h-[34px] items-center"><h2 className="text-[15px] font-semibold leading-[22px]">Recent shipment changes</h2><Link href="/admin/shipments" className="ml-auto text-[12px] font-medium leading-[17px] text-[#5b5b5b] hover:text-[#141414]">View shipments</Link></div>
        {recent.length ? recent.map((job) => <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex min-h-[44px] items-center gap-3 border-b border-[#e2e2e2] text-[12px] last:border-b-0 hover:bg-white/60 sm:gap-4">
          <span className="w-[48px] shrink-0 text-[11px] font-medium text-[#737373]">{timeOnly(job.updated_at)}</span><span className="w-[250px] truncate text-[13px] font-medium">{shipmentStatusLabels[job.status]} · {job.current_location || route(job)}</span><span className="min-w-0 flex-1 truncate font-medium text-[#5b5b5b]">{job.reference} · {job.customer_name}</span><span className="hidden text-[11px] font-medium text-[#737373] sm:block">Shipment record</span>
        </Link>) : <p className="py-6 text-[12px] text-[#737373]">No accessible shipment changes are available.</p>}
      </section>
    </div>
  </main>;
}
