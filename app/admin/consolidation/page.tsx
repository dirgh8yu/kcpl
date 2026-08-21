import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { listConsolidationLoads } from "./tms-consolidation.server";
import { OperationsShell } from "../operations-shell";
import { listTmsOrders } from "../rating/tms-rating.server";
import { getStaffContext } from "../staff-directory.server";
import { TmsConsolidationWorkspace } from "./tms-consolidation-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Load Planner | KCPL Operations", robots: { index: false, follow: false } };

export default async function ConsolidationPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Load Planner is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Consolidation planning contains procurement-sensitive transport orders and costs." embedded/></OperationsShell>;

  try {
    const [loads, orders] = await Promise.all([listConsolidationLoads(staff), listTmsOrders(staff)]);
    if (loads.kind !== "ready" || orders.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Load Planner unavailable" detail="KCPL consolidation or transport-order storage is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

    return (
      <OperationsShell {...shellProps}>
        <TmsConsolidationWorkspace initialLoads={loads.loads} initialOrders={orders.orders} canManage={staff.permissions.canEditCommercial}/>
      </OperationsShell>
    );
  } catch (error) {
    console.error("Failed to load KCPL Load Planner", error);
    return <OperationsShell {...shellProps}><Gate title="Load Planner could not be loaded" detail="KCPL consolidation data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#342f2b] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[16px] border border-[#e5ddd6] bg-white p-8 shadow-[0_18px_50px_rgba(67,49,38,.06)]"><p className="ops-eyebrow">KCPL Load Planner</p><h1 className="mt-3 text-[27px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[12px] leading-6 text-[#776e67]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/rating" className="ops-button" data-variant="primary" data-size="md">Rate Desk</Link><Link href="/admin/tenders" className="ops-button" data-variant="secondary" data-size="md">Tender Desk</Link></div></section></main>;
}
