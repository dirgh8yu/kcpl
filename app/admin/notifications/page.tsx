import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { NotificationsWorkspace } from "./notifications-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notification Centre | KCPL Operations", robots: { index: false, follow: false } };

export default async function NotificationsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="The notification centre is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  return <OperationsShell {...shellProps}><NotificationsWorkspace /></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Organisation · Notifications" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/notifications", label: "Notifications", primary: true }, { href: "/admin/alerts", label: "Tasks & Alerts" }, { href: "/admin/command-centre", label: "Operations Home" }]}/>;
}
