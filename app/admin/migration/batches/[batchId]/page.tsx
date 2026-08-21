import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Archive, CheckCircle2, Clock3, Database, FileSpreadsheet } from "lucide-react";
import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { OpsBadge, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../../operations-ui";
import { getStaffContext } from "../../../staff-directory.server";
import { getMigrationBatch } from "../../migration-batches.server";
import type { MigrationBatchStatus } from "../../migration-batches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Migration Batch | KCPL Operations", robots: { index: false, follow: false } };

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

function statusLabel(status: MigrationBatchStatus) {
  if (status === "completed") return "Completed";
  if (status === "running") return "Running";
  if (status === "partial_failure") return "Partial failure";
  if (status === "interrupted") return "Interrupted";
  return "Unknown";
}

export default async function MigrationBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Migration batch records are available only to authorised KCPL Management staff."/>;
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return <Gate title="Management access required" detail="Migration batch history is restricted to the Management role."/>;

  const { batchId } = await params;
  const batch = await getMigrationBatch(batchId);
  if (!batch) notFound();

  return <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement>
    <OpsPage>
      <OpsPageHeader
        eyebrow={`Migration Control Centre · ${batch.stage_label}`}
        title={<OpsMono>{batch.id}</OpsMono>}
        description={`${batch.type_label} migration batch${batch.source_filename ? ` from ${batch.source_filename}` : ""}. This Stage 4A view is read-only and preserves the evidence needed for later recovery tooling.`}
        meta={<><OpsBadge tone={tone(batch.status)} dot>{statusLabel(batch.status)}</OpsBadge><span>{batch.imported_count} records imported</span><span>{batch.created_by_name}</span></>}
        actions={<Link href="/admin/migration" className="ops-button" data-variant="secondary" data-size="md">Back to Migration Hub</Link>}
      />

      <div className="ops-content-wide ops-stack">
        {batch.status === "partial_failure" || batch.status === "interrupted" ? <OpsNotice tone="warning"><strong>Recovery candidate.</strong> This batch needs review before any retry or rollback. Stage 4A intentionally does not delete records. Stage 4C will add controlled recovery after the paper archive layer is in place.</OpsNotice> : null}
        {batch.error ? <OpsNotice tone="danger"><strong>Recorded batch error:</strong> {batch.error}</OpsNotice> : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card icon={<FileSpreadsheet size={14}/>} label="Source" value={batch.source_filename || "No filename"} detail={`${batch.total_rows} rows detected`}/>
          <Card icon={<CheckCircle2 size={14}/>} label="Imported" value={String(batch.imported_count)} detail={`${batch.ready_rows} ready at preview`}/>
          <Card icon={<Clock3 size={14}/>} label="Created" value={dateTime(batch.created_at)} detail={batch.created_by_email || "No actor email"}/>
          <Card icon={<Archive size={14}/>} label="Completed" value={dateTime(batch.completed_at)} detail={`${batch.duplicate_rows} duplicates · ${batch.invalid_rows} invalid`}/>
        </div>

        {batch.detail_metrics.length ? <OpsSurface eyebrow="Batch composition" title="What this batch created"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{batch.detail_metrics.map((item) => <div key={item.label} className="rounded-[12px] border border-[#e9e1db] bg-[#faf8f5] p-4"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#998f87]">{item.label}</p><strong className="mt-1 block text-[18px] text-[#514840]">{item.value}</strong></div>)}</div></OpsSurface> : null}

        <OpsSurface eyebrow="Created records" title="Objects written by this migration batch" description="These links are the authoritative Stage 4A inventory. Later rollback checks will operate from this batch-to-record relationship, not from guesses or name matching." flush>
          {batch.created_records.length ? <div className="ops-table-wrap"><table className="ops-table min-w-[760px]"><thead><tr><th>Type</th><th>Record</th><th>Current system location</th></tr></thead><tbody>{batch.created_records.map((record) => <tr key={`${record.kind}-${record.id}`}><td><OpsBadge tone="neutral">{record.kind}</OpsBadge></td><td><OpsMono>{record.id}</OpsMono></td><td><Link href={record.href} className="font-bold text-[#b5654f]">Open record</Link></td></tr>)}</tbody></table></div> : <div className="p-5"><OpsEmptyState icon={<Database size={17}/>} title="No created-record inventory" description="This batch does not expose a created-record list. Older or interrupted migration batches may have stopped before writing record references."/></div>}
        </OpsSurface>

        <OpsSurface eyebrow="Stage 4 safety model" title="Evidence first, destructive controls later" description="Rollback is deliberately not enabled in Stage 4A.">
          <div className="grid gap-3 md:grid-cols-3">
            <Safety title="Batch identity" detail="Every imported object is traced back to its migration batch ID and source file."/>
            <Safety title="Failure visibility" detail="Partial failures and stale running batches are surfaced without silently changing their stored status."/>
            <Safety title="Recovery boundary" detail="Stage 4C will only consider records proven to belong to this batch and will validate post-import activity before reversal."/>
          </div>
        </OpsSurface>
      </div>
    </OpsPage>
  </OperationsShell>;
}

function Card({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-[14px] border border-[#e8e0d9] bg-[#fffdfa] p-4"><div className="flex items-center gap-2 text-[#b5654f]">{icon}<span className="text-[8px] font-bold uppercase tracking-[.08em]">{label}</span></div><strong className="mt-2 block text-[12px] text-[#514840]">{value}</strong><p className="mt-1 text-[8px] leading-4 text-[#91877f]">{detail}</p></div>;
}

function Safety({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-[12px] border border-[#e8e0d9] bg-[#faf8f5] p-4"><strong className="flex items-center gap-2 text-[10px] text-[#514840]"><AlertTriangle size={12} className="text-[#b5654f]"/>{title}</strong><p className="mt-2 text-[8px] leading-4 text-[#857b73]">{detail}</p></div>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e7dfd8] bg-[#fffdfa] p-8"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Migration Control Centre</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><Link href="/admin/command-centre" className="ops-button mt-6" data-variant="primary" data-size="md">Operations Home</Link></section></main>;
}
