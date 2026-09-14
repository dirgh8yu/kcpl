"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileText,
  MapPin,
  PackageCheck,
  SlidersHorizontal,
  Truck,
  X,
} from "lucide-react";
import { shipmentStatusLabels } from "../../shipment-types";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";
import type { WorkflowOverview } from "./workflow-overview.server";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";
const DAY_MS = 86_400_000;

type Tone = "neutral" | "warning" | "danger" | "success" | "info" | "violet";
type WindowFilter = "live" | "today" | "week";
type WorkflowRow = {
  label: string;
  href: string;
  action: number;
  actionLabel: string;
  supporting: string;
  note: string;
  tone: Tone;
};
type MetricCard = {
  label: string;
  value: number;
  detail: string;
  href: string;
  tone: Tone;
};
type BranchLoad = CommandCentreData["branch_load"][number];
type StaffLoad = CommandCentreData["staff_load"][number];
type Inspector =
  | { kind: "job"; job: CommandCentreJob }
  | { kind: "metric"; metric: MetricCard }
  | { kind: "workflow"; workflow: WorkflowRow }
  | { kind: "branch"; branch: BranchLoad }
  | { kind: "staff"; staff: StaffLoad }
  | null;

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
  if (!job.assigned_to_name && !job.assigned_to_email) return { title: "Shipment has no assigned owner", tone: "violet" as Tone, label: "Unassigned" };
  if (job.priority === "urgent") return { title: "Urgent shipment needs attention", tone: "warning" as Tone, label: "Urgent" };
  if (job.priority === "high") return { title: "High-priority shipment needs attention", tone: "warning" as Tone, label: "High priority" };
  return { title: `${shipmentStatusLabels[job.status]} movement`, tone: "info" as Tone, label: "Active" };
}

function relativeAge(value: string, anchor: string) {
  const time = Date.parse(value);
  const anchorTime = Date.parse(anchor);
  if (!Number.isFinite(time) || !Number.isFinite(anchorTime)) return "Updated";
  const minutes = Math.max(0, Math.round((anchorTime - time) / 60000));
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

function operationalKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: NEPAL_TIME_ZONE }).format(date);
}

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || "Unassigned";
}

function route(job: CommandCentreJob) {
  return `${job.origin || "Origin"} → ${job.destination || "Destination"}`;
}

function workflowRows(overview: WorkflowOverview): WorkflowRow[] {
  const rows: WorkflowRow[] = [];
  if (overview.planning) rows.push({
    label: "Orders & rates", href: "/admin/rating", action: overview.planning.needs_rate_or_selection,
    actionLabel: "need rating", supporting: `${overview.planning.selected_for_procurement} selected · ${overview.planning.booked_orders} booked`,
    note: "Commercial orders moving toward procurement", tone: overview.planning.needs_rate_or_selection ? "warning" : "success",
  });
  if (overview.tendering) rows.push({
    label: "Tender & booking", href: "/admin/tenders", action: overview.tendering.active,
    actionLabel: "active", supporting: `${overview.tendering.accepted_or_countered} accepted/countered · ${overview.tendering.booked} booked`,
    note: "Partner procurement and booking authority", tone: overview.tendering.active ? "info" : "success",
  });
  if (overview.pickup) {
    const action = overview.pickup.missed + overview.pickup.unscheduled;
    rows.push({ label: "Pickup", href: "/admin/pickups", action, actionLabel: "need action", supporting: `${overview.pickup.requested} requested · ${overview.pickup.confirmed} confirmed · ${overview.pickup.picked_up_today} collected today`, note: "Collection scheduling and handoff", tone: overview.pickup.missed ? "danger" : action ? "warning" : "success" });
  }
  if (overview.documents) {
    const action = overview.documents.missing_primary + overview.documents.review_pending;
    rows.push({ label: "Documents", href: "/admin/freight-documents", action, actionLabel: "need action", supporting: `${overview.documents.missing_primary} missing primary · ${overview.documents.review_pending} review pending · ${overview.documents.generated_current} current`, note: "Freight document readiness", tone: overview.documents.missing_primary ? "danger" : action ? "warning" : "success" });
  }
  if (overview.visibility) {
    const action = overview.visibility.delayed + overview.visibility.stale;
    rows.push({ label: "Visibility", href: "/admin/visibility", action, actionLabel: "exceptions", supporting: `${overview.visibility.delayed} delayed · ${overview.visibility.stale} stale · ${overview.visibility.customs} customs · ${overview.visibility.out_for_delivery} final mile`, note: "Tracking freshness and movement exceptions", tone: overview.visibility.delayed ? "danger" : overview.visibility.stale ? "warning" : "success" });
  }
  if (overview.delivery) {
    const action = overview.delivery.failed_or_refused + overview.delivery.pod_pending;
    rows.push({ label: "Delivery & POD", href: "/admin/delivery", action, actionLabel: "need action", supporting: `${overview.delivery.active} out for delivery · ${overview.delivery.pod_pending} POD pending · ${overview.delivery.verified} verified`, note: "Final-mile completion and proof of delivery", tone: overview.delivery.failed_or_refused ? "danger" : overview.delivery.pod_pending ? "warning" : "success" });
  }
  if (overview.finance) {
    const action = overview.finance.payment_blocked + overview.finance.review_required + overview.finance.disputed;
    rows.push({ label: "Freight audit", href: "/admin/freight-audit", action, actionLabel: "need review", supporting: `${overview.finance.payment_blocked} payment blocked · ${overview.finance.disputed} disputed · ${overview.finance.approved_variance} approved variance`, note: "Commercial settlement controls", tone: overview.finance.payment_blocked || overview.finance.disputed ? "danger" : overview.finance.review_required ? "warning" : "violet" });
  }
  return rows;
}

function branchPressureScore(item: BranchLoad) {
  return item.urgent_jobs * 8 + item.overdue_tasks * 5 + item.customs_blockers * 3 + item.deliveries_today + item.active_jobs * 0.1;
}

function staffPressureScore(item: StaffLoad) {
  return item.overdue_tasks * 8 + item.urgent_jobs * 5 + item.open_tasks + item.active_jobs * 0.1;
}

function jobMatchesWindow(job: CommandCentreJob, windowFilter: WindowFilter, data: CommandCentreData) {
  if (windowFilter === "live") return true;
  const updatedDay = operationalKey(job.updated_at);
  const etaDay = job.eta ? operationalKey(job.eta) : "";
  if (windowFilter === "today") return updatedDay === data.operational_date || etaDay === data.operational_date;
  const anchor = Date.parse(data.generated_at);
  const updated = Date.parse(job.updated_at);
  const eta = job.eta ? Date.parse(job.eta) : Number.NaN;
  if (!Number.isFinite(anchor)) return true;
  const recent = Number.isFinite(updated) && updated >= anchor - 7 * DAY_MS;
  const upcoming = Number.isFinite(eta) && eta >= anchor - DAY_MS && eta <= anchor + 7 * DAY_MS;
  return recent || upcoming;
}

function buildBranchLoad(jobs: CommandCentreJob[], branches: CommandCentreData["accessible_branches"], operationalDate: string) {
  const map = new Map<CommandCentreJob["primary_branch"], BranchLoad>();
  const ensure = (branch: CommandCentreJob["primary_branch"]) => {
    const existing = map.get(branch);
    if (existing) return existing;
    const created: BranchLoad = { branch, active_jobs: 0, urgent_jobs: 0, overdue_tasks: 0, customs_blockers: 0, deliveries_today: 0 };
    map.set(branch, created);
    return created;
  };
  branches.forEach(ensure);
  jobs.forEach((job) => {
    const jobBranches = Array.from(new Set([job.primary_branch, ...job.handling_branches]));
    jobBranches.forEach((branch) => {
      const item = ensure(branch);
      item.active_jobs += 1;
      if (job.priority === "urgent") item.urgent_jobs += 1;
      item.overdue_tasks += job.overdue_tasks;
      item.customs_blockers += job.required_customs_open;
      if (job.eta && operationalKey(job.eta) === operationalDate) item.deliveries_today += 1;
    });
  });
  return [...map.values()];
}

function buildStaffLoad(jobs: CommandCentreJob[]) {
  const map = new Map<string, StaffLoad>();
  jobs.forEach((job) => {
    if (!job.assigned_to_uid && !job.assigned_to_email && !job.assigned_to_name) return;
    const key = job.assigned_to_uid || job.assigned_to_email || job.assigned_to_name || job.reference;
    const existing = map.get(key) || {
      key,
      uid: job.assigned_to_uid,
      name: job.assigned_to_name || job.assigned_to_email || "KCPL staff",
      email: job.assigned_to_email || "",
      phone: job.assigned_to_phone,
      active_jobs: 0,
      urgent_jobs: 0,
      open_tasks: 0,
      overdue_tasks: 0,
    };
    existing.active_jobs += 1;
    if (job.priority === "urgent") existing.urgent_jobs += 1;
    existing.open_tasks += job.open_tasks;
    existing.overdue_tasks += job.overdue_tasks;
    map.set(key, existing);
  });
  return [...map.values()];
}

function pressurePercent(value: number, max: number) {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(8, Math.round((value / max) * 100));
}

function InspectorPanel({ inspector, onClose, anchor }: { inspector: NonNullable<Inspector>; onClose: () => void; anchor: string }) {
  let title = "Overview detail";
  let kicker = "Operational context";
  let tone: Tone = "neutral";
  let body: React.ReactNode = null;
  let href = "/admin/shipments";
  let actionLabel = "Open workspace";

  if (inspector.kind === "job") {
    const { job } = inspector;
    const issue = issueFor(job);
    title = issue.title;
    kicker = job.reference;
    tone = issue.tone;
    href = `/admin/jobs/${encodeURIComponent(job.reference)}`;
    actionLabel = "Open Job File";
    body = <dl className="overview-inspector-list">
      <div><dt>Customer</dt><dd>{job.customer_name || "Not linked"}</dd></div>
      <div><dt>Route</dt><dd>{route(job)}</dd></div>
      <div><dt>Status</dt><dd>{shipmentStatusLabels[job.status]}</dd></div>
      <div><dt>Owner</dt><dd>{owner(job)}</dd></div>
      <div><dt>Priority</dt><dd>{job.priority}</dd></div>
      <div><dt>Open tasks</dt><dd>{job.open_tasks}</dd></div>
      <div><dt>Overdue</dt><dd>{job.overdue_tasks}</dd></div>
      <div><dt>Customs open</dt><dd>{job.required_customs_open}</dd></div>
      <div><dt>Last update</dt><dd>{relativeAge(job.updated_at, anchor)}</dd></div>
    </dl>;
  } else if (inspector.kind === "metric") {
    const { metric } = inspector;
    title = metric.label;
    kicker = "Current filtered view";
    tone = metric.tone;
    href = metric.href;
    body = <div className="overview-inspector-metric"><strong>{metric.value}</strong><span>{metric.detail}</span></div>;
  } else if (inspector.kind === "workflow") {
    const { workflow } = inspector;
    title = workflow.label;
    kicker = "Workflow health";
    tone = workflow.tone;
    href = workflow.href;
    body = <div className="overview-inspector-copy"><strong>{workflow.action} {workflow.actionLabel}</strong><p>{workflow.note}</p><span>{workflow.supporting}</span></div>;
  } else if (inspector.kind === "branch") {
    const { branch } = inspector;
    title = branch.branch;
    kicker = "Branch pressure";
    tone = branch.overdue_tasks || branch.customs_blockers || branch.urgent_jobs ? "warning" : "success";
    href = `/admin/branches/${encodeURIComponent(branch.branch)}`;
    actionLabel = "Open branch";
    body = <dl className="overview-inspector-list">
      <div><dt>Active shipments</dt><dd>{branch.active_jobs}</dd></div>
      <div><dt>Urgent</dt><dd>{branch.urgent_jobs}</dd></div>
      <div><dt>Overdue tasks</dt><dd>{branch.overdue_tasks}</dd></div>
      <div><dt>Customs blockers</dt><dd>{branch.customs_blockers}</dd></div>
      <div><dt>Due today</dt><dd>{branch.deliveries_today}</dd></div>
    </dl>;
  } else if (inspector.kind === "staff") {
    const { staff } = inspector;
    title = staff.name;
    kicker = "Assigned workload";
    tone = staff.overdue_tasks || staff.urgent_jobs ? "warning" : "success";
    href = `/admin/workload/${encodeURIComponent(staff.key)}`;
    actionLabel = "Open workload";
    body = <dl className="overview-inspector-list">
      <div><dt>Email</dt><dd>{staff.email || "KCPL staff"}</dd></div>
      <div><dt>Active jobs</dt><dd>{staff.active_jobs}</dd></div>
      <div><dt>Open tasks</dt><dd>{staff.open_tasks}</dd></div>
      <div><dt>Overdue</dt><dd>{staff.overdue_tasks}</dd></div>
      <div><dt>Urgent</dt><dd>{staff.urgent_jobs}</dd></div>
    </dl>;
  }

  return <div className="overview-inspector-shell" data-tone={tone}>
    <button type="button" className="overview-inspector-backdrop" aria-label="Close overview detail" onClick={onClose} />
    <aside className="overview-inspector" aria-label="Overview detail panel">
      <div className="overview-inspector-head">
        <div><p>{kicker}</p><h2>{title}</h2></div>
        <button type="button" className="overview-inspector-close" onClick={onClose} aria-label="Close detail panel"><X size={16} /></button>
      </div>
      <div className="overview-inspector-body">{body}</div>
      <div className="overview-inspector-actions">
        <Link href={href} className="overview-primary-action">{actionLabel}<ArrowRight size={14} /></Link>
        {inspector.kind === "job" ? <Link href="/admin/alerts" className="overview-text-action">Open alerts</Link> : null}
      </div>
    </aside>
  </div>;
}

export function V4OperationsOverview({ data, overview, isManagement = false }: { data: CommandCentreData; overview: WorkflowOverview; isManagement?: boolean }) {
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("live");
  const [branchFilter, setBranchFilter] = useState("all");
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [inspector, setInspector] = useState<Inspector>(null);

  useEffect(() => {
    if (!inspector) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspector(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspector]);

  const branches = useMemo(() => Array.from(new Set([
    ...data.accessible_branches,
    ...data.jobs.map((job) => job.primary_branch),
  ])).sort(), [data.accessible_branches, data.jobs]);

  const filteredJobs = useMemo(() => data.jobs.filter((job) => {
    const branchMatch = branchFilter === "all" || job.primary_branch === branchFilter || job.handling_branches.includes(branchFilter as CommandCentreJob["primary_branch"]);
    return branchMatch && jobMatchesWindow(job, windowFilter, data);
  }), [branchFilter, data, windowFilter]);

  const totals = useMemo(() => ({
    active_jobs: filteredJobs.length,
    exception_jobs: filteredJobs.filter((job) => job.status === "exception").length,
    overdue_tasks: filteredJobs.reduce((sum, job) => sum + job.overdue_tasks, 0),
    customs_blockers: filteredJobs.reduce((sum, job) => sum + job.required_customs_open, 0),
    unassigned_jobs: filteredJobs.filter((job) => !job.assigned_to_name && !job.assigned_to_email).length,
    deliveries_today: filteredJobs.filter((job) => job.eta && operationalKey(job.eta) === data.operational_date).length,
  }), [data.operational_date, filteredJobs]);

  const attentionJobs = useMemo(() => [...filteredJobs].filter((job) => score(job) > 0).sort((a, b) => score(b) - score(a) || Date.parse(b.updated_at) - Date.parse(a.updated_at)), [filteredJobs]);
  const priority = attentionJobs.slice(0, 7);
  const today = [...filteredJobs].filter((job) => job.eta && operationalKey(job.eta) === data.operational_date).sort((a, b) => String(a.eta).localeCompare(String(b.eta))).slice(0, 7);
  const recent = [...filteredJobs].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 8);
  const workflows = workflowRows(overview);
  const branchLoad = buildBranchLoad(filteredJobs, branchFilter === "all" ? data.accessible_branches : [branchFilter as CommandCentreJob["primary_branch"]], data.operational_date)
    .filter((item) => item.active_jobs > 0 || item.overdue_tasks > 0 || item.customs_blockers > 0 || item.deliveries_today > 0)
    .sort((a, b) => branchPressureScore(b) - branchPressureScore(a)).slice(0, 6);
  const staffLoad = buildStaffLoad(filteredJobs).filter((item) => item.active_jobs > 0 || item.open_tasks > 0 || item.overdue_tasks > 0 || item.urgent_jobs > 0).sort((a, b) => staffPressureScore(b) - staffPressureScore(a)).slice(0, 6);
  const maxBranchPressure = Math.max(0, ...branchLoad.map(branchPressureScore));
  const maxStaffPressure = Math.max(0, ...staffLoad.map(staffPressureScore));

  const kpis: MetricCard[] = [
    { label: "Active shipments", value: totals.active_jobs, detail: "Job Files in this view", href: "/admin/shipments", tone: "info" },
    { label: "Exceptions", value: totals.exception_jobs, detail: "Movement exceptions", href: "/admin/alerts", tone: totals.exception_jobs ? "danger" : "success" },
    { label: "Overdue tasks", value: totals.overdue_tasks, detail: "Past operational due time", href: "/admin/alerts", tone: totals.overdue_tasks ? "danger" : "success" },
    { label: "Customs blockers", value: totals.customs_blockers, detail: "Requirements outstanding", href: "/admin/customs", tone: totals.customs_blockers ? "warning" : "success" },
    { label: "Unassigned", value: totals.unassigned_jobs, detail: "Shipments without owner", href: "/admin/shipments", tone: totals.unassigned_jobs ? "violet" : "success" },
    { label: "Due today", value: totals.deliveries_today, detail: "Delivery commitments", href: "/admin/delivery", tone: totals.deliveries_today ? "info" : "success" },
  ];

  return <main className="kcpl-ops-overview">
    <div className="kcpl-ops-overview-inner">
      <header className="overview-intro">
        <div className="overview-heading">
          <p className="overview-kicker">KCPL Operations <span>{isManagement ? "Management lens" : "Operational lens"}</span></p>
          <h1>Operations overview</h1>
          <p className="overview-lede">A live control board for freight risk, commitments, workflow health and workload pressure.</p>
        </div>
        <div className="overview-meta">
          <dl className="overview-meta-list">
            <div><dt>Operational date</dt><dd>{formatOperationalDate(data.operational_date)}</dd></div>
            <div><dt>Snapshot</dt><dd>{dateTime(data.generated_at)}</dd></div>
            <div><dt>Scope</dt><dd>{data.accessible_branches.length ? data.accessible_branches.join(" · ") : "Assigned branches"}</dd></div>
          </dl>
          <div className="overview-header-actions">
            <Link href="/admin/alerts" className="overview-text-action">Open alerts</Link>
            <Link href="/admin/shipments" className="overview-primary-action">Open shipments <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </div>
      </header>

      <section className="overview-controlbar" aria-label="Overview controls">
        <div className="overview-window-control">
          <span><SlidersHorizontal size={13} />Focus window</span>
          <div className="overview-segmented" role="group" aria-label="Overview time window">
            {(["live", "today", "week"] as const).map((value) => <button key={value} type="button" aria-pressed={windowFilter === value} onClick={() => setWindowFilter(value)}>{value === "live" ? "Live" : value === "today" ? "Today" : "7 days"}</button>)}
          </div>
        </div>
        <label className="overview-branch-control" htmlFor="overview-branch-filter">
          <span>Branch</span>
          <select id="overview-branch-filter" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
            <option value="all">All branches</option>
            {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </select>
        </label>
        <p className="overview-filter-summary" aria-live="polite"><CircleDot size={10} />Showing <strong>{filteredJobs.length}</strong> of {data.jobs.length} active Job Files</p>
      </section>

      <nav className="overview-quick-actions" aria-label="Quick desk access">
        <span>Quick desk access</span>
        <Link href="/admin/alerts"><AlertTriangle size={13} />Review alerts</Link>
        <Link href="/admin/shipments"><Truck size={13} />Shipments</Link>
        <Link href="/admin/pickups"><MapPin size={13} />Pickup</Link>
        <Link href="/admin/freight-documents"><FileText size={13} />Documents</Link>
      </nav>

      <section aria-label="Operational status" className="overview-metrics">
        {kpis.map((item) => <button key={item.label} type="button" className="overview-metric" data-tone={item.tone} onClick={() => setInspector({ kind: "metric", metric: item })}>
          <span className="overview-status-dot" aria-hidden="true" />
          <p className="overview-metric-label">{item.label}</p>
          <p className="overview-metric-value">{item.value}</p>
          <p className="overview-metric-detail">{item.detail}</p>
        </button>)}
      </section>

      <section className="overview-workgrid">
        <div className="overview-register overview-priority-register">
          <div className="overview-section-head">
            <div><p className="overview-section-kicker">Needs attention now</p><h2>Priority queue{attentionJobs.length > 0 ? <span className="overview-count">{attentionJobs.length}</span> : null}</h2><p>Highest-risk shipment work first. Select a row to inspect without leaving Overview.</p></div>
            <Link href="/admin/alerts" className="overview-section-link">View all alerts</Link>
          </div>
          {priority.length ? <div className="overview-row-list">{priority.map((job) => {
            const issue = issueFor(job);
            return <button key={job.reference} type="button" className="overview-row" data-tone={issue.tone} onClick={() => setInspector({ kind: "job", job })}>
              <span className="overview-row-state"><span className="overview-tag" data-tone={issue.tone}><span className="overview-status-dot" />{issue.label}</span><span>{relativeAge(job.updated_at, data.generated_at)}</span></span>
              <span className="overview-row-main"><span className="overview-row-title">{issue.title}</span><span className="overview-row-subtitle">{job.reference} · {job.customer_name || "Customer not linked"}</span><span className="overview-row-route">{route(job)}</span></span>
              <span className="overview-row-owner"><small>Owner</small>{owner(job)}</span>
              <ChevronRight size={14} className="overview-row-chevron" aria-hidden="true" />
            </button>;
          })}</div> : <div className="overview-empty"><div><PackageCheck size={18} /><strong>No priority blockers</strong><span>No exceptions, overdue tasks, customs blockers or ownership gaps in the current view.</span></div></div>}
        </div>

        <aside className="overview-register overview-today-register">
          <div className="overview-section-head">
            <div><p className="overview-section-kicker">Today</p><h2>ETA commitments</h2><p>Nepal operational time.</p></div>
            <Link href="/admin/delivery" className="overview-section-link">Delivery desk</Link>
          </div>
          {today.length ? <div className="overview-row-list">{today.map((job) => <button key={job.reference} type="button" className="overview-today-row" onClick={() => setInspector({ kind: "job", job })}>
            <span className="overview-time">{etaTime(job)}</span>
            <span className="overview-today-main"><span className="overview-today-title">{shipmentStatusLabels[job.status]}</span><span className="overview-today-subtitle">{job.reference}</span><span className="overview-today-route">{job.destination || job.current_location || route(job)}</span></span>
            <ChevronRight size={14} className="overview-row-chevron" aria-hidden="true" />
          </button>)}</div> : <div className="overview-empty"><div><PackageCheck size={18} /><strong>Nothing due today</strong><span>No shipment ETA falls on the current operational date in this view.</span></div></div>}
        </aside>
      </section>

      <section className="overview-workflows">
        <div className="overview-section-head">
          <div><p className="overview-section-kicker">Workflow health</p><h2>Operational workstreams</h2><p>Desk-level counters stay network-wide; expand a row for context or open the workspace.</p></div>
        </div>
        {workflows.length ? <div className="overview-workflow-list">{workflows.map((item) => {
          const expanded = expandedWorkflow === item.label;
          return <div key={item.label} className="overview-workflow-entry" data-tone={item.tone}>
            <button type="button" className="overview-workflow-row" data-tone={item.tone} aria-expanded={expanded} onClick={() => setExpandedWorkflow(expanded ? null : item.label)}>
              <span className="overview-workflow-name"><strong><span className="overview-status-dot" />{item.label}</strong><small>{item.note}</small></span>
              <span className="overview-workflow-action"><strong>{item.action}</strong><small>{item.actionLabel}</small></span>
              <span className="overview-workflow-support">{item.supporting}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {expanded ? <div className="overview-workflow-expand">
              <div><span>Current state</span><strong>{item.action} {item.actionLabel}</strong><p>{item.supporting}</p></div>
              <div className="overview-workflow-expand-actions"><button type="button" onClick={() => setInspector({ kind: "workflow", workflow: item })}>Inspect</button><Link href={item.href}>Open workspace <ArrowRight size={12} /></Link></div>
            </div> : null}
          </div>;
        })}</div> : <div className="overview-empty overview-empty-compact"><div><strong>Workflow summaries unavailable</strong><span>Shipment-level data remains available above.</span></div></div>}
      </section>

      <section className="overview-network-grid">
        <div className="overview-register">
          <div className="overview-section-head"><div><p className="overview-section-kicker">Network load</p><h2>Branch pressure</h2><p>Relative pressure based on urgent work, overdue tasks, customs and due-today commitments.</p></div></div>
          {branchLoad.length ? <div className="overview-branch-list">{branchLoad.map((item) => {
            const pressure = branchPressureScore(item);
            const blockers = item.overdue_tasks + item.customs_blockers + item.urgent_jobs;
            return <button key={item.branch} type="button" className="overview-branch-row" data-alert={blockers > 0 ? "true" : "false"} onClick={() => setInspector({ kind: "branch", branch: item })}>
              <span className="overview-branch-name"><strong>{item.branch}</strong><small>{item.active_jobs} active shipment{item.active_jobs === 1 ? "" : "s"}</small><span className="overview-pressure-track"><span style={{ width: `${pressurePercent(pressure, maxBranchPressure)}%` }} /></span></span>
              <span><strong>{item.urgent_jobs}</strong><small>urgent</small></span><span><strong>{item.overdue_tasks}</strong><small>overdue</small></span><span><strong>{item.customs_blockers}</strong><small>customs</small></span><span><strong>{item.deliveries_today}</strong><small>due today</small></span><ChevronRight size={14} aria-hidden="true" />
            </button>;
          })}</div> : <div className="overview-empty overview-empty-compact"><div><strong>No branch pressure</strong><span>No active workload is recorded for this filter.</span></div></div>}
        </div>

        <div className="overview-register">
          <div className="overview-section-head"><div><p className="overview-section-kicker">Ownership</p><h2>Workload</h2><p>Assigned shipment and task pressure in the current filtered view.</p></div></div>
          {staffLoad.length ? <div className="overview-staff-list">{staffLoad.map((item) => {
            const pressure = staffPressureScore(item);
            return <button key={item.key} type="button" className="overview-staff-row" data-alert={item.overdue_tasks > 0 || item.urgent_jobs > 0 ? "true" : "false"} onClick={() => setInspector({ kind: "staff", staff: item })}>
              <span className="overview-staff-name"><strong>{item.name}</strong><small>{item.email || "KCPL staff"}</small><span className="overview-pressure-track"><span style={{ width: `${pressurePercent(pressure, maxStaffPressure)}%` }} /></span></span>
              <span><strong>{item.active_jobs}</strong><small>jobs</small></span><span><strong>{item.open_tasks}</strong><small>tasks</small></span><span><strong>{item.overdue_tasks}</strong><small>overdue</small></span><span><strong>{item.urgent_jobs}</strong><small>urgent</small></span><ChevronRight size={14} aria-hidden="true" />
            </button>;
          })}</div> : <div className="overview-empty overview-empty-compact"><div><strong>No assigned workload</strong><span>Staff workload will appear as shipment ownership and tasks are recorded.</span></div></div>}
        </div>
      </section>

      <section className="overview-activity">
        <div className="overview-section-head"><div><p className="overview-section-kicker">Live activity</p><h2>Recent shipment activity</h2><p>Latest Job File updates in the current branch and time view.</p></div><Link href="/admin/shipments" className="overview-section-link">All shipments</Link></div>
        {recent.length ? <div className="overview-activity-list">{recent.map((job) => <button key={job.reference} type="button" className="overview-activity-row" onClick={() => setInspector({ kind: "job", job })}>
          <span className="overview-activity-time">{timeOnly(job.updated_at)}</span><span className="overview-activity-state"><span className="overview-status-dot" data-tone={job.status === "exception" ? "danger" : "info"} />{shipmentStatusLabels[job.status]}</span><span className="overview-activity-main"><strong>{job.reference}</strong><small>{job.customer_name || route(job)}</small></span><span className="overview-activity-owner">{owner(job)}</span><span className="overview-activity-age">{relativeAge(job.updated_at, data.generated_at)}</span><ChevronRight size={14} aria-hidden="true" />
        </button>)}</div> : <div className="overview-empty overview-empty-compact"><div><strong>No recent shipment activity</strong><span>Try a wider time window or another branch.</span></div></div>}
      </section>
    </div>
    {inspector ? <InspectorPanel inspector={inspector} onClose={() => setInspector(null)} anchor={data.generated_at} /> : null}
  </main>;
}
