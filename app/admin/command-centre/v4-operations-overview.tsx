import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
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
    { label: "Active shipments", value: data.totals.active_jobs, detail: "Open job files", href: "/admin/shipments", alert: false },
    { label: "Exceptions", value: data.totals.exception_jobs, detail: data.totals.exception_jobs === 1 ? "Shipment needs review" : "Shipments need review", href: "/admin/alerts", alert: data.totals.exception_jobs > 0 },
    { label: "Customs blockers", value: data.totals.customs_blockers, detail: "Requirements outstanding", href: "/admin/customs", alert: data.totals.customs_blockers > 0 },
    { label: "Due today", value: data.totals.deliveries_today, detail: "Delivery commitments", href: "/admin/delivery", alert: false },
  ];

  return (
    <main className="kcpl-ops-overview">
      <div className="kcpl-ops-overview-inner">
        <header className="overview-intro">
          <div>
            <p className="overview-kicker">KCPL Operations <span>· Nepal time</span></p>
            <h1>Operations overview</h1>
            <p className="overview-lede">Active freight, operational exceptions, customs blockers and today&apos;s delivery commitments in one working view.</p>
          </div>
          <div className="overview-meta">
            <p className="overview-date">Operational date · {formatOperationalDate(data.operational_date)}</p>
            <Link href="/admin/shipments" className="overview-primary-action">Open shipments <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </header>

        <section aria-label="Operational status" className="overview-metrics">
          {kpis.map((item) => (
            <Link key={item.label} href={item.href} className="overview-metric" data-alert={item.alert ? "true" : "false"}>
              <p className="overview-metric-label"><span>{item.label}</span><ArrowRight size={13} aria-hidden="true" /></p>
              <p className="overview-metric-value">{item.value}</p>
              <p className="overview-metric-detail">{item.detail}</p>
            </Link>
          ))}
        </section>

        <section className="overview-workgrid">
          <div className="overview-panel">
            <div className="overview-section-head">
              <div>
                <h2>Action required{attentionJobs.length > 0 ? <span className="overview-count">{attentionJobs.length}</span> : null}</h2>
                <p>Highest-risk operational items, sorted by urgency.</p>
              </div>
              <Link href="/admin/alerts" className="overview-section-link">View all alerts</Link>
            </div>

            {priority.length ? priority.map((job) => {
              const issue = issueFor(job);
              return (
                <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="overview-row">
                  <span className="overview-row-main">
                    <span className="overview-row-meta">
                      <span className="overview-tag" data-tone={issue.tone}>{issue.label}</span>
                      <span>{relativeAge(job.updated_at)} ago</span>
                    </span>
                    <span className="overview-row-title">{issue.title}</span>
                    <span className="overview-row-subtitle">{job.reference} · {route(job)}</span>
                  </span>
                  <span className="overview-row-side">{owner(job)}<ChevronRight size={14} className="ml-auto mt-2" aria-hidden="true" /></span>
                </Link>
              );
            }) : (
              <div className="overview-empty"><div><strong>No priority blockers</strong><span>Active shipments have no overdue tasks, exceptions, open customs requirements or ownership gaps.</span></div></div>
            )}
          </div>

          <div className="overview-panel">
            <div className="overview-section-head">
              <div><h2>Today</h2><p>ETA commitments in Nepal time.</p></div>
            </div>
            {today.length ? today.map((job) => (
              <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="overview-today-row">
                <span className="overview-time">{etaTime(job)}</span>
                <span className="min-w-0">
                  <span className="overview-today-title block truncate">{shipmentStatusLabels[job.status]}</span>
                  <span className="overview-today-subtitle block truncate">{job.reference} · {job.destination || job.current_location || route(job)}</span>
                </span>
                <ChevronRight size={14} className="text-[#878780]" aria-hidden="true" />
              </Link>
            )) : (
              <div className="overview-empty"><div><strong>Nothing due today</strong><span>No active shipment ETA falls on the current operational date.</span></div></div>
            )}
          </div>
        </section>

        <section className="overview-flow">
          <div className="overview-section-head">
            <div><h2>Operational flow</h2><p>Current workload from pickup through final delivery.</p></div>
            <Link href="/admin/shipments" className="overview-section-link">All shipments</Link>
          </div>
          <div className="overview-flow-grid">
            {movement.map((item, index) => (
              <Link key={item.label} href={item.href} className="overview-flow-item">
                <p className="overview-flow-number">0{index + 1}</p>
                <p className="overview-flow-label">{item.label}</p>
                <p className="overview-flow-value">{item.value}</p>
                <p className="overview-flow-detail">{item.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="overview-activity">
          <div className="overview-section-head">
            <div><h2>Recent activity</h2><p>Latest updates across active job files.</p></div>
            <Link href="/admin/shipments" className="overview-section-link">View all</Link>
          </div>
          {recent.length ? recent.map((job) => (
            <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="overview-activity-row">
              <span>{timeOnly(job.updated_at)}</span>
              <strong className="truncate">{shipmentStatusLabels[job.status]}</strong>
              <span className="truncate">{job.reference} · {job.customer_name}</span>
              <span className="truncate">{owner(job)}</span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          )) : <div className="overview-empty"><div><strong>No recent shipment activity</strong><span>Updates will appear here as active job files change.</span></div></div>}
        </section>
      </div>
    </main>
  );
}
