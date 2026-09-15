"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  MapPinned,
  MoreHorizontal,
  PackageCheck,
  Plane,
  Plus,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRoundX,
  Users,
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

const DAY_MS = 86_400_000;

type Tone = "danger" | "warning" | "success" | "info" | "neutral" | "violet";

type DashboardProps = {
  data: CommandCentreData;
  workflow: WorkflowOverview;
  finance: OverviewFinanceSnapshot | null;
  note: OperationalNote | null;
  userName: string;
  selectedBranch: string;
  canViewCommercial: boolean;
  canPostNotes: boolean;
};

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || (job.assigned_to_uid ? "Assigned staff" : "Unassigned");
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function route(job: Pick<CommandCentreJob, "origin" | "destination">) {
  return `${job.origin || "Origin"} → ${job.destination || "Destination"}`;
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

function greeting(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Good morning";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Kathmandu" }).format(parsed));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function shortDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: value.length === 10 ? "UTC" : "Asia/Kathmandu" }).format(parsed);
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

function statusTone(status: ShipmentStatus): Tone {
  if (status === "exception") return "danger";
  if (status === "customs_clearance" || status === "preparing") return "warning";
  if (status === "delivered") return "success";
  if (status === "in_transit" || status === "booking_confirmed" || status === "out_for_delivery") return "info";
  return "neutral";
}

function toneIconClass(tone: Tone) {
  if (tone === "danger") return styles.dangerIcon;
  if (tone === "warning") return styles.warningIcon;
  if (tone === "success") return styles.successIcon;
  if (tone === "info") return styles.infoIcon;
  if (tone === "violet") return styles.violetIcon;
  return styles.neutralIcon;
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

function Metric({ href, label, value, icon, tone }: { href: string; label: string; value: number; icon: ReactNode; tone: Tone }) {
  return (
    <Link href={href} className={styles.metric}>
      <span className={`${styles.metricIcon} ${toneIconClass(tone)}`}>{icon}</span>
      <span className={styles.metricCopy}><strong>{value}</strong><span>{label}</span></span>
      <ChevronRight size={15} strokeWidth={1.8} className={styles.metricChevron} aria-hidden="true" />
    </Link>
  );
}

function TodayItem({ href, label, value, icon, tone }: { href: string; label: string; value: number | null; icon: ReactNode; tone: Tone }) {
  return (
    <Link href={href} className={styles.todayItem}>
      <span className={`${styles.todayItemIcon} ${toneIconClass(tone)}`}>{icon}</span>
      <strong>{label}</strong>
      <span className={styles.todayItemCount}>{value === null ? "—" : value}</span>
      <ChevronRight size={13} strokeWidth={1.8} className={styles.metricChevron} aria-hidden="true" />
    </Link>
  );
}

function AttentionTable({ jobs, total, returnTo, generatedAt }: { jobs: CommandCentreJob[]; total: number; returnTo: string; generatedAt: string }) {
  return (
    <section className={styles.card} aria-labelledby="attention-title">
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitleRow}><h2 id="attention-title">Attention required</h2><span className={styles.countBadge}>{total}</span></div>
          <p>Shipments that need action</p>
        </div>
        <Link className={styles.secondaryButton} href="/admin/shipments?attention=1">View all <ArrowRight size={13} strokeWidth={1.8} /></Link>
      </div>
      {jobs.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="Shipments requiring attention">
            <thead><tr>
              <th><input className={styles.checkbox} type="checkbox" aria-label="Select all visible shipments" /></th>
              <th>Reference</th><th>Customer</th><th>Route</th><th>Status</th><th>Blocker / Next action</th><th>Owner</th><th>Age</th><th>ETA</th><th><span className={styles.srOnly}>Actions</span></th>
            </tr></thead>
            <tbody>
              {jobs.map((job) => {
                const issue = shipmentNextAction(job);
                const age = ageShort(job.updated_at, generatedAt);
                const jobOwner = owner(job);
                const tone = statusTone(job.status);
                return (
                  <tr key={job.reference}>
                    <td><input className={styles.checkbox} type="checkbox" aria-label={`Select ${job.reference}`} /></td>
                    <td><Link className={styles.referenceLink} href={jobHref(job.reference, returnTo)}>{job.reference}</Link></td>
                    <td>{job.customer_name || "Customer not linked"}</td>
                    <td className={styles.routeCell}>{route(job)}</td>
                    <td><span className={`${styles.statusBadge} ${statusClass(tone)}`}>{shipmentStatusLabels[job.status]}</span></td>
                    <td><Link href={withReturn(issue.href, returnTo)} className={styles.referenceLink}>{issue.label}</Link></td>
                    <td><span className={styles.owner}><span className={styles.ownerAvatar}>{jobOwner === "Unassigned" ? <UserRoundX size={12} /> : initials(jobOwner)}</span><span className={jobOwner === "Unassigned" ? styles.ownerUnassigned : undefined}>{jobOwner}</span></span></td>
                    <td className={age.danger ? styles.ageDanger : undefined}>{age.label}</td>
                    <td>{shortDate(job.eta)}</td>
                    <td><Link className={styles.rowAction} href={jobHref(job.reference, returnTo)} aria-label={`Open ${job.reference}`}><MoreHorizontal size={16} strokeWidth={1.8} /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyTable}><div><CheckCircle2 size={22} strokeWidth={1.8} className={styles.successIcon} /><strong>No shipment needs priority attention</strong><span>The current branch scope has no exception, overdue, customs, ownership or urgent queue signal.</span></div></div>
      )}
    </section>
  );
}

function Workload({ data, workflow }: { data: CommandCentreData; workflow: WorkflowOverview }) {
  const active = data.jobs.filter((job) => job.status !== "delivered");
  const weekStart = Date.parse(`${data.operational_date}T00:00:00Z`) - 6 * DAY_MS;
  const deliveredThisWeek = data.jobs.filter((job) => job.status === "delivered" && (Date.parse(job.updated_at) || 0) >= weekStart).length;
  const rows = [
    { label: "In transit", count: active.filter((job) => job.status === "in_transit").length, tone: "transit", href: "/admin/shipments?status=in_transit" },
    { label: "Customs", count: active.filter((job) => job.status === "customs_clearance").length, tone: "customs", href: "/admin/customs" },
    { label: "Booking", count: active.filter((job) => job.status === "booking_confirmed").length, tone: "booking", href: "/admin/shipments?status=booking_confirmed" },
    { label: "Awaiting pickup", count: Math.max(active.filter((job) => job.status === "preparing").length, (workflow.pickup?.unscheduled ?? 0) + (workflow.pickup?.requested ?? 0)), tone: "pickup", href: "/admin/pickups" },
    { label: "Out for delivery", count: active.filter((job) => job.status === "out_for_delivery").length, tone: "delivery", href: "/admin/delivery" },
    { label: "Delivered (this week)", count: deliveredThisWeek, tone: "delivered", href: "/admin/shipments?status=delivered" },
  ];
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <section className={styles.card} aria-labelledby="workload-title">
      <div className={styles.cardHeader}><div><h2 id="workload-title">Shipment workload</h2><p>Total shipments by operational status</p></div></div>
      <div className={styles.workloadBody}>
        {rows.map((row) => <Link key={row.label} href={row.href} className={styles.workloadRow}><span>{row.label}</span><span className={styles.workloadTrack}><span className={styles.workloadFill} data-tone={row.tone} style={{ width: `${Math.max(3, (row.count / max) * 100)}%` }} /></span><span className={styles.workloadCount}>{row.count}</span></Link>)}
      </div>
    </section>
  );
}

type Point = { x: number; y: number; code: string };
const hubPoints: Record<string, Point> = {
  KTM: { x: 708, y: 178, code: "KTM" }, KATHMANDU: { x: 708, y: 178, code: "KTM" },
  DXB: { x: 592, y: 196, code: "DXB" }, DUBAI: { x: 592, y: 196, code: "DXB" },
  SIN: { x: 786, y: 278, code: "SIN" }, SINGAPORE: { x: 786, y: 278, code: "SIN" },
  SHA: { x: 824, y: 160, code: "SHA" }, SHANGHAI: { x: 824, y: 160, code: "SHA" }, PVG: { x: 824, y: 160, code: "PVG" },
  BOM: { x: 657, y: 216, code: "BOM" }, MUMBAI: { x: 657, y: 216, code: "BOM" },
  DEL: { x: 684, y: 184, code: "DEL" }, DELHI: { x: 684, y: 184, code: "DEL" },
  CCU: { x: 735, y: 196, code: "CCU" }, KOLKATA: { x: 735, y: 196, code: "CCU" },
  LHR: { x: 464, y: 119, code: "LHR" }, LONDON: { x: 464, y: 119, code: "LHR" },
  MEL: { x: 866, y: 337, code: "MEL" }, MELBOURNE: { x: 866, y: 337, code: "MEL" },
  SYD: { x: 900, y: 322, code: "SYD" }, SYDNEY: { x: 900, y: 322, code: "SYD" },
  HKG: { x: 812, y: 194, code: "HKG" }, HONGKONG: { x: 812, y: 194, code: "HKG" },
  BKK: { x: 762, y: 225, code: "BKK" }, BANGKOK: { x: 762, y: 225, code: "BKK" },
  DOH: { x: 570, y: 194, code: "DOH" }, AUH: { x: 601, y: 201, code: "AUH" },
};

function hubPoint(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (hubPoints[normalized]) return hubPoints[normalized];
  for (const [key, point] of Object.entries(hubPoints)) if (normalized.includes(key)) return point;
  return null;
}

function LiveMovement({ movements }: { movements: OverviewMovement[] }) {
  const lanes = useMemo(() => {
    const map = new Map<string, { origin: string; destination: string; count: number; from: Point; to: Point }>();
    for (const row of movements) {
      const from = hubPoint(row.origin);
      const to = hubPoint(row.destination);
      if (!from || !to || from.code === to.code) continue;
      const key = `${from.code}-${to.code}`;
      const current = map.get(key) ?? { origin: from.code, destination: to.code, count: 0, from, to };
      current.count += 1;
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [movements]);
  const nodes = useMemo(() => {
    const map = new Map<string, { point: Point; count: number }>();
    for (const lane of lanes) {
      for (const point of [lane.from, lane.to]) {
        const row = map.get(point.code) ?? { point, count: 0 };
        row.count += lane.count;
        map.set(point.code, row);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [lanes]);

  return (
    <section className={`${styles.card} ${styles.mapCard}`} aria-labelledby="movement-title">
      <div className={styles.cardHeader}><div><h2 id="movement-title">Live movement</h2><p>Active shipments across key routes</p></div><Link className={styles.secondaryButton} href="/admin/visibility">View live <ArrowRight size={13} /></Link></div>
      <div className={styles.mapBody}>
        <svg className={styles.mapSvg} viewBox="0 0 1000 400" role="img" aria-label="Active KCPL movement network by route">
          <path className={styles.mapLand} d="M66 119l74-39 76 17 39 46-22 45-63 5-39-23-53 13-40-29zM299 84l88-30 96 17 43 33 12 57-43 36-62-11-36 28-52-21-17-49zM522 91l104-23 123 15 81 37 77-2 48 31-31 49-79 8-37 56-73 26-58-37-61 9-37-29-52 5-25-41 31-50zM803 286l68-14 62 24 29 50-54 24-76-12-34-37z" />
          <defs><marker id="overview-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#667085" /></marker></defs>
          {lanes.map((lane, index) => {
            const midX = (lane.from.x + lane.to.x) / 2;
            const midY = Math.min(lane.from.y, lane.to.y) - 45 - index * 4;
            return <path key={`${lane.origin}-${lane.destination}`} className={`${styles.routeLine} ${index === 0 ? styles.routeLineHot : ""}`} d={`M ${lane.from.x} ${lane.from.y} Q ${midX} ${midY} ${lane.to.x} ${lane.to.y}`} markerEnd="url(#overview-arrow)" />;
          })}
          {nodes.map(({ point, count }) => <g key={point.code}><circle className={styles.routeNode} cx={point.x} cy={point.y} r="6"/><circle cx={point.x} cy={point.y} r="2.5" fill="#d92d20"/><text x={point.x + 10} y={point.y - 4} fontSize="11" fontWeight="700" fill="#344054">{point.code}</text><text x={point.x + 10} y={point.y + 10} fontSize="9" fill="#667085">{count} active</text></g>)}
        </svg>
        <div className={styles.mapFoot}><span>{movements.length} active visibility records · {lanes.length} plotted lanes</span><MapPinned size={14} strokeWidth={1.7} /></div>
      </div>
    </section>
  );
}

function activityIcon(item: OverviewActivity) {
  const value = `${item.type} ${item.title}`.toLowerCase();
  if (value.includes("track") || value.includes("depart") || value.includes("arriv")) return <Plane size={14} strokeWidth={1.8} />;
  if (value.includes("customs")) return <ShieldCheck size={14} strokeWidth={1.8} />;
  if (value.includes("document") || value.includes("pod")) return <FileText size={14} strokeWidth={1.8} />;
  if (value.includes("assign") || value.includes("owner")) return <Users size={14} strokeWidth={1.8} />;
  if (item.tone === "success") return <CheckCircle2 size={14} strokeWidth={1.8} />;
  if (item.tone === "danger") return <CircleAlert size={14} strokeWidth={1.8} />;
  return <Clock3 size={14} strokeWidth={1.8} />;
}

function RecentActivity({ activity, generatedAt, returnTo }: { activity: OverviewActivity[]; generatedAt: string; returnTo: string }) {
  return (
    <section className={styles.card} aria-labelledby="activity-title">
      <div className={styles.cardHeader}><div><h2 id="activity-title">Recent activity</h2></div><Link className={styles.secondaryButton} href="/admin/notifications">View all <ArrowRight size={13} /></Link></div>
      <div className={styles.activityBody}>
        {activity.length ? activity.slice(0, 6).map((item) => <Link key={`${item.reference}-${item.id}`} href={jobHref(item.reference, returnTo)} className={styles.activityItem}><span className={`${styles.activityIcon} ${toneIconClass(item.tone === "neutral" ? "neutral" : item.tone)}`}>{activityIcon(item)}</span><span className={styles.activityCopy}><strong>{item.title}</strong><span>{item.reference}{item.detail ? ` · ${item.detail}` : ""}</span><small>{relativeAge(item.occurred_at, generatedAt)}{item.actor_name ? ` · ${item.actor_name}` : ""}</small></span></Link>) : <div className={styles.financeEmpty}>No recent operational activity in this scope.</div>}
      </div>
    </section>
  );
}

function changeLabel(value: number | null, suffix = "%") {
  if (value === null) return { label: "—", className: styles.changeNeutral };
  const sign = value > 0 ? "+" : "";
  return { label: `${sign}${value.toFixed(value % 1 === 0 ? 0 : 1)}${suffix}`, className: value > 0 ? styles.changePositive : value < 0 ? styles.changeNegative : styles.changeNeutral };
}

function FinanceSnapshot({ finance }: { finance: OverviewFinanceSnapshot | null }) {
  const [currency, setCurrency] = useState(finance?.currencies[0]?.currency ?? "");
  const selected = finance?.currencies.find((item) => item.currency === currency) ?? finance?.currencies[0] ?? null;
  const maxBar = selected ? Math.max(...selected.trend.map((point) => Math.max(point.revenue, point.cost, 0)), 1) : 1;
  const rows = selected ? [
    { label: "Total revenue", value: money(selected.revenue, selected.currency), change: changeLabel(selected.revenue_change_percent) },
    { label: "Total cost", value: money(selected.cost, selected.currency), change: changeLabel(selected.cost_change_percent) },
    { label: "Gross margin", value: money(selected.profit, selected.currency), change: changeLabel(selected.profit_change_percent) },
    { label: "Margin %", value: selected.margin_percent === null ? "—" : `${selected.margin_percent.toFixed(1)}%`, change: changeLabel(selected.margin_change_points, "pp") },
  ] : [];

  return (
    <section className={styles.card} aria-labelledby="finance-title">
      <div className={styles.cardHeader}>
        <div><h2 id="finance-title">Finance snapshot</h2></div>
        <div className={styles.financeControls}>
          {finance?.currencies.length && finance.currencies.length > 1 ? <select className={styles.financeSelect} value={selected?.currency ?? ""} onChange={(event) => setCurrency(event.target.value)} aria-label="Finance currency">{finance.currencies.map((item) => <option key={item.currency} value={item.currency}>{item.currency}</option>)}</select> : null}
          <span className={styles.secondaryButton}>{finance?.period_label ?? "This month"}</span>
        </div>
      </div>
      {selected ? <div className={styles.financeBody}>
        {rows.map((row) => <div key={row.label} className={styles.financeRow}><span>{row.label}</span><span className={styles.financeValue}><strong>{row.value}</strong><span className={`${styles.change} ${row.change.className}`}>{row.change.label}</span></span></div>)}
        <div className={styles.financeChart} aria-label={`${selected.currency} daily revenue this month`}>{selected.trend.map((point) => <span key={point.date} className={styles.financeBar} style={{ height: `${Math.max(8, (point.revenue / maxBar) * 100)}%` }} title={`${point.date}: ${money(point.revenue, selected.currency)}`} />)}</div>
        <div className={styles.financeAxis}><span>1 {new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(new Date(`${selected.trend[0]?.date ?? dataFallbackDate()}T00:00:00Z`))}</span><span>{selected.trend.at(-1)?.date.slice(8, 10) ?? ""} {new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(new Date(`${selected.trend.at(-1)?.date ?? dataFallbackDate()}T00:00:00Z`))}</span></div>
      </div> : <div className={styles.financeEmpty}>Finance values are available to authorised Accounts and Management users when the current month contains financial activity.</div>}
    </section>
  );
}

function dataFallbackDate() { return "2026-01-01"; }

function OperationalNotes({ note, selectedBranch, canPostNotes }: { note: OperationalNote | null; selectedBranch: string; canPostNotes: boolean }) {
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
    <section className={styles.notes} aria-label="Operational notes">
      <span className={styles.noteIcon}><FileText size={16} strokeWidth={1.8} /></span>
      <div><span className={styles.noteLabel}>Operational notes</span><span className={styles.noteText}> · {note?.message ?? "No operational note posted for this scope."}</span></div>
      <span className={styles.noteMeta}>{note ? `Posted ${relativeAge(note.created_at, new Date().toISOString())} by ${note.created_by_name}` : selectedBranch === "all" ? "All branches" : selectedBranch}</span>
      {canPostNotes ? <button type="button" className={styles.rowAction} onClick={() => setEditing((current) => !current)} aria-label="Edit operational note"><MoreHorizontal size={16} /></button> : <span />}
      {editing ? <div className={styles.noteEditor}><textarea value={message} maxLength={500} onChange={(event) => setMessage(event.target.value)} aria-label="Operational note" /> <div className={styles.noteEditorActions}><button type="button" className={styles.secondaryButton} onClick={() => setEditing(false)}>Cancel</button><button type="button" className={styles.blackButton} disabled={busy || message.trim().length < 3} onClick={() => void submit()}>{busy ? "Posting…" : "Post note"}</button></div>{error ? <span className={styles.ageDanger}>{error}</span> : null}</div> : null}
    </section>
  );
}

export function V4OperationsOverview({ data, workflow, finance, note, userName, selectedBranch, canViewCommercial, canPostNotes }: DashboardProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const { search } = useWorkspaceQuery();
  const returnTo = `/admin/command-centre${search}`;
  const activeShipments = useMemo(() => data.jobs.filter((job) => job.status !== "delivered"), [data.jobs]);
  const attentionShipments = useMemo(() => activeShipments.filter(shipmentNeedsAttention).sort(compareShipmentPriority), [activeShipments]);
  const attentionQueue = attentionShipments.slice(0, 6);
  const firstName = userName.trim().split(/\s+/)[0] || "team";
  const arrivingToday = activeShipments.filter((job) => job.eta?.slice(0, 10) === data.operational_date).length;
  const inTransit = activeShipments.filter((job) => job.status === "in_transit").length;
  const customs = workflow.visibility?.customs ?? activeShipments.filter((job) => job.status === "customs_clearance").length;
  const critical = workflow.critical_blockers;

  return (
    <div className={styles.dashboard}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}><h1>{greeting(data.generated_at)}, {firstName}</h1><p>Here’s what needs your attention today.</p></div>
        <div className={styles.heroActions}>
          <div className={styles.timeBlock}><strong>{formatOperationalDate(data.operational_date)}</strong><span>Local time {formatNepalTime(data.generated_at)} (NPT)</span></div>
          <button type="button" className={styles.secondaryButton} onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "app-refreshing" : undefined} />{refreshing ? "Refreshing" : "Refresh"}</button>
          <button type="button" className={styles.blackButton} onClick={() => setLauncherOpen(true)}><Plus size={15} strokeWidth={2} /> New shipment</button>
        </div>
      </section>

      {data.partial ? <div className={styles.warningBanner}><AlertTriangle size={16} /><span>This operational snapshot reached a server loading limit. Counts may be incomplete; confirm the Digital Job File before acting.</span></div> : null}

      <section className={styles.metrics} aria-label="Operational pulse">
        <Metric href="/admin/shipments?attention=1" label="Requires attention" value={attentionShipments.length} tone="danger" icon={<AlertTriangle size={16} strokeWidth={1.9} />} />
        <Metric href="/admin/customs" label="Customs pending" value={data.totals.customs_blockers} tone="warning" icon={<CircleAlert size={16} strokeWidth={1.9} />} />
        <Metric href="/admin/alerts" label="Overdue" value={data.totals.overdue_tasks} tone="danger" icon={<Clock3 size={16} strokeWidth={1.9} />} />
        <Metric href="/admin/delivery" label="Due today" value={data.totals.deliveries_today} tone="success" icon={<Truck size={16} strokeWidth={1.9} />} />
        <Metric href="/admin/shipments?attention=1" label="Unassigned" value={data.totals.unassigned_jobs} tone="neutral" icon={<Users size={16} strokeWidth={1.9} />} />
        <Metric href="/admin/shipments?status=in_transit" label="In transit" value={inTransit} tone="success" icon={<CheckCircle2 size={16} strokeWidth={1.9} />} />
      </section>

      <div className={styles.primaryGrid}>
        <AttentionTable jobs={attentionQueue} total={attentionShipments.length} returnTo={returnTo} generatedAt={data.generated_at} />
        <section className={`${styles.card} ${styles.todayCard}`} aria-labelledby="today-title">
          <div className={styles.cardHeader}><div><h2 id="today-title">Today</h2></div><Link className={styles.textButton} href="/admin/delivery">View calendar <ArrowRight size={13} /></Link></div>
          <div className={styles.todayList}>
            <TodayItem href="/admin/delivery" label="Arriving today" value={arrivingToday} tone="danger" icon={<Plane size={14} />} />
            <TodayItem href="/admin/visibility" label="Departing today" value={workflow.visibility?.departing_today ?? null} tone="info" icon={<Plane size={14} />} />
            <TodayItem href="/admin/customs" label="Customs clearance" value={customs} tone="success" icon={<FileCheck2 size={14} />} />
            <TodayItem href="/admin/delivery" label="POD overdue" value={workflow.delivery?.pod_overdue ?? null} tone="danger" icon={<CircleAlert size={14} />} />
            <TodayItem href="/admin/tenders" label="Booking approvals" value={workflow.tendering?.accepted_or_countered ?? null} tone="violet" icon={<PackageCheck size={14} />} />
            <TodayItem href="/admin/freight-documents" label="Missing documents" value={workflow.documents?.missing_primary ?? null} tone="danger" icon={<FileText size={14} />} />
            <TodayItem href="/admin/shipments?attention=1" label="Unassigned shipments" value={data.totals.unassigned_jobs} tone="danger" icon={<UserRoundX size={14} />} />
          </div>
          <Link href="/admin/alerts" className={styles.todayCritical}><span className={`${styles.todayItemIcon} ${styles.dangerIcon}`}><AlertTriangle size={15} /></span><span><strong>{critical === null ? "Critical blockers unavailable" : `${critical} critical blocker${critical === 1 ? "" : "s"}`}</strong><span>{critical ? "Require immediate attention" : "No unresolved critical automation alert"}</span></span><ChevronRight size={15} /></Link>
        </section>
      </div>

      <div className={styles.lowerGrid}>
        <Workload data={data} workflow={workflow} />
        <LiveMovement movements={workflow.movements} />
        <RecentActivity activity={workflow.recent_activity} generatedAt={data.generated_at} returnTo={returnTo} />
        <FinanceSnapshot finance={finance} />
      </div>

      <OperationalNotes note={note} selectedBranch={selectedBranch} canPostNotes={canPostNotes} />

      {launcherOpen ? <div className={styles.launcherBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLauncherOpen(false); }}><section className={styles.launcher} role="dialog" aria-modal="true" aria-labelledby="new-shipment-title"><div className={styles.launcherHeader}><div><h2 id="new-shipment-title">New shipment</h2><p>KCPL creates shipment records through the controlled planning, tender and booking chain. This launcher starts the authorised workflow instead of bypassing it.</p></div><button type="button" className={styles.iconButton} onClick={() => setLauncherOpen(false)} aria-label="Close new shipment launcher"><X size={15} /></button></div><div className={styles.launcherBody}>{canViewCommercial ? <Link href="/admin/rating?create=1" className={styles.launcherChoice}><span><strong>Create transport order</strong><span>Start planning, rating, tender and booking for a new movement.</span></span><ArrowRight size={15} /></Link> : <Link href="/admin/enquiries" className={styles.launcherChoice}><span><strong>Open enquiries</strong><span>Operations users can review an existing enquiry and follow its authorised commercial handoff.</span></span><ArrowRight size={15} /></Link>}<Link href="/admin/shipments" className={styles.launcherChoice}><span><strong>Open shipment register</strong><span>Find an existing active or delivered shipment and its Digital Job File.</span></span><ArrowRight size={15} /></Link></div></section></div> : null}
    </div>
  );
}
