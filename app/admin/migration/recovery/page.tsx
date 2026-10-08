import "../../organisation-premium.css";
import Link from "next/link";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { OpsBadge, OpsEmptyState, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../operations-ui";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { listMigrationBatches } from "../migration-batches.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Undo an import", robots: { index: false, follow: false } };

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
        title="Undo an import"
        description="Preview first, then undo one batch. A batch can’t be undone once its records have been worked on."
      />

      <div className="px-4 pb-8 pt-4 md:px-6 org-stack">
        <OpsSurface density="compact" title="Import batches" flush>
          {dashboard?.batches.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table recovery-table" aria-label="Migration batches for recovery"><thead><tr><th>Batch</th><th>Records</th><th>Import</th><th className="ops-col-num">Imported</th><th>Recovery</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{dashboard.batches.map((batch) => {
            const recoverable = batch.status === "completed" || batch.status === "partial_failure" || batch.status === "interrupted";
            const recoveryTone = batch.rollback_status === "completed" ? "success" : batch.rollback_status === "partial_failure" ? "warning" : batch.rollback_status === "running" ? "info" : "neutral";
            return <tr key={batch.id}>
              <td><span className="ops-cell-primary ops-mono ops-cell-id">{batch.id}</span><span className="ops-cell-secondary ops-cell-clamp" title={batch.source_filename || undefined}>{batch.source_filename || "No source filename"}</span></td>
              <td><span className="ops-cell-primary">{batch.type_label}</span></td>
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

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Undo an import" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/migration/recovery", label: "Undo an import", primary: true }]}/>;
}
