import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listPartnerDashboard } from "../partners/partners.server";
import { listPartnerBuyRateCards, listTmsOrders } from "./tms-rating.server";
import { TmsRatingWorkspace } from "./tms-rating-workspace";
import { V4TransportOrdersWorkspace } from "./v4-transport-orders-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transport Orders | KCPL Operations", robots: { index: false, follow: false } };

export default async function RatingPage({ searchParams }: { searchParams: Promise<{ order?: string; view?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="KCPL Transport Orders are available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Transport Orders and procurement pricing are restricted to authorised Commercial, Accounts and Management users." embedded/></OperationsShell>;

  const { order, view } = await searchParams;

  let orders: Awaited<ReturnType<typeof listTmsOrders>>;
  try {
    orders = await listTmsOrders(staff);
  } catch (error) {
    console.error("Failed to load KCPL Transport Orders", error);
    return <OperationsShell {...shellProps}><Gate title="Transport Orders could not be loaded" detail="KCPL planning data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  if (orders.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Transport Orders unavailable" detail="KCPL transport-order storage is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

  const requestedOrder = order?.trim().toUpperCase() ?? "";
  const orderedOrders = requestedOrder
    ? [...orders.orders].sort((a, b) => Number(b.id === requestedOrder) - Number(a.id === requestedOrder))
    : orders.orders;

  if (view === "rate-desk") {
    let rateCards: Awaited<ReturnType<typeof listPartnerBuyRateCards>>;
    let partners: Awaited<ReturnType<typeof listPartnerDashboard>>;
    try {
      [rateCards, partners] = await Promise.all([
        listPartnerBuyRateCards(staff),
        listPartnerDashboard(staff),
      ]);
    } catch (error) {
      console.error("Failed to load KCPL Rate Desk", error);
      return <OperationsShell {...shellProps}><Gate title="Rate Desk could not be loaded" detail="KCPL Partner pricing is temporarily unavailable. The Transport Orders register remains available." embedded/></OperationsShell>;
    }
    if (rateCards.kind !== "ready" || !partners) return <OperationsShell {...shellProps}><Gate title="Rate Desk unavailable" detail="KCPL Partner pricing storage is temporarily unavailable." embedded/></OperationsShell>;

    return <OperationsShell {...shellProps}>
      <div className="px-4 pt-4 sm:px-6 lg:px-7"><div className="mx-auto flex w-full max-w-[1152px] justify-between gap-2"><Link href="/admin/rating" className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold text-[#141414]">← Transport Orders</Link><Link href="/admin/tenders" className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Open Tender Workspace →</Link></div></div>
      <TmsRatingWorkspace
        initialOrders={orderedOrders}
        initialRateCards={rateCards.rateCards}
        partners={partners.partners.filter((partner) => partner.status === "active").map((partner) => ({ id: partner.id, name: partner.display_name }))}
        branches={staff.branches}
        canUseGlobalBranch={staff.permissions.role === "management" || staff.can_access_all_branches}
        canManageRateCards={staff.permissions.canManageRateCards}
      />
    </OperationsShell>;
  }

  return <OperationsShell {...shellProps}>
    <V4TransportOrdersWorkspace initialOrders={orderedOrders} branches={staff.branches}/>
  </OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f6f6f3] p-6 text-[#141414] ${embedded ? "min-h-[calc(100vh-54px)]" : "min-h-screen"}`}><section className="w-full max-w-xl border-y border-[#e2e2e2] bg-white p-8"><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#dc143c]">KCPL Operations</p><h1 className="mt-3 text-[22px] font-semibold tracking-[-.02em]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#5b5b5b]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/command-centre" className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Operations Overview</Link><Link href="/admin/shipments" className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Shipments</Link></div></section></main>;
}
