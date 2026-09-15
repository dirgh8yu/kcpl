"use client";

import Link from "next/link";
import { useMemo, useTransition, type ReactNode } from "react";
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
  Badge,
  BarList,
  Button,
  Callout,
  LinkButton,
  MetricLink,
  MetricStrip,
  Panel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
  TextLink,
  Workspace,
  WorkspaceBody,
  WorkspaceHeader,
} from "../tremor/tremor-ui";
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

function statusTone(status: ShipmentStatus): StatusTone {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance" || status === "out_for_delivery") return "warning";
  if (status === "in_transit" || status === "booking_confirmed") return "info";
  return "neutral";
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

function SectionAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <TextLink href={href}>
      {children}
      <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
    </TextLink>
  );
}

function SignalRow({
  href,
  icon,
  label,
  value,
  detail,
  tone,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: "danger" | "warning" | "info";
}) {
  const toneClass = tone === "danger"
    ? "text-[var(--admin-danger)]"
    : tone === "warning"
      ? "text-[var(--admin-warning)]"
      : "text-[var(--admin-info)]";

  return (
    <Link
      href={href}
      className="flex min-h-12 items-start gap-3 border-b border-[var(--admin-line)] px-4 py-2.5 no-underline last:border-b-0 hover:bg-[var(--admin-surface-soft)]"
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
      className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--admin-line)] px-4 py-2.5 no-underline last:border-b-0 hover:bg-[var(--admin-surface-soft)]"
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

function AttentionRegister({
  jobs,
  total,
  returnTo,
  operationalDate,
  generatedAt,
}: {
  jobs: CommandCentreJob[];
  total: number;
  returnTo: string;
  operationalDate: string;
  generatedAt: string;
}) {
  return (
    <Panel
      title={(
        <span className="flex items-center gap-2">
          <AlertTriangle size={17} strokeWidth={1.75} className="text-[var(--admin-danger)]" aria-hidden="true" />
          Attention required
          <Badge tone="danger">{total}</Badge>
        </span>
      )}
      description="Prioritised by KCPL shipment queue policy. Actions remain subject to server authority."
      action={<SectionAction href="/admin/shipments?attention=1">Open queue</SectionAction>}
      tone="danger"
      flush
    >
      <TableRoot>
        <Table className="min-w-[980px]" aria-label="Shipments requiring operational attention">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Reference</TableHeaderCell>
              <TableHeaderCell>Customer · Route</TableHeaderCell>
              <TableHeaderCell>State</TableHeaderCell>
              <TableHeaderCell>Blocker</TableHeaderCell>
              <TableHeaderCell>Owner</TableHeaderCell>
              <TableHeaderCell>Timing</TableHeaderCell>
              <TableHeaderCell>Next action</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => {
              const issue = shipmentNextAction(job);
              return (
                <TableRow key={job.reference}>
                  <TableCell>
                    <Link href={jobHref(job, returnTo)} className="font-mono font-medium text-[var(--admin-info)] no-underline hover:underline">
                      {job.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <strong className="block max-w-64 truncate text-sm font-medium">{job.customer_name || "Customer not linked"}</strong>
                    <span className="mt-0.5 block max-w-72 truncate text-xs text-[var(--admin-muted)]">{route(job)}</span>
                  </TableCell>
                  <TableCell><Badge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</Badge></TableCell>
                  <TableCell>
                    <strong className="block text-sm font-medium">{issue.label}</strong>
                    <span className="mt-0.5 block max-w-64 text-xs leading-4 text-[var(--admin-muted)]">{issue.detail}</span>
                  </TableCell>
                  <TableCell>
                    <span className={owner(job) === "Unassigned" ? "font-medium text-[var(--admin-danger)]" : "text-[var(--admin-ink)]"}>{owner(job)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block font-medium">{etaLabel(job, operationalDate)}</span>
                    <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{relativeAge(job.updated_at, generatedAt)}</span>
                  </TableCell>
                  <TableCell>
                    <LinkButton href={withReturn(issue.href, returnTo)} size="sm">
                      {issue.title}
                      <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                    </LinkButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableRoot>
    </Panel>
  );
}

function ShipmentWorkload({
  activeShipments,
  statusRows,
}: {
  activeShipments: CommandCentreJob[];
  statusRows: Array<[ShipmentStatus, number]>;
}) {
  const data = statusRows.map(([status, count]) => ({
    key: status,
    name: shipmentStatusLabels[status],
    value: count,
    href: workloadHref(status),
    percentage: activeShipments.length ? Math.round((count / activeShipments.length) * 100) : 0,
  }));

  return (
    <Panel
      title="Shipment workload"
      description={`${activeShipments.length} active shipment${activeShipments.length === 1 ? "" : "s"} by current state.`}
      action={<SectionAction href="/admin/shipments">Open register</SectionAction>}
    >
      {data.length ? (
        <BarList
          data={data}
          valueFormatter={(value, item) => `${value} · ${item.percentage}%`}
          sortOrder="descending"
        />
      ) : (
        <Callout
          icon={<CheckCircle2 size={17} strokeWidth={1.75} aria-hidden="true" />}
          title="No active shipment workload"
          tone="success"
        >
          The current accessible scope has no active shipments.
        </Callout>
      )}
    </Panel>
  );
}

function RecentActivity({
  jobs,
  returnTo,
  generatedAt,
}: {
  jobs: CommandCentreJob[];
  returnTo: string;
  generatedAt: string;
}) {
  return (
    <Panel
      title="Recent operational activity"
      description="Latest shipment changes by real update time. This is not a full audit trail."
      flush
    >
      {jobs.length ? (
        <div>
          {jobs.map((job) => (
            <Link
              key={job.reference}
              href={jobHref(job, returnTo)}
              className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--admin-line)] px-4 py-2.5 no-underline last:border-b-0 hover:bg-[var(--admin-surface-soft)]"
            >
              <span className="font-mono text-xs font-medium text-[var(--admin-info)]">{job.reference}</span>
              <span className="min-w-0">
                <strong className="block truncate text-sm font-medium text-[var(--admin-ink)]">{job.customer_name || "Customer not linked"}</strong>
                <span className="mt-0.5 block truncate text-xs text-[var(--admin-muted)]">{shipmentStatusLabels[job.status]} · {route(job)} · {owner(job)}</span>
              </span>
              <span className="shrink-0 text-xs text-[var(--admin-muted)]">{relativeAge(job.updated_at, generatedAt)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-4">
          <Callout title="No recent shipment activity">
            There are no active shipment updates in this accessible snapshot.
          </Callout>
        </div>
      )}
    </Panel>
  );
}

function ContextRail({
  data,
  newEnquiries,
  dueTodayJobs,
  ownerLoad,
  returnTo,
}: {
  data: CommandCentreData;
  newEnquiries: number | null;
  dueTodayJobs: CommandCentreJob[];
  ownerLoad: CommandCentreStaffLoad[];
  returnTo: string;
}) {
  const hasNowSignals = Boolean(
    data.totals.deliveries_today
    || data.totals.exception_jobs
    || data.totals.customs_blockers
    || data.totals.unassigned_jobs
    || (newEnquiries ?? 0),
  );

  return (
    <aside className="flex min-w-0 flex-col gap-4" aria-label="Current operational context">
      <Panel title="Now" description="Current commitments and unresolved pressure only." flush>
        {hasNowSignals ? (
          <>
            {data.totals.deliveries_today ? <SignalRow href="/admin/delivery" icon={<CalendarClock size={16} strokeWidth={1.75} aria-hidden="true" />} label="Due today" value={data.totals.deliveries_today} detail="Active shipments with today's ETA" tone="info" /> : null}
            {data.totals.exception_jobs ? <SignalRow href="/admin/alerts" icon={<AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />} label="Exceptions" value={data.totals.exception_jobs} detail="Shipment exception state requiring resolution" tone="danger" /> : null}
            {data.totals.customs_blockers ? <SignalRow href="/admin/customs" icon={<FileWarning size={16} strokeWidth={1.75} aria-hidden="true" />} label="Customs blockers" value={data.totals.customs_blockers} detail="Required customs work at movement risk" tone="warning" /> : null}
            {data.totals.unassigned_jobs ? <SignalRow href="/admin/shipments?attention=1" icon={<UserRoundX size={16} strokeWidth={1.75} aria-hidden="true" />} label="Unassigned" value={data.totals.unassigned_jobs} detail="Active jobs without an operational owner" tone="warning" /> : null}
            {newEnquiries ? <SignalRow href="/admin/enquiries" icon={<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />} label="New enquiries" value={newEnquiries} detail="Commercial enquiries awaiting review" tone="info" /> : null}
          </>
        ) : (
          <div className="p-4">
            <Callout
              icon={<CheckCircle2 size={17} strokeWidth={1.75} aria-hidden="true" />}
              title="No immediate blockers"
              tone="success"
            >
              Nothing is due today, in exception, customs-blocked or unassigned.
            </Callout>
          </div>
        )}

        {dueTodayJobs.length ? (
          <div className="border-t border-[var(--admin-line)] px-4 py-3">
            <p className="m-0 text-xs font-medium text-[var(--admin-muted)]">Today’s ETA watch</p>
            <div className="mt-2 space-y-2">
              {dueTodayJobs.map((job) => (
                <Link key={job.reference} href={jobHref(job, returnTo)} className="flex items-center justify-between gap-3 text-sm no-underline hover:text-[var(--admin-crimson)]">
                  <span className="min-w-0 truncate"><span className="font-mono font-medium">{job.reference}</span> · {job.destination || "Destination"}</span>
                  <span className="shrink-0 text-xs text-[var(--admin-muted)]">{owner(job)}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Ownership"
        description="Staff carrying active operational work."
        action={<SectionAction href="/admin/staff">Staff</SectionAction>}
        flush
      >
        {ownerLoad.length ? ownerLoad.map((row) => <OwnerRow key={row.key} row={row} />) : (
          <div className="p-4">
            <Callout title="No assigned workload">No staff workload is present in this accessible snapshot.</Callout>
          </div>
        )}
      </Panel>
    </aside>
  );
}

function FinanceSnapshot({ finance }: { finance: FinanceOverviewSummary }) {
  return (
    <Panel
      title="Finance snapshot"
      description="Receivables stay separated by currency so the control tower never presents a false combined total."
      action={<SectionAction href="/admin/finance">Open finance</SectionAction>}
      flush
    >
      <TableRoot>
        <Table className="min-w-[720px]" aria-label="Finance snapshot by currency">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Currency</TableHeaderCell>
              <TableHeaderCell className="text-right">Invoices</TableHeaderCell>
              <TableHeaderCell className="text-right">Invoiced</TableHeaderCell>
              <TableHeaderCell className="text-right">Collected</TableHeaderCell>
              <TableHeaderCell className="text-right">Outstanding</TableHeaderCell>
              <TableHeaderCell className="text-right">Overdue</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {finance.currency_summaries.map((summary) => (
              <TableRow key={summary.currency}>
                <TableCell><strong className="font-medium">{summary.currency}</strong></TableCell>
                <TableCell className="text-right tabular-nums">{summary.invoice_count}</TableCell>
                <TableCell className="text-right tabular-nums">{money(summary.invoiced, summary.currency)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(summary.collected, summary.currency)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(summary.outstanding, summary.currency)}</TableCell>
                <TableCell className={summary.overdue > 0 ? "text-right font-medium tabular-nums text-[var(--admin-danger)]" : "text-right tabular-nums"}>{money(summary.overdue, summary.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </Panel>
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

  const contextRail = (
    <ContextRail
      data={data}
      newEnquiries={newEnquiries}
      dueTodayJobs={dueTodayJobs}
      ownerLoad={ownerLoad}
      returnTo={returnTo}
    />
  );

  return (
    <Workspace className="kcpl-ops-overview">
      <WorkspaceHeader
        title="Overview"
        description="Today’s exceptions, commitments and ownership across your accessible operations."
        meta={(
          <>
            <span>{formatOperationalDate(data.operational_date)}</span>
            <span>Scope: {scopeLabel}</span>
            <span>{formatGeneratedTime(data.generated_at)}</span>
          </>
        )}
        actions={(
          <>
            <Button
              variant="secondary"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing Overview" : "Refresh Overview"}
            >
              <RefreshCw size={16} strokeWidth={1.75} className={refreshing ? "app-refreshing" : undefined} aria-hidden="true" />
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
            <LinkButton href="/admin/shipments" variant="secondary">
              Shipments
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </LinkButton>
          </>
        )}
      />

      <WorkspaceBody>
        {data.partial ? (
          <Callout
            icon={<AlertTriangle size={17} strokeWidth={1.75} aria-hidden="true" />}
            title="Operational snapshot is partial"
            tone="warning"
          >
            This snapshot reached a server loading limit. Counts may be incomplete; confirm a shipment in its Job File before acting on readiness.
          </Callout>
        ) : null}

        <section className={data.partial ? "mt-4" : undefined} aria-labelledby="overview-pulse-title">
          <div className="mb-2 flex items-end justify-between gap-4">
            <div>
              <h2 id="overview-pulse-title" className="m-0 text-base font-semibold text-[var(--admin-ink)]">Operational pulse</h2>
              <p className="mb-0 mt-0.5 text-xs text-[var(--admin-muted)]">Only actionable operating signals receive semantic colour.</p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-[var(--admin-muted)]">{activeShipments.length} active shipment{activeShipments.length === 1 ? "" : "s"}</span>
          </div>
          <MetricStrip>
            <MetricLink href="/admin/shipments?attention=1" label="Requires attention" value={attentionShipments.length} detail="shipment records" tone={attentionShipments.length ? "danger" : "neutral"} />
            <MetricLink href="/admin/shipments?status=exception" label="Exceptions" value={data.totals.exception_jobs} detail="active exception state" tone={data.totals.exception_jobs ? "danger" : "neutral"} />
            <MetricLink href="/admin/customs" label="Customs pending" value={data.totals.customs_blockers} detail="required open steps" tone={data.totals.customs_blockers ? "warning" : "neutral"} />
            <MetricLink href="/admin/shipments?attention=1" label="Overdue" value={data.totals.overdue_tasks} detail="open tasks past due" tone={data.totals.overdue_tasks ? "danger" : "neutral"} />
            <MetricLink href="/admin/shipments?attention=1" label="Unassigned" value={data.totals.unassigned_jobs} detail="active jobs without owner" tone={data.totals.unassigned_jobs ? "warning" : "neutral"} />
            <MetricLink href="/admin/delivery" label="Due today" value={data.totals.deliveries_today} detail="ETA commitments" tone={data.totals.deliveries_today ? "info" : "neutral"} />
          </MetricStrip>
        </section>

        {attentionQueue.length ? (
          <>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.8fr)]">
              <AttentionRegister
                jobs={attentionQueue}
                total={attentionShipments.length}
                returnTo={returnTo}
                operationalDate={data.operational_date}
                generatedAt={data.generated_at}
              />
              {contextRail}
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <ShipmentWorkload activeShipments={activeShipments} statusRows={statusRows} />
              <RecentActivity jobs={recentActivity} returnTo={returnTo} generatedAt={data.generated_at} />
            </div>
          </>
        ) : (
          <>
            <div className="mt-4">
              <Callout
                icon={<CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" />}
                title="Operations clear"
                tone="success"
                action={<SectionAction href="/admin/shipments?attention=1">Review queue</SectionAction>}
              >
                No exception, overdue, customs, unassigned or urgent shipment signal requires priority attention.
              </Callout>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.8fr)]">
              <div className="flex min-w-0 flex-col gap-4">
                <ShipmentWorkload activeShipments={activeShipments} statusRows={statusRows} />
                <RecentActivity jobs={recentActivity} returnTo={returnTo} generatedAt={data.generated_at} />
              </div>
              {contextRail}
            </div>
          </>
        )}

        {finance?.currency_summaries.length ? <div className="mt-4"><FinanceSnapshot finance={finance} /></div> : null}
      </WorkspaceBody>
    </Workspace>
  );
}
