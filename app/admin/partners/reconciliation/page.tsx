import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { kcplStaffRoleLabels } from "../../staff-permissions";
import { getStaffContext } from "../../staff-directory.server";
import { SupplierReconciliationWorkspace } from "./supplier-reconciliation-workspace";
import { listSupplierReconciliation } from "./supplier-reconciliation.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supplier Reconciliation | KCPL Finance", robots: { index: false, follow: false } };

export default async function SupplierReconciliationPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Supplier reconciliation is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return <Gate title="Supplier reconciliation is restricted" detail="Only Management and Accounts can relink legacy supplier bills to Partner records."/>;

  const loaded = await listSupplierReconciliation(staff);
  if (loaded.kind === "forbidden") return <Gate title="Supplier reconciliation is restricted" detail="Your role does not have Accounts Payable authority."/>;
  if (loaded.kind === "unavailable") return <Gate title="Supplier reconciliation is unavailable" detail="The Partner and Accounts Payable stores are not available for this deployment."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <SupplierReconciliationWorkspace snapshot={loaded.snapshot} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Finance</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[12px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/partners" className="rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[11px] font-bold text-white">Partners & vendors</Link><Link href="/admin/payables" className="rounded-[11px] border border-[#e2d9d2] bg-white px-4 py-2.5 text-[11px] font-bold text-[#665c55]">Accounts Payable</Link></div></section></main>;
}
