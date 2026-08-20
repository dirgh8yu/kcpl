import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { getStaffContext } from "../staff-directory.server";
import { listPayablesDashboard } from "./payables.server";
import { PayablesWorkspace } from "./payables-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts Payable | KCPL Finance", robots: { index: false, follow: false } };

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ shipment?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations." detail="Accounts Payable is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return <Gate title="Accounts Payable is restricted." detail="Supplier bills and payments are available to Management and Accounts roles only."/>;
  const dashboard = await listPayablesDashboard(staff);
  if (!dashboard) return <Gate title="Accounts Payable is unavailable." detail="The Firestore payable ledger is not available for this deployment."/>;
  const params = await searchParams;
  const initialShipment = typeof params.shipment === "string" ? params.shipment.trim().toUpperCase() : "";

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <PayablesWorkspace dashboard={dashboard} roleLabel={kcplStaffRoleLabels[staff.permissions.role]} initialShipment={initialShipment}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">KCPL Finance</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-black/50">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/finance" className="rounded-xl bg-[#10263f] px-4 py-3 text-sm font-black text-white">Accounts Receivable</Link><Link href="/admin" className="rounded-xl border border-black/10 px-4 py-3 text-sm font-black">Operations</Link></div></section></main>;
}
