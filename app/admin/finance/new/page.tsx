import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { getStaffContext } from "../../staff-directory.server";
import { NewReceivableWorkspace } from "./new-receivable-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Receivable | KCPL Finance", robots: { index: false, follow: false } };

export default async function NewReceivablePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Receivable creation is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return <Gate title="Finance access is restricted" detail="Customer invoices are available to Management and Accounts roles only."/>;

  return (
    <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
      <NewReceivableWorkspace />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <V4WorkspaceGate eyebrow="KCPL Receivables" title={title} detail={detail} actions={[{ href: "/admin/finance", label: "Receivables", primary: true }, { href: "/admin/command-centre", label: "Operations Home" }]}/>;
}
