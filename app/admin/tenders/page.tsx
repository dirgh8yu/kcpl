import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { listCrmCustomers } from "../crm/crm-data.server";
import { OperationsShell } from "../operations-shell";
import { listTmsOrders } from "../rating/tms-rating.server";
import { getStaffContext } from "../staff-directory.server";
import { reconcileExpiredTmsTenders } from "./tms-tender-expiry.server";
import { listTmsTenders } from "./tms-tendering.server";
import { V4TenderWorkspace } from "./v4-tender-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tender Workspace | KCPL Operations", robots: { index: false, follow: false } };

export default async function TenderDeskPage({ searchParams }: { searchParams: Promise<{ tender?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Tender Workspace is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Tendering contains supplier commercial pricing and procurement decisions." embedded/></OperationsShell>;

  let orders: Awaited<ReturnType<typeof listTmsOrders>>;
  let tenders: Awaited<ReturnType<typeof listTmsTenders>>;
  let customers: Awaited<ReturnType<typeof listCrmCustomers>>;
  try {
    await reconcileExpiredTmsTenders();
    [orders, tenders, customers] = await Promise.all([
      listTmsOrders(staff),
      listTmsTenders(staff),
      listCrmCustomers(staff),
    ]);
  } catch (error) {
    console.error("Failed to load KCPL Tender Workspace", error);
    return <OperationsShell {...shellProps}><Gate title="Tender Workspace could not be loaded" detail="KCPL tender data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  if (orders.kind !== "ready" || tenders.kind !== "ready" || !customers) return <OperationsShell {...shellProps}><Gate title="Tender Workspace unavailable" detail="KCPL order, tender or customer storage is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

  const { tender } = await searchParams;
  const requestedTender = tender?.trim().toUpperCase() ?? "";
  const targetTender = requestedTender ? tenders.tenders.find((item) => item.id === requestedTender || item.tender_reference === requestedTender) : undefined;
  const orderedTenders = targetTender ? [targetTender, ...tenders.tenders.filter((item) => item.id !== targetTender.id)] : tenders.tenders;
  const orderedOrders = targetTender ? [...orders.orders].sort((a, b) => Number(b.id === targetTender.order_id) - Number(a.id === targetTender.order_id)) : orders.orders;

  return <OperationsShell {...shellProps}>
    <V4TenderWorkspace
      initialOrders={orderedOrders}
      initialTenders={orderedTenders}
      customers={customers.map((customer) => ({ id: customer.id, name: customer.display_name, branch: customer.primary_branch }))}
      canManage={staff.permissions.canEditCommercial}
    />
  </OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f6f6f3] p-6 text-[#141414] ${embedded ? "min-h-[calc(100vh-54px)]" : "min-h-screen"}`}><section className="w-full max-w-xl border-y border-[#e2e2e2] bg-white p-8"><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#dc143c]">KCPL Tender Workspace</p><h1 className="mt-3 text-[22px] font-semibold tracking-[-.02em]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#5b5b5b]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/rating" className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Transport Orders</Link><Link href="/admin/partners" className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Partners</Link></div></section></main>;
}
