import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { loadClaimsRegister } from "../../cargo-claims.server";
import { nepalOperationalDate } from "../../invoice-effective-status";
import { ClaimsWorkspace } from "./claims-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claims", robots: { index: false, follow: false } };

export default async function ClaimsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Claims are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile, isManagement: staff.permissions.role === "management" };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate embedded title="Not available for this account" detail="Claims are kept by staff who work on Job Files."/></OperationsShell>;
  const result = await loadClaimsRegister(staff);
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Claims didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  return <OperationsShell {...shellProps}><ClaimsWorkspace open={result.open} closed={result.closed} today={nepalOperationalDate()}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Claims" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/shipments", label: "Shipments", primary: true }]}/>;
}
