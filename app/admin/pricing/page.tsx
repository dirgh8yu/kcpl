import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { TmsPricingWorkspace } from "./tms-pricing-workspace";
import { listPricingWorkspace } from "./tms-pricing.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing Desk | KCPL Operations", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try {
    return { kind: "ready", staff: await getStaffContext(user) };
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Pricing Desk", error);
    return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) };
  }
}

async function loadWorkspace(staff: Awaited<ReturnType<typeof getStaffContext>>) {
  try {
    return await listPricingWorkspace(staff);
  } catch (error) {
    console.error("Failed to load KCPL Pricing Desk", error);
    return { kind: "error" as const };
  }
}

export default async function PricingPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Pricing Desk is available only to authorised staff."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><Gate title="Pricing Desk could not be loaded" detail="KCPL pricing data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  const staff = staffResult.staff;
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Sell pricing contains customer-specific rates, procurement costs and margin controls." embedded/></OperationsShell>;

  const workspace = await loadWorkspace(staff);
  if (workspace.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Pricing Desk unavailable" detail="KCPL transport-order, CRM or pricing-rule storage is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

  return (
    <OperationsShell {...shellProps}>
      <TmsPricingWorkspace initialOrders={workspace.orders} initialCustomers={workspace.customers} initialRules={workspace.rules} canManageRules={staff.permissions.canManageRateCards} canApprove={staff.permissions.role === "management"}/>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Pricing Desk"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/rating", label: "Rate Desk", primary: true },
      { href: "/admin", label: "Enquiries" },
    ]}
  />;
}
