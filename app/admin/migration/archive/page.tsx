import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { listPaperArchive } from "./archive.server";
import { PaperArchiveWorkspace } from "./archive-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paper Archive | KCPL Operations", robots: { index: false, follow: false } };

export default async function PaperArchivePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL paper archive is available only to authorised Management staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (staff.permissions.role !== "management") return <OperationsShell {...shellProps}><Gate embedded title="Management access required" detail="Historical paper files can contain operational and financial records, so the archive is restricted to Management."/></OperationsShell>;

  const dashboard = await listPaperArchive().catch((error) => {
    console.error("Failed to preload KCPL paper archive", error);
    return null;
  });

  return <OperationsShell {...shellProps}><PaperArchiveWorkspace initialDashboard={dashboard}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Organisation · Paper Archive" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/migration/archive", label: "Paper Archive", primary: true }, { href: "/admin/migration", label: "Migration Hub" }, { href: "/admin/migration/recovery", label: "Recovery" }]}/>;
}
