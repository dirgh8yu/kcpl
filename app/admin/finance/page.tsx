import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { ForexReferencePanel } from "../forex/forex-reference-panel";
import { OperationsShell } from "../operations-shell";
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
  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];

  return (
    <OperationsShell
      userName={access.user.displayName}
      roleLabel={roleLabel}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <FinanceWorkspace dashboard={dashboard} roleLabel={roleLabel}/>
      <div className="ops-page-body pt-0"><ForexReferencePanel compact/></div>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Finance</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="inline-flex h-9 items-center rounded-lg bg-[#283a77] px-4 text-xs font-semibold text-white">Enquiry desk</Link><Link href="/admin/command-centre" className="inline-flex h-9 items-center rounded-lg border border-[#dfe2e6] px-4 text-xs font-semibold text-[#505861]">Operations Home</Link></div></section></main>;
}
