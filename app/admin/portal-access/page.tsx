import { getAdminAccess } from "../admin-auth";
import { AdminLoginPage } from "../admin-login-page";
import { listCrmCustomers } from "../crm/crm-data.server";
import { getStaffContext } from "../staff-directory.server";
import { OperationsShell } from "../operations-shell";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listPortalAccounts } from "../../portal/portal-accounts.server";
import { PortalAccessWorkspace } from "./portal-access-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer Portal Access · KCPL Operations", robots: { index: false, follow: false } };

export default async function PortalAccessPage() {
  const access = await getAdminAccess();
  if (access.kind === "unconfigured") {
    return <V4WorkspaceGate
      title="Firebase admin access needs configuration"
      detail="Customer portal access management needs the Firebase runtime configured for this deployment."
    />;
  }
  if (access.kind === "signed-out") return <AdminLoginPage/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
  };

  if (!staff.permissions.canManageStaff) {
    return <OperationsShell {...shellProps}>
      <V4WorkspaceGate
        embedded
        title="Customer Portal Access is Management-only"
        detail="Granting a customer a login to their own shipment and billing data is an access-control decision, so it sits with the same authority that manages staff accounts."
      />
    </OperationsShell>;
  }

  const [accounts, customers] = await Promise.all([
    listPortalAccounts(),
    listCrmCustomers(staff),
  ]);

  return <OperationsShell {...shellProps}>
    <PortalAccessWorkspace
      initialAccounts={accounts.kind === "ready" ? accounts.accounts : []}
      customers={(customers ?? []).map((customer) => ({
        id: customer.id,
        name: customer.display_name,
        branch: customer.primary_branch,
      }))}
    />
  </OperationsShell>;
}
