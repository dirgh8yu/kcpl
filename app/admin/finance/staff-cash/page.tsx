import { getAdminAccess } from "../../admin-auth";
import { kcplBranches } from "../../crm/crm-data";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext, listStaffProfiles } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { listStaffAdvances } from "../staff-cash.server";
import { StaffCashWorkspace } from "./staff-cash-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff cash", robots: { index: false, follow: false } };

export default async function StaffCashPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Staff cash is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile, isManagement: staff.permissions.role === "management" };
  const [result, profiles] = await Promise.all([listStaffAdvances(staff), listStaffProfiles().catch(() => null)]);
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Finance access is restricted" detail="Staff cash is available to Management and Accounts roles only."/></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Staff cash didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  const branches = staff.can_access_all_branches ? [...kcplBranches] : staff.branches;
  const people = (profiles ?? []).filter((profile) => profile.active).map((profile) => ({
    email: profile.email,
    name: profile.display_name,
    branch: profile.branch_scope === "selected" ? profile.branches.find((branch) => branches.includes(branch)) ?? null : null,
  }));
  return <OperationsShell {...shellProps}><StaffCashWorkspace open={result.open} settled={result.settled} people={people} branches={branches}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Staff cash" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/finance", label: "Receivables", primary: true }]}/>;
}
