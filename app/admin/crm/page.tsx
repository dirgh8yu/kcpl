import "../plan-sell-premium.css";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { CrmDashboard } from "./crm-dashboard";
import { listCrmCustomers } from "./crm-data.server";
import type { CrmCustomerSummary } from "./crm-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try {
    return { kind: "ready", staff: await getStaffContext(user) };
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for CRM", error);
    return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) };
  }
}

async function loadCustomers(staff: Awaited<ReturnType<typeof getStaffContext>>) {
  try {
    const customers = await listCrmCustomers(staff);
    return customers === null ? { kind: "unavailable" as const } : { kind: "ready" as const, customers };
  } catch (error) {
    console.error("Failed to load KCPL CRM workspace", error);
    return { kind: "error" as const };
  }
}

export default async function CrmPage() {
  const access = await getAdminAccess();
  if (access.kind === "unconfigured") return <CrmGate title="CRM access needs configuration" detail="Firebase and KCPL staff access must be configured before the CRM can load."/>;
  if (access.kind === "signed-out") return <CrmGate title="Sign in to KCPL Operations" detail="The CRM is private and available only to authorised KCPL staff." signIn/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><CrmGate title="Customers didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
  }

  const staff = staffResult.staff;
  const result = await loadCustomers(staff);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };

  if (result.kind === "error") return <OperationsShell {...shellProps}><CrmGate title="Customers didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><CrmGate title="Can’t load right now" detail="The records service isn’t responding. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;

  const safeCustomers: CrmCustomerSummary[] = staff.permissions.canViewCommercial
    ? result.customers
    : result.customers.map((customer) => ({ ...customer, revenue_total: 0, cost_total: 0, profit_total: 0 }));

  return (
    <OperationsShell {...shellProps}>
      <CrmDashboard initialCustomers={safeCustomers} userName={access.user.displayName} userEmail={access.user.email} commercialVisible={staff.permissions.canViewCommercial}/>
    </OperationsShell>
  );
}

function CrmGate({ title, detail, signIn = false, embedded = false }: { title: string; detail: string; signIn?: boolean; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Customers"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: signIn ? "/admin" : "/admin/enquiries", label: signIn ? "Go to staff sign in" : "Enquiries", primary: true },
      { href: "/", label: "Public website" },
    ]}
  />;
}
