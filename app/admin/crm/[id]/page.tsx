import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { getCrmCustomer } from "../crm-data.server";
import type { CrmCustomerDetail } from "../crm-data";
import { Customer360Workspace } from "./customer-360-workspace";
import "./customer-360.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Customer 360 | KCPL CRM",
  robots: { index: false, follow: false },
};

export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") {
    return <CustomerGate title="Sign in to KCPL Operations." detail="Customer 360 is available only to authorised KCPL staff." />;
  }

  const { id } = await params;
  let customer: CrmCustomerDetail | null | undefined;
  let failed = false;
  try {
    customer = await getCrmCustomer(id);
  } catch (error) {
    failed = true;
    customer = undefined;
    console.error("Failed to load KCPL Customer 360", id, error);
  }

  if (failed) return <CustomerGate title="Customer 360 could not be loaded." detail="KCPL customer data is temporarily unavailable." />;
  if (customer === undefined) return <CustomerGate title="Firestore is unavailable." detail="The CRM backend is not available for this deployment." />;
  if (!customer || customer.archived) return <CustomerGate title="Customer not found." detail="This CRM record does not exist or has been archived." />;

  return <Customer360Workspace initialCustomer={customer} userName={access.user.displayName} userEmail={access.user.email} />;
}

function CustomerGate({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]">
      <section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#b78a3e]">KCPL Customer 360</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-.04em]">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-black/60">{detail}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/crm" className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white">Back to CRM</Link>
          <Link href="/admin" className="rounded-xl border border-black/10 px-5 py-3 text-sm font-black">Operations</Link>
        </div>
      </section>
    </main>
  );
}
