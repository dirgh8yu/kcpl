import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext } from "../staff-directory.server";
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

  if (loadFailed) return <CrmGate title="The CRM could not be loaded." detail="KCPL customer data is temporarily unavailable. No customer information was exposed." />;
  if (customers === null) return <CrmGate title="Firestore is not available yet." detail="The CRM is ready, but Firebase customer storage is not available for this deployment." />;

  return (
    <OperationsShell
      userName={access.user.displayName}
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
    <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]">
      <section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8 sm:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Customers</p>
        <h1 className="mt-3 text-2xl font-bold tracking-[-.03em]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/admin" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">{signIn ? "Go to staff sign in" : "Back to Operations"}</Link><Link href="/" className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Public website</Link></div>
      </section>
    </main>
  );
}
