import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { listCustomerCredits } from "../customer-credits.server";
import { CreditsWorkspace } from "./credits-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Credits & refunds", robots: { index: false, follow: false } };

export default async function CreditsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Credits and refunds are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile, isManagement: staff.permissions.role === "management" };
  const result = await listCustomerCredits(staff);
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Finance access is restricted" detail="Credits and refunds are available to Management and Accounts roles only."/></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Credits didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  return <OperationsShell {...shellProps}><CreditsWorkspace credits={result.overview.credits} refunds={result.overview.refunds} isManagement={staff.permissions.role === "management"}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Credits & refunds" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/finance", label: "Receivables", primary: true }]}/>;
}
