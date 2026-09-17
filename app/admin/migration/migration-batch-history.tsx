"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Clock3, History, LoaderCircle, RefreshCw } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsSurface } from "../operations-ui";
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

  return <div className="ops-stack">
    {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
    <OpsSurface
      eyebrow="Stage 4A · Migration Control Centre"
      title="Every migration batch, one ledger"
      description="A read-only operational ledger of every Customer, Shipment, Receivables and Payables import. Stage 4A does not delete or roll back data yet. It establishes the evidence trail first."
      action={<OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => void refresh()}>{busy ? <LoaderCircle size={12} className="animate-spin"/> : <RefreshCw size={12}/>}Refresh</OpsButton>}
      flush
    >
      {!dashboard ? <div className="p-5"><OpsEmptyState icon={<History size={17}/>} title="Migration history unavailable" description="Firebase migration batch storage could not be loaded."/></div> : <>
        <div className="grid grid-cols-2 gap-px border-b border-[var(--admin-line)] bg-[var(--admin-line)] md:grid-cols-5">
          <Metric label="Batches" value={dashboard.total_batches}/>
          <Metric label="Completed" value={dashboard.completed_batches} tone="success"/>
          <Metric label="Partial failures" value={dashboard.partial_failure_batches} tone={dashboard.partial_failure_batches ? "danger" : "neutral"}/>
          <Metric label="Interrupted" value={dashboard.interrupted_batches} tone={dashboard.interrupted_batches ? "warning" : "neutral"}/>
          <Metric label="Records imported" value={dashboard.imported_records}/>
        </div>

        {dashboard.batches.length ? <div className="ops-table-wrap"><table className="ops-table min-w-[1180px]"><thead><tr><th>Batch</th><th>Stage</th><th>Source</th><th>Rows</th><th>Imported</th><th>Actor</th><th>Completed</th><th>Status</th></tr></thead><tbody>{dashboard.batches.map((batch) => <tr key={batch.id}>
          <td><Link href={`/admin/migration/batches/${encodeURIComponent(batch.id)}`} className="font-bold text-[var(--admin-crimson)]"><OpsMono>{batch.id}</OpsMono></Link><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Created {dateTime(batch.created_at)}</p></td>
          <td><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{batch.stage_label}</strong><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.type_label}</p></td>
          <td><span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.source_filename || "No source filename"}</span></td>
          <td><span className="text-[length:var(--app-label-size)]">{batch.total_rows} detected</span><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.ready_rows} ready · {batch.duplicate_rows} duplicate · {batch.invalid_rows} invalid</p></td>
          <td><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{batch.imported_count}</strong>{batch.detail_metrics.length ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.detail_metrics.map((item) => `${item.label} ${item.value}`).join(" · ")}</p> : null}</td>
          <td><span className="text-[length:var(--app-label-size)]">{batch.created_by_name}</span><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.created_by_email || "No email"}</p></td>
          <td><span className="text-[length:var(--app-label-size)]">{dateTime(batch.completed_at)}</span></td>
          <td><OpsBadge tone={tone(batch.status)} dot>{label(batch.status)}</OpsBadge>{batch.status === "interrupted" ? <p className="mt-1 flex items-center gap-1 text-[length:var(--app-label-size)] text-[var(--admin-warning)]"><Clock3 size={9}/>Running for more than 30 minutes</p> : null}{batch.error ? <p className="mt-1 max-w-[220px] text-[length:var(--app-label-size)] leading-4 text-[var(--admin-danger)]">{batch.error}</p> : null}</td>
        </tr>)}</tbody></table></div> : <div className="p-5"><OpsEmptyState icon={<History size={17}/>} title="No migration batches yet" description="The first confirmed Stage 1–3 import will appear here automatically."/></div>}

        {dashboard.partial_failure_batches || dashboard.interrupted_batches ? <div className="border-t border-[var(--admin-line)] bg-[var(--admin-warning-bg)] p-4"><div className="flex items-start gap-2 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-warning)]"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-[var(--admin-warning)]"/><span><strong>Recovery attention required.</strong> Stage 4A only surfaces the affected batches. Controlled rollback and recovery actions will be added in Stage 4C after the archive layer is established.</span></div></div> : null}
      </>}
    </OpsSurface>
  </div>;
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const className = tone === "success" ? "text-[var(--admin-success)]" : tone === "warning" ? "text-[var(--admin-warning)]" : tone === "danger" ? "text-[var(--admin-danger)]" : "text-[var(--admin-ink)]";
  return <div className="bg-[var(--admin-surface)] p-4"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.07em] text-[var(--admin-faint)]">{label}</p><strong className={`mt-1 block text-[20px] font-[740] ${className}`}>{value}</strong></div>;
}
