import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { OperationsShell } from "../operations-shell";
import { CrmDashboard } from "./crm-dashboard";
import { CrmCustomerJump } from "./crm-customer-jump";
import { crmDashboardStats, listCrmCustomers } from "./crm-data.server";
import type { CrmCustomerSummary } from "./crm-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Customers | KCPL Operations",
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
  if (access.kind === "unconfigured") return <CrmGate title="CRM access needs configuration." detail="Firebase and KCPL staff access must be configured before the CRM can load." />;
  if (access.kind === "signed-out") return <CrmGate title="Sign in to KCPL Operations." detail="The CRM is private and available only to authorised KCPL staff." signIn />;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} isManagement={permissions.role === "management"}><CrmGate title="The CRM could not be loaded." detail="KCPL customer data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded /></OperationsShell>;
  }

  const staff = staffResult.staff;
  const result = await loadCustomers(staff);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };

  if (result.kind === "error") return <OperationsShell {...shellProps}><CrmGate title="The CRM could not be loaded." detail="KCPL customer data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded /></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><CrmGate title="Firestore is not available yet." detail="The CRM is ready, but Firebase customer storage is not available for this deployment. Navigation and search remain available." embedded /></OperationsShell>;

  const safeCustomers: CrmCustomerSummary[] = staff.permissions.canViewCommercial
    ? result.customers
    : result.customers.map((customer) => ({ ...customer, revenue_total: 0, cost_total: 0, profit_total: 0 }));

  return (
    <OperationsShell {...shellProps}>
      <CrmCustomerJump customers={safeCustomers} />
      <CrmDashboard initialCustomers={safeCustomers} initialStats={crmDashboardStats(safeCustomers)} userName={access.user.displayName} userEmail={access.user.email} commercialVisible={staff.permissions.canViewCommercial} />
    </OperationsShell>
  );
}

function CrmGate({ title, detail, signIn = false, embedded = false }: { title: string; detail: string; signIn?: boolean; embedded?: boolean }) {
  return (
    <main className={`grid place-items-center bg-[#f5f6f7] p-6 text-[#10263f] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}>
      <section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8 sm:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Customers</p>
        <h1 className="mt-3 text-2xl font-bold tracking-[-.03em]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/admin" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">{signIn ? "Go to staff sign in" : "Back to Operations"}</Link><Link href="/" className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Public website</Link></div>
      </section>
    </main>
  );
}
