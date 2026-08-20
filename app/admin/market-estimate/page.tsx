import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Market Estimate | KCPL Operations", robots: { index: false, follow: false } };

export default async function MarketEstimatePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required." detail="Use an authorised KCPL staff account to access commercial tools."/>;

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return <Gate title="Commercial access required." detail="Market intelligence tools are available to Management, Accounts and Commercial roles."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <main className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
        <header className="border-b border-[#dfe3e8] bg-white px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9a763b]">KCPL Commercial Intelligence</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Market Estimate</h1>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-[#68747f]">The external courier-rate provider has been removed. This workspace is reserved for KCPL-controlled pricing tools and future vetted integrations.</p>
            </div>
            <span className="rounded-full border border-[#dfe3e8] bg-[#f8f9fa] px-3 py-2 text-[10px] font-black uppercase tracking-[.08em] text-[#68747f]">{kcplStaffRoleLabels[staff.permissions.role]}</span>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <section className="max-w-3xl rounded-2xl border border-[#dfe3e8] bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a763b]">External provider disconnected</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.03em]">No live courier API is connected.</h2>
            <p className="mt-3 text-sm leading-6 text-[#68747f]">KCPL will not send shipment details to an external rate provider from this page. Use verified partner/vendor rates and the internal quotation workflow until a replacement pricing source is approved.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/admin/partners" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Open Partners</Link>
              <Link href="/admin" className="rounded-lg border border-[#dfe3e8] bg-white px-4 py-2.5 text-xs font-bold text-[#10263f]">Back to enquiries</Link>
            </div>
          </section>
        </div>
      </main>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Operations</p><h1 className="mt-3 text-2xl font-bold">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p><Link href="/admin" className="mt-5 inline-block rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Back to enquiries</Link></section></main>;
}
