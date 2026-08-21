import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { listCrmCustomers } from "../crm/crm-data.server";
import { OperationsShell } from "../operations-shell";
import { listTmsOrders } from "../rating/tms-rating.server";
import { getStaffContext } from "../staff-directory.server";
import { listTmsTenders } from "./tms-tendering.server";
import { TmsTenderWorkspace } from "./tms-tender-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tender Desk | KCPL Operations", robots: { index: false, follow: false } };

export default async function TenderDeskPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Tender Desk is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return <Gate title="Commercial access required" detail="Tendering contains supplier commercial pricing and procurement decisions."/>;

  const [orders, tenders, customers] = await Promise.all([
    listTmsOrders(staff),
    listTmsTenders(staff),
    listCrmCustomers(staff),
  ]);
  if (orders.kind !== "ready" || tenders.kind !== "ready" || !customers) return <Gate title="Tender Desk unavailable" detail="KCPL order, tender or customer storage is temporarily unavailable."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <TmsTenderWorkspace
        initialOrders={orders.orders}
        initialTenders={tenders.tenders}
        customers={customers.map((customer) => ({ id: customer.id, name: customer.display_name, branch: customer.primary_branch }))}
        canManage={staff.permissions.canEditCommercial}
      />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#342f2b]"><section className="w-full max-w-xl rounded-[16px] border border-[#e5ddd6] bg-white p-8 shadow-[0_18px_50px_rgba(67,49,38,.06)]"><p className="ops-eyebrow">KCPL Tender Desk</p><h1 className="mt-3 text-[27px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[12px] leading-6 text-[#776e67]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/rating" className="ops-button" data-variant="primary" data-size="md">Rate Desk</Link><Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="md">Partners</Link></div></section></main>;
}
