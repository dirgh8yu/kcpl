import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { listCrmCustomers } from "../crm/crm-data.server";
import { OperationsShell } from "../operations-shell";
import type { TmsOrder } from "../rating/tms-rating";
import { listTmsOrders } from "../rating/tms-rating.server";
import { getStaffContext } from "../staff-directory.server";
import { reconcileExpiredTmsTenders } from "./tms-tender-expiry.server";
import type { TmsTender } from "./tms-tendering";
import { listTmsTenders } from "./tms-tendering.server";
import { V4TenderWorkspace } from "./v4-tender-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tender Workspace | KCPL Operations", robots: { index: false, follow: false } };

export default async function TenderDeskPage({ searchParams }: { searchParams: Promise<{ tender?: string; state?: string }> }) {
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

  const { tender, state } = await searchParams;
  if (state === "booked") {
    return <OperationsShell {...shellProps}><BookingRegister tenders={tenders.tenders.filter((item) => item.status === "booked")} orders={orders.orders}/></OperationsShell>;
  }

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

function BookingRegister({ tenders, orders }: { tenders: TmsTender[]; orders: TmsOrder[] }) {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const sorted = [...tenders].sort((a, b) => Date.parse(b.booked_at ?? b.updated_at) - Date.parse(a.booked_at ?? a.updated_at));
  return <main className="min-h-[calc(100vh-54px)] bg-[#f6f6f3] px-4 pb-10 pt-6 text-[#141414] sm:px-6 lg:px-7">
    <div className="mx-auto w-full max-w-[1152px]">
      <header className="flex min-h-[60px] flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-[22px] font-semibold leading-[30px]">Bookings</h1><p className="mt-[3px] text-[13px] leading-[19px] text-[#5b5b5b]">{sorted.length} confirmed booking{sorted.length === 1 ? "" : "s"} with authoritative tender lineage</p></div>
        <Link href="/admin/tenders" className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Tender Workspace</Link>
      </header>
      <nav className="flex h-11 items-center gap-5 overflow-x-auto border-b border-[#e2e2e2]" aria-label="Operations workflow">
        <Link href="/admin/rating" className="flex h-10 shrink-0 items-center px-2 text-[13px] font-medium text-[#5b5b5b]">Orders</Link>
        <Link href="/admin/tenders" className="flex h-10 shrink-0 items-center px-2 text-[13px] font-medium text-[#5b5b5b]">Tenders</Link>
        <span className="relative flex h-10 shrink-0 items-center px-2 text-[13px] font-medium">Bookings<span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#dc143c]"/></span>
        <Link href="/admin/pickups" className="flex h-10 shrink-0 items-center px-2 text-[13px] font-medium text-[#5b5b5b]">Pickups</Link>
        <Link href="/admin/shipments" className="flex h-10 shrink-0 items-center px-2 text-[13px] font-medium text-[#5b5b5b]">Shipments</Link>
        <Link href="/admin/consolidation" className="flex h-10 shrink-0 items-center px-2 text-[13px] font-medium text-[#5b5b5b]">Consolidations</Link>
      </nav>
      <section className="mt-4 overflow-x-auto border-t border-[#e2e2e2]">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
          <thead><tr className="h-9 border-b border-[#e2e2e2] text-[11px] font-medium text-[#737373]"><th className="w-[160px] px-3 font-medium">BOOKING</th><th className="w-[150px] px-3 font-medium">ORDER</th><th className="w-[190px] px-3 font-medium">ROUTE</th><th className="w-[170px] px-3 font-medium">CUSTOMER</th><th className="w-[160px] px-3 font-medium">PARTNER</th><th className="w-[130px] px-3 font-medium">SHIPMENT</th><th className="w-[90px] px-3 text-right font-medium">ACTION</th></tr></thead>
          <tbody>{sorted.length ? sorted.map((tender) => {
            const order = orderById.get(tender.order_id);
            return <tr key={tender.id} className="h-12 border-b border-[#e2e2e2] bg-white text-[12px] hover:bg-[#fbfbf9]"><td className="px-3 text-[13px] font-semibold"><span className="block truncate">{tender.booking_reference || tender.tender_reference}</span></td><td className="px-3 font-medium text-[#5b5b5b]">{tender.order_id}</td><td className="px-3 text-[#5b5b5b]"><span className="block truncate">{tender.origin} → {tender.destination}</span></td><td className="px-3 text-[#5b5b5b]"><span className="block truncate">{order?.customer_name || "Not linked"}</span></td><td className="px-3 text-[#5b5b5b]"><span className="block truncate">{tender.partner_name}</span></td><td className="px-3 font-medium">{tender.shipment_reference || "Not linked"}</td><td className="px-3 text-right"><Link href={`/admin/tenders/${encodeURIComponent(tender.id)}`} className="font-semibold text-[#dc143c]">Open</Link></td></tr>;
          }) : <tr><td colSpan={7} className="h-48 px-6 text-center"><p className="text-[14px] font-semibold">No confirmed bookings</p><p className="mt-1 text-[12px] text-[#737373]">Accepted tenders will appear here after the server confirms booking.</p></td></tr>}</tbody>
        </table>
      </section>
    </div>
  </main>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f6f6f3] p-6 text-[#141414] ${embedded ? "min-h-[calc(100vh-54px)]" : "min-h-screen"}`}><section className="w-full max-w-xl border-y border-[#e2e2e2] bg-white p-8"><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#dc143c]">KCPL Tender Workspace</p><h1 className="mt-3 text-[22px] font-semibold tracking-[-.02em]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#5b5b5b]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/rating" className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Transport Orders</Link><Link href="/admin/partners" className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Partners</Link></div></section></main>;
}
