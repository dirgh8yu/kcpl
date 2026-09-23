import "../organisation-premium.css";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listMigrationBatches } from "./migration-batches.server";
import { MigrationWorkspace } from "./migration-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Migration Hub | KCPL Operations", robots: { index: false, follow: false } };

export default async function MigrationPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Migration Hub is available only to authorised Management staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (staff.permissions.role !== "management") return <OperationsShell {...shellProps}><Gate embedded title="Management access required" detail="Bulk migration can create company master data, so this workspace is restricted to the Management role."/></OperationsShell>;

  const batchDashboard = await listMigrationBatches().catch((error) => {
    console.error("Failed to preload KCPL migration batch history", error);
    return null;
  });

  return <OperationsShell {...shellProps}>
    <MigrationWorkspace initialBatchDashboard={batchDashboard} canRecover={staff.permissions.canManageFinance}/>
  </OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Organisation · Migration Hub" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/migration", label: "Migration Hub", primary: true }, { href: "/admin/migration/archive", label: "Paper Archive" }, { href: "/admin/management", label: "Management" }]}/>;
}
