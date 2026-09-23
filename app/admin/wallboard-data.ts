import { compareShipmentPriority, shipmentNeedsAttention, shipmentNextAction } from "./shipments/shipment-queue-policy.ts";
import { isRegisterTransition, nptDayStart } from "./notifications/transition-metrics.ts";
import type { CommandCentreData, CommandCentreJob } from "./command-centre/command-centre-data";
import type { OperationsNotification } from "./notifications/notification-data";

/**
 * Pure projection of the operational snapshot into wallboard slides. No
 * fetching, no Date.now, no mutation — the API route and the client pass the
 * same inputs, so what the TV shows is exactly what the register knows.
 */

export type WallboardBlocker = {
  reference: string;
  customer: string;
  route: string;
  label: string;
  detail: string;
  tone: "danger" | "warning";
  owner: string | null;
};

export type WallboardTodayRow = {
  reference: string;
  customer: string;
  route: string;
  label: string;
  tone: "info" | "success" | "warning";
};

export type WallboardTransitionRow = {
  id: string;
  title: string;
  severity: OperationsNotification["severity"];
  whenLabel: string;
};

export type Wallboard = {
  pulse: Array<{ key: string; label: string; value: number; tone: "neutral" | "info" | "warning" | "danger" }>;
  blockers: WallboardBlocker[];
  arrivals: WallboardTodayRow[];
  deliveries: WallboardTodayRow[];
  dueToday: WallboardTodayRow[];
  branches: Array<{ branch: string; active: number; urgent: number; overdue: number }>;
  transitions7d: number[];
  transitionsToday: WallboardTransitionRow[];
  totals: { active: number; urgent: number; overdueTasks: number; customs: number };
};

const dayMs = 86_400_000;

function routeLabel(job: CommandCentreJob) {
  return `${job.origin} → ${job.destination}`;
}

function ownerLabel(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || null;
}

function etaMatchesDay(job: CommandCentreJob, dayStart: number) {
  if (!job.eta) return false;
  const parsed = Date.parse(job.eta);
  if (!Number.isFinite(parsed)) return false;
  return parsed >= dayStart && parsed < dayStart + dayMs;
}

function toRow(job: CommandCentreJob, label: string, tone: WallboardTodayRow["tone"]): WallboardTodayRow {
  return { reference: job.reference, customer: job.customer_name, route: routeLabel(job), label, tone };
}

/** Same presentation ranking the register uses — no parallel priority model. */
function rankJobs(jobs: CommandCentreJob[]) {
  return [...jobs].sort(compareShipmentPriority);
}

export function buildWallboard(data: CommandCentreData, notifications: OperationsNotification[], now: Date): Wallboard {
  const todayStart = nptDayStart(now.toISOString());
  const active = data.jobs.filter((job) => job.status !== "delivered");

  const blockers = rankJobs(data.jobs.filter(shipmentNeedsAttention))
    .slice(0, 10)
    .map((job) => {
      const next = shipmentNextActionLabel(job);
      return {
        reference: job.reference,
        customer: job.customer_name,
        route: routeLabel(job),
        label: next.label,
        detail: next.detail,
        tone: next.tone,
        owner: ownerLabel(job),
      };
    });

  const arrivals = data.jobs.filter((job) => etaMatchesDay(job, todayStart))
    .sort((a, b) => String(a.eta).localeCompare(String(b.eta)))
    .slice(0, 12)
    .map((job) => toRow(job, "Arriving today", job.status === "customs_clearance" ? "warning" : "info"));

  const deliveries = data.jobs.filter((job) => job.status === "delivered" && etaMatchesDay(job, todayStart))
    .slice(0, 12)
    .map((job) => toRow(job, "Delivered today", "success"));

  const dueToday = rankJobs(active.filter((job) => job.overdue_tasks > 0 || job.required_customs_open > 0))
    .slice(0, 12)
    .map((job) => toRow(job, job.overdue_tasks > 0 ? `${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}` : `${job.required_customs_open} customs step${job.required_customs_open === 1 ? "" : "s"}`, job.overdue_tasks > 0 ? "warning" : "info"));

  const branches = data.branch_load
    .filter((entry) => entry.active_jobs > 0 || entry.urgent_jobs > 0 || entry.overdue_tasks > 0)
    .sort((a, b) => b.urgent_jobs - a.urgent_jobs || b.active_jobs - a.active_jobs || a.branch.localeCompare(b.branch))
    .slice(0, 8)
    .map((entry) => ({ branch: entry.branch, active: entry.active_jobs, urgent: entry.urgent_jobs, overdue: entry.overdue_tasks }));

  const transitionsToday: WallboardTransitionRow[] = [];
  const transitions7d = new Array<number>(7).fill(0);
  for (const item of notifications) {
    if (!isRegisterTransition(item)) continue;
    const created = Date.parse(item.created_at);
    if (!Number.isFinite(created)) continue;
    const offset = Math.floor((todayStart - nptDayStart(item.created_at)) / dayMs);
    if (offset >= 0 && offset < 7) transitions7d[6 - offset] += 1;
    if (offset === 0 && transitionsToday.length < 8) {
      const minutes = Math.max(0, Math.round((now.getTime() - created) / 60_000));
      transitionsToday.push({
        id: item.id,
        title: item.title,
        severity: item.severity,
        whenLabel: minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`,
      });
    }
  }

  const pulse = [
    { key: "in_transit", label: "In transit", value: active.filter((job) => job.status === "in_transit").length, tone: "info" as const },
    { key: "out_for_delivery", label: "Delivery", value: active.filter((job) => job.status === "out_for_delivery").length, tone: "info" as const },
    { key: "customs_clearance", label: "Customs", value: active.filter((job) => job.status === "customs_clearance").length, tone: "warning" as const },
    { key: "attention", label: "Attention", value: active.filter((job) => job.status === "exception").length, tone: "danger" as const },
    { key: "delivered_today", label: "Delivered today", value: deliveries.length, tone: "neutral" as const },
    { key: "unassigned", label: "Unassigned", value: active.filter((job) => !job.assigned_to_uid && !job.assigned_to_name && !job.assigned_to_email).length, tone: "neutral" as const },
  ];

  return {
    pulse,
    blockers,
    arrivals,
    deliveries,
    dueToday,
    branches,
    transitions7d,
    transitionsToday,
    totals: {
      active: active.length,
      urgent: data.totals.urgent_jobs,
      overdueTasks: data.totals.overdue_tasks,
      customs: data.totals.customs_blockers,
    },
  };
}

/** Wallboard blocker copy mirrors the register's own next-action policy. */
function shipmentNextActionLabel(job: CommandCentreJob): { label: string; detail: string; tone: "danger" | "warning" } {
  const next = shipmentNextAction(job);
  return {
    label: next.label,
    detail: next.detail,
    tone: next.tone === "danger" ? "danger" : "warning",
  };
}
