import Link from "next/link";
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { OpsBadge, OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsSurface } from "../../operations-ui";
import { getStaffContext } from "../../staff-directory.server";
import { listMigrationBatches } from "../migration-batches.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Migration Recovery | KCPL Operations", robots: { index: false, follow: false } };

export default async function RecoveryPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Migration recovery is available only to authorised KCPL Management."/>;
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management" || !staff.permissions.canManageFinance) return <Gate title="Management + finance authority required" detail="Stage 4C can reverse finance migration records, so recovery requires both Management and finance authority."/>;
  const dashboard = await listMigrationBatches();

  return <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement>
    <OpsPage>
      <OpsPageHeader
        eyebrow="Organisation · Migration Hub · Stage 4C"
        title="Controlled rollback & recovery"
        description="Recovery is batch-scoped, dry-run-first and deliberately conservative. KCPL will refuse automatic rollback when imported records have been edited, used, paid, progressed or otherwise gained post-migration business history."
        meta={<><span>Management + finance authority</span><span>No force-delete mode</span><span>Paper Archive preserved</span></>}
        actions={<div className="flex flex-wrap gap-2"><Link href="/admin/migration/archive" className="ops-button" data-variant="secondary" data-size="md">Paper Archive</Link><Link href="/admin/migration" className="ops-button" data-variant="secondary" data-size="md">Migration Hub</Link></div>}
      />

      <div className="ops-content-wide ops-stack">
        <div className="grid gap-3 md:grid-cols-3">
          <Rule icon={<ShieldCheck size={15}/>} title="1 · Dry run" detail="Every created record is revalidated against its batch ID, dependencies and post-import activity."/>
          <Rule icon={<AlertTriangle size={15}/>} title="2 · Exact confirmation" detail="Plans expire after 15 minutes, bind to one Management user and require the exact batch rollback phrase."/>
          <Rule icon={<RotateCcw size={15}/>} title="3 · Recheck before delete" detail="Each eligible record is inspected again immediately before reversal. Any state drift stops recovery."/>
        </div>

        <OpsSurface eyebrow="Recovery queue" title="Migration batches" description="Open a batch to generate its live Stage 4C dry run. Completed recoveries remain visible as permanent migration evidence." flush>
          {dashboard?.batches.length ? <div className="ops-table-wrap"><table className="ops-table min-w-[900px]"><thead><tr><th>Batch</th><th>Stage</th><th>Migration state</th><th>Imported</th><th>Recovery</th><th>Action</th></tr></thead><tbody>{dashboard.batches.map((batch) => {
            const recoverable = batch.status === "completed" || batch.status === "partial_failure" || batch.status === "interrupted";
            const recoveryTone = batch.rollback_status === "completed" ? "success" : batch.rollback_status === "partial_failure" ? "warning" : batch.rollback_status === "running" ? "info" : "neutral";
            return <tr key={batch.id}><td><OpsMono>{batch.id}</OpsMono><p className="mt-1 text-[8px] text-[#91877f]">{batch.source_filename || "No source filename"}</p></td><td><strong className="text-[10px] text-[#514840]">{batch.stage_label}</strong><p className="mt-1 text-[8px] text-[#91877f]">{batch.type_label}</p></td><td><OpsBadge tone={batch.status === "completed" ? "success" : batch.status === "partial_failure" ? "danger" : batch.status === "interrupted" ? "warning" : "info"}>{batch.status.replaceAll("_", " ")}</OpsBadge></td><td>{batch.imported_count}</td><td>{batch.rollback_status ? <OpsBadge tone={recoveryTone}>{batch.rollback_status.replaceAll("_", " ")}</OpsBadge> : <span className="text-[9px] text-[#91877f]">Not started</span>}</td><td>{recoverable ? <Link href={`/admin/migration/batches/${encodeURIComponent(batch.id)}`} className="ops-button" data-variant={batch.rollback_status === "completed" ? "secondary" : "primary"} data-size="sm">{batch.rollback_status === "completed" ? <><CheckCircle2 size={11}/>View evidence</> : <>Open dry run</>}</Link> : <span className="text-[8px] text-[#9a8f87]">Not recoverable while running</span>}</td></tr>;
          })}</tbody></table></div> : <div className="p-6"><OpsEmptyState icon={<RotateCcw size={17}/>} title="No migration batches" description="There are no migration batches available for Stage 4C recovery."/></div>}
        </OpsSurface>
      </div>
    </OpsPage>
  </OperationsShell>;
}

function Rule({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="rounded-[13px] border border-[#e8e0d9] bg-[#fffdfa] p-4"><strong className="flex items-center gap-2 text-[10px] text-[#514840]">{icon}{title}</strong><p className="mt-2 text-[9px] leading-4 text-[#857b73]">{detail}</p></div>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e7dfd8] bg-[#fffdfa] p-8"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Migration Recovery</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><Link href="/admin/command-centre" className="ops-button mt-6" data-variant="primary" data-size="md">Operations Home</Link></section></main>;
}
