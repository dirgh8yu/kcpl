import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { shipmentStatusLabels } from "../../shipment-types";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";
import type { WorkflowOverview } from "./workflow-overview.server";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";
type Tone = "neutral" | "warning" | "danger" | "success";
type WorkflowRow = {
  label: string;
  href: string;
  action: number;
  actionLabel: string;
  supporting: string;
  note: string;
  tone: Tone;
};

function score(job: CommandCentreJob) {
  return (job.status === "exception" ? 100 : 0) +
    (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) +
    job.overdue_tasks * 10 +
    job.required_customs_open * 4 +
    (!job.assigned_to_name && !job.assigned_to_email ? 3 : 0);
}

function issueFor(job: CommandCentreJob) {
  if (job.status === "exception") return { title: "Shipment exception requires review", tone: "danger" as Tone, label: "Exception" };
  if (job.overdue_tasks > 0) return { title: `${job.overdue_tasks} overdue operational task${job.overdue_tasks === 1 ? "" : "s"}`, tone: "danger" as Tone, label: "Overdue" };
  if (job.required_customs_open > 0) return { title: `${job.required_customs_open} customs requirement${job.required_customs_open === 1 ? "" : "s"} open`, tone: "warning" as Tone, label: "Customs" };
  if (!job.assigned_to_name && !job.assigned_to_email) return { title: "Shipment has no assigned owner", tone: "warning" as Tone, label: "Unassigned" };
  if (job.priority === "urgent") return { title: "Urgent shipment needs attention", tone: "warning" as Tone, label: "Urgent" };
  if (job.priority === "high") return { title: "High-priority shipment needs attention", tone: "warning" as Tone, label: "High priority" };
  return { title: `${shipmentStatusLabels[job.status]} movement`, tone: "neutral" as Tone, label: "Active" };
}

function relativeAge(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Updated";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function timeOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: NEPAL_TIME_ZONE }).format(date);
}

function dateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return `${new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: NEPAL_TIME_ZONE }).format(date)} NPT`;
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
  return new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || "Unassigned";
}

function route(job: CommandCentreJob) {
  const origin = job.origin || "Origin";
  const destination = job.destination || "Destination";
  return `${origin} → ${destination}`;
}

function workflowRows(overview: WorkflowOverview): WorkflowRow[] {
  const rows: WorkflowRow[] = [];

  if (overview.planning) {
    rows.push({
      label: "Orders & rates",
      href: "/admin/rating",
      action: overview.planning.needs_rate_or_selection,
      actionLabel: "need rating",
      supporting: `${overview.planning.selected_for_procurement} selected · ${overview.planning.booked_orders} booked`,
      note: "Commercial orders moving toward procurement",
      tone: overview.planning.needs_rate_or_selection ? "warning" : "success",
    });
  }
  if (overview.tendering) {
    rows.push({
      label: "Tender & booking",
      href: "/admin/tenders",
      action: overview.tendering.active,
      actionLabel: "active",
      supporting: `${overview.tendering.accepted_or_countered} accepted/countered · ${overview.tendering.booked} booked`,
      note: "Partner procurement and booking authority",
      tone: overview.tendering.active ? "neutral" : "success",
    });
  }
  if (overview.pickup) {
    const pickupAttention = overview.pickup.missed + overview.pickup.unscheduled;
    rows.push({
      label: "Pickup",
      href: "/admin/pickups",
      action: pickupAttention,
      actionLabel: "need action",
      supporting: `${overview.pickup.requested} requested · ${overview.pickup.confirmed} confirmed · ${overview.pickup.picked_up_today} collected today`,
      note: "Collection scheduling and handoff",
      tone: overview.pickup.missed ? "danger" : pickupAttention ? "warning" : "success",
    });
  }
  if (overview.documents) {
    const documentAttention = overview.documents.missing_primary + overview.documents.review_pending;
    rows.push({
      label: "Documents",
      href: "/admin/freight-documents",
      action: documentAttention,
      actionLabel: "need action",
      supporting: `${overview.documents.missing_primary} missing primary · ${overview.documents.review_pending} review pending · ${overview.documents.generated_current} current`,
      note: "Freight document readiness",
      tone: overview.documents.missing_primary ? "danger" : documentAttention ? "warning" : "success",
    });
  }
  if (overview.visibility) {
    const visibilityAttention = overview.visibility.delayed + overview.visibility.stale;
    rows.push({
      label: "Visibility",
      href: "/admin/visibility",
      action: visibilityAttention,
      actionLabel: "exceptions",
      supporting: `${overview.visibility.delayed} delayed · ${overview.visibility.stale} stale · ${overview.visibility.customs} customs · ${overview.visibility.out_for_delivery} final mile`,
      note: "Tracking freshness and movement exceptions",
      tone: overview.visibility.delayed ? "danger" : overview.visibility.stale ? "warning" : "success",
    });
  }
  if (overview.delivery) {
    const deliveryAttention = overview.delivery.failed_or_refused + overview.delivery.pod_pending;
    rows.push({
      label: "Delivery & POD",
      href: "/admin/delivery",
      action: deliveryAttention,
      actionLabel: "need action",
      supporting: `${overview.delivery.active} out for delivery · ${overview.delivery.pod_pending} POD pending · ${overview.delivery.verified} verified`,
      note: "Final-mile completion and proof of delivery",
      tone: overview.delivery.failed_or_refused ? "danger" : overview.delivery.pod_pending ? "warning" : "success",
    });
  }
  if (overview.finance) {
    const financeAttention = overview.finance.payment_blocked + overview.finance.review_required + overview.finance.disputed;
    rows.push({
      label: "Freight audit",
      href: "/admin/freight-audit",
      action: financeAttention,
      actionLabel: "need review",
      supporting: `${overview.finance.payment_blocked} payment blocked · ${overview.finance.disputed} disputed · ${overview.finance.approved_variance} approved variance`,
      note: "Commercial settlement controls",
      tone: overview.finance.payment_blocked || overview.finance.disputed ? "danger" : overview.finance.review_required ? "warning" : "success",
    });
  }

  return rows;
}

function branchPressureScore(item: CommandCentreData["branch_load"][number]) {
  return item.urgent_jobs * 8 + item.overdue_tasks * 5 + item.customs_blockers * 3 + item.deliveries_today + item.active_jobs * 0.1;
}

function staffPressureScore(item: CommandCentreData["staff_load"][number]) {
  return item.overdue_tasks * 8 + item.urgent_jobs * 5 + item.open_tasks + item.active_jobs * 0.1;
}

export function V4OperationsOverview({ data, overview }: { data: CommandCentreData; overview: WorkflowOverview }) {
  const attentionJobs = [...data.jobs]
    .filter((job) => score(job) > 0)
    .sort((a, b) => score(b) - score(a) || Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const priority = attentionJobs.slice(0, 7);
  const today = data.jobs
    .filter((job) => job.eta?.slice(0, 10) === data.operational_date)
    .sort((a, b) => String(a.eta).localeCompare(String(b.eta)))
    .slice(0, 7);
  const recent = [...data.jobs]
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, 6);
  const workflows = workflowRows(overview);
  const branchLoad = [...data.branch_load]
    .filter((item) => item.active_jobs > 0 || item.overdue_tasks > 0 || item.customs_blockers > 0 || item.deliveries_today > 0)
    .sort((a, b) => branchPressureScore(b) - branchPressureScore(a))
    .slice(0, 6);
  const staffLoad = [...data.staff_load]
    .filter((item) => item.active_jobs > 0 || item.open_tasks > 0 || item.overdue_tasks > 0 || item.urgent_jobs > 0)
    .sort((a, b) => staffPressureScore(b) - staffPressureScore(a))
    .slice(0, 6);

  const kpis = [
    { label: "Active shipments", value: data.totals.active_jobs, detail: "Open job files", href: "/admin/shipments", tone: "neutral" as Tone },
    { label: "Exceptions", value: data.totals.exception_jobs, detail: "Movement exceptions", href: "/admin/alerts", tone: data.totals.exception_jobs ? "danger" as Tone : "success" as Tone },
    { label: "Overdue tasks", value: data.totals.overdue_tasks, detail: "Past operational due time", href: "/admin/alerts", tone: data.totals.overdue_tasks ? "danger" as Tone : "success" as Tone },
    { label: "Customs blockers", value: data.totals.customs_blockers, detail: "Requirements outstanding", href: "/admin/customs", tone: data.totals.customs_blockers ? "warning" as Tone : "success" as Tone },
    { label: "Unassigned", value: data.totals.unassigned_jobs, detail: "Shipments without owner", href: "/admin/shipments", tone: data.totals.unassigned_jobs ? "warning" as Tone : "success" as Tone },
    { label: "Due today", value: data.totals.deliveries_today, detail: "Delivery commitments", href: "/admin/delivery", tone: "neutral" as Tone },
  ];

  return (
    <main className="kcpl-ops-overview">
      <div className="kcpl-ops-overview-inner">
        <header className="overview-intro">
          <div className="overview-heading">
            <p className="overview-kicker">KCPL Operations <span>Control board</span></p>
            <h1>Operations overview</h1>
            <p className="overview-lede">The operational picture for active freight: what needs action, what is due, and where workload is building.</p>
          </div>
          <div className="overview-meta">
            <dl className="overview-meta-list">
              <div><dt>Operational date</dt><dd>{formatOperationalDate(data.operational_date)}</dd></div>
              <div><dt>Data refreshed</dt><dd>{dateTime(data.generated_at)}</dd></div>
              <div><dt>Scope</dt><dd>{data.accessible_branches.length ? data.accessible_branches.join(" · ") : "Assigned branches"}</dd></div>
            </dl>
            <div className="overview-header-actions">
              <Link href="/admin/alerts" className="overview-text-action">Open alerts</Link>
              <Link href="/admin/shipments" className="overview-primary-action">Open shipments <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </div>
        </header>

        <section aria-label="Operational status" className="overview-metrics">
          {kpis.map((item) => (
            <Link key={item.label} href={item.href} className="overview-metric" data-tone={item.tone}>
              <p className="overview-metric-label">{item.label}</p>
              <p className="overview-metric-value">{item.value}</p>
              <p className="overview-metric-detail">{item.detail}</p>
            </Link>
          ))}
        </section>

        <section className="overview-workgrid">
          <div className="overview-register overview-priority-register">
            <div className="overview-section-head">
              <div>
                <p className="overview-section-kicker">Priority queue</p>
                <h2>Action required{attentionJobs.length > 0 ? <span className="overview-count">{attentionJobs.length}</span> : null}</h2>
                <p>Highest-risk shipment work first.</p>
              </div>
              <Link href="/admin/alerts" className="overview-section-link">View all alerts</Link>
            </div>

            {priority.length ? <div className="overview-row-list">{priority.map((job) => {
              const issue = issueFor(job);
              return (
                <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="overview-row">
                  <span className="overview-row-state"><span className="overview-tag" data-tone={issue.tone}>{issue.label}</span><span>{relativeAge(job.updated_at)}</span></span>
                  <span className="overview-row-main">
                    <span className="overview-row-title">{issue.title}</span>
                    <span className="overview-row-subtitle">{job.reference} · {job.customer_name || "Customer not linked"}</span>
                    <span className="overview-row-route">{route(job)}</span>
                  </span>
                  <span className="overview-row-owner"><small>Owner</small>{owner(job)}</span>
                  <ChevronRight size={14} className="overview-row-chevron" aria-hidden="true" />
                </Link>
              );
            })}</div> : (
              <div className="overview-empty"><div><strong>No priority blockers</strong><span>Active shipments have no overdue tasks, exceptions, open customs requirements or ownership gaps.</span></div></div>
            )}
          </div>

          <aside className="overview-register overview-today-register">
            <div className="overview-section-head">
              <div><p className="overview-section-kicker">Today</p><h2>ETA commitments</h2><p>Nepal operational time.</p></div>
              <Link href="/admin/delivery" className="overview-section-link">Delivery desk</Link>
            </div>
            {today.length ? <div className="overview-row-list">{today.map((job) => (
              <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="overview-today-row">
                <span className="overview-time">{etaTime(job)}</span>
                <span className="overview-today-main">
                  <span className="overview-today-title">{shipmentStatusLabels[job.status]}</span>
                  <span className="overview-today-subtitle">{job.reference}</span>
                  <span className="overview-today-route">{job.destination || job.current_location || route(job)}</span>
                </span>
                <ChevronRight size={14} className="overview-row-chevron" aria-hidden="true" />
              </Link>
            ))}</div> : (
              <div className="overview-empty"><div><strong>Nothing due today</strong><span>No active shipment ETA falls on the current operational date.</span></div></div>
            )}
          </aside>
        </section>

        <section className="overview-workflows">
          <div className="overview-section-head">
            <div><p className="overview-section-kicker">Workflow health</p><h2>Operational workstreams</h2><p>Cross-workspace queues without opening every desk.</p></div>
          </div>
          {workflows.length ? <div className="overview-workflow-list">{workflows.map((item) => (
            <Link key={item.label} href={item.href} className="overview-workflow-row" data-tone={item.tone}>
              <span className="overview-workflow-name"><strong>{item.label}</strong><small>{item.note}</small></span>
              <span className="overview-workflow-action"><strong>{item.action}</strong><small>{item.actionLabel}</small></span>
              <span className="overview-workflow-support">{item.supporting}</span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          ))}</div> : <div className="overview-empty overview-empty-compact"><div><strong>Workflow summaries unavailable</strong><span>Shipment-level data remains available above.</span></div></div>}
        </section>

        <section className="overview-network-grid">
          <div className="overview-register">
            <div className="overview-section-head">
              <div><p className="overview-section-kicker">Network load</p><h2>Branch pressure</h2><p>Where operational work is concentrated.</p></div>
            </div>
            {branchLoad.length ? <div className="overview-branch-list">{branchLoad.map((item) => {
              const blockers = item.overdue_tasks + item.customs_blockers + item.urgent_jobs;
              return (
                <Link key={item.branch} href={`/admin/branches/${encodeURIComponent(item.branch)}`} className="overview-branch-row" data-alert={blockers > 0 ? "true" : "false"}>
                  <span className="overview-branch-name"><strong>{item.branch}</strong><small>{item.active_jobs} active shipment{item.active_jobs === 1 ? "" : "s"}</small></span>
                  <span><strong>{item.urgent_jobs}</strong><small>urgent</small></span>
                  <span><strong>{item.overdue_tasks}</strong><small>overdue</small></span>
                  <span><strong>{item.customs_blockers}</strong><small>customs</small></span>
                  <span><strong>{item.deliveries_today}</strong><small>due today</small></span>
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              );
            })}</div> : <div className="overview-empty overview-empty-compact"><div><strong>No branch pressure</strong><span>No active workload is currently recorded across your accessible branches.</span></div></div>}
          </div>

          <div className="overview-register">
            <div className="overview-section-head">
              <div><p className="overview-section-kicker">Ownership</p><h2>Workload</h2><p>Assigned shipment and task pressure.</p></div>
            </div>
            {staffLoad.length ? <div className="overview-staff-list">{staffLoad.map((item) => (
              <Link key={item.key} href={`/admin/workload/${encodeURIComponent(item.key)}`} className="overview-staff-row" data-alert={item.overdue_tasks > 0 || item.urgent_jobs > 0 ? "true" : "false"}>
                <span className="overview-staff-name"><strong>{item.name}</strong><small>{item.email || "KCPL staff"}</small></span>
                <span><strong>{item.active_jobs}</strong><small>jobs</small></span>
                <span><strong>{item.open_tasks}</strong><small>tasks</small></span>
                <span><strong>{item.overdue_tasks}</strong><small>overdue</small></span>
                <span><strong>{item.urgent_jobs}</strong><small>urgent</small></span>
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            ))}</div> : <div className="overview-empty overview-empty-compact"><div><strong>No assigned workload</strong><span>Staff workload will appear here as shipment ownership and tasks are recorded.</span></div></div>}
          </div>
        </section>

        <section className="overview-activity">
          <div className="overview-section-head">
            <div><p className="overview-section-kicker">Audit trail</p><h2>Recent activity</h2><p>Latest shipment updates across active Job Files.</p></div>
            <Link href="/admin/shipments" className="overview-section-link">All shipments</Link>
          </div>
          {recent.length ? <div className="overview-activity-list">{recent.map((job) => (
            <Link key={job.reference} href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="overview-activity-row">
              <span className="overview-activity-time">{timeOnly(job.updated_at)}</span>
              <span className="overview-activity-state">{shipmentStatusLabels[job.status]}</span>
              <span className="overview-activity-main"><strong>{job.reference}</strong><small>{job.customer_name || route(job)}</small></span>
              <span className="overview-activity-owner">{owner(job)}</span>
              <span className="overview-activity-age">{relativeAge(job.updated_at)}</span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          ))}</div> : <div className="overview-empty overview-empty-compact"><div><strong>No recent shipment activity</strong><span>Updates will appear here as active Job Files change.</span></div></div>}
        </section>
      </div>
    </main>
  );
}
