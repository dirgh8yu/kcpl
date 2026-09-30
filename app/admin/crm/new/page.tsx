import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { getStaffContext } from "../../staff-directory.server";
import type { CrmCustomerSummary } from "../crm-data";
import { CrmDashboard } from "../crm-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "New customer", robots: { index: false, follow: false } };

export default async function NewCustomerPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Customer creation is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canEditCustomer) return <Gate title="Customer editing is restricted" detail="Your current KCPL role has read-only customer access."/>;

  const customers: CrmCustomerSummary[] = [];
  return (
    <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"} detailLabel="New customer">
      <CrmDashboard initialCustomers={customers} userName={access.user.displayName} userEmail={access.user.email} commercialVisible={staff.permissions.canViewCommercial}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <V4WorkspaceGate eyebrow="KCPL Customers" title={title} detail={detail} actions={[{ href: "/admin/crm", label: "Customers", primary: true }, { href: "/admin/command-centre", label: "Operations Home" }]}/>;
}
