import { Send } from "lucide-react";
import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { listTmsTenders } from "../../tenders/tms-tendering.server";
import { tenderTone, tmsTenderStatusLabels, type TmsTender } from "../../tenders/tms-tendering";
import { listTmsOrders } from "../tms-rating.server";
import type { TmsOrder, TmsOrderStatus } from "../tms-rating";
import { recordTitle } from "../../../record-title";
import { OpsBadge, OpsDetailGrid, OpsDetailItem, OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../operations-ui";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { freightModeLabel } from "../../freight-mode";

export const dynamic = "force-dynamic";
/** The tab names the record, so a row of open tabs and the history read as
 *  a list of shipments and invoices rather than the same word repeated. */
export async function generateMetadata({ params }: { params: Promise<{ order: string }> }) {
  const name = recordTitle((await params).order);
  return { title: name, robots: { index: false, follow: false } };
}

const statusLabels: Record<TmsOrderStatus, string> = {
  draft: "Draft",
  rated: "Rated",
  selected: "Rate selected",
  tendering: "Tendering",
  booked: "Booked",
  cancelled: "Cancelled",
};

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  const text = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: value.length === 10 ? undefined : "short", timeZone: value.length === 10 ? "UTC" : "Asia/Kathmandu" }).format(date);
  // Times carry NPT, as everywhere else in the staff app; plain dates don't.
  return value.length === 10 ? text : `${text} NPT`;
}

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return "Not selected";
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}


export default async function TransportOrderDetailPage({ params }: { params: Promise<{ order: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Transport orders are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="This transport order contains procurement context restricted to authorised users." embedded/></OperationsShell>;

  const { order: rawOrder } = await params;
  const orderId = decodeURIComponent(rawOrder).trim().toUpperCase();
  const [orders, tenders] = await Promise.all([listTmsOrders(staff), listTmsTenders(staff)]);
  if (orders.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Order didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
  const order = orders.orders.find((item) => item.id === orderId);
  if (!order) return <OperationsShell {...shellProps}><Gate title="Transport order not found" detail="This order reference does not exist within your current branch access." embedded/></OperationsShell>;

  const relatedTenders = tenders.kind === "ready" ? tenders.tenders.filter((item) => item.order_id === order.id) : [];
  const bookedTender = relatedTenders.find((item) => item.status === "booked") ?? null;
  const liveTender = relatedTenders.find((item) => ["sent", "accepted", "countered"].includes(item.status)) ?? null;

  return <OperationsShell {...shellProps} detailLabel={order.id}><TransportOrderDetail order={order} relatedTenders={relatedTenders} bookedTender={bookedTender} liveTender={liveTender}/></OperationsShell>;
}

function TransportOrderDetail({ order, relatedTenders, bookedTender, liveTender }: { order: TmsOrder; relatedTenders: TmsTender[]; bookedTender: TmsTender | null; liveTender: TmsTender | null }) {
  const next = nextAction(order, liveTender, bookedTender);
  const action = bookedTender
    ? <Link href={`/admin/tenders/${encodeURIComponent(bookedTender.id)}`} className="ops-button" data-variant="primary" data-size="md">Open booking</Link>
    : ["selected", "tendering"].includes(order.status)
      ? <Link href={`/admin/tenders${liveTender ? `?tender=${encodeURIComponent(liveTender.tender_reference)}` : ""}`} className="ops-button" data-variant="primary" data-size="md">Open carrier booking</Link>
      : ["draft", "rated"].includes(order.status)
        ? <Link href={`/admin/rating?view=rate-desk&order=${encodeURIComponent(order.id)}`} className="ops-button" data-variant="primary" data-size="md">Rate order</Link>
        : null;
  return <OpsPage>
    <OpsPageHeader
      eyebrow="Transport order"
      title={<span className="inline-flex flex-wrap items-center gap-2"><OpsMono>{order.id}</OpsMono><OpsBadge tone={statusTone(order.status)} dot>{statusLabels[order.status]}</OpsBadge></span>}
      description={`${order.origin} → ${order.destination}`}
      meta={<><span>{order.customer_name || "Customer not linked"}</span><span>{order.branch}</span><span>{freightModeLabel(order.mode)}</span><span>Updated {dateTime(order.updated_at)}</span></>}
      actions={action}
    />
    <div className="ops-content">
      <div className="ops-stack">
        <OpsSurface priority="info" eyebrow="Next step" title={next.title} description={next.detail}>{null}</OpsSurface>
        <OpsSurface title="Movement">
          <OpsDetailGrid columns={3}>
            <OpsDetailItem label="Origin">{order.origin}</OpsDetailItem>
            <OpsDetailItem label="Destination">{order.destination}</OpsDetailItem>
            <OpsDetailItem label="Mode">{freightModeLabel(order.mode)}</OpsDetailItem>
            <OpsDetailItem label="Pickup">{dateTime(order.pickup_date)}</OpsDetailItem>
            <OpsDetailItem label="Delivery target">{dateTime(order.delivery_date)}</OpsDetailItem>
            <OpsDetailItem label="Equipment">{order.equipment || "Not set"}</OpsDetailItem>
          </OpsDetailGrid>
        </OpsSurface>
        <OpsSurface title="Cargo">
          <OpsDetailGrid columns={3}>
            <OpsDetailItem label="Weight">{`${order.weight_kg.toLocaleString()} kg`}</OpsDetailItem>
            <OpsDetailItem label="Volume">{`${order.volume_cbm.toLocaleString()} CBM`}</OpsDetailItem>
            <OpsDetailItem label="Pieces">{order.pieces.toLocaleString()}</OpsDetailItem>
            <OpsDetailItem label="Containers">{order.container_count.toLocaleString()}</OpsDetailItem>
            <OpsDetailItem label="Temperature">{order.temperature_requirement || "Not set"}</OpsDetailItem>
            <OpsDetailItem label="Carrier requirement">{order.carrier_requirement || "Not set"}</OpsDetailItem>
          </OpsDetailGrid>
        </OpsSurface>
        <OpsSurface title="Buy rate" description="The selected partner rate is the starting point. The carrier’s reply and the booking are separate steps.">
          <OpsDetailGrid columns={3}>
            <OpsDetailItem label="Selected buy rate">{money(order.selected_cost, order.selected_currency)}</OpsDetailItem>
            <OpsDetailItem label="Partner">{order.selected_partner_id || "No partner selected"}</OpsDetailItem>
            <OpsDetailItem label="Rate card">{order.selected_rate_card_id || "Not locked"}</OpsDetailItem>
          </OpsDetailGrid>
        </OpsSurface>
        <OpsSurface title="Carrier requests" description={relatedTenders.length === 1 ? "1 request sent for this order." : `${relatedTenders.length} requests sent for this order.`} flush>
          {relatedTenders.length ? <OpsTableWrap>
            <table className="ops-table ops-register-table ops-stack-table">
              <thead><tr><th>Request</th><th>Partner</th><th>Offered</th><th>Reply due</th><th>Status</th></tr></thead>
              <tbody>{relatedTenders.map((tender) => <tr key={tender.id}>
                <td data-cell="primary"><Link href={tender.status === "booked" ? `/admin/tenders/${encodeURIComponent(tender.id)}` : `/admin/tenders?tender=${encodeURIComponent(tender.tender_reference)}`}><OpsMono>{tender.tender_reference}</OpsMono></Link></td>
                <td>{tender.partner_name}</td>
                <td>{money(tender.offered_cost, tender.currency)}</td>
                <td>{dateTime(tender.response_due_at)}</td>
                <td><OpsBadge tone={tenderTone(tender.status)} dot>{tmsTenderStatusLabels[tender.status]}</OpsBadge></td>
              </tr>)}</tbody>
            </table>
          </OpsTableWrap> : <OpsEmptyState icon={<Send size={16} strokeWidth={1.75} aria-hidden="true"/>} compact title="No carrier requests yet" description="Requests sent to carriers for this order will appear here."/>}
        </OpsSurface>
        {order.notes ? <OpsSurface title="Notes"><p className="whitespace-pre-wrap">{order.notes}</p></OpsSurface> : null}
        <OpsSurface title="Ownership and records">
          <OpsDetailGrid columns={3}>
            <OpsDetailItem label="Branch">{order.branch}</OpsDetailItem>
            <OpsDetailItem label="Created by">{order.created_by_name || order.created_by_email}</OpsDetailItem>
            <OpsDetailItem label="Customer">{order.customer_name || "Not linked"}</OpsDetailItem>
            <OpsDetailItem label="Booking">{bookedTender?.booking_reference || "Not confirmed"}</OpsDetailItem>
            <OpsDetailItem label="Shipment">{bookedTender?.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(bookedTender.shipment_reference)}`}><OpsMono>{bookedTender.shipment_reference}</OpsMono></Link> : "Not linked"}</OpsDetailItem>
            <OpsDetailItem label="Created">{dateTime(order.created_at)}</OpsDetailItem>
          </OpsDetailGrid>
        </OpsSurface>
      </div>
    </div>
  </OpsPage>;
}

function statusTone(status: TmsOrderStatus) {
  if (status === "booked") return "success" as const;
  if (status === "tendering" || status === "rated") return "info" as const;
  if (status === "selected") return "warning" as const;
  return "neutral" as const;
}

function nextAction(order: TmsOrder, liveTender: TmsTender | null, bookedTender: TmsTender | null) {
  if (bookedTender) return { title: "Hand the booking to operations", detail: "The booking is confirmed. Open it to see the shipment and its Job File." };
  if (liveTender) return { title: "Check the carrier’s reply", detail: `${liveTender.tender_reference} is the carrier request in progress.` };
  if (order.status === "selected") return { title: "Send to the carrier", detail: "A partner rate is selected. Send it to the carrier next." };
  if (order.status === "draft" || order.status === "rated") return { title: "Complete rating", detail: "Compare partner buy rates and pick one before sending it to a carrier." };
  return { title: "Review transport order", detail: "Nothing else to do on this order." };
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Transport order" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/rating", label: "Buy rates", primary: true }, { href: "/admin/command-centre", label: "Overview" }]}/>;
}
