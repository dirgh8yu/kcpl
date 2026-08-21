import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listPartnerDashboard } from "../partners/partners.server";
import { listPartnerBuyRateCards, listTmsOrders } from "./tms-rating.server";
import { TmsRatingWorkspace } from "./tms-rating-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rate Desk | KCPL Operations", robots: { index: false, follow: false } };

export default async function RatingPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Rate Desk is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return <Gate title="Commercial access required" detail="Rate comparison contains supplier commercial pricing and is restricted to Commercial, Accounts and Management."/>;

  const [orders, rateCards, partners] = await Promise.all([
    listTmsOrders(staff),
    listPartnerBuyRateCards(staff),
    listPartnerDashboard(staff),
  ]);
  if (orders.kind !== "ready" || rateCards.kind !== "ready" || !partners) return <Gate title="Rate Desk unavailable" detail="KCPL order or partner pricing storage is temporarily unavailable."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <div className="px-4 pt-4 lg:px-5">
        <div className="flex justify-end"><Link href="/admin/tenders" className="ops-button" data-variant="primary" data-size="sm">Open Tender Desk →</Link></div>
      </div>
      <TmsRatingWorkspace
        initialOrders={orders.orders}
        initialRateCards={rateCards.rateCards}
        partners={partners.partners.filter((partner) => partner.status === "active").map((partner) => ({ id: partner.id, name: partner.display_name }))}
        branches={staff.branches}
        canUseGlobalBranch={staff.permissions.role === "management" || staff.can_access_all_branches}
        canManageRateCards={staff.permissions.canManageRateCards}
      />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#342f2b]"><section className="w-full max-w-xl rounded-[16px] border border-[#e5ddd6] bg-white p-8 shadow-[0_18px_50px_rgba(67,49,38,.06)]"><p className="ops-eyebrow">KCPL Rate Desk</p><h1 className="mt-3 text-[27px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[12px] leading-6 text-[#776e67]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="ops-button" data-variant="primary" data-size="md">Enquiries</Link><Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="md">Partners</Link></div></section></main>;
}
