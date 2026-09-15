"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileWarning,
  RefreshCw,
  UserRoundX,
} from "lucide-react";
import { shipmentStatusLabels, type ShipmentStatus } from "../../shipment-types";
import type { QuoteSummary } from "../admin-data";
import type { FinanceOverviewSummary } from "../finance/finance-data";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsProgress,
  OpsSurface,
  OpsTableWrap,
} from "../operations-ui";
import {
  compareShipmentPriority,
  shipmentNeedsAttention,
  shipmentNextAction,
} from "../shipments/shipment-queue-policy";
import { useWorkspaceQuery } from "../use-workspace-query";
import type {
  CommandCentreData,
  CommandCentreJob,
  CommandCentreStaffLoad,
} from "./command-centre-data";

const DAY_MS = 86_400_000;

type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";
type ProgressTone = "accent" | "success" | "warning" | "danger";

function statusTone(status: ShipmentStatus): StatusTone {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance" || status === "out_for_delivery") return "warning";
  if (status === "in_transit" || status === "booking_confirmed") return "info";
  return "neutral";
}

function progressTone(status: ShipmentStatus): ProgressTone {
  if (status === "exception") return "danger";
  if (status === "customs_clearance" || status === "out_for_delivery") return "warning";
  if (status === "delivered") return "success";
  return "accent";
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

function formatGeneratedTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Snapshot time unavailable";
  return `Updated ${new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kathmandu",
    timeZoneName: "short",
  }).format(parsed)}`;
}

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || (job.assigned_to_uid ? "Assigned staff" : "Unassigned");
}

function route(job: CommandCentreJob) {
  return `${job.origin || "Origin"} → ${job.destination || "Destination"}`;
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

function etaLabel(job: CommandCentreJob, operationalDate: string) {
  if (job.status === "delivered") return "Delivered";
  if (!job.eta) return "No ETA";
  const base = Date.parse(`${operationalDate}T00:00:00Z`);
  const eta = Date.parse(job.eta.length === 10 ? `${job.eta}T00:00:00Z` : job.eta);
  if (!Number.isFinite(base) || !Number.isFinite(eta)) return "ETA unavailable";
  const days = Math.ceil((eta - base) / DAY_MS);
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

function withReturn(href: string, returnTo: string) {
  const [path, hash] = href.split("#");
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}returnTo=${encodeURIComponent(returnTo)}${hash ? `#${hash}` : ""}`;
}

function jobHref(job: CommandCentreJob, returnTo: string) {
  return `/admin/jobs/${encodeURIComponent(job.reference)}?returnTo=${encodeURIComponent(returnTo)}`;
}

function workloadHref(status: ShipmentStatus) {
  return `/admin/shipments?status=${encodeURIComponent(status)}`;
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-AU")}`;
  }
}

function ActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="ops-button"
      data-variant={primary ? "primary" : "secondary"}
      data-size="md"
    >
      {children}
    </Link>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center gap-1.5 px-1 text-sm font-medium text-[var(--admin-muted)] no-underline hover:text-[var(--admin-crimson)]"
    >
      {children}
      <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}

function PulseMetric({
  href,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  href: string;
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "danger" | "warning" | "info";
}) {
  const valueTone =
    tone === "danger"
      ? "text-[var(--admin-danger)]"
      : tone === "warning"
        ? "text-[var(--admin-warning)]"
        : tone === "info"
          ? "text-[var(--admin-info)]"
          : "text-[var(--admin-ink)]";

  return (
    <Link
      href={href}
      className="group min-w-0 px-4 py-3 no-underline transition-colors hover:bg-[var(--admin-surface-muted)]"
    >
      <span className="block text-xs font-medium text-[var(--admin-muted)]">{label}</span>
      <strong className={`mt-1 block text-2xl font-semibold leading-7 tabular-nums ${valueTone}`}>{value}</strong>
      <span className="mt-0.5 block text-xs leading-4 text-[var(--admin-faint)]">{detail}</span>
    </Link>
  );
}

function SignalRow({
  href,
  icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "danger" | "warning" | "info";
}) {
  const toneClass =
    tone === "danger"
      ? "text-[var(--admin-danger)]"
      : tone === "warning"
        ? "text-[var(--admin-warning)]"
        : tone === "info"
          ? "text-[var(--admin-info)]"
          : "text-[var(--admin-muted)]";

  return (
    <Link
      href={href}
      className="flex min-h-14 items-start gap-3 border-b border-[var(--admin-line)] px-4 py-3 no-underline last:border-b-0 hover:bg-[var(--admin-surface-muted)]"
    >
      <span className={`mt-0.5 shrink-0 ${toneClass}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <strong className="text-sm font-medium text-[var(--admin-ink)]">{label}</strong>
          <strong className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</strong>
        </span>
        <span className="mt-0.5 block text-xs leading-4 text-[var(--admin-muted)]">{detail}</span>
      </span>
    </Link>
  );
}

function OwnerRow({ row }: { row: CommandCentreStaffLoad }) {
  const hrefKey = row.uid || row.email || row.key;
  const detail = [
    `${row.active_jobs} job${row.active_jobs === 1 ? "" : "s"}`,
    `${row.open_tasks} task${row.open_tasks === 1 ? "" : "s"}`,
  ].join(" · ");

  return (
    <Link
      href={`/admin/workload/${encodeURIComponent(hrefKey)}`}
      className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--admin-line)] px-4 py-3 no-underline last:border-b-0 hover:bg-[var(--admin-surface-muted)]"
    >
      <span className="min-w-0">
        <strong className="block truncate text-sm font-medium text-[var(--admin-ink)]">{row.name}</strong>
        <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{detail}</span>
      </span>
      <span className="shrink-0 text-right">
        <strong className={row.overdue_tasks ? "block text-sm font-semibold tabular-nums text-[var(--admin-danger)]" : "block text-sm font-semibold tabular-nums text-[var(--admin-ink)]"}>{row.overdue_tasks}</strong>
        <span className="block text-xs text-[var(--admin-muted)]">overdue</span>
      </span>
    </Link>
  );
}

function FinanceSnapshot({ finance }: { finance: FinanceOverviewSummary }) {
  return (
    <OpsSurface
      title="Finance snapshot"
      description="Receivables are shown by currency. KCPL does not combine currencies into a misleading total."
      action={<SectionLink href="/admin/finance">Open finance</SectionLink>}
      flush
    >
      <OpsTableWrap>
        <table className="ops-table w-full min-w-[720px]" aria-label="Finance snapshot by currency">
          <thead>
            <tr>
              <th>Currency</th>
              <th className="text-right">Invoices</th>
              <th className="text-right">Invoiced</th>
              <th className="text-right">Collected</th>
              <th className="text-right">Outstanding</th>
              <th className="text-right">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {finance.currency_summaries.map((summary) => (
              <tr key={summary.currency}>
                <td><strong className="font-medium">{summary.currency}</strong></td>
                <td className="text-right tabular-nums">{summary.invoice_count}</td>
                <td className="text-right tabular-nums">{money(summary.invoiced, summary.currency)}</td>
                <td className="text-right tabular-nums">{money(summary.collected, summary.currency)}</td>
                <td className="text-right tabular-nums">{money(summary.outstanding, summary.currency)}</td>
                <td className={summary.overdue > 0 ? "text-right font-medium tabular-nums text-[var(--admin-danger)]" : "text-right tabular-nums"}>{money(summary.overdue, summary.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsTableWrap>
    </OpsSurface>
  );
}

export function V4OperationsOverview({
  data,
  enquiries = null,
  finance = null,
}: {
  data: CommandCentreData;
  enquiries?: QuoteSummary[] | null;
  finance?: FinanceOverviewSummary | null;
  isManagement?: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const { search } = useWorkspaceQuery();
  const returnTo = `/admin/command-centre${search}`;

  const activeShipments = useMemo(
    () => data.jobs.filter((job) => job.status !== "delivered"),
    [data.jobs],
  );

  const attentionShipments = useMemo(
    () => [...activeShipments].filter(shipmentNeedsAttention).sort(compareShipmentPriority),
    [activeShipments],
  );

  const attentionQueue = attentionShipments.slice(0, 8);
  const recentActivity = useMemo(
    () => [...activeShipments]
      .sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0))
      .slice(0, 7),
    [activeShipments],
  );

  const dueTodayJobs = activeShipments
    .filter((job) => job.eta?.slice(0, 10) === data.operational_date)
    .slice(0, 3);

  const ownerLoad = data.staff_load
    .filter((row) => row.active_jobs > 0 || row.open_tasks > 0 || row.overdue_tasks > 0 || row.urgent_jobs > 0)
    .slice(0, 5);

  const newEnquiries = enquiries === null ? null : enquiries.filter((quote) => quote.status === "new").length;

  const statusRows = useMemo(() => {
    const counts = new Map<ShipmentStatus, number>();
    for (const job of activeShipments) counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [activeShipments]);

  const scopeLabel = data.accessible_branches.length === 1
    ? data.accessible_branches[0]
    : `${data.accessible_branches.length} accessible branches`;

  return (
    <OpsPage className="kcpl-ops-overview">
      <OpsPageHeader
        title="Overview"
        description="Exceptions, commitments and ownership across the operations you can access."
        meta={(
          <>
            <span>{formatOperationalDate(data.operational_date)}</span>
            <span>Scope: {scopeLabel}</span>
            <span>{formatGeneratedTime(data.generated_at)}</span>
          </>
        )}
        actions={(
          <>
            <OpsButton
              variant="secondary"
              type="button"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing Overview" : "Refresh Overview"}
            >
              <RefreshCw size={16} strokeWidth={1.75} className={refreshing ? "app-refreshing" : undefined} aria-hidden="true" />
              {refreshing ? "Refreshing" : "Refresh"}
            </OpsButton>
            <ActionLink href="/admin/shipments" primary>
              Open shipments
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </ActionLink>
          </>
        )}
      />

      <div className="ops-content-wide">
        {data.partial ? (
          <OpsNotice tone="warning">
            This operational snapshot reached a server loading limit. Counts may be incomplete; confirm a shipment in its Job File before acting on readiness.
          </OpsNotice>
        ) : null}

        <section className="mt-4" aria-labelledby="overview-pulse-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 id="overview-pulse-title" className="m-0">Operational pulse</h2>
              <p className="mt-0.5 text-xs text-[var(--admin-muted)]">Counts are scoped to accessible active operations.</p>
            </div>
          </div>
          <div className="grid overflow-hidden border-y border-[var(--admin-line)] bg-[var(--admin-surface)] sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-[var(--admin-line)] sm:[&>*]:border-r sm:[&>*:nth-child(2n)]:border-r-0 md:[&>*:nth-child(2n)]:border-r md:[&>*:nth-child(3n)]:border-r-0 xl:[&>*]:border-b-0 xl:[&>*:nth-child(3n)]:border-r xl:[&>*:last-child]:border-r-0">
            <PulseMetric href="/admin/shipments?attention=1" label="Requires attention" value={attentionShipments.length} detail="shipment records" tone={attentionShipments.length ? "danger" : "neutral"} />
            <PulseMetric href="/admin/shipments?status=exception" label="Exceptions" value={data.totals.exception_jobs} detail="active exception state" tone={data.totals.exception_jobs ? "danger" : "neutral"} />
            <PulseMetric href="/admin/customs" label="Customs pending" value={data.totals.customs_blockers} detail="required open steps" tone={data.totals.customs_blockers ? "warning" : "neutral"} />
            <PulseMetric href="/admin/shipments?attention=1" label="Overdue" value={data.totals.overdue_tasks} detail="open tasks past due" tone={data.totals.overdue_tasks ? "danger" : "neutral"} />
            <PulseMetric href="/admin/shipments?attention=1" label="Unassigned" value={data.totals.unassigned_jobs} detail="active jobs without owner" tone={data.totals.unassigned_jobs ? "warning" : "neutral"} />
            <PulseMetric href="/admin/delivery" label="Due today" value={data.totals.deliveries_today} detail="ETA commitments" tone={data.totals.deliveries_today ? "info" : "neutral"} />
          </div>
        </section>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <OpsSurface
            title={(
              <span className="flex items-center gap-2">
                <AlertTriangle size={17} strokeWidth={1.75} className="text-[var(--admin-danger)]" aria-hidden="true" />
                Attention required
                <OpsBadge tone={attentionShipments.length ? "danger" : "success"}>{attentionShipments.length}</OpsBadge>
              </span>
            )}
            description="Priority uses KCPL shipment queue policy. Actions remain subject to server authority."
            action={<SectionLink href="/admin/shipments?attention=1">Open attention queue</SectionLink>}
            flush
          >
            {attentionQueue.length ? (
              <OpsTableWrap>
                <table className="ops-table w-full min-w-[980px]" aria-label="Shipments requiring operational attention">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Customer · Route</th>
                      <th>State</th>
                      <th>Blocker</th>
                      <th>Owner</th>
                      <th>Timing</th>
                      <th>Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentionQueue.map((job) => {
                      const issue = shipmentNextAction(job);
                      return (
                        <tr key={job.reference}>
                          <td>
                            <Link href={jobHref(job, returnTo)} className="ops-mono font-medium text-[var(--admin-info)] no-underline hover:underline">
                              {job.reference}
                            </Link>
                          </td>
                          <td>
                            <strong className="block max-w-64 truncate text-sm font-medium">{job.customer_name || "Customer not linked"}</strong>
                            <span className="mt-0.5 block max-w-72 truncate text-xs text-[var(--admin-muted)]">{route(job)}</span>
                          </td>
                          <td><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></td>
                          <td>
                            <strong className="block text-sm font-medium">{issue.label}</strong>
                            <span className="mt-0.5 block max-w-64 text-xs leading-4 text-[var(--admin-muted)]">{issue.detail}</span>
                          </td>
                          <td>
                            <span className={owner(job) === "Unassigned" ? "text-sm font-medium text-[var(--admin-danger)]" : "text-sm text-[var(--admin-ink)]"}>{owner(job)}</span>
                          </td>
                          <td>
                            <span className="block text-sm font-medium">{etaLabel(job, data.operational_date)}</span>
                            <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{relativeAge(job.updated_at, data.generated_at)}</span>
                          </td>
                          <td>
                            <Link
                              href={withReturn(issue.href, returnTo)}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--app-radius)] border border-[var(--admin-line)] px-3 text-sm font-medium text-[var(--admin-ink)] no-underline hover:border-[var(--admin-line-strong)] hover:bg-[var(--admin-surface-muted)]"
                            >
                              {issue.title}
                              <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (
              <OpsEmptyState
                icon={<CheckCircle2 size={20} strokeWidth={1.75} aria-hidden="true" />}
                title="No active shipment needs priority attention"
                description="The current accessible shipment snapshot has no exception, overdue, customs, unassigned or urgent priority signal."
                kind="healthy"
                compact
              />
            )}
          </OpsSurface>

          <aside className="flex min-w-0 flex-col gap-4" aria-label="Current operational context">
            <OpsSurface title="Now" description="Current commitments and unresolved operational pressure." flush>
              <SignalRow href="/admin/delivery" icon={<CalendarClock size={16} strokeWidth={1.75} aria-hidden="true" />} label="Due today" value={data.totals.deliveries_today} detail="Active shipments with today's ETA" tone={data.totals.deliveries_today ? "info" : "neutral"} />
              <SignalRow href="/admin/alerts" icon={<AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />} label="Exceptions" value={data.totals.exception_jobs} detail="Shipment exception state requiring resolution" tone={data.totals.exception_jobs ? "danger" : "neutral"} />
              <SignalRow href="/admin/customs" icon={<FileWarning size={16} strokeWidth={1.75} aria-hidden="true" />} label="Customs blockers" value={data.totals.customs_blockers} detail="Required customs work at movement risk" tone={data.totals.customs_blockers ? "warning" : "neutral"} />
              <SignalRow href="/admin/shipments?attention=1" icon={<UserRoundX size={16} strokeWidth={1.75} aria-hidden="true" />} label="Unassigned" value={data.totals.unassigned_jobs} detail="Active jobs without an operational owner" tone={data.totals.unassigned_jobs ? "warning" : "neutral"} />
              {newEnquiries === null ? null : (
                <SignalRow href="/admin/enquiries" icon={<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />} label="New enquiries" value={newEnquiries} detail="Commercial enquiries awaiting review" tone={newEnquiries ? "info" : "neutral"} />
              )}
              {dueTodayJobs.length ? (
                <div className="border-t border-[var(--admin-line)] px-4 py-3">
                  <p className="m-0 text-xs font-medium text-[var(--admin-muted)]">Today’s ETA watch</p>
                  <div className="mt-2 space-y-2">
                    {dueTodayJobs.map((job) => (
                      <Link key={job.reference} href={jobHref(job, returnTo)} className="flex items-center justify-between gap-3 text-sm no-underline hover:text-[var(--admin-crimson)]">
                        <span className="min-w-0 truncate"><span className="ops-mono font-medium">{job.reference}</span> · {job.destination || "Destination"}</span>
                        <span className="shrink-0 text-xs text-[var(--admin-muted)]">{owner(job)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </OpsSurface>

            <OpsSurface
              title="Ownership"
              description="Staff carrying active operational work."
              action={<SectionLink href="/admin/staff">Staff</SectionLink>}
              flush
            >
              {ownerLoad.length ? ownerLoad.map((row) => <OwnerRow key={row.key} row={row} />) : (
                <OpsEmptyState title="No assigned workload" description="No staff workload is present in this accessible snapshot." compact />
              )}
            </OpsSurface>
          </aside>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <OpsSurface
            title="Shipment workload"
            description={`${activeShipments.length} active shipment${activeShipments.length === 1 ? "" : "s"} by current state.`}
            action={<SectionLink href="/admin/shipments">Open register</SectionLink>}
          >
            {statusRows.length ? (
              <div className="space-y-1">
                {statusRows.map(([status, count]) => {
                  const percentage = activeShipments.length ? Math.round((count / activeShipments.length) * 100) : 0;
                  return (
                    <Link
                      key={status}
                      href={workloadHref(status)}
                      className="grid min-h-14 grid-cols-[minmax(130px,0.7fr)_minmax(150px,1.3fr)_auto] items-center gap-4 px-2 py-2 no-underline hover:bg-[var(--admin-surface-muted)] sm:px-3"
                    >
                      <span className="min-w-0 text-sm font-medium text-[var(--admin-ink)]">{shipmentStatusLabels[status]}</span>
                      <OpsProgress value={count} max={Math.max(activeShipments.length, 1)} tone={progressTone(status)} label={`${shipmentStatusLabels[status]} ${count} of ${activeShipments.length}`} />
                      <span className="min-w-16 text-right"><strong className="text-sm font-semibold tabular-nums">{count}</strong><span className="ml-2 text-xs tabular-nums text-[var(--admin-muted)]">{percentage}%</span></span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <OpsEmptyState title="No active shipment workload" description="No active shipments are available in the current accessible scope." kind="healthy" compact />
            )}
          </OpsSurface>

          <OpsSurface
            title="Recent operational activity"
            description="Latest shipment records ordered by their real update timestamp. This is a current-change feed, not a full audit trail."
            flush
          >
            {recentActivity.length ? (
              <div>
                {recentActivity.map((job) => (
                  <Link
                    key={job.reference}
                    href={jobHref(job, returnTo)}
                    className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--admin-line)] px-4 py-3 no-underline last:border-b-0 hover:bg-[var(--admin-surface-muted)]"
                  >
                    <span className="ops-mono text-xs font-medium text-[var(--admin-info)]">{job.reference}</span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-medium text-[var(--admin-ink)]">{job.customer_name || "Customer not linked"}</strong>
                      <span className="mt-0.5 block truncate text-xs text-[var(--admin-muted)]">{shipmentStatusLabels[job.status]} · {route(job)} · {owner(job)}</span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--admin-muted)]">{relativeAge(job.updated_at, data.generated_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <OpsEmptyState title="No recent shipment activity" description="There are no active shipment updates in the current accessible snapshot." compact />
            )}
          </OpsSurface>
        </div>

        {finance?.currency_summaries.length ? <div className="mt-5"><FinanceSnapshot finance={finance} /></div> : null}
      </div>
    </OpsPage>
  );
}
