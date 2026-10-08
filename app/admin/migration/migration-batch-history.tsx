"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Clock3, History, LoaderCircle, RefreshCw } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsInlineAlert, OpsNotice, OpsSurface } from "../operations-ui";
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
      title="Import batches"
      action={<OpsButton variant="ghost" size="xs" disabled={busy} onClick={() => void refresh()}>{busy ? <LoaderCircle size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true"/> : <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true"/>}Refresh</OpsButton>}
      flush
    >
      {!dashboard ? <OpsEmptyState compact icon={<History size={16} strokeWidth={1.75} aria-hidden="true"/>} title="Import history didn’t load" description="Import batches didn’t load. Try again in a minute."/> : <>
        {dashboard.batches.length ? <div className="ops-table-wrap"><table className="ops-table ops-register-table ops-stack-table migration-table min-w-[1180px]"><thead><tr><th>Batch</th><th>Records</th><th>Source</th><th>Rows</th><th>Imported</th><th>Actor</th><th>Completed</th><th>Status</th></tr></thead><tbody>{dashboard.batches.map((batch) => <tr key={batch.id}>
          <td><Link href={`/admin/migration/batches/${encodeURIComponent(batch.id)}`} className="ops-cell-primary ops-mono ops-cell-id org-link">{batch.id}</Link><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Created {dateTime(batch.created_at)}</p></td>
          <td><span className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{batch.type_label}</span></td>
          <td><span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.source_filename || "No source filename"}</span></td>
          <td><span className="text-[length:var(--app-label-size)]">{batch.total_rows} detected</span><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{batch.ready_rows} ready · {batch.duplicate_rows} duplicate · {batch.invalid_rows} invalid</p></td>
          <td><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{batch.imported_count}</strong></td>
          <td><span className="text-[length:var(--app-label-size)]">{batch.created_by_name}</span></td>
          <td><span className="text-[length:var(--app-label-size)]">{dateTime(batch.completed_at)}</span></td>
          <td><OpsBadge tone={tone(batch.status)}>{label(batch.status)}</OpsBadge>{batch.status === "interrupted" ? <p className="mt-1 flex items-center gap-1 text-[length:var(--app-label-size)] text-[var(--admin-warning)]"><Clock3 size={9}/>Running for more than 30 minutes</p> : null}{batch.error ? <p className="mt-1 max-w-[220px] text-[length:var(--app-label-size)] leading-4 text-[var(--admin-danger)]">{batch.error}</p> : null}</td>
        </tr>)}</tbody></table></div> : <OpsEmptyState compact icon={<History size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No migration batches yet" description="Each confirmed import appears here."/>}

        {dashboard.partial_failure_batches || dashboard.interrupted_batches ? <div className="migration-attention"><OpsInlineAlert icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Some imports didn’t finish.</strong> Undo them from <Link href="/admin/migration/recovery" className="org-link">Undo an import</Link>.</OpsInlineAlert></div> : null}
      </>}
    </OpsSurface>
  </div>;
}
