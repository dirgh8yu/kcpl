import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { listFinanceDashboard } from "./finance.server";
import { FinanceWorkspace } from "./finance-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance & Accounts Receivable | KCPL", robots: { index: false, follow: false } };

export default async function FinancePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations." detail="Finance is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return <Gate title="Finance access is restricted." detail="Accounts Receivable is available to Management and Accounts roles only."/>;
  const dashboard = await listFinanceDashboard(staff);
  if (!dashboard) return <Gate title="Finance is unavailable." detail="The Firestore finance backend is not available for this deployment."/>;
  return <><FinanceWorkspace dashboard={dashboard} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/><Link href="/admin/payables" className="fixed bottom-5 left-5 z-50 rounded-2xl bg-[#b78a3e] px-4 py-3 text-[10px] font-black uppercase tracking-[.1em] text-white shadow-lg">Accounts Payable</Link></>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">KCPL Finance</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-black/50">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="rounded-xl bg-[#10263f] px-4 py-3 text-sm font-black text-white">Operations</Link><Link href="/admin/command-centre" className="rounded-xl border border-black/10 px-4 py-3 text-sm font-black">Command Centre</Link></div></section></main>;
}
