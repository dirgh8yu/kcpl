import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { getStaffContext } from "../../../staff-directory.server";
import { V4WorkspaceGate } from "../../../v4-workspace-gate";
import { getStaffAdvance } from "../../staff-cash.server";
import { AdvanceWorkspace } from "./advance-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff cash advance", robots: { index: false, follow: false } };

export default async function StaffAdvancePage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Staff cash is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile, isManagement: staff.permissions.role === "management" };
  const { id } = await params;
  const result = await getStaffAdvance(decodeURIComponent(id), staff);
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Outside your finance access" detail="Staff cash is available to Management and Accounts, in their own branches."/></OperationsShell>;
  if (result.kind === "missing") return <OperationsShell {...shellProps}><Gate embedded title="Advance not found" detail="Open it from Staff cash instead."/></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Advance didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  return <OperationsShell {...shellProps} detailLabel={result.advance.number}><AdvanceWorkspace advance={result.advance}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Staff cash" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/finance/staff-cash", label: "Staff cash", primary: true }]}/>;
}
