"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  MoreHorizontal,
  PackageCheck,
  Plane,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRoundX,
  X,
} from "lucide-react";
import { shipmentStatusLabels, type ShipmentStatus } from "../../shipment-types";
import {
  compareShipmentPriority,
  shipmentNeedsAttention,
  shipmentNextAction,
} from "../shipments/shipment-queue-policy";
import { useWorkspaceQuery } from "../use-workspace-query";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";
import type { OperationalNote } from "./operational-notes.server";
import type { OverviewFinanceSnapshot } from "./overview-finance.server";
import type { OverviewActivity, OverviewMovement, WorkflowOverview } from "./workflow-overview.server";
import styles from "./overview-dashboard.module.css";
import extras from "./overview-dashboard-extras.module.css";

const DAY_MS = 86_400_000;
// Mirrors --app-duration-fast in overview-dashboard.module.css; keep the two in step.
const LAUNCHER_EXIT_MS = 120;
const creationModes = ["road", "ocean", "air", "rail"] as const;
type CreationMode = typeof creationModes[number];
type Tone = "danger" | "warning" | "success" | "info" | "neutral" | "violet";

type DashboardProps = {
  data: CommandCentreData;
  workflow: WorkflowOverview;
  finance: OverviewFinanceSnapshot | null;
  note: OperationalNote | null;
  userName: string;
  selectedBranch: string;
  branches: string[];
  canViewCommercial: boolean;
  canPostNotes: boolean;
};

type CreateOrderResponse = {
  ok?: boolean;
  error?: string;
  order?: { id: string };
};

type Metric = { href: string; label: string; value: number; tone: Tone };

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || (job.assigned_to_uid ? "Assigned staff" : "Unassigned");
}

function formatOperationalDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatNepalTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "NPT";
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kathmandu",
  }).format(parsed);
}

function relativeAge(value: string, anchor: string) {
  const time = Date.parse(value);
  const anchorTime = Date.parse(anchor);
  if (!Number.isFinite(time) || !Number.isFinite(anchorTime)) return "Updated";
  const minutes = Math.max(0, Math.round((anchorTime - time) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function ageShort(value: string, anchor: string) {
  const time = Date.parse(value);
  const anchorTime = Date.parse(anchor);
  if (!Number.isFinite(time) || !Number.isFinite(anchorTime)) return { label: "—", danger: false };
  const hours = Math.max(0, (anchorTime - time) / 3_600_000);
  if (hours < 1) return { label: "<1h", danger: false };
  if (hours < 24) return { label: `${Math.round(hours)}h`, danger: false };
  const days = Math.max(1, Math.round(hours / 24));
  return { label: `${days}d`, danger: days >= 2 };
}

/** How long until it lands. Negative means it is already overdue against its ETA. */
function etaShort(value: string | null, anchor: string) {
  if (!value) return { label: "ETA unset", late: false };
  const time = Date.parse(value);
  const anchorTime = Date.parse(anchor);
  if (!Number.isFinite(time) || !Number.isFinite(anchorTime)) return { label: "ETA unset", late: false };
  const hours = (time - anchorTime) / 3_600_000;
  if (hours < 0) {
    const overdue = Math.abs(hours);
    return { label: overdue < 24 ? `${Math.round(overdue)}h late` : `${Math.round(overdue / 24)}d late`, late: true };
  }
  if (hours < 1) return { label: "due now", late: false };
  if (hours < 24) return { label: `in ${Math.round(hours)}h`, late: false };
  return { label: `in ${Math.round(hours / 24)}d`, late: false };
}

function statusTone(status: ShipmentStatus): Tone {
  if (status === "exception") return "danger";
  if (status === "customs_clearance" || status === "preparing") return "warning";
  if (status === "delivered") return "success";
  if (status === "in_transit" || status === "booking_confirmed" || status === "out_for_delivery") return "info";
  return "neutral";
}

function statusClass(tone: Tone) {
  if (tone === "danger") return styles.statusDanger;
  if (tone === "warning") return styles.statusWarning;
  if (tone === "success") return styles.statusSuccess;
  if (tone === "info") return styles.statusInfo;
  return styles.statusNeutral;
}

function jobHref(reference: string, returnTo: string) {
  return `/admin/jobs/${encodeURIComponent(reference)}?returnTo=${encodeURIComponent(returnTo)}`;
}

function withReturn(href: string, returnTo: string) {
  const [path, hash] = href.split("#");
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}returnTo=${encodeURIComponent(returnTo)}${hash ? `#${hash}` : ""}`;
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-AU")}`;
  }
}

const PULSE_POLL_MS = 60_000;

/** Compact live shipments summary for the Overview. Polls the same
 * register-refresh endpoint the shipments workspace uses — no new backend —
 * and keeps its own quiet state; failures and hidden tabs leave the last
 * server-rendered numbers in place. Rows list the shipments that changed
 * status since the previous snapshot, so the widget earns its "live" label. */
function ShipmentsPulse({ initialData, returnTo }: { initialData: CommandCentreData; returnTo: string }) {
  const [snapshot, setSnapshot] = useState(initialData);
  const [changes, setChanges] = useState<Array<{ reference: string; to: ShipmentStatus }>>([]);
  const appliedAtRef = useRef(Date.parse(initialData.generated_at) || 0);
  const knownStatusesRef = useRef(new Map(initialData.jobs.map((job) => [job.reference, job.status])));

  useEffect(() => {
    let disposed = false;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/admin/shipments/queue", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const result = await response.json() as { ok?: boolean; data?: CommandCentreData };
          if (disposed || !result.ok || !result.data) return;
          const incoming = result.data;
          const generatedAt = Date.parse(incoming.generated_at) || 0;
          if (generatedAt <= appliedAtRef.current) return;
          // A partial snapshot must never replace a complete one.
          if (!initialData.partial && incoming.partial) return;
          appliedAtRef.current = generatedAt;
          const nextChanges: Array<{ reference: string; to: ShipmentStatus }> = [];
          for (const job of incoming.jobs) {
            const before = knownStatusesRef.current.get(job.reference);
            if (before && before !== job.status) nextChanges.push({ reference: job.reference, to: job.status });
          }
          knownStatusesRef.current = new Map(incoming.jobs.map((job) => [job.reference, job.status]));
          setChanges(nextChanges.slice(0, 3));
          setSnapshot(incoming);
        })
        .catch(() => { /* the widget keeps the last good snapshot */ });
    };
    const timer = window.setInterval(poll, PULSE_POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { disposed = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [initialData.partial]);

  const active = snapshot.jobs.filter((job) => job.status !== "delivered");
  const inTransit = active.filter((job) => job.status === "in_transit").length;
  const outForDelivery = active.filter((job) => job.status === "out_for_delivery").length;
  const customsHold = active.filter((job) => job.status === "customs_clearance").length;
  const attention = active.filter(shipmentNeedsAttention).length;
  const rows: Array<{ label: string; value: number; tone: Tone; href: string }> = [
    { label: "In transit", value: inTransit, tone: "info", href: "/admin/shipments?status=in_transit" },
    { label: "Delivery", value: outForDelivery, tone: "violet", href: "/admin/shipments?status=out_for_delivery" },
    { label: "Customs", value: customsHold, tone: "warning", href: "/admin/shipments?status=customs_clearance" },
    { label: "Attention", value: attention, tone: "danger", href: "/admin/shipments?attention=1" },
  ];

  return (
    <section className={`${styles.card} ${extras.pulseCard}`} aria-labelledby="pulse-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}><h2 id="pulse-title">Shipments pulse</h2><span className={extras.pulseLive} aria-hidden="true" /></div>
        <Link className={styles.headAction} href="/admin/shipments">Open register <ArrowRight size={13} strokeWidth={1.8} /></Link>
      </div>
      <div className={extras.pulseBody}>
        {rows.map((row) => (
          <Link key={row.label} href={row.href} className={extras.pulseRow}>
            <span className={extras.pulseLabel}>{row.label}</span>
            <span className={extras.pulseValue} data-tone={row.tone} data-zero={row.value === 0 || undefined}>{row.value}</span>
          </Link>
        ))}
      </div>
      <div className={extras.pulseFoot}>
        {changes.length
          ? changes.map((change) => (
            <Link key={change.reference} href={jobHref(change.reference, returnTo)} className={extras.pulseChange}>
              <span className={extras.pulseLive} aria-hidden="true" />
              <span className={styles.monoRef}>{change.reference}</span> → {shipmentStatusLabels[change.to]}
            </Link>
          ))
          : <span className={extras.pulseQuiet}>{active.length} active · live every minute</span>}
      </div>
    </section>
  );
}

function KpiRail({ metrics }: { metrics: Metric[] }) {
  return (
    <section className={styles.kpiRail} aria-label="Operational pulse">
      {metrics.map((metric) => (
        <Link key={metric.label} href={metric.href} className={styles.kpiCell} data-tone={metric.tone} data-zero={metric.value === 0 || undefined}>
          <span className={styles.kpiLabel}>{metric.label}</span>
          <span className={styles.kpiValue}>{metric.value}</span>
        </Link>
      ))}
    </section>
  );
}

/**
 * The operational work queue. Rows stay records, not cards; the empty state is
 * a single quiet line because an empty queue is good news, not a feature.
 */
function WorkQueue({ jobs, total, returnTo, generatedAt }: { jobs: CommandCentreJob[]; total: number; returnTo: string; generatedAt: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allVisibleSelected = jobs.length > 0 && jobs.every((job) => selected.has(job.reference));

  function toggle(reference: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(reference)) next.delete(reference);
      else next.add(reference);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) jobs.forEach((job) => next.delete(job.reference));
      else jobs.forEach((job) => next.add(job.reference));
      return next;
    });
  }

  return (
    <section className={styles.card} aria-label="Attention required">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <h2>Work queue</h2>
          <span className={`${styles.headCount} ${total ? styles.headCountAlert : undefined}`}>{total}</span>
          {selected.size ? <span className={extras.selectionSummary}>{selected.size} selected</span> : null}
        </div>
        <Link className={styles.headAction} href="/admin/shipments?attention=1">View all <ArrowRight size={13} strokeWidth={1.8} /></Link>
      </div>
      {jobs.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="Shipments requiring attention">
            <thead><tr>
              <th><input className={styles.checkbox} type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Select all visible shipments" /></th>
              <th>Reference</th><th>Customer</th><th>Status</th><th>Blocker</th><th>Owner</th><th>Age</th><th><span className={styles.srOnly}>Actions</span></th>
            </tr></thead>
            <tbody>
              {jobs.map((job) => {
                const issue = shipmentNextAction(job);
                const age = ageShort(job.updated_at, generatedAt);
                const jobOwner = owner(job);
                const tone = statusTone(job.status);
                return (
                  <tr key={job.reference}>
                    <td><input className={styles.checkbox} type="checkbox" checked={selected.has(job.reference)} onChange={() => toggle(job.reference)} aria-label={`Select ${job.reference}`} /></td>
                    <td><Link className={styles.referenceLink} href={jobHref(job.reference, returnTo)}>{job.reference}</Link></td>
                    <td title={job.customer_name || undefined}>{job.customer_name || "Customer not linked"}</td>
                    <td><span className={`${styles.statusBadge} ${statusClass(tone)}`}>{shipmentStatusLabels[job.status]}</span></td>
                    <td><Link href={withReturn(issue.href, returnTo)} className={styles.actionLink}>{issue.label}</Link></td>
                    <td><span className={`${styles.ownerCell} ${jobOwner === "Unassigned" ? styles.ownerUnassigned : undefined}`}>{jobOwner === "Unassigned" ? <UserRoundX size={12} strokeWidth={1.8} aria-hidden="true" /> : null}{jobOwner}</span></td>
                    <td className={age.danger ? styles.ageDanger : undefined}>{age.label}</td>
                    <td><Link className={styles.rowAction} href={jobHref(job.reference, returnTo)} aria-label={`Open ${job.reference}`}><MoreHorizontal size={15} strokeWidth={1.8} /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.queueEmpty}>
          <CheckCircle2 size={15} strokeWidth={1.8} aria-hidden="true" />
          <div><strong>All caught up</strong><span>No shipments currently require action.</span></div>
        </div>
      )}
    </section>
  );
}

function TodayItem({ href, label, value, icon, tone }: { href: string; label: string; value: number | null; icon: ReactNode; tone: Tone }) {
  const alert = tone === "danger" && value !== null && value > 0;
  return (
    <Link href={href} className={styles.todayItem} data-alert={alert || undefined}>
      <span className={styles.todayItemIcon} aria-hidden="true">{icon}</span>
      <strong>{label}</strong>
      <span className={styles.todayItemCount} data-zero={value === 0 || undefined}>{value === null ? "—" : value}</span>
      <ChevronRight size={13} strokeWidth={1.8} className={styles.rowChevron} aria-hidden="true" />
    </Link>
  );
}

function TodayPanel({ data, workflow, customs, arrivingToday }: { data: CommandCentreData; workflow: WorkflowOverview; customs: number; arrivingToday: number }) {
  const critical = workflow.critical_blockers;
  return (
    <section className={`${styles.card} ${styles.todayCard}`} aria-labelledby="today-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}><h2 id="today-title">Today</h2></div>
        <Link className={styles.headAction} href="/admin/delivery">View calendar <ArrowRight size={13} strokeWidth={1.8} /></Link>
      </div>
      <div className={styles.todayList}>
        <TodayItem href="/admin/delivery" label="Arriving today" value={arrivingToday} tone="danger" icon={<Plane size={13} strokeWidth={1.8} />} />
        <TodayItem href="/admin/visibility" label="Departing today" value={workflow.visibility?.departing_today ?? null} tone="info" icon={<Plane size={13} strokeWidth={1.8} />} />
        <TodayItem href="/admin/customs" label="Customs clearance" value={customs} tone="warning" icon={<ShieldCheck size={13} strokeWidth={1.8} />} />
        <TodayItem href="/admin/delivery" label="POD overdue" value={workflow.delivery?.pod_overdue ?? null} tone="danger" icon={<CircleAlert size={13} strokeWidth={1.8} />} />
        <TodayItem href="/admin/tenders" label="Booking approvals" value={workflow.tendering?.accepted_or_countered ?? null} tone="violet" icon={<PackageCheck size={13} strokeWidth={1.8} />} />
        <TodayItem href="/admin/freight-documents" label="Missing documents" value={workflow.documents?.missing_primary ?? null} tone="danger" icon={<FileText size={13} strokeWidth={1.8} />} />
        <TodayItem href="/admin/shipments?attention=1" label="Unassigned shipments" value={data.totals.unassigned_jobs} tone="danger" icon={<UserRoundX size={13} strokeWidth={1.8} />} />
      </div>
      {critical ? (
        <Link href="/admin/alerts" className={styles.todayCritical}>
          <AlertTriangle size={14} strokeWidth={1.8} aria-hidden="true" />
          <span className={styles.todayFootCopy}><strong>{critical} critical blocker{critical === 1 ? "" : "s"}</strong><span>Require immediate attention</span></span>
          <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      ) : (
        <Link href="/admin/alerts" className={styles.todayClear}>
          <CheckCircle2 size={14} strokeWidth={1.8} aria-hidden="true" />
          <span className={styles.todayFootCopy}><strong>{critical === null ? "Critical blockers unavailable" : "No critical blockers"}</strong><span>{critical === null ? "Confirm in Tasks & Alerts" : "No unresolved critical automation alert"}</span></span>
          <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function Workload({ data, workflow }: { data: CommandCentreData; workflow: WorkflowOverview }) {
  const active = data.jobs.filter((job) => job.status !== "delivered");
  const weekStart = Date.parse(`${data.operational_date}T00:00:00Z`) - 6 * DAY_MS;
  const deliveredThisWeek = data.jobs.filter((job) => job.status === "delivered" && (Date.parse(job.updated_at) || 0) >= weekStart).length;
  const rows = [
    { label: "In transit", count: active.filter((job) => job.status === "in_transit").length, tone: "info", href: "/admin/shipments?status=in_transit" },
    { label: "Customs", count: active.filter((job) => job.status === "customs_clearance").length, tone: "warning", href: "/admin/customs" },
    { label: "Booking", count: active.filter((job) => job.status === "booking_confirmed").length, tone: "neutral", href: "/admin/shipments?status=booking_confirmed" },
    { label: "Awaiting pickup", count: Math.max(active.filter((job) => job.status === "preparing").length, (workflow.pickup?.unscheduled ?? 0) + (workflow.pickup?.requested ?? 0)), tone: "neutral", href: "/admin/pickups" },
    { label: "Out for delivery", count: active.filter((job) => job.status === "out_for_delivery").length, tone: "violet", href: "/admin/delivery" },
    { label: "Delivered (this week)", count: deliveredThisWeek, tone: "success", href: "/admin/shipments?status=delivered" },
  ];
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <section className={styles.card} aria-labelledby="workload-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}><h2 id="workload-title">Shipment workload</h2></div>
        <span className={styles.headMeta}>{data.totals.active_jobs} active</span>
      </div>
      <div className={styles.workloadBody}>
        {rows.map((row) => (
          <Link key={row.label} href={row.href} className={styles.workloadRow}>
            <span className={styles.workloadLabel}>{row.label}</span>
            <span className={styles.workloadTrack} aria-hidden="true"><span className={styles.workloadFill} data-tone={row.tone} data-zero={row.count === 0 || undefined} style={{ width: `${Math.max(row.count ? 4 : 0, (row.count / max) * 100)}%` }} /></span>
            <span className={styles.workloadCount} data-zero={row.count === 0 || undefined}>{row.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// This card used to draw a world map whose landmass was four invented polygons
// and whose city coordinates were eyeballed rather than projected -- decorative
// pseudo-geography that told the reader nothing. "Live movement" is a question
// about where each shipment is right now and when it lands, so it answers that.
function LiveMovement({ movements, generatedAt, returnTo }: { movements: OverviewMovement[]; generatedAt: string; returnTo: string }) {
  const rows = movements.slice(0, 8);
  return (
    <section className={styles.card} aria-labelledby="movement-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}><h2 id="movement-title">Live movement</h2>{movements.length ? <span className={styles.headCount}>{movements.length}</span> : null}</div>
        <Link className={styles.headAction} href="/admin/visibility">View live <ArrowRight size={13} strokeWidth={1.8} /></Link>
      </div>
      {rows.length ? (
        <div className={styles.movementList}>
          {rows.map((row) => {
            const eta = etaShort(row.eta, generatedAt);
            return (
              <Link key={row.reference} href={jobHref(row.reference, returnTo)} className={styles.movementRow}>
                <span className={styles.movementMain}>
                  <strong>{row.current_location || row.origin}</strong>
                  <span><span className={styles.monoRef}>{row.reference}</span> · {row.last_milestone || row.status}</span>
                </span>
                <span className={styles.movementEta} data-late={eta.late || undefined}>{eta.label}</span>
              </Link>
            );
          })}
        </div>
      ) : <p className={styles.quietEmpty}>No active movement in this scope.</p>}
    </section>
  );
}

function activityIcon(item: OverviewActivity) {
  const value = `${item.type} ${item.title}`.toLowerCase();
  if (value.includes("track") || value.includes("depart") || value.includes("arriv")) return <Plane size={13} strokeWidth={1.8} />;
  if (value.includes("customs")) return <ShieldCheck size={13} strokeWidth={1.8} />;
  if (value.includes("document") || value.includes("pod")) return <FileText size={13} strokeWidth={1.8} />;
  if (value.includes("assign") || value.includes("owner")) return <UserRoundX size={13} strokeWidth={1.8} />;
  if (item.tone === "success") return <CheckCircle2 size={13} strokeWidth={1.8} />;
  if (item.tone === "danger") return <CircleAlert size={13} strokeWidth={1.8} />;
  return <Clock3 size={13} strokeWidth={1.8} />;
}

function RecentActivity({ activity, generatedAt, returnTo }: { activity: OverviewActivity[]; generatedAt: string; returnTo: string }) {
  return (
    <section className={styles.card} aria-labelledby="activity-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}><h2 id="activity-title">Recent activity</h2>{activity.length ? <span className={styles.headCount}>{activity.length}</span> : null}</div>
        <Link className={styles.headAction} href="/admin/notifications">View all <ArrowRight size={13} strokeWidth={1.8} /></Link>
      </div>
      {activity.length ? (
        <ol className={styles.activityFeed}>
          {activity.slice(0, 8).map((item) => (
            <li key={`${item.reference}-${item.id}`}>
              <Link href={jobHref(item.reference, returnTo)} className={styles.activityRow} title={item.detail ?? undefined}>
                <span className={styles.activityMark} data-tone={item.tone} aria-hidden="true">{activityIcon(item)}</span>
                <span className={styles.activityMain}>
                  <span className={styles.activityTitle}>{item.title}</span>
                  {item.reference ? <span className={styles.monoRef}>{item.reference}</span> : null}
                </span>
                <span className={styles.activityTime}>{relativeAge(item.occurred_at, generatedAt)}{item.actor_name ? ` · ${item.actor_name}` : ""}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : <p className={styles.quietEmpty}>No recent operational activity in this scope.</p>}
    </section>
  );
}

function changeLabel(value: number | null, suffix = "%", emptyPeriod = false) {
  // A period with nothing recorded yet is not a collapse: "-100%" beside NPR 0
  // reads as an error, so an empty current period is presented neutrally. The
  // server-side percentageChange calculation itself is untouched.
  if (emptyPeriod && value !== null) return { label: "No activity", className: styles.changeNeutral };
  if (value === null) return { label: "—", className: styles.changeNeutral };
  const sign = value > 0 ? "+" : "";
  return { label: `${sign}${value.toFixed(value % 1 === 0 ? 0 : 1)}${suffix}`, className: value > 0 ? styles.changePositive : value < 0 ? styles.changeNegative : styles.changeNeutral };
}

function FinanceSnapshot({ finance }: { finance: OverviewFinanceSnapshot | null }) {
  const [currency, setCurrency] = useState(finance?.currencies[0]?.currency ?? "");
  const selected = finance?.currencies.find((item) => item.currency === currency) ?? finance?.currencies[0] ?? null;
  const maxBar = selected ? Math.max(...selected.trend.map((point) => Math.max(point.revenue, point.cost, 0)), 1) : 1;
  const rows = selected ? [
    { label: "Total revenue", value: money(selected.revenue, selected.currency), change: changeLabel(selected.revenue_change_percent, "%", selected.revenue === 0) },
    { label: "Total cost", value: money(selected.cost, selected.currency), change: changeLabel(selected.cost_change_percent, "%", selected.cost === 0) },
    { label: "Gross margin", value: money(selected.profit, selected.currency), change: changeLabel(selected.profit_change_percent, "%", selected.profit === 0) },
    { label: "Margin %", value: selected.margin_percent === null ? "—" : `${selected.margin_percent.toFixed(1)}%`, change: changeLabel(selected.margin_change_points, "pp") },
  ] : [];
  const firstTrendDate = selected?.trend[0]?.date ?? finance?.generated_at.slice(0, 10) ?? "";
  const lastTrendDate = selected?.trend.at(-1)?.date ?? firstTrendDate;
  const trendMonth = firstTrendDate ? new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(new Date(`${firstTrendDate}T00:00:00Z`)) : "";

  return (
    <section className={styles.card} aria-labelledby="finance-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}><h2 id="finance-title">Finance snapshot</h2></div>
        <div className={styles.financeControls}>
          {finance?.currencies.length && finance.currencies.length > 1 ? <select className={styles.financeSelect} value={selected?.currency ?? ""} onChange={(event) => setCurrency(event.target.value)} aria-label="Finance currency">{finance.currencies.map((item) => <option key={item.currency} value={item.currency}>{item.currency}</option>)}</select> : null}
          <span className={styles.financePeriod}>{finance?.period_label ?? "This month"}</span>
        </div>
      </div>
      {selected ? <div className={styles.financeBody}>
        {rows.map((row) => <div key={row.label} className={styles.financeRow}><span>{row.label}</span><span className={styles.financeValue}><strong>{row.value}</strong><span className={`${styles.change} ${row.change.className}`}>{row.change.label}</span></span></div>)}
        <div className={styles.financeChart} aria-label={`${selected.currency} daily revenue this month`}>{selected.trend.map((point) => <span key={point.date} className={styles.financeBar} style={{ height: `${Math.max(8, (point.revenue / maxBar) * 100)}%` }} title={`${point.date}: ${money(point.revenue, selected.currency)}`} />)}</div>
        <div className={styles.financeAxis}><span>1 {trendMonth}</span><span>{lastTrendDate.slice(8, 10)} {trendMonth}</span></div>
      </div> : <div className={styles.financeEmpty}>Finance values are available to authorised Accounts and Management users when the current month contains financial activity.</div>}
    </section>
  );
}

function OperationalNotes({ note, selectedBranch, canPostNotes, generatedAt }: { note: OperationalNote | null; selectedBranch: string; canPostNotes: boolean; generatedAt: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(note?.message ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/command-centre/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, branch: selectedBranch === "all" ? null : selectedBranch }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Operational note could not be posted.");
      setEditing(false);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Operational note could not be posted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.notes} data-noted={note ? "true" : undefined} aria-label="Operational notes">
      <span className={styles.noteIcon} aria-hidden="true"><FileText size={15} strokeWidth={1.8} /></span>
      <div className={styles.noteBody}><span className={styles.noteLabel}>Operational notes</span><span className={styles.noteText}><span aria-hidden="true"> · </span>{note?.message ?? "No operational note posted for this scope."}</span></div>
      <span className={styles.noteMeta}>{note ? `Posted ${relativeAge(note.created_at, generatedAt)} by ${note.created_by_name}` : selectedBranch === "all" ? "All branches" : selectedBranch}</span>
      {canPostNotes ? <button type="button" className={styles.rowAction} onClick={() => setEditing((current) => !current)} aria-label="Edit operational note"><MoreHorizontal size={15} strokeWidth={1.8} /></button> : <span />}
      {editing ? <div className={styles.noteEditor}><textarea value={message} maxLength={500} onChange={(event) => setMessage(event.target.value)} aria-label="Operational note" /> <div className={styles.noteEditorActions}><button type="button" className={styles.secondaryButton} onClick={() => setEditing(false)}>Cancel</button><button type="button" className={styles.blackButton} disabled={busy || message.trim().length < 3} onClick={() => void submit()}>{busy ? "Posting…" : "Post note"}</button></div>{error ? <span className={styles.ageDanger}>{error}</span> : null}</div> : null}
    </section>
  );
}

function NewShipmentLauncher({ canViewCommercial, selectedBranch, branches, closing, onClose }: { canViewCommercial: boolean; selectedBranch: string; branches: string[]; closing: boolean; onClose: () => void }) {
  const router = useRouter();
  const defaultBranch = selectedBranch !== "all" && branches.includes(selectedBranch)
    ? selectedBranch
    : branches.includes("Kathmandu")
      ? "Kathmandu"
      : branches[0] ?? "Kathmandu";
  const [branch, setBranch] = useState(defaultBranch);
  const [mode, setMode] = useState<CreationMode>("road");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [weightKg, setWeightKg] = useState("0");
  const [volumeCbm, setVolumeCbm] = useState("0");
  const [pieces, setPieces] = useState("0");
  const [containerCount, setContainerCount] = useState("0");
  const [equipment, setEquipment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/rating", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create_order",
          branch,
          origin,
          destination,
          mode,
          pickupDate,
          weightKg: Number(weightKg),
          volumeCbm: Number(volumeCbm),
          pieces: Number(pieces),
          containerCount: Number(containerCount),
          equipment,
        }),
      });
      const result = await response.json() as CreateOrderResponse;
      if (!response.ok || !result.ok || !result.order?.id) throw new Error(result.error || "The shipment planning record could not be created.");
      router.push(`/admin/rating/${encodeURIComponent(result.order.id)}`);
      onClose();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The shipment planning record could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.launcherBackdrop} data-closing={closing ? "true" : undefined} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.launcher} data-closing={closing ? "true" : undefined} role="dialog" aria-modal="true" aria-labelledby="new-shipment-title">
        <div className={styles.launcherHeader}>
          <div><h2 id="new-shipment-title">New shipment</h2><p>Start a new movement through KCPL’s controlled transport-order, tender and booking chain. The shipment record is still created only by the existing server-authoritative workflow.</p></div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close new shipment"><X size={14} strokeWidth={1.8} /></button>
        </div>
        {canViewCommercial ? (
          <form className={extras.createForm} onSubmit={create}>
            <div className={extras.createGrid}>
              <div className={extras.createField}><label htmlFor="overview-new-branch">Branch</label><select id="overview-new-branch" value={branch} onChange={(event) => setBranch(event.target.value)}>{branches.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
              <div className={extras.createField}><label htmlFor="overview-new-mode">Mode</label><select id="overview-new-mode" value={mode} onChange={(event) => setMode(event.target.value as CreationMode)}>{creationModes.map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></div>
              <div className={extras.createField}><label htmlFor="overview-new-origin">Origin</label><input id="overview-new-origin" required value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Kathmandu / KTM / Nepal" /></div>
              <div className={extras.createField}><label htmlFor="overview-new-destination">Destination</label><input id="overview-new-destination" required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Dubai / DXB / UAE" /></div>
              <div className={extras.createField}><label htmlFor="overview-new-pickup">Pickup date</label><input id="overview-new-pickup" type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} /></div>
              <div className={extras.createField}><label htmlFor="overview-new-equipment">Equipment</label><input id="overview-new-equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="20GP, 40HC, reefer, truck…" /></div>
            </div>
            <div className={extras.createMetrics}>
              <div className={extras.createField}><label htmlFor="overview-new-weight">Weight (kg)</label><input id="overview-new-weight" type="number" min="0" step="0.01" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} /></div>
              <div className={extras.createField}><label htmlFor="overview-new-volume">Volume (CBM)</label><input id="overview-new-volume" type="number" min="0" step="0.001" value={volumeCbm} onChange={(event) => setVolumeCbm(event.target.value)} /></div>
              <div className={extras.createField}><label htmlFor="overview-new-pieces">Pieces</label><input id="overview-new-pieces" type="number" min="0" step="1" value={pieces} onChange={(event) => setPieces(event.target.value)} /></div>
              <div className={extras.createField}><label htmlFor="overview-new-containers">Containers</label><input id="overview-new-containers" type="number" min="0" step="1" value={containerCount} onChange={(event) => setContainerCount(event.target.value)} /></div>
            </div>
            {error ? <div className={extras.createError} role="alert">{error}</div> : null}
            <div className={extras.createActions}><Link href="/admin/rating" className={styles.textButton}>Open rate desk</Link><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" className={styles.blackButton} disabled={busy}>{busy ? "Creating…" : "Create planning record"}</button></div>
          </form>
        ) : (
          <div className={styles.launcherBody}>
            <Link href="/admin/enquiries" className={styles.launcherChoice}><span><strong>Open enquiries</strong><span>Your Operations role cannot originate a commercial transport order. Continue from an authorised enquiry or commercial handoff.</span></span><ArrowRight size={14} strokeWidth={1.8} /></Link>
            <Link href="/admin/shipments" className={styles.launcherChoice}><span><strong>Open shipment register</strong><span>Find an existing active or delivered shipment and its Digital Job File.</span></span><ArrowRight size={14} strokeWidth={1.8} /></Link>
          </div>
        )}
      </section>
    </div>
  );
}

export function V4OperationsOverview({ data, workflow, finance, note, selectedBranch, branches, canViewCommercial, canPostNotes }: DashboardProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherClosing, setLauncherClosing] = useState(false);
  // The unmount is deferred until the exit has played, so the timer has to be
  // cancellable: reopening inside that window must not be closed by the old timer.
  const launcherTimer = useRef<number | null>(null);
  const clearLauncherTimer = useCallback(() => {
    if (launcherTimer.current === null) return;
    window.clearTimeout(launcherTimer.current);
    launcherTimer.current = null;
  }, []);
  // Exit is shorter than the entrance: the user has already decided to leave.
  const closeLauncher = useCallback(() => {
    clearLauncherTimer();
    setLauncherClosing(true);
    launcherTimer.current = window.setTimeout(() => {
      launcherTimer.current = null;
      setLauncherOpen(false);
      setLauncherClosing(false);
    }, LAUNCHER_EXIT_MS);
  }, [clearLauncherTimer]);
  const openLauncher = useCallback(() => {
    clearLauncherTimer();
    setLauncherClosing(false);
    setLauncherOpen(true);
  }, [clearLauncherTimer]);
  useEffect(() => clearLauncherTimer, [clearLauncherTimer]);
  const { search } = useWorkspaceQuery();
  const returnTo = `/admin/command-centre${search}`;
  const activeShipments = useMemo(() => data.jobs.filter((job) => job.status !== "delivered"), [data.jobs]);
  const attentionShipments = useMemo(() => activeShipments.filter(shipmentNeedsAttention).sort(compareShipmentPriority), [activeShipments]);
  const attentionQueue = attentionShipments.slice(0, 6);
  const arrivingToday = activeShipments.filter((job) => job.eta?.slice(0, 10) === data.operational_date).length;
  const inTransit = activeShipments.filter((job) => job.status === "in_transit").length;
  const customs = workflow.visibility?.customs ?? activeShipments.filter((job) => job.status === "customs_clearance").length;

  const metrics: Metric[] = [
    { href: "/admin/shipments?attention=1", label: "Requires attention", value: attentionShipments.length, tone: "danger" },
    { href: "/admin/customs", label: "Customs pending", value: data.totals.customs_blockers, tone: "warning" },
    { href: "/admin/alerts", label: "Overdue", value: data.totals.overdue_tasks, tone: "danger" },
    { href: "/admin/delivery", label: "Due today", value: data.totals.deliveries_today, tone: "info" },
    { href: "/admin/shipments?attention=1", label: "Unassigned", value: data.totals.unassigned_jobs, tone: "neutral" },
    { href: "/admin/shipments?status=in_transit", label: "In transit", value: inTransit, tone: "info" },
  ];

  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHead}>
        <div className={styles.pageHeadCopy}>
          <h1>Overview</h1>
          <p className={styles.pageHeadMeta}>
            <span>{selectedBranch === "all" ? "All branches" : selectedBranch} operations</span>
            <span className={styles.metaDot} aria-hidden="true" />
            <span>{formatOperationalDate(data.operational_date)}</span>
            <span className={styles.metaDot} aria-hidden="true" />
            <span>Updated {formatNepalTime(data.generated_at)} NPT</span>
          </p>
        </div>
        <div className={styles.pageHeadActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
            <RefreshCw size={14} strokeWidth={1.8} className={refreshing ? "app-refreshing" : undefined} />{refreshing ? "Refreshing" : "Refresh"}
          </button>
          <button type="button" className={styles.blackButton} onClick={openLauncher}>
            <Plus size={14} strokeWidth={2} /> New shipment
          </button>
        </div>
      </header>

      {data.partial ? <div className={styles.warningBanner}><AlertTriangle size={15} strokeWidth={1.8} /><span>This operational snapshot reached a server loading limit. Counts may be incomplete; confirm the Digital Job File before acting.</span></div> : null}

      <KpiRail metrics={metrics} />

      <div className={styles.primaryGrid}>
        <WorkQueue jobs={attentionQueue} total={attentionShipments.length} returnTo={returnTo} generatedAt={data.generated_at} />
        <TodayPanel data={data} workflow={workflow} customs={customs} arrivingToday={arrivingToday} />
      </div>

      <div className={styles.lowerGrid}>
        <RecentActivity activity={workflow.recent_activity} generatedAt={data.generated_at} returnTo={returnTo} />
        <LiveMovement movements={workflow.movements} generatedAt={data.generated_at} returnTo={returnTo} />
        <Workload data={data} workflow={workflow} />
        <ShipmentsPulse initialData={data} returnTo={returnTo} />
        <FinanceSnapshot finance={finance} />
      </div>

      <OperationalNotes note={note} selectedBranch={selectedBranch} canPostNotes={canPostNotes} generatedAt={data.generated_at} />

      {launcherOpen ? <NewShipmentLauncher canViewCommercial={canViewCommercial} selectedBranch={selectedBranch} branches={branches} closing={launcherClosing} onClose={closeLauncher} /> : null}
    </div>
  );
}
