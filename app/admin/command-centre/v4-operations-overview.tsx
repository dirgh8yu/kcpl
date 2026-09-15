"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { shipmentStatusLabels, type ShipmentStatus } from "../../shipment-types";
import type { QuoteSummary } from "../admin-data";
import type { FinanceOverviewSummary } from "../finance/finance-data";
import { OpsBadge, OpsNotice, OpsPage } from "../operations-ui";
import { compareShipmentPriority, shipmentNeedsAttention, shipmentNextAction } from "../shipments/shipment-queue-policy";
import { useWorkspaceQuery } from "../use-workspace-query";
import type { CommandCentreData, CommandCentreJob } from "./command-centre-data";

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
  if (!job.eta) return "—";
  const base = Date.parse(`${operationalDate}T00:00:00Z`);
  const eta = Date.parse(job.eta.length === 10 ? `${job.eta}T00:00:00Z` : job.eta);
  if (!Number.isFinite(base) || !Number.isFinite(eta)) return "—";
  const days = Math.ceil((eta - base) / DAY_MS);
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "Today";
  return `${days}d`;
}

function withReturn(href: string, returnTo: string) {
  const [path, hash] = href.split("#");
  return `${path}?returnTo=${encodeURIComponent(returnTo)}${hash ? `#${hash}` : ""}`;
}

function jobHref(job: CommandCentreJob, returnTo: string) {
  return `/admin/jobs/${encodeURIComponent(job.reference)}?returnTo=${encodeURIComponent(returnTo)}`;
}

function Surface({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overview-dashboard-surface">
      <header className="overview-dashboard-surface-header">
        <div className="overview-dashboard-surface-title">{title}</div>
        {action ? <div className="overview-dashboard-surface-action">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

function TextAction({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex min-h-9 items-center gap-1.5 px-1 text-xs font-medium text-[var(--admin-crimson)] no-underline hover:underline">{children}</Link>;
}

function EmptyLine({ icon = false, children }: { icon?: boolean; children: React.ReactNode }) {
  return <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-5 py-6 text-center text-sm text-[var(--admin-muted)]">{icon ? <CheckCircle2 size={18} strokeWidth={1.75} className="text-[var(--admin-success)]" aria-hidden="true"/> : null}<span>{children}</span></div>;
}

function Kpi({ href, label, value, detail, tone = "neutral" }: { href: string; label: string; value: number; detail: string; tone?: "neutral" | "danger" | "warning" | "info" }) {
  const valueClass = tone === "danger" ? "is-danger" : tone === "warning" ? "is-warning" : tone === "info" ? "is-info" : "";
  return (
    <Link href={href} className={`overview-dashboard-kpi ${valueClass}`} data-tone={tone}>
      <span className="overview-dashboard-kpi-label">{label}</span>
      <strong className="overview-dashboard-kpi-value">{value}</strong>
      <span className="overview-dashboard-kpi-detail">{detail}</span>
    </Link>
  );
}

function StatusMix({ data }: { data: CommandCentreData }) {
  const statuses = useMemo(() => {
    const counts = new Map<ShipmentStatus, number>();
    for (const job of data.jobs) counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.jobs]);

  const total = data.jobs.length;

  return (
    <section className="overview-status-board" aria-label="Shipment status mix">
      <div className="overview-status-board-heading">
        <div>
          <p className="overview-status-kicker">Workload mix</p>
          <h2>Where shipments are now</h2>
          <p>Current snapshot across all shipment records.</p>
        </div>
        <Link href="/admin/shipments" className="overview-section-link">Open register <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></Link>
      </div>
      {statuses.length ? (
        <div className="overview-status-list">
          {statuses.map(([status, count]) => {
            const percentage = total ? Math.round((count / total) * 100) : 0;
            return (
              <Link key={status} href={`/admin/shipments?status=${encodeURIComponent(status)}`} className="overview-status-item">
                <span className="overview-status-item-label">{shipmentStatusLabels[status]}</span>
                <span className="overview-status-item-track" aria-hidden="true"><span style={{ width: `${percentage}%` }}/></span>
                <strong>{count}</strong>
                <span className="overview-status-item-percent">{percentage}%</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyLine>No shipment status data available</EmptyLine>
      )}
    </section>
  );
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-AU")}`;
  }
}

function FinanceSnapshot({ finance }: { finance: FinanceOverviewSummary }) {
  return (
    <Surface
      title={<span className="flex items-center gap-2">Revenue snapshot <OpsBadge tone="info">Finance</OpsBadge></span>}
      action={<TextAction href="/admin/finance">Open finance <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true"/></TextAction>}
    >
      <div className="overview-finance-grid">
        {finance.currency_summaries.map((summary) => (
          <div key={summary.currency} className="overview-finance-currency">
            <div className="overview-finance-currency-head">
              <strong>{summary.currency}</strong>
              <span>{summary.invoice_count} invoice{summary.invoice_count === 1 ? "" : "s"}</span>
            </div>
            <div className="overview-finance-values">
              <div><span>Invoiced</span><strong>{money(summary.invoiced, summary.currency)}</strong></div>
              <div><span>Collected</span><strong>{money(summary.collected, summary.currency)}</strong></div>
              <div><span>Outstanding</span><strong>{money(summary.outstanding, summary.currency)}</strong></div>
              <div><span>Overdue</span><strong className={summary.overdue > 0 ? "overview-finance-danger" : undefined}>{money(summary.overdue, summary.currency)}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </Surface>
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

  const activeShipments = useMemo(() => [...data.jobs]
    .filter((job) => job.status !== "delivered")
    .sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0))
    .slice(0, 6), [data.jobs]);

  const attentionShipments = useMemo(() => [...data.jobs]
    .filter(shipmentNeedsAttention)
    .sort(compareShipmentPriority)
    .slice(0, 5), [data.jobs]);

  const criticalAlerts = attentionShipments.slice(0, 3);
  const newEnquiries = useMemo(() => (enquiries ?? [])
    .filter((quote) => quote.status === "new")
    .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
    .slice(0, 4), [enquiries]);

  const active = data.jobs.filter((job) => job.status !== "delivered").length;
  const exceptions = data.jobs.filter((job) => job.status === "exception").length;
  const overdue = data.jobs.reduce((sum, job) => sum + job.overdue_tasks, 0);
  const customs = data.jobs.reduce((sum, job) => sum + job.required_customs_open, 0);
  const unassigned = data.jobs.filter((job) => job.status !== "delivered" && !job.assigned_to_uid && !job.assigned_to_name && !job.assigned_to_email).length;
  const dueToday = data.jobs.filter((job) => job.status !== "delivered" && etaLabel(job, data.operational_date) === "Today").length;

  return (
    <OpsPage className="kcpl-ops-overview overview-reference-layout">
      <div className="overview-dashboard-content px-4 py-5 md:px-6 md:py-6">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0">Overview</h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Operational snapshot · {formatOperationalDate(data.operational_date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-grid h-10 w-10 place-items-center rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)] disabled:opacity-50"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing Overview" : "Refresh Overview"}
              title="Refresh Overview"
            >
              <RefreshCw size={16} strokeWidth={1.75} className={refreshing ? "app-refreshing" : undefined} aria-hidden="true"/>
            </button>
            <Link href="/admin/shipments" className="ops-button" data-variant="primary" data-size="md">Open shipments <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true"/></Link>
          </div>
        </header>

        {data.partial ? <div className="mb-4"><OpsNotice tone="warning">This snapshot reached a loading limit. Counts may be incomplete; confirm shipment readiness in the Job File.</OpsNotice></div> : null}

        <section className="overview-dashboard-kpis mb-5" aria-label="Operational KPIs">
          <Kpi href="/admin/shipments" label="Active" value={active} detail="shipments in progress"/>
          <Kpi href="/admin/alerts" label="Exceptions" value={exceptions} detail="require resolution" tone={exceptions ? "danger" : "neutral"}/>
          <Kpi href="/admin/shipments?attention=1" label="Overdue" value={overdue} detail="past due time" tone={overdue ? "danger" : "neutral"}/>
          <Kpi href="/admin/customs" label="Customs" value={customs} detail="clearance pending" tone={customs ? "warning" : "neutral"}/>
          <Kpi href="/admin/shipments?attention=1" label="Unassigned" value={unassigned} detail="no owner" tone={unassigned ? "warning" : "neutral"}/>
          <Kpi href="/admin/delivery" label="Due today" value={dueToday} detail="ETA commitments" tone={dueToday ? "info" : "neutral"}/>
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
            {attentionShipments.length ? (
              <Surface
                title={<span className="flex items-center gap-2"><AlertTriangle size={16} strokeWidth={1.75} className="text-[var(--admin-danger)]" aria-hidden="true"/>Attention required <OpsBadge tone="danger">{attentionShipments.length}</OpsBadge></span>}
                action={<TextAction href="/admin/alerts">View all alerts <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true"/></TextAction>}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]" aria-label="Shipments needing attention">
                    <thead style={{ background: "var(--admin-surface)" }}>
                      <tr>
                        <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Ref</th>
                        <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Customer · Route</th>
                        <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Status</th>
                        <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Blocker</th>
                        <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Next action</th>
                      </tr>
                    </thead>
                    <tbody>{attentionShipments.map((job) => {
                      const issue = shipmentNextAction(job);
                      return <tr key={job.reference}>
                        <td><Link href={jobHref(job, returnTo)} className="ops-mono font-medium text-[var(--admin-info)] no-underline hover:underline">{job.reference}</Link></td>
                        <td><strong className="block text-sm font-medium">{job.customer_name || "Customer not linked"}</strong><span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{route(job)}</span></td>
                        <td><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></td>
                        <td><span className="text-sm text-[var(--admin-muted)]">{issue.detail}</span></td>
                        <td><Link href={withReturn(issue.href, returnTo)} className="inline-flex min-h-8 items-center rounded-md border border-[var(--admin-crimson)] px-2.5 text-xs font-medium text-[var(--admin-crimson)] no-underline hover:bg-[var(--admin-surface-muted)]">{issue.title}</Link></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
              </Surface>
            ) : null}

            <Surface title="Active shipments" action={<TextAction href="/admin/shipments">All shipments <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true"/></TextAction>}>
              {activeShipments.length ? <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]" aria-label="Active shipments">
                  <thead style={{ background: "var(--admin-surface)" }}><tr>
                    <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Ref</th>
                    <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Customer · Route</th>
                    <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Mode</th>
                    <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Status</th>
                    <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Owner</th>
                    <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>ETA</th>
                    <th style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>Updated</th>
                  </tr></thead>
                  <tbody>{activeShipments.map((job) => <tr key={job.reference}>
                    <td><Link href={jobHref(job, returnTo)} className="ops-mono font-medium text-[var(--admin-info)] no-underline hover:underline">{job.reference}</Link></td>
                    <td><strong className="block text-sm font-medium">{job.customer_name || "Customer not linked"}</strong><span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{route(job)}</span></td>
                    <td><span className="text-sm text-[var(--admin-muted)]">{job.mode || "—"}</span></td>
                    <td><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></td>
                    <td><span className={owner(job) === "Unassigned" ? "text-sm text-[var(--admin-danger)]" : "text-sm text-[var(--admin-muted)]"}>{owner(job)}</span></td>
                    <td><span className="text-sm">{etaLabel(job, data.operational_date)}</span></td>
                    <td><span className="text-sm text-[var(--admin-muted)]">{relativeAge(job.updated_at, data.generated_at)}</span></td>
                  </tr>)}</tbody>
                </table>
              </div> : <EmptyLine icon>No active shipments</EmptyLine>}
            </Surface>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <Surface title="Critical alerts" action={<TextAction href="/admin/alerts">View all</TextAction>}>
              {criticalAlerts.length ? <div>{criticalAlerts.map((job, index) => {
                const issue = shipmentNextAction(job);
                return <Link key={job.reference} href={withReturn(issue.href, returnTo)} className={`block px-4 py-3 no-underline hover:bg-[var(--admin-surface-muted)] ${index ? "border-t border-[var(--admin-line)]" : ""}`}>
                  <div className="flex items-center justify-between gap-2"><OpsBadge tone={issue.tone}>{issue.label}</OpsBadge><span className="text-xs text-[var(--admin-muted)]">{relativeAge(job.updated_at, data.generated_at)}</span></div>
                  <p className="mt-2 text-sm font-medium leading-5 text-[var(--admin-ink)]">{issue.title}</p>
                  <p className="mt-1 text-xs leading-4 text-[var(--admin-muted)]">{job.reference} · {owner(job)}</p>
                </Link>;
              })}</div> : <EmptyLine icon>No critical alerts</EmptyLine>}
            </Surface>

            <Surface title="New enquiries" action={<TextAction href="/admin/enquiries">View all</TextAction>}>
              {enquiries === null ? <EmptyLine>Enquiry snapshot unavailable</EmptyLine> : newEnquiries.length ? <div>{newEnquiries.map((quote, index) => <Link key={quote.reference} href={`/admin/enquiries?enquiry=${encodeURIComponent(quote.reference)}`} className={`block px-4 py-3 no-underline hover:bg-[var(--admin-surface-muted)] ${index ? "border-t border-[var(--admin-line)]" : ""}`}>
                <div className="flex items-start justify-between gap-3"><strong className="min-w-0 text-sm font-medium text-[var(--admin-ink)]">{quote.company_name || quote.contact_name || "Enquiry"}</strong><span className="shrink-0 text-xs text-[var(--admin-muted)]">{relativeAge(quote.created_at, data.generated_at)}</span></div>
                <p className="mt-1 text-xs text-[var(--admin-muted)]">{quote.origin || "Origin"} → {quote.destination || "Destination"} · {quote.mode || "Mode not set"}</p>
                <p className="mt-1 text-xs font-medium text-[var(--admin-ink)]">{quote.reference}</p>
              </Link>)}</div> : <EmptyLine>No new enquiries</EmptyLine>}
            </Surface>
          </aside>
        </div>

        <div className="mt-5">
          <StatusMix data={data}/>
        </div>

        {finance?.currency_summaries.length ? <div className="mt-5"><FinanceSnapshot finance={finance}/></div> : null}
      </div>
    </OpsPage>
  );
}
