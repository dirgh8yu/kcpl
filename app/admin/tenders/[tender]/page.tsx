import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { listTmsOrders } from "../../rating/tms-rating.server";
import type { TmsOrder } from "../../rating/tms-rating";
import { getStaffContext } from "../../staff-directory.server";
import { listTmsTenders } from "../tms-tendering.server";
import { tmsTenderStatusLabels, type TmsTender } from "../tms-tendering";
import { OpsBadge, OpsCopyButton, OpsDetailGrid, OpsDetailItem, OpsMono, OpsPage, OpsPageHeader, OpsSurface } from "../../operations-ui";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { recordTitle } from "../../../record-title";
import { freightModeLabel } from "../../freight-mode";

export const dynamic = "force-dynamic";
/** The tab names the record, so a row of open tabs and the history read as
 *  a list of shipments and invoices rather than the same word repeated. */
export async function generateMetadata({ params }: { params: Promise<{ tender: string }> }) {
  const name = recordTitle((await params).tender);
  return { title: name, robots: { index: false, follow: false } };
}

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return "Not recorded";
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function shortDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: value.length === 10 ? "UTC" : "Asia/Kathmandu" }).format(date);
}

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

export default async function BookingConfirmationPage({ params }: { params: Promise<{ tender: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Booking confirmations are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Booking confirmation exposes the accepted procurement basis and is restricted to authorised users." embedded/></OperationsShell>;

  const { tender: rawTender } = await params;
  const tenderKey = decodeURIComponent(rawTender).trim().toUpperCase();
  const [tenders, orders] = await Promise.all([listTmsTenders(staff), listTmsOrders(staff)]);
  if (tenders.kind !== "ready" || orders.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Booking didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;

  const tender = tenders.tenders.find((item) => item.id.toUpperCase() === tenderKey || item.tender_reference.toUpperCase() === tenderKey);
  if (!tender) return <OperationsShell {...shellProps}><Gate title="Booking not found" detail="This booking doesn’t exist, or it belongs to a branch you can’t see." embedded/></OperationsShell>;
  const order = orders.orders.find((item) => item.id === tender.order_id) ?? null;

  if (tender.status !== "booked") return <OperationsShell {...shellProps} detailLabel={tender.tender_reference}><NotBooked tender={tender}/></OperationsShell>;
  return <OperationsShell {...shellProps} detailLabel={tender.booking_reference || tender.tender_reference}><BookingConfirmation tender={tender} order={order}/></OperationsShell>;
}

function BookingConfirmation({ tender, order }: { tender: TmsTender; order: TmsOrder | null }) {
  const bookedAmount = tender.final_cost !== null && tender.final_currency ? money(tender.final_cost, tender.final_currency) : tender.counter_cost !== null && tender.counter_currency ? money(tender.counter_cost, tender.counter_currency) : money(tender.offered_cost, tender.currency);
  const commercialBasis = tender.counter_cost !== null ? "Accepted counter-offer" : "Accepted offer";
  const shipment = tender.shipment_reference;

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Carrier booking"
      title={<span className="inline-flex flex-wrap items-center gap-2"><OpsMono>{tender.booking_reference || tender.tender_reference}</OpsMono><OpsCopyButton value={tender.booking_reference || tender.tender_reference} label={tender.booking_reference || tender.tender_reference}/><OpsBadge tone="success" dot>Booked</OpsBadge></span>}
      description={`${tender.origin} → ${tender.destination}`}
      meta={<><span>{order?.customer_name || "Customer not linked"}</span><span>{tender.partner_name}</span><span>{freightModeLabel(tender.mode)}</span><span>Booked {dateTime(tender.booked_at)}</span></>}
      actions={shipment ? <Link href={`/admin/jobs/${encodeURIComponent(shipment)}`} className="ops-button" data-variant="primary" data-size="md">Open Job File</Link> : null}
    />
    <div className="ops-content">
      <div className="ops-stack">
        <OpsSurface priority="info" eyebrow="Next step" title="Hand the booking to operations" description={shipment ? "The booking is done. Carry on in the shipment’s Job File and pickup." : "No shipment is linked to this booking yet."}>
          {shipment ? <div className="flex flex-wrap gap-2">
            <Link href={`/admin/pickups?shipment=${encodeURIComponent(shipment)}`} className="ops-button" data-variant="secondary" data-size="sm">Open pickup</Link>
          </div> : null}
        </OpsSurface>
        <OpsSurface title="What was booked">
          <OpsDetailGrid columns={3}>
            <OpsDetailItem label="Transport order"><Link href={`/admin/rating/${encodeURIComponent(tender.order_id)}`}><OpsMono>{tender.order_id}</OpsMono></Link></OpsDetailItem>
            <OpsDetailItem label="Carrier request"><Link href={`/admin/tenders?tender=${encodeURIComponent(tender.tender_reference)}`}><OpsMono>{tender.tender_reference}</OpsMono></Link></OpsDetailItem>
            <OpsDetailItem label="Partner">{tender.partner_name}</OpsDetailItem>
            <OpsDetailItem label="Outcome">{commercialBasis}</OpsDetailItem>
            <OpsDetailItem label="Agreed buy rate">{bookedAmount}</OpsDetailItem>
          </OpsDetailGrid>
        </OpsSurface>
        <OpsSurface title="Booking details">
          <OpsDetailGrid columns={3}>
            <OpsDetailItem label="Pickup confirmation">{tender.pickup_confirmation || "Not recorded"}</OpsDetailItem>
            <OpsDetailItem label="Planned pickup">{shortDate(tender.pickup_date || order?.pickup_date || null)}</OpsDetailItem>
            {tender.service ? <OpsDetailItem label="Service">{tender.service}</OpsDetailItem> : null}
            {tender.equipment || order?.equipment ? <OpsDetailItem label="Equipment">{tender.equipment || order?.equipment}</OpsDetailItem> : null}
          </OpsDetailGrid>
        </OpsSurface>
        {order ? <OpsSurface title="Cargo">
          <OpsDetailGrid columns={4}>
            <OpsDetailItem label="Weight">{`${order.weight_kg.toLocaleString()} kg`}</OpsDetailItem>
            <OpsDetailItem label="Volume">{`${order.volume_cbm.toLocaleString()} CBM`}</OpsDetailItem>
            <OpsDetailItem label="Pieces">{order.pieces.toLocaleString()}</OpsDetailItem>
            {order.container_count ? <OpsDetailItem label="Containers">{order.container_count.toLocaleString()}</OpsDetailItem> : null}
          </OpsDetailGrid>
        </OpsSurface> : null}
        <OpsSurface title="Carrier’s reply">
          <OpsDetailGrid columns={4}>
            <OpsDetailItem label="Channel">{channelLabel(tender.channel)}</OpsDetailItem>
            <OpsDetailItem label="Sent">{dateTime(tender.sent_at)}</OpsDetailItem>
            <OpsDetailItem label="Replied">{dateTime(tender.responded_at)}</OpsDetailItem>
            {tender.responded_at ? null : <OpsDetailItem label="Reply due">{dateTime(tender.response_due_at)}</OpsDetailItem>}
            {tender.response_note ? <OpsDetailItem label="Note" wide><span className="whitespace-pre-wrap">{tender.response_note}</span></OpsDetailItem> : null}
          </OpsDetailGrid>
        </OpsSurface>
        <OpsSurface title="Ownership and records">
          <OpsDetailGrid columns={3}>
            <OpsDetailItem label="Branch">{order?.branch || "Not recorded"}</OpsDetailItem>
            <OpsDetailItem label="Created by">{tender.created_by_name || tender.created_by_email}</OpsDetailItem>
            <OpsDetailItem label="Customer">{order?.customer_name || "Not linked"}</OpsDetailItem>
            <OpsDetailItem label="Shipment">{shipment ? <Link href={`/admin/jobs/${encodeURIComponent(shipment)}`}><OpsMono>{shipment}</OpsMono></Link> : "Not linked"}</OpsDetailItem>
            <OpsDetailItem label="Updated">{dateTime(tender.updated_at)}</OpsDetailItem>
          </OpsDetailGrid>
        </OpsSurface>
      </div>
    </div>
  </OpsPage>;
}

function channelLabel(channel: string) {
  if (channel === "edi_204") return "EDI 204";
  return titleCase(channel);
}

function NotBooked({ tender }: { tender: TmsTender }) {
  return <V4WorkspaceGate
    eyebrow="Carrier booking"
    title="Not booked yet"
    detail={`${tender.tender_reference} is ${tmsTenderStatusLabels[tender.status].toLowerCase()}. Only an accepted offer or counter-offer can be booked.`}
    embedded
    actions={[{ href: `/admin/tenders?tender=${encodeURIComponent(tender.tender_reference)}`, label: "Open carrier request", primary: true }]}
  />;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Carrier booking" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/tenders", label: "Carrier booking", primary: true }]}/>;
}
