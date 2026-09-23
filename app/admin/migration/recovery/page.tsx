import "../../organisation-premium.css";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { OpsBadge, OpsEmptyState, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../operations-ui";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { listMigrationBatches } from "../migration-batches.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Migration Recovery | KCPL Operations", robots: { index: false, follow: false } };

export default async function RecoveryPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Migration recovery is available only to authorised KCPL Management."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (staff.permissions.role !== "management" || !staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate embedded title="Management + finance authority required" detail="Recovery can reverse finance migration records, so it requires both Management and finance authority."/></OperationsShell>;
  const dashboard = await listMigrationBatches();

  return <OperationsShell {...shellProps}>
    <OpsPage>
      <OpsPageHeader
        title="Controlled rollback & recovery"
        description="Batch-scoped and dry-run first. KCPL refuses rollback once imported records gain post-migration history."
        meta={<span>Management + finance authority · no force-delete mode · Paper Archive preserved</span>}
        actions={<>
          <Link href="/admin/migration/archive" className="ops-button" data-variant="secondary" data-size="md">Paper Archive</Link>
          <Link href="/admin/migration" className="ops-button" data-variant="secondary" data-size="md">Migration Hub</Link>
        </>}
      />

      <div className="px-4 pb-8 pt-4 md:px-6 org-stack">
        <OpsSurface density="compact" title="Recovery safeguards" description="Every rollback passes three checks, in order." flush>
          <ol className="migration-stages recovery-rules">
            <Rule icon={<ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true"/>} step="1" title="Dry run" detail="Every created record is revalidated against its batch ID, dependencies and post-import activity."/>
            <Rule icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>} step="2" title="Exact confirmation" detail="Plans expire after 15 minutes, bind to one Management user and require the exact batch rollback phrase."/>
            <Rule icon={<RotateCcw size={14} strokeWidth={1.75} aria-hidden="true"/>} step="3" title="Recheck before delete" detail="Each eligible record is inspected again immediately before reversal. Any state drift stops recovery."/>
          </ol>
        </OpsSurface>

        <OpsSurface density="compact" title="Recovery queue" description="Open a batch to generate its live recovery dry run. Completed recoveries remain visible as permanent migration evidence." flush>
          {dashboard?.batches.length ? <OpsTableWrap><table className="ops-table ops-register-table recovery-table" aria-label="Migration batches for recovery"><thead><tr><th>Batch</th><th>Stage</th><th>Migration state</th><th className="ops-col-num">Imported</th><th>Recovery</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{dashboard.batches.map((batch) => {
            const recoverable = batch.status === "completed" || batch.status === "partial_failure" || batch.status === "interrupted";
            const recoveryTone = batch.rollback_status === "completed" ? "success" : batch.rollback_status === "partial_failure" ? "warning" : batch.rollback_status === "running" ? "info" : "neutral";
            return <tr key={batch.id}>
              <td><span className="ops-cell-primary ops-mono ops-cell-id">{batch.id}</span><span className="ops-cell-secondary ops-cell-clamp" title={batch.source_filename || undefined}>{batch.source_filename || "No source filename"}</span></td>
              <td><span className="ops-cell-primary">{batch.stage_label}</span><span className="ops-cell-secondary">{batch.type_label}</span></td>
              <td><OpsBadge tone={batch.status === "completed" ? "success" : batch.status === "partial_failure" ? "danger" : batch.status === "interrupted" ? "warning" : "info"}>{sentence(batch.status)}</OpsBadge></td>
              <td className="ops-col-num"><span className="ops-num">{batch.imported_count}</span></td>
              <td>{batch.rollback_status ? <OpsBadge tone={recoveryTone}>{sentence(batch.rollback_status)}</OpsBadge> : <span className="ops-cell-muted">Not started</span>}</td>
              <td className="ops-cell-actions">{recoverable ? <Link href={`/admin/migration/batches/${encodeURIComponent(batch.id)}`} className="ops-button" data-variant={batch.rollback_status === "completed" ? "ghost" : "secondary"} data-size="xs">{batch.rollback_status === "completed" ? <><CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>View evidence</> : <>Open dry run</>}</Link> : <span className="ops-cell-muted">Not recoverable while running</span>}</td>
            </tr>;
          })}</tbody></table></OpsTableWrap> : <OpsEmptyState compact icon={<RotateCcw size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No migration batches" description="There are no migration batches available for recovery."/>}
        </OpsSurface>
      </div>
    </OpsPage>
  </OperationsShell>;
}

function sentence(value: string) {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Rule({ icon, step, title, detail }: { icon: React.ReactNode; step: string; title: string; detail: string }) {
  return <li className="migration-stage"><span className="migration-stage-head recovery-rule-head">{icon}<span className="ops-mono">Step {step}</span></span><strong>{title}</strong><span className="migration-stage-detail">{detail}</span></li>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Organisation · Migration Recovery" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/migration/recovery", label: "Recovery", primary: true }, { href: "/admin/migration", label: "Migration Hub" }, { href: "/admin/migration/archive", label: "Paper Archive" }]}/>;
}
