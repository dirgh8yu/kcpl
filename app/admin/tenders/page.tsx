import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { listCrmCustomers } from "../crm/crm-data.server";
import { OperationsShell } from "../operations-shell";
import { listTmsOrders } from "../rating/tms-rating.server";
import { getStaffContext } from "../staff-directory.server";
import { reconcileExpiredTmsTenders } from "./tms-tender-expiry.server";
import { listTmsTenders } from "./tms-tendering.server";
import { TmsTenderWorkspace } from "./tms-tender-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tender Desk | KCPL Operations", robots: { index: false, follow: false } };

export default async function TenderDeskPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Tender Desk is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Tendering contains supplier commercial pricing and procurement decisions." embedded/></OperationsShell>;

  try {
    await reconcileExpiredTmsTenders();
    const [orders, tenders, customers] = await Promise.all([
      listTmsOrders(staff),
      listTmsTenders(staff),
      listCrmCustomers(staff),
    ]);
    if (orders.kind !== "ready" || tenders.kind !== "ready" || !customers) return <OperationsShell {...shellProps}><Gate title="Tender Desk unavailable" detail="KCPL order, tender or customer storage is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

    return (
      <OperationsShell {...shellProps}>
        <TmsTenderWorkspace
          initialOrders={orders.orders}
          initialTenders={tenders.tenders}
          customers={customers.map((customer) => ({ id: customer.id, name: customer.display_name, branch: customer.primary_branch }))}
          canManage={staff.permissions.canEditCommercial}
        />
      </OperationsShell>
    );
  } catch (error) {
    console.error("Failed to load KCPL Tender Desk", error);
    return <OperationsShell {...shellProps}><Gate title="Tender Desk could not be loaded" detail="KCPL tender data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#342f2b] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[16px] border border-[#e5ddd6] bg-white p-8 shadow-[0_18px_50px_rgba(67,49,38,.06)]"><p className="ops-eyebrow">KCPL Tender Desk</p><h1 className="mt-3 text-[27px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[12px] leading-6 text-[#776e67]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/rating" className="ops-button" data-variant="primary" data-size="md">Rate Desk</Link><Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="md">Partners</Link></div></section></main>;
}
