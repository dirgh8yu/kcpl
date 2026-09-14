"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Truck,
  X,
} from "lucide-react";
import { shipmentStatusLabels } from "../../shipment-types";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsStat,
  OpsStatStrip,
  OpsSurface,
  OpsToolbar,
} from "../operations-ui";
import { compareShipmentPriority, shipmentNeedsAttention, shipmentNextAction } from "../shipments/shipment-queue-policy";
import { useWorkspaceQuery } from "../use-workspace-query";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";
import type { WorkflowOverview } from "./workflow-overview.server";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";
const DAY_MS = 86_400_000;
const VALID_WINDOWS = ["live", "today", "week"] as const;

type Tone = "neutral" | "warning" | "danger" | "success" | "info" | "violet";
type WindowFilter = typeof VALID_WINDOWS[number];
type WorkflowRow = {
  label: string;
  href: string;
  action: number;
  actionLabel: string;
  supporting: string;
  note: string;
  tone: Tone;
};
type MetricKey = "active" | "exception" | "overdue" | "customs" | "unassigned" | "due";
type MetricCard = {
  key: MetricKey;
  label: string;
  value: number;
  detail: string;
  href: string;
  tone: Tone;
};
type BranchLoad = CommandCentreData["branch_load"][number];
type StaffLoad = CommandCentreData["staff_load"][number];
type Inspector = { kind: "job"; job: CommandCentreJob };

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
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: NEPAL_TIME_ZONE,
  }).format(date);
}

function dateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return `${new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: NEPAL_TIME_ZONE,
  }).format(date)} NPT`;
}

function etaTime(job: CommandCentreJob) {
  if (!job.eta) return "—";
  const date = new Date(job.eta);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: NEPAL_TIME_ZONE,
  }).format(date);
}

function formatOperationalDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function operationalKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: NEPAL_TIME_ZONE,
  }).format(date);
}

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || (job.assigned_to_uid ? "Assigned staff" : "Unassigned");
}

function route(job: CommandCentreJob) {
  return `${job.origin || "Origin"} → ${job.destination || "Destination"}`;
}

function workflowRows(overview: WorkflowOverview): WorkflowRow[] {
  const rows: WorkflowRow[] = [];
  if (overview.planning) rows.push({
    label: "Orders & rates",
    href: "/admin/rating",
    action: overview.planning.needs_rate_or_selection,
    actionLabel: "need rating",
    supporting: `${overview.planning.selected_for_procurement} selected · ${overview.planning.booked_orders} booked`,
    note: "Commercial orders moving toward procurement",
    tone: overview.planning.needs_rate_or_selection ? "warning" : "success",
  });
  if (overview.tendering) rows.push({
    label: "Tender & booking",
    href: "/admin/tenders",
    action: overview.tendering.active,
    actionLabel: "active",
    supporting: `${overview.tendering.accepted_or_countered} accepted/countered · ${overview.tendering.booked} booked`,
    note: "Partner procurement and booking authority",
    tone: overview.tendering.active ? "info" : "success",
  });
  if (overview.pickup) {
    const action = overview.pickup.missed + overview.pickup.unscheduled;
    rows.push({
      label: "Pickup",
      href: "/admin/pickups",
      action,
      actionLabel: "need action",
      supporting: `${overview.pickup.requested} requested · ${overview.pickup.confirmed} confirmed · ${overview.pickup.picked_up_today} collected today`,
      note: "Collection scheduling and handoff",
      tone: overview.pickup.missed ? "danger" : action ? "warning" : "success",
    });
  }
  if (overview.documents) {
    const action = overview.documents.missing_primary + overview.documents.review_pending;
    rows.push({
      label: "Documents",
      href: "/admin/freight-documents",
      action,
      actionLabel: "need action",
      supporting: `${overview.documents.missing_primary} missing primary · ${overview.documents.review_pending} review pending · ${overview.documents.generated_current} current`,
      note: "Freight document readiness",
      tone: overview.documents.missing_primary ? "danger" : action ? "warning" : "success",
    });
  }
  if (overview.visibility) {
    const action = overview.visibility.delayed + overview.visibility.stale;
    rows.push({
      label: "Visibility",
      href: "/admin/visibility",
      action,
      actionLabel: "exceptions",
      supporting: `${overview.visibility.delayed} delayed · ${overview.visibility.stale} stale · ${overview.visibility.customs} customs · ${overview.visibility.out_for_delivery} final mile`,
      note: "Tracking freshness and movement exceptions",
      tone: overview.visibility.delayed ? "danger" : overview.visibility.stale ? "warning" : "success",
    });
  }
  if (overview.delivery) {
    const action = overview.delivery.failed_or_refused + overview.delivery.pod_pending;
    rows.push({
      label: "Delivery & POD",
      href: "/admin/delivery",
      action,
      actionLabel: "need action",
      supporting: `${overview.delivery.active} out for delivery · ${overview.delivery.pod_pending} POD pending · ${overview.delivery.verified} verified`,
      note: "Final-mile completion and proof of delivery",
      tone: overview.delivery.failed_or_refused ? "danger" : overview.delivery.pod_pending ? "warning" : "success",
    });
  }
  if (overview.finance) {
    const action = overview.finance.payment_blocked + overview.finance.review_required + overview.finance.disputed;
    rows.push({
      label: "Freight audit",
      href: "/admin/freight-audit",
      action,
      actionLabel: "need review",
      supporting: `${overview.finance.payment_blocked} payment blocked · ${overview.finance.disputed} disputed · ${overview.finance.approved_variance} approved variance`,
      note: "Commercial settlement controls",
      tone: overview.finance.payment_blocked || overview.finance.disputed ? "danger" : overview.finance.review_required ? "warning" : "violet",
    });
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
    Array.from(new Set([job.primary_branch, ...job.handling_branches])).forEach((branch) => {
      const item = ensure(branch);
      item.active_jobs += 1;
      if (job.priority === "urgent" || job.status === "exception") item.urgent_jobs += 1;
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
    if (job.priority === "urgent" || job.status === "exception") existing.urgent_jobs += 1;
    existing.open_tasks += job.open_tasks;
    existing.overdue_tasks += job.overdue_tasks;
    map.set(key, existing);
  });
  return [...map.values()];
}

function metricMatches(job: CommandCentreJob, metric: MetricKey, operationalDate: string) {
  if (metric === "active") return true;
  if (metric === "exception") return job.status === "exception";
  if (metric === "overdue") return job.overdue_tasks > 0;
  if (metric === "customs") return job.required_customs_open > 0;
  if (metric === "unassigned") return !job.assigned_to_uid && !job.assigned_to_name && !job.assigned_to_email;
  return Boolean(job.eta && operationalKey(job.eta) === operationalDate);
}

function statTone(tone: Tone): "neutral" | "accent" | "success" | "warning" | "danger" | "info" {
  return tone === "violet" ? "accent" : tone;
}

function SectionAction({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="overview-section-link">{children}<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></Link>;
}

function InspectorPanel({ job, onClose, anchor, returnTo }: { job: CommandCentreJob; onClose: () => void; anchor: string; returnTo: string }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const issue = shipmentNextAction(job);
  const [path, hash] = issue.href.split("#");
  const href = `${path}?returnTo=${encodeURIComponent(returnTo)}${hash ? `#${hash}` : ""}`;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return <div className="overview-inspector-shell" data-tone={issue.tone}>
    <button type="button" className="overview-inspector-backdrop" aria-label="Close overview detail" onClick={onClose}/>
    <aside className="overview-inspector" aria-label="Overview detail panel">
      <div className="overview-inspector-head">
        <div><p>{job.reference}</p><h2>{issue.title}</h2></div>
        <button ref={closeButtonRef} type="button" className="overview-inspector-close" onClick={onClose} aria-label="Close detail panel"><X size={18} strokeWidth={1.75}/></button>
      </div>
      <div className="overview-inspector-body">
        <dl className="overview-inspector-list">
          <div><dt>Customer</dt><dd>{job.customer_name || "Not linked"}</dd></div>
          <div><dt>Route</dt><dd>{route(job)}</dd></div>
          <div><dt>Status</dt><dd>{shipmentStatusLabels[job.status]}</dd></div>
          <div><dt>Owner</dt><dd>{owner(job)}</dd></div>
          <div><dt>Priority</dt><dd>{job.priority}</dd></div>
          <div><dt>Open tasks</dt><dd>{job.open_tasks}</dd></div>
          <div><dt>Overdue</dt><dd>{job.overdue_tasks}</dd></div>
          <div><dt>Customs open</dt><dd>{job.required_customs_open}</dd></div>
          <div><dt>Last update</dt><dd>{relativeAge(job.updated_at, anchor)}</dd></div>
        </dl>
      </div>
      <div className="overview-inspector-actions">
        <Link href={href} className="overview-primary-action">Open Job File <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></Link>
        <Link href="/admin/alerts" className="overview-text-action">Open alerts</Link>
      </div>
    </aside>
  </div>;
}

export function V4OperationsOverview({ data, overview, isManagement = false }: { data: CommandCentreData; overview: WorkflowOverview; isManagement?: boolean }) {
  const { params, search, update } = useWorkspaceQuery();
  const requestedWindow = params.get("window") ?? "live";
  const windowFilter: WindowFilter = VALID_WINDOWS.includes(requestedWindow as WindowFilter) ? requestedWindow as WindowFilter : "live";
  const requestedBranch = params.get("branch") ?? "all";
  const branchFilter = data.accessible_branches.includes(requestedBranch as CommandCentreJob["primary_branch"]) ? requestedBranch : "all";
  const requestedMetric = params.get("focus") as MetricKey | null;
  const metricFilter: MetricKey | null = requestedMetric && ["active", "exception", "overdue", "customs", "unassigned", "due"].includes(requestedMetric) ? requestedMetric : null;
  const expandedWorkflow = params.get("workflow");
  const selectedReference = params.get("selected");

  const branches = useMemo(() => Array.from(new Set([
    ...data.accessible_branches,
    ...data.jobs.map((job) => job.primary_branch),
  ])).sort(), [data.accessible_branches, data.jobs]);

  const filteredJobs = useMemo(() => data.jobs.filter((job) => {
    const branchMatch = branchFilter === "all" || job.primary_branch === branchFilter || job.handling_branches.includes(branchFilter as CommandCentreJob["primary_branch"]);
    const windowMatch = jobMatchesWindow(job, windowFilter, data);
    const metricMatch = !metricFilter || metricMatches(job, metricFilter, data.operational_date);
    return branchMatch && windowMatch && metricMatch;
  }), [branchFilter, data, metricFilter, windowFilter]);

  const totals = useMemo(() => ({
    active_jobs: filteredJobs.length,
    exception_jobs: filteredJobs.filter((job) => job.status === "exception").length,
    overdue_tasks: filteredJobs.reduce((sum, job) => sum + job.overdue_tasks, 0),
    customs_blockers: filteredJobs.reduce((sum, job) => sum + job.required_customs_open, 0),
    unassigned_jobs: filteredJobs.filter((job) => !job.assigned_to_uid && !job.assigned_to_name && !job.assigned_to_email).length,
    deliveries_today: filteredJobs.filter((job) => job.eta && operationalKey(job.eta) === data.operational_date).length,
  }), [data.operational_date, filteredJobs]);

  const attentionJobs = useMemo(() => [...filteredJobs].filter(shipmentNeedsAttention).sort(compareShipmentPriority), [filteredJobs]);
  const priority = attentionJobs.slice(0, 7);
  const today = useMemo(() => [...filteredJobs]
    .filter((job) => job.eta && operationalKey(job.eta) === data.operational_date)
    .sort((a, b) => String(a.eta).localeCompare(String(b.eta)))
    .slice(0, 7), [data.operational_date, filteredJobs]);
  const recent = useMemo(() => [...filteredJobs]
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, 8), [filteredJobs]);
  const workflows = useMemo(() => workflowRows(overview), [overview]);
  const branchLoad = useMemo(() => buildBranchLoad(
    filteredJobs,
    branchFilter === "all" ? data.accessible_branches : [branchFilter as CommandCentreJob["primary_branch"]],
    data.operational_date,
  ).filter((item) => item.active_jobs > 0 || item.overdue_tasks > 0 || item.customs_blockers > 0 || item.deliveries_today > 0)
    .sort((a, b) => branchPressureScore(b) - branchPressureScore(a))
    .slice(0, 6), [branchFilter, data.accessible_branches, data.operational_date, filteredJobs]);
  const staffLoad = useMemo(() => buildStaffLoad(filteredJobs)
    .filter((item) => item.active_jobs > 0 || item.open_tasks > 0 || item.overdue_tasks > 0 || item.urgent_jobs > 0)
    .sort((a, b) => staffPressureScore(b) - staffPressureScore(a))
    .slice(0, 6), [filteredJobs]);
  const maxBranchPressure = Math.max(0, ...branchLoad.map(branchPressureScore));
  const maxStaffPressure = Math.max(0, ...staffLoad.map(staffPressureScore));

  const kpis: MetricCard[] = [
    { key: "active", label: "Active shipments", value: totals.active_jobs, detail: "Job Files in this view", href: "/admin/shipments", tone: "info" },
    { key: "exception", label: "Exceptions", value: totals.exception_jobs, detail: "Movement exceptions", href: "/admin/alerts", tone: totals.exception_jobs ? "danger" : "success" },
    { key: "overdue", label: "Overdue tasks", value: totals.overdue_tasks, detail: "Past operational due time", href: "/admin/alerts", tone: totals.overdue_tasks ? "danger" : "success" },
    { key: "customs", label: "Customs blockers", value: totals.customs_blockers, detail: "Requirements outstanding", href: "/admin/customs", tone: totals.customs_blockers ? "warning" : "success" },
    { key: "unassigned", label: "Unassigned", value: totals.unassigned_jobs, detail: "Shipments without owner", href: "/admin/shipments", tone: totals.unassigned_jobs ? "violet" : "success" },
    { key: "due", label: "Due today", value: totals.deliveries_today, detail: "Delivery commitments", href: "/admin/delivery", tone: totals.deliveries_today ? "info" : "success" },
  ];

  const selectedJob = selectedReference ? filteredJobs.find((job) => job.reference === selectedReference) : undefined;
  const inspector: Inspector | null = selectedJob ? { kind: "job", job: selectedJob } : null;
  const returnTo = `/admin/command-centre${search}`;
  const filtersActive = windowFilter !== "live" || branchFilter !== "all" || metricFilter !== null;
  const setWindow = (value: WindowFilter) => update({ window: value === "live" ? null : value, selected: null });
  const setBranch = (value: string) => update({ branch: value === "all" ? null : value, selected: null });
  const setMetric = (metric: MetricCard) => update({ focus: metricFilter === metric.key ? null : metric.key, selected: null });
  const setInspector = (next: Inspector | null) => update({ selected: next?.job.reference ?? null });
  const resetFilters = () => update({ window: null, branch: null, focus: null, selected: null });

  return <OpsPage className="kcpl-ops-overview">
    <OpsPageHeader
      eyebrow={`Operations · ${isManagement ? "Management lens" : "Operational lens"}`}
      title="Operations overview"
      description="Live freight risk, commitments, workflow health and ownership pressure across your permitted operating scope."
      meta={<><span>{formatOperationalDate(data.operational_date)}</span><span>Snapshot {dateTime(data.generated_at)}</span><span>{data.accessible_branches.length ? data.accessible_branches.join(" · ") : "Assigned branches"}</span></>}
      actions={<><Link href="/admin/alerts" className="ops-button" data-variant="secondary" data-size="md">Open alerts</Link><Link href="/admin/shipments" className="ops-button" data-variant="primary" data-size="md">Open shipments <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true"/></Link></>}
    >
      <OpsStatStrip className="overview-metrics">
        {kpis.map((item) => <OpsStat key={item.key} active={metricFilter === item.key} onClick={() => setMetric(item)} label={item.label} value={item.value} detail={item.detail} tone={statTone(item.tone)}/>) }
      </OpsStatStrip>
    </OpsPageHeader>

    <div className="ops-content ops-content-wide">
      {data.partial ? <OpsNotice tone="warning">This operational snapshot reached a loading limit. Counts may be incomplete; confirm readiness in the relevant Job File or workflow workspace.</OpsNotice> : null}

      <OpsToolbar className="overview-controlbar">
        <div className="overview-window-control">
          <span><SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true"/>Focus window</span>
          <div className="overview-segmented" role="group" aria-label="Overview time window">
            {VALID_WINDOWS.map((value) => <button key={value} type="button" aria-pressed={windowFilter === value} onClick={() => setWindow(value)}>{value === "live" ? "Live" : value === "today" ? "Today" : "7 days"}</button>)}
          </div>
        </div>
        <label className="overview-branch-control" htmlFor="overview-branch-filter">
          <span>Branch</span>
          <select id="overview-branch-filter" value={branchFilter} onChange={(event) => setBranch(event.target.value)}>
            <option value="all">All branches</option>
            {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </select>
        </label>
        <p className="overview-filter-summary" aria-live="polite">Showing <strong>{filteredJobs.length}</strong> of {data.jobs.length} active Job Files</p>
        {filtersActive ? <OpsButton variant="ghost" onClick={resetFilters}><RotateCcw size={15} strokeWidth={1.75} aria-hidden="true"/>Reset</OpsButton> : null}
      </OpsToolbar>

      <nav className="overview-quick-actions" aria-label="Quick desk access">
        <span>Quick desk access</span>
        <Link href="/admin/alerts"><AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true"/>Review alerts</Link>
        <Link href="/admin/shipments"><Truck size={16} strokeWidth={1.75} aria-hidden="true"/>Shipments</Link>
        <Link href="/admin/pickups"><MapPin size={16} strokeWidth={1.75} aria-hidden="true"/>Pickup</Link>
        <Link href="/admin/freight-documents"><FileText size={16} strokeWidth={1.75} aria-hidden="true"/>Documents</Link>
      </nav>

      <section className="overview-workgrid">
        <OpsSurface className="overview-register overview-priority-register" eyebrow="Needs attention now" title={<>Priority queue{attentionJobs.length ? <span className="overview-count">{attentionJobs.length}</span> : null}</>} description="Highest-risk shipment work first. Select a row for context without leaving Overview." action={<SectionAction href="/admin/alerts">View all alerts</SectionAction>} flush>
          {priority.length ? <div className="overview-row-list">{priority.map((job) => {
            const issue = shipmentNextAction(job);
            return <button key={job.reference} type="button" className="overview-row" data-tone={issue.tone} onClick={() => setInspector({ kind: "job", job })}>
              <span className="overview-row-state"><OpsBadge tone={issue.tone} dot>{issue.label}</OpsBadge><span>{relativeAge(job.updated_at, data.generated_at)}</span></span>
              <span className="overview-row-main"><span className="overview-row-title">{issue.title}</span><span className="overview-row-subtitle">{job.reference} · {job.customer_name || "Customer not linked"}</span><span className="overview-row-route">{route(job)}</span></span>
              <span className="overview-row-owner"><small>Owner</small>{owner(job)}</span>
              <ChevronRight size={16} strokeWidth={1.75} className="overview-row-chevron" aria-hidden="true"/>
            </button>;
          })}</div> : <OpsEmptyState compact kind="healthy" icon={<CheckCircle2 size={20} strokeWidth={1.75}/>} title="No priority blockers" description="No exceptions, overdue tasks, customs blockers or ownership gaps match this view."/>}
        </OpsSurface>

        <OpsSurface className="overview-register overview-today-register" eyebrow="Today" title="ETA commitments" description="Shipment ETAs for the current Nepal operational date." action={<SectionAction href="/admin/delivery">Delivery desk</SectionAction>} flush>
          {today.length ? <div className="overview-row-list">{today.map((job) => <button key={job.reference} type="button" className="overview-today-row" onClick={() => setInspector({ kind: "job", job })}>
            <span className="overview-time">{etaTime(job)}</span>
            <span className="overview-today-main"><span className="overview-today-title">{shipmentStatusLabels[job.status]}</span><span className="overview-today-subtitle">{job.reference}</span><span className="overview-today-route">{job.destination || job.current_location || route(job)}</span></span>
            <ChevronRight size={16} strokeWidth={1.75} className="overview-row-chevron" aria-hidden="true"/>
          </button>)}</div> : <OpsEmptyState compact kind="healthy" icon={<CheckCircle2 size={20} strokeWidth={1.75}/>} title="Nothing due today" description="No shipment ETA falls on the current operational date in this view."/>}
        </OpsSurface>
      </section>

      <OpsSurface className="overview-workflows" eyebrow="Workflow health" title="Operational workstreams" description="Desk-level counters remain network-wide. Expand a workstream for context or open its workspace." flush>
        {workflows.length ? <div className="overview-workflow-list">{workflows.map((item) => {
          const expanded = expandedWorkflow === item.label;
          return <div key={item.label} className="overview-workflow-entry" data-tone={item.tone}>
            <button type="button" className="overview-workflow-row" data-tone={item.tone} aria-expanded={expanded} onClick={() => update({ workflow: expanded ? null : item.label })}>
              <span className="overview-workflow-name"><strong><span className="overview-status-dot" data-tone={item.tone}/>{item.label}</strong><small>{item.note}</small></span>
              <span className="overview-workflow-action"><strong>{item.action}</strong><small>{item.actionLabel}</small></span>
              <span className="overview-workflow-support">{item.supporting}</span>
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true"/>
            </button>
            {expanded ? <div className="overview-workflow-expand"><div><span>Current state</span><strong>{item.action} {item.actionLabel}</strong><p>{item.supporting}</p></div><div className="overview-workflow-expand-actions"><Link href={item.href}>Open workspace <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></Link></div></div> : null}
          </div>;
        })}</div> : <OpsEmptyState compact kind="unavailable" title="Workflow summaries unavailable" description="Shipment-level data remains available above. Some desk summaries could not be loaded."/>}
      </OpsSurface>

      <section className="overview-network-grid">
        <OpsSurface className="overview-register" eyebrow="Network load" title="Branch pressure" description="Relative pressure from urgent work, overdue tasks, customs blockers and due-today commitments." flush>
          {branchLoad.length ? <div className="overview-branch-list">{branchLoad.map((item) => {
            const pressure = branchPressureScore(item);
            const percent = maxBranchPressure > 0 ? Math.max(8, Math.round((pressure / maxBranchPressure) * 100)) : 0;
            const blockers = item.overdue_tasks + item.customs_blockers + item.urgent_jobs;
            return <button key={item.branch} type="button" className="overview-branch-row" data-alert={blockers > 0 ? "true" : "false"} onClick={() => setBranch(item.branch)}>
              <span className="overview-branch-name"><strong>{item.branch}</strong><small>{item.active_jobs} active shipment{item.active_jobs === 1 ? "" : "s"}</small><span className="overview-pressure-track"><span style={{ width: `${percent}%` }}/></span></span>
              <span><strong>{item.urgent_jobs}</strong><small>urgent</small></span><span><strong>{item.overdue_tasks}</strong><small>overdue</small></span><span><strong>{item.customs_blockers}</strong><small>customs</small></span><span><strong>{item.deliveries_today}</strong><small>due today</small></span>
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true"/>
            </button>;
          })}</div> : <OpsEmptyState compact kind="healthy" title="No branch pressure" description="No active workload is recorded for this filter."/>}
        </OpsSurface>

        <OpsSurface className="overview-register" eyebrow="Ownership" title="Workload" description="Assigned shipment and task pressure in the current filtered view." flush>
          {staffLoad.length ? <div className="overview-staff-list">{staffLoad.map((item) => {
            const pressure = staffPressureScore(item);
            const percent = maxStaffPressure > 0 ? Math.max(8, Math.round((pressure / maxStaffPressure) * 100)) : 0;
            return <Link key={item.key} href={`/admin/workload/${encodeURIComponent(item.key)}`} className="overview-staff-row" data-alert={item.overdue_tasks > 0 || item.urgent_jobs > 0 ? "true" : "false"}>
              <span className="overview-staff-name"><strong>{item.name}</strong><small>{item.email || "KCPL staff"}</small><span className="overview-pressure-track"><span style={{ width: `${percent}%` }}/></span></span>
              <span><strong>{item.active_jobs}</strong><small>jobs</small></span><span><strong>{item.open_tasks}</strong><small>tasks</small></span><span><strong>{item.overdue_tasks}</strong><small>overdue</small></span><span><strong>{item.urgent_jobs}</strong><small>urgent</small></span>
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true"/>
            </Link>;
          })}</div> : <OpsEmptyState compact title="No assigned workload" description="Staff workload will appear as shipment ownership and tasks are recorded."/>}
        </OpsSurface>
      </section>

      <OpsSurface className="overview-activity" eyebrow="Live activity" title="Recent shipment activity" description="Latest Job File updates in the current branch and time view." action={<SectionAction href="/admin/shipments">All shipments</SectionAction>} flush>
        {recent.length ? <div className="overview-activity-list">{recent.map((job) => <button key={job.reference} type="button" className="overview-activity-row" onClick={() => setInspector({ kind: "job", job })}>
          <span className="overview-activity-time">{timeOnly(job.updated_at)}</span>
          <span className="overview-activity-state"><span className="overview-status-dot" data-tone={job.status === "exception" ? "danger" : "info"}/>{shipmentStatusLabels[job.status]}</span>
          <span className="overview-activity-main"><strong>{job.reference}</strong><small>{job.customer_name || route(job)}</small></span>
          <span className="overview-activity-owner">{owner(job)}</span>
          <span className="overview-activity-age">{relativeAge(job.updated_at, data.generated_at)}</span>
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true"/>
        </button>)}</div> : <OpsEmptyState compact kind="search" title="No recent shipment activity" description="Try a wider time window, reset the status focus, or choose another branch." action={filtersActive ? <OpsButton variant="secondary" onClick={resetFilters}>Reset filters</OpsButton> : undefined}/>} 
      </OpsSurface>
    </div>

    {inspector ? <InspectorPanel job={inspector.job} onClose={() => setInspector(null)} anchor={data.generated_at} returnTo={returnTo}/> : null}
  </OpsPage>;
}
