import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext, listStaffProfiles } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { StaffManager } from "./staff-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff | KCPL Operations", robots: { index: false, follow: false } };

export default async function StaffPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Staff management is available only inside KCPL Operations."/>;

  const context = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: context.permissions.canManageStaff,
    canManageFinance: context.permissions.canManageFinance,
    canViewCommercial: context.permissions.canViewCommercial,
    canManageJobFile: context.permissions.canManageJobFile,
    isManagement: context.permissions.role === "management",
  };
  if (!context.permissions.canManageStaff) return <OperationsShell {...shellProps}><Gate embedded title="Management access required" detail="Only KCPL Management can change staff roles and branch access."/></OperationsShell>;

  const profiles = await listStaffProfiles();
  if (profiles === null) return <OperationsShell {...shellProps}><Gate embedded title="Staff directory unavailable" detail="Firestore could not load the KCPL staff directory."/></OperationsShell>;

  return <OperationsShell {...shellProps}><StaffManager initialProfiles={profiles}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Organisation · People & Branches" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/staff", label: "People & Branches", primary: true }, { href: "/admin/management", label: "Management" }, { href: "/admin/notifications", label: "Notifications" }]}/>;
}
