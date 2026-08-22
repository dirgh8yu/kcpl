import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listPartnerDashboard } from "../partners/partners.server";
import { listPartnerBuyRateCards, listTmsOrders } from "./tms-rating.server";
import { TmsRatingWorkspace } from "./tms-rating-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rate Desk | KCPL Operations", robots: { index: false, follow: false } };

export default async function RatingPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Rate Desk is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Rate comparison contains supplier commercial pricing and is restricted to Commercial, Accounts and Management." embedded/></OperationsShell>;

  let orders: Awaited<ReturnType<typeof listTmsOrders>>;
  let rateCards: Awaited<ReturnType<typeof listPartnerBuyRateCards>>;
  let partners: Awaited<ReturnType<typeof listPartnerDashboard>>;
  try {
    [orders, rateCards, partners] = await Promise.all([
      listTmsOrders(staff),
      listPartnerBuyRateCards(staff),
      listPartnerDashboard(staff),
    ]);
  } catch (error) {
    console.error("Failed to load KCPL Rate Desk", error);
    return <OperationsShell {...shellProps}><Gate title="Rate Desk could not be loaded" detail="KCPL pricing data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  if (orders.kind !== "ready" || rateCards.kind !== "ready" || !partners) return <OperationsShell {...shellProps}><Gate title="Rate Desk unavailable" detail="KCPL order or partner pricing storage is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

  const { order } = await searchParams;
  const requestedOrder = order?.trim().toUpperCase() ?? "";
  const orderedOrders = requestedOrder
    ? [...orders.orders].sort((a, b) => Number(b.id === requestedOrder) - Number(a.id === requestedOrder))
    : orders.orders;

  return (
    <OperationsShell {...shellProps}>
      <div className="px-4 pt-4 lg:px-5">
        <div className="flex justify-end"><Link href="/admin/tenders" className="ops-button" data-variant="primary" data-size="sm">Open Tender Desk →</Link></div>
      </div>
      <TmsRatingWorkspace
        initialOrders={orderedOrders}
        initialRateCards={rateCards.rateCards}
        partners={partners.partners.filter((partner) => partner.status === "active").map((partner) => ({ id: partner.id, name: partner.display_name }))}
        branches={staff.branches}
        canUseGlobalBranch={staff.permissions.role === "management" || staff.can_access_all_branches}
        canManageRateCards={staff.permissions.canManageRateCards}
      />
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#342f2b] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[16px] border border-[#e5ddd6] bg-white p-8 shadow-[0_18px_50px_rgba(67,49,38,.06)]"><p className="ops-eyebrow">KCPL Rate Desk</p><h1 className="mt-3 text-[27px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[12px] leading-6 text-[#776e67]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="ops-button" data-variant="primary" data-size="md">Enquiries</Link><Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="md">Partners</Link></div></section></main>;
}
