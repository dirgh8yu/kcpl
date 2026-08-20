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
  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];

  return (
    <OperationsShell
      userName={access.user.displayName}
      roleLabel={roleLabel}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <PayablesWorkspace dashboard={dashboard} roleLabel={roleLabel} initialShipment={initialShipment}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Finance</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/finance" className="inline-flex h-9 items-center rounded-lg bg-[#283a77] px-4 text-xs font-semibold text-white">Finance & AR</Link><Link href="/admin" className="inline-flex h-9 items-center rounded-lg border border-[#dfe2e6] px-4 text-xs font-semibold text-[#505861]">Enquiry desk</Link></div></section></main>;
}
