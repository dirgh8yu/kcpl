import "../plan-sell-premium.css";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { getStaffContext } from "../staff-directory.server";
import { listPartnerDashboard } from "../partners/partners.server";
import { listPartnerBuyRateCards, listTmsOrders } from "./tms-rating.server";
import { TmsRatingWorkspace } from "./tms-rating-workspace";
import { V4TransportOrdersWorkspace } from "./v4-transport-orders-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Buy rates", robots: { index: false, follow: false } };

export default async function RatingPage({ searchParams }: { searchParams: Promise<{ order?: string; view?: string; create?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Buy rates are available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Buy rates are restricted to Commercial, Accounts and Management users." embedded/></OperationsShell>;

  const { order, view, create } = await searchParams;

  let orders: Awaited<ReturnType<typeof listTmsOrders>>;
  try {
    orders = await listTmsOrders(staff);
  } catch (error) {
    console.error("Failed to load KCPL Transport Orders", error);
    return <OperationsShell {...shellProps}><Gate title="Orders didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
  }

  if (orders.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Orders didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;

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
      return <OperationsShell {...shellProps}><Gate title="Buy rates didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
    }
    if (rateCards.kind !== "ready" || !partners) return <OperationsShell {...shellProps}><Gate title="Buy rates didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;

    return <OperationsShell {...shellProps}>
      <TmsRatingWorkspace
        initialOrders={orderedOrders}
        initialRateCards={rateCards.rateCards}
        partners={partners.partners.filter((partner) => partner.status === "active").map((partner) => ({ id: partner.id, name: partner.display_name }))}
        branches={staff.branches}
        canUseGlobalBranch={staff.permissions.role === "management" || staff.can_access_all_branches}
        canManageRateCards={staff.permissions.canManageRateCards}
        canManageOrders={staff.permissions.canManageTransportOrders}
      />
    </OperationsShell>;
  }

  return <OperationsShell {...shellProps}>
    <V4TransportOrdersWorkspace initialOrders={orderedOrders} branches={staff.branches} initialCreate={create === "1"} canCreate={staff.permissions.canManageTransportOrders}/>
  </OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Buy rates" title={title} detail={detail} embedded={embedded}/>;
}
