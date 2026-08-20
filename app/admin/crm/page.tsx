import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { CrmDashboard } from "./crm-dashboard";
import { crmDashboardStats, listCrmCustomers } from "./crm-data.server";
import type { CrmCustomerSummary } from "./crm-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "KCPL CRM | Operations",
  robots: { index: false, follow: false },
};

export default async function CrmPage() {
  const access = await getAdminAccess();

  if (access.kind === "unconfigured") {
    return <CrmGate title="CRM access needs configuration." detail="Firebase and KCPL staff access must be configured before the CRM can load." />;
  }

  if (access.kind === "signed-out") {
    return <CrmGate title="Sign in to KCPL Operations." detail="The CRM is private and available only to authorised KCPL staff." signIn />;
  }

  let customers: CrmCustomerSummary[] | null = null;
  let loadFailed = false;
  try {
    customers = await listCrmCustomers();
  } catch (error) {
    loadFailed = true;
    console.error("Failed to load KCPL CRM workspace", error);
  }

  if (loadFailed) {
    return <CrmGate title="The CRM could not be loaded." detail="KCPL customer data is temporarily unavailable. No customer information was exposed." />;
  }

  if (customers === null) {
    return <CrmGate title="Firestore is not available yet." detail="The CRM is ready, but Firebase customer storage is not available for this deployment." />;
  }

  return (
    <CrmDashboard
      initialCustomers={customers}
      initialStats={crmDashboardStats(customers)}
      userName={access.user.displayName}
      userEmail={access.user.email}
    />
  );
}

function CrmGate({ title, detail, signIn = false }: { title: string; detail: string; signIn?: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]">
      <section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#b78a3e]">KCPL CRM</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-.04em]">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-black/60">{detail}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin" className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white">
            {signIn ? "Go to staff sign in" : "Back to Operations"}
          </Link>
          <Link href="/" className="rounded-xl border border-black/10 px-5 py-3 text-sm font-black">Public website</Link>
        </div>
      </section>
    </main>
  );
}
