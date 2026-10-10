import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { loadDepositRegister } from "../../container-deposits.server";
import { DepositsWorkspace } from "./deposits-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Container deposits", robots: { index: false, follow: false } };

export default async function DepositsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Container deposits are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile, isManagement: staff.permissions.role === "management" };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate embedded title="Not available for this account" detail="Container deposits are kept by staff who work on Job Files."/></OperationsShell>;
  const result = await loadDepositRegister(staff);
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Deposits didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  return <OperationsShell {...shellProps}><DepositsWorkspace open={result.open} closed={result.closed}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Container deposits" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/shipments", label: "Shipments", primary: true }]}/>;
}
