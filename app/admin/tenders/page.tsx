import "../plan-sell-premium.css";
import Link from "next/link";
import { ArrowRight, Send } from "lucide-react";
import { OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsTableWrap } from "../operations-ui";
import { getAdminAccess } from "../admin-auth";
import { listCrmCustomers } from "../crm/crm-data.server";
import { OperationsShell } from "../operations-shell";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import type { TmsOrder } from "../rating/tms-rating";
import { listTmsOrders } from "../rating/tms-rating.server";
import { getStaffContext } from "../staff-directory.server";
import { reconcileExpiredTmsTenders } from "./tms-tender-expiry.server";
import type { TmsTender } from "./tms-tendering";
import { listTmsTenders } from "./tms-tendering.server";
import { V4TenderWorkspace } from "./v4-tender-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carrier booking", robots: { index: false, follow: false } };

export default async function TenderDeskPage({ searchParams }: { searchParams: Promise<{ tender?: string; state?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Carrier booking is available only to authorised staff."/>;
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
    return <OperationsShell {...shellProps}><Gate title="Carrier booking didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
  }

  if (orders.kind !== "ready" || tenders.kind !== "ready" || !customers) return <OperationsShell {...shellProps}><Gate title="Carrier booking didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;

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
  return <OpsPage>
    <OpsPageHeader
      title="Confirmed bookings"
      description="Confirmed carrier bookings, newest first."
    />
    <div className="ops-content ops-stack">
      <section className="ops-surface" aria-label="Confirmed bookings">
        {sorted.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link aria-label="Confirmed bookings">
          <thead><tr><th>Booking</th><th>Order</th><th>Route</th><th>Customer</th><th>Partner</th><th>Shipment</th></tr></thead>
          <tbody>{sorted.map((tender) => {
            const order = orderById.get(tender.order_id);
            return <tr key={tender.id}>
              <td data-cell="primary"><Link href={`/admin/tenders/${encodeURIComponent(tender.id)}`} className="font-semibold text-[var(--admin-ink)]"><OpsMono>{tender.booking_reference || tender.tender_reference}</OpsMono></Link></td>
              <td data-label="Order"><OpsMono>{tender.order_id}</OpsMono></td>
              <td data-cell="route"><span className="ops-route"><span>{tender.origin}</span><ArrowRight size={11} className="ops-route-arrow" aria-hidden="true"/><span>{tender.destination}</span></span></td>
              <td data-label="Customer">{order?.customer_name || "Not linked"}</td>
              <td data-label="Partner">{tender.partner_name}</td>
              <td data-label="Shipment">{tender.shipment_reference ? <OpsMono>{tender.shipment_reference}</OpsMono> : "Not linked"}</td>
            </tr>;
          })}</tbody>
        </table></OpsTableWrap> : <OpsEmptyState compact icon={<Send size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No confirmed bookings yet" description="Accepted carrier bookings appear here once the server confirms them."/>}
      </section>
    </div>
  </OpsPage>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Carrier booking" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/rating", label: "Buy rates", primary: true }]}/>;
}
