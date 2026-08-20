import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { CrmDashboard } from "./crm-dashboard";
import { CrmCustomerJump } from "./crm-customer-jump";
import { crmDashboardStats, listCrmCustomers } from "./crm-data.server";
import type { CrmCustomerSummary } from "./crm-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers | KCPL Operations", robots: { index: false, follow: false } };

export default async function CrmPage() {
  const access = await getAdminAccess();
  if (access.kind === "unconfigured") return <CrmGate title="CRM access needs configuration." detail="Firebase and KCPL staff access must be configured before the CRM can load." />;
  if (access.kind === "signed-out") return <CrmGate title="Sign in to KCPL Operations." detail="The CRM is private and available only to authorised KCPL staff." signIn />;

  const staff = await getStaffContext(access.user);
  let customers: CrmCustomerSummary[] | null = null;
  let loadFailed = false;
  try {
    customers = await listCrmCustomers();
  } catch (error) {
    loadFailed = true;
    console.error("Failed to load KCPL CRM workspace", error);
  }

  if (loadFailed) return <CrmGate title="The CRM could not be loaded." detail="KCPL customer data is temporarily unavailable. Existing customer records remain protected." />;
  if (customers === null) return <CrmGate title="Firestore is not available yet." detail="The CRM is ready, but Firebase customer storage is not available for this deployment." />;

  return (
    <OperationsShell
      userName={access.user.displayName}
      roleLabel={kcplStaffRoleLabels[staff.permissions.role]}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <CrmCustomerJump customers={customers} />
      <CrmDashboard initialCustomers={customers} initialStats={crmDashboardStats(customers)} userName={access.user.displayName} userEmail={access.user.email} />
    </OperationsShell>
  );
}

function CrmGate({ title, detail, signIn = false }: { title: string; detail: string; signIn?: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]">
      <section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Customers</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/admin" className="inline-flex h-9 items-center rounded-lg bg-[#283a77] px-4 text-xs font-semibold text-white">{signIn ? "Go to staff sign in" : "Back to Operations"}</Link><Link href="/" className="inline-flex h-9 items-center rounded-lg border border-[#dfe2e6] px-4 text-xs font-semibold text-[#505861]">Public website</Link></div>
      </section>
    </main>
  );
}
