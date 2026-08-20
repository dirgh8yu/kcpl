import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { ForexReferencePanel } from "../forex/forex-reference-panel";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { SeaRatesMarketEstimateWorkspace } from "./searates-market-estimate-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Market Estimate | KCPL Operations", robots: { index: false, follow: false } };

export default async function MarketEstimatePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required." detail="Use an authorised KCPL staff account to access external market estimates."/>;

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return <Gate title="Commercial access required." detail="External market estimates are available to Management, Accounts and Commercial roles."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <ForexReferencePanel compact/>
      <SeaRatesMarketEstimateWorkspace roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Operations</p><h1 className="mt-3 text-2xl font-bold">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p><Link href="/admin" className="mt-5 inline-block rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Back to enquiries</Link></section></main>;
}
