import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listPricingWorkspace } from "./tms-pricing.server";
import { TmsPricingWorkspace } from "./tms-pricing-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing Desk | KCPL Operations", robots: { index: false, follow: false } };

export default async function PricingPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Pricing Desk is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return <Gate title="Commercial access required" detail="Sell pricing contains customer-specific rates, procurement costs and margin controls."/>;

  const workspace = await listPricingWorkspace(staff);
  if (workspace.kind !== "ready") return <Gate title="Pricing Desk unavailable" detail="KCPL transport-order, CRM or pricing-rule storage is temporarily unavailable."/>;

  return (
    <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
      <TmsPricingWorkspace initialOrders={workspace.orders} initialCustomers={workspace.customers} initialRules={workspace.rules} canManageRules={staff.permissions.canManageRateCards} canApprove={staff.permissions.role === "management"}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#342f2b]"><section className="w-full max-w-xl rounded-[16px] border border-[#e5ddd6] bg-white p-8 shadow-[0_18px_50px_rgba(67,49,38,.06)]"><p className="ops-eyebrow">KCPL Pricing Desk</p><h1 className="mt-3 text-[27px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[12px] leading-6 text-[#776e67]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/rating" className="ops-button" data-variant="primary" data-size="md">Rate Desk</Link><Link href="/admin" className="ops-button" data-variant="secondary" data-size="md">Enquiries</Link></div></section></main>;
}
