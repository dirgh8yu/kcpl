import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { loadCashFlow } from "../cash-flow.server";
import { CashFlowWorkspace } from "./cash-flow-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cash flow", robots: { index: false, follow: false } };

export default async function CashFlowPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Cash flow is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile, isManagement: staff.permissions.role === "management" };
  const result = await loadCashFlow(staff);
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Finance access is restricted" detail="Cash flow is available to Management and Accounts roles only."/></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Cash flow didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  return <OperationsShell {...shellProps}><CashFlowWorkspace overview={result.overview}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Cash flow" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/finance", label: "Receivables", primary: true }]}/>;
}
