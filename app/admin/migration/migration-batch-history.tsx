"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Clock3, History, LoaderCircle, RefreshCw } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsInlineAlert, OpsKpiRail, OpsNotice, OpsRailMetric, OpsSurface } from "../operations-ui";
import type { MigrationBatchDashboard, MigrationBatchStatus } from "./migration-batches";

function dateTime(value: string | null) {
  if (!value) return "Not completed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date);
}

function tone(status: MigrationBatchStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "running") return "info";
  if (status === "partial_failure") return "danger";
  if (status === "interrupted") return "warning";
  return "neutral";
}

function label(status: MigrationBatchStatus) {
  if (status === "completed") return "Completed";
  if (status === "running") return "Running";
  if (status === "partial_failure") return "Partial failure";
  if (status === "interrupted") return "Interrupted";
  return "Unknown";
}

export function MigrationBatchHistory({ initialDashboard }: { initialDashboard: MigrationBatchDashboard | null }) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/migration/batches", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; error?: string; dashboard?: MigrationBatchDashboard };
      if (!response.ok || !payload.ok || !payload.dashboard) throw new Error(payload.error || "Migration history could not be refreshed.");
      setDashboard(payload.dashboard);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Migration history could not be refreshed.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="org-stack">
    {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
    <OpsSurface
      density="compact"
      title="Stage 4A · Migration Control Centre"
      description="Every migration batch in one read-only ledger: Customer, Shipment, Receivables and Payables imports. The evidence trail comes before any rollback."
      action={<OpsButton variant="ghost" size="xs" disabled={busy} onClick={() => void refresh()}>{busy ? <LoaderCircle size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true"/> : <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true"/>}Refresh</OpsButton>}
      flush
    >
      {!dashboard ? <OpsEmptyState compact icon={<History size={16} strokeWidth={1.75} aria-hidden="true"/>} title="Migration history unavailable" description="Firebase migration batch storage could not be loaded."/> : <>
        <div className="migration-counts"><OpsKpiRail label="Migration batch summary">
          <Metric label="Batches" value={dashboard.total_batches}/>
          <Metric label="Completed" value={dashboard.completed_batches} tone="success"/>
          <Metric label="Partial failures" value={dashboard.partial_failure_batches} tone={dashboard.partial_failure_batches ? "danger" : "neutral"}/>
          <Metric label="Interrupted" value={dashboard.interrupted_batches} tone={dashboard.interrupted_batches ? "warning" : "neutral"}/>
          <Metric label="Records imported" value={dashboard.imported_records}/>
        </OpsKpiRail></div>

        {dashboard.batches.length ? <div className="ops-table-wrap"><table className="ops-table ops-register-table migration-table min-w-[1180px]"><thead><tr><th>Batch</th><th>Stage</th><th>Source</th><th>Rows</th><th>Imported</th><th>Actor</th><th>Completed</th><th>Status</th></tr></thead><tbody>{dashboard.batches.map((batch) => <tr key={batch.id}>
          <td><Link href={`/admin/migration/batches/${encodeURIComponent(batch.id)}`} className="ops-cell-primary ops-mono ops-cell-id org-link">{batch.id}</Link><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Created {dateTime(batch.created_at)}</p></td>
          <td><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{batch.stage_label}</strong><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.type_label}</p></td>
          <td><span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.source_filename || "No source filename"}</span></td>
          <td><span className="text-[length:var(--app-label-size)]">{batch.total_rows} detected</span><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.ready_rows} ready · {batch.duplicate_rows} duplicate · {batch.invalid_rows} invalid</p></td>
          <td><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{batch.imported_count}</strong>{batch.detail_metrics.length ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.detail_metrics.map((item) => `${item.label} ${item.value}`).join(" · ")}</p> : null}</td>
          <td><span className="text-[length:var(--app-label-size)]">{batch.created_by_name}</span><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.created_by_email || "No email"}</p></td>
          <td><span className="text-[length:var(--app-label-size)]">{dateTime(batch.completed_at)}</span></td>
          <td><OpsBadge tone={tone(batch.status)}>{label(batch.status)}</OpsBadge>{batch.status === "interrupted" ? <p className="mt-1 flex items-center gap-1 text-[length:var(--app-label-size)] text-[var(--admin-warning)]"><Clock3 size={9}/>Running for more than 30 minutes</p> : null}{batch.error ? <p className="mt-1 max-w-[220px] text-[length:var(--app-label-size)] leading-4 text-[var(--admin-danger)]">{batch.error}</p> : null}</td>
        </tr>)}</tbody></table></div> : <OpsEmptyState compact icon={<History size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No migration batches yet" description="The first confirmed Stage 1–3 import will appear here automatically."/>}

        {dashboard.partial_failure_batches || dashboard.interrupted_batches ? <div className="migration-attention"><OpsInlineAlert icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Recovery attention required.</strong> Stage 4A only surfaces the affected batches. Controlled rollback and recovery actions run from Migration Recovery.</OpsInlineAlert></div> : null}
      </>}
    </OpsSurface>
  </div>;
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <OpsRailMetric label={label} value={value} tone={tone}/>;
}
