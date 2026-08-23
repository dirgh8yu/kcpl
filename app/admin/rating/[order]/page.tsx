import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { listTmsTenders } from "../../tenders/tms-tendering.server";
import type { TmsTender } from "../../tenders/tms-tendering";
import { listTmsOrders } from "../tms-rating.server";
import type { TmsOrder, TmsOrderStatus } from "../tms-rating";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transport Order Detail | KCPL Operations", robots: { index: false, follow: false } };

const statusLabels: Record<TmsOrderStatus, string> = {
  draft: "Draft",
  rated: "Rated",
  selected: "Rate selected",
  tendering: "Tendering",
  booked: "Booked",
  cancelled: "Cancelled",
};

function statusClasses(status: TmsOrderStatus) {
  if (status === "booked") return "bg-[#edf8f2] text-[#18794e]";
  if (status === "tendering" || status === "rated") return "bg-[#eef5ff] text-[#2563a6]";
  if (status === "selected") return "bg-[#fff7e6] text-[#945b00]";
  return "bg-[#f7f7f7] text-[#5b5b5b]";
}

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: value.length === 10 ? undefined : "short", timeZone: value.length === 10 ? "UTC" : "Asia/Kathmandu" }).format(date);
}

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return "Not selected";
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

export default async function TransportOrderDetailPage({ params }: { params: Promise<{ order: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Transport Order records are available only to authorised KCPL staff."/>;
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
  if (orders.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Transport Order unavailable" detail="KCPL order storage is temporarily unavailable." embedded/></OperationsShell>;
  const order = orders.orders.find((item) => item.id === orderId);
  if (!order) return <OperationsShell {...shellProps}><Gate title="Transport Order not found" detail="This order reference does not exist within your current branch access." embedded/></OperationsShell>;

  const relatedTenders = tenders.kind === "ready" ? tenders.tenders.filter((item) => item.order_id === order.id) : [];
  const bookedTender = relatedTenders.find((item) => item.status === "booked") ?? null;
  const liveTender = relatedTenders.find((item) => ["sent", "accepted", "countered"].includes(item.status)) ?? null;

  return <OperationsShell {...shellProps}><TransportOrderDetail order={order} relatedTenders={relatedTenders} bookedTender={bookedTender} liveTender={liveTender}/></OperationsShell>;
}

function TransportOrderDetail({ order, relatedTenders, bookedTender, liveTender }: { order: TmsOrder; relatedTenders: TmsTender[]; bookedTender: TmsTender | null; liveTender: TmsTender | null }) {
  const next = nextAction(order, liveTender, bookedTender);
  return <main className="min-h-[calc(100vh-54px)] bg-[#f6f6f3] px-4 pb-12 pt-6 text-[#141414] sm:px-6 lg:px-7">
    <div className="mx-auto w-full max-w-[1152px]">
      <header className="border-b border-[#e2e2e2] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-[23px] font-semibold leading-[31px] tracking-[-.02em]">{order.id}</h1><span className={`inline-flex rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium ${statusClasses(order.status)}`}>{statusLabels[order.status]}</span></div><p className="mt-1 text-[14px] font-medium text-[#141414]">{order.origin} → {order.destination}</p><p className="mt-1 text-[12px] text-[#5b5b5b]">{order.customer_name || "Customer not linked"} · {order.branch} · {titleCase(order.mode)}</p><p className="mt-1 text-[11px] text-[#737373]">Created by {order.created_by_name || order.created_by_email} · Updated {dateTime(order.updated_at)}</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/admin/rating" className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Transport Orders</Link>{["draft", "rated"].includes(order.status) ? <Link href={`/admin/rating?view=rate-desk&order=${encodeURIComponent(order.id)}`} className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Rate order</Link> : null}{["selected", "tendering"].includes(order.status) ? <Link href={`/admin/tenders${liveTender ? `?tender=${encodeURIComponent(liveTender.tender_reference)}` : ""}`} className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Tender workspace</Link> : null}{bookedTender ? <Link href={`/admin/tenders/${encodeURIComponent(bookedTender.id)}`} className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Booking confirmation</Link> : null}</div>
        </div>
        <nav className="mt-5 flex h-9 items-end gap-5 overflow-x-auto text-[12px] font-medium"><span className="relative flex h-8 shrink-0 items-center text-[#141414]">Overview<span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#dc143c]"/></span><Link href={`/admin/rating?view=rate-desk&order=${encodeURIComponent(order.id)}`} className="flex h-8 shrink-0 items-center text-[#5b5b5b] hover:text-[#141414]">Rating</Link><Link href="/admin/tenders" className="flex h-8 shrink-0 items-center text-[#5b5b5b] hover:text-[#141414]">Tender</Link>{bookedTender ? <Link href={`/admin/tenders/${encodeURIComponent(bookedTender.id)}`} className="flex h-8 shrink-0 items-center text-[#5b5b5b] hover:text-[#141414]">Booking</Link> : <span className="flex h-8 shrink-0 items-center text-[#a0a0a0]">Booking</span>}</nav>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,800px)_351px]">
        <div className="min-w-0 lg:border-r lg:border-[#e2e2e2] lg:pr-7">
          <Section title="Movement"><Grid><Datum label="Origin" value={order.origin}/><Datum label="Destination" value={order.destination}/><Datum label="Mode" value={titleCase(order.mode)}/><Datum label="Pickup" value={dateTime(order.pickup_date)}/><Datum label="Delivery target" value={dateTime(order.delivery_date)}/><Datum label="Equipment" value={order.equipment || "Not set"}/></Grid></Section>
          <Section title="Cargo"><Grid><Datum label="Weight" value={`${order.weight_kg.toLocaleString()} kg`}/><Datum label="Volume" value={`${order.volume_cbm.toLocaleString()} CBM`}/><Datum label="Pieces" value={order.pieces.toLocaleString()}/><Datum label="Containers" value={order.container_count.toLocaleString()}/><Datum label="Temperature" value={order.temperature_requirement || "Not set"}/><Datum label="Carrier requirement" value={order.carrier_requirement || "Not set"}/></Grid></Section>
          <Section title="Procurement basis"><Grid><Datum label="Selected buy rate" value={money(order.selected_cost, order.selected_currency)}/><Datum label="Partner authority" value={order.selected_partner_id || "No Partner selected"}/><Datum label="Rate card" value={order.selected_rate_card_id || "Not locked"}/><Datum label="Order state" value={statusLabels[order.status]}/></Grid><p className="mt-4 text-[12px] leading-[19px] text-[#5b5b5b]">A selected Partner buy rate is procurement context only. Tender response and booking remain distinct authoritative steps.</p></Section>
          <Section title="Tender & booking lineage">
            {relatedTenders.length ? <div className="border-t border-[#e2e2e2]">{relatedTenders.map((tender) => <div key={tender.id} className="grid gap-2 border-b border-[#e2e2e2] py-3 sm:grid-cols-[150px_1fr_120px]"><div><Link href={`/admin/tenders?tender=${encodeURIComponent(tender.tender_reference)}`} className="text-[12px] font-semibold hover:underline">{tender.tender_reference}</Link><p className="mt-1 text-[11px] text-[#737373]">{tender.channel}</p></div><div><p className="text-[12px] font-medium">{tender.partner_name}</p><p className="mt-1 text-[11px] text-[#737373]">Offered {money(tender.offered_cost, tender.currency)} · due {dateTime(tender.response_due_at)}</p></div><div className="text-left sm:text-right"><p className="text-[12px] font-semibold">{titleCase(tender.status)}</p>{tender.status === "booked" ? <Link href={`/admin/tenders/${encodeURIComponent(tender.id)}`} className="mt-1 inline-block text-[11px] font-semibold text-[#dc143c]">Open booking</Link> : null}</div></div>)}</div> : <p className="text-[12px] text-[#737373]">No tender has been recorded for this transport order.</p>}
          </Section>
          {order.notes ? <Section title="Operational notes"><p className="whitespace-pre-wrap text-[13px] leading-6 text-[#5b5b5b]">{order.notes}</p></Section> : null}
        </div>

        <aside className="bg-white px-6 py-5 lg:min-h-[720px]">
          <p className="text-[11px] font-medium text-[#737373]">NEXT ACTION</p><h2 className="mt-1 text-[15px] font-semibold leading-[22px]">{next.title}</h2><p className="mt-1 text-[12px] leading-[19px] text-[#5b5b5b]">{next.detail}</p>
          <div className="mt-5 border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">OWNERSHIP</p><DetailRow label="Branch" value={order.branch}/><DetailRow label="Created by" value={order.created_by_name || order.created_by_email}/><DetailRow label="Customer" value={order.customer_name || "Not linked"}/></div>
          <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">CONNECTED RECORDS</p><DetailRow label="Tenders" value={relatedTenders.length.toString()}/><DetailRow label="Booking" value={bookedTender?.booking_reference || "Not confirmed"}/>{bookedTender?.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(bookedTender.shipment_reference)}`} className="mt-3 inline-flex text-[12px] font-semibold text-[#dc143c]">Open {bookedTender.shipment_reference} →</Link> : null}</div>
          <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">AUDIT FACTS</p><DetailRow label="Created" value={dateTime(order.created_at)}/><DetailRow label="Updated" value={dateTime(order.updated_at)}/></div>
        </aside>
      </div>
    </div>
  </main>;
}

function nextAction(order: TmsOrder, liveTender: TmsTender | null, bookedTender: TmsTender | null) {
  if (bookedTender) return { title: "Review booking execution handoff", detail: "Booking is confirmed. Open the booking confirmation to inspect shipment and Job File linkage." };
  if (liveTender) return { title: "Review tender response", detail: `${liveTender.tender_reference} is the current procurement activity for this order.` };
  if (order.status === "selected") return { title: "Create tender", detail: "A Partner rate is selected. The next authoritative step is tendering." };
  if (order.status === "draft" || order.status === "rated") return { title: "Complete rating", detail: "Compare compatible Partner buy rates and select the procurement basis before tendering." };
  return { title: "Review transport order", detail: "No additional authoritative transition is exposed from this record state." };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#e2e2e2] py-6"><h2 className="mb-4 text-[14px] font-semibold">{title}</h2>{children}</section>; }
function Grid({ children }: { children: React.ReactNode }) { return <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>; }
function Datum({ label, value }: { label: string; value: string }) { return <div><dt className="text-[11px] font-medium text-[#737373]">{label}</dt><dd className="mt-1 text-[13px] font-medium leading-[19px]">{value}</dd></div>; }
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-[88px_1fr] gap-3 py-[5px] text-[12px]"><span className="text-[#737373]">{label}</span><span className="break-words font-medium">{value}</span></div>; }
function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) { return <main className={`grid place-items-center bg-[#f6f6f3] p-6 text-[#141414] ${embedded ? "min-h-[calc(100vh-54px)]" : "min-h-screen"}`}><section className="w-full max-w-xl border-y border-[#e2e2e2] bg-white p-8"><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#dc143c]">KCPL Transport Order</p><h1 className="mt-3 text-[22px] font-semibold">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#5b5b5b]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/rating" className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Transport Orders</Link><Link href="/admin/command-centre" className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Operations</Link></div></section></main>; }
