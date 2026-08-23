import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { listTmsOrders } from "../../rating/tms-rating.server";
import type { TmsOrder } from "../../rating/tms-rating";
import { getStaffContext } from "../../staff-directory.server";
import { listTmsTenders } from "../tms-tendering.server";
import type { TmsTender } from "../tms-tendering";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking Confirmation | KCPL Operations", robots: { index: false, follow: false } };

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
  if (tenders.kind !== "ready" || orders.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Booking unavailable" detail="KCPL booking or transport-order storage is temporarily unavailable." embedded/></OperationsShell>;

  const tender = tenders.tenders.find((item) => item.id.toUpperCase() === tenderKey || item.tender_reference.toUpperCase() === tenderKey);
  if (!tender) return <OperationsShell {...shellProps}><Gate title="Tender not found" detail="This tender reference does not exist within your current branch access." embedded/></OperationsShell>;
  const order = orders.orders.find((item) => item.id === tender.order_id) ?? null;

  if (tender.status !== "booked") return <OperationsShell {...shellProps}><NotBooked tender={tender}/></OperationsShell>;
  return <OperationsShell {...shellProps}><BookingConfirmation tender={tender} order={order}/></OperationsShell>;
}

function BookingConfirmation({ tender, order }: { tender: TmsTender; order: TmsOrder | null }) {
  const bookedAmount = tender.final_cost !== null && tender.final_currency ? money(tender.final_cost, tender.final_currency) : tender.counter_cost !== null && tender.counter_currency ? money(tender.counter_cost, tender.counter_currency) : money(tender.offered_cost, tender.currency);
  const commercialBasis = tender.counter_cost !== null ? "Accepted counter-offer" : "Accepted tender offer";

  return <main className="min-h-[calc(100vh-54px)] bg-[#f6f6f3] px-4 pb-12 pt-6 text-[#141414] sm:px-6 lg:px-7">
    <div className="mx-auto w-full max-w-[1152px]">
      <header className="border-b border-[#e2e2e2] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-[23px] font-semibold leading-[31px] tracking-[-.02em]">{tender.booking_reference || "Booking confirmed"}</h1><span className="inline-flex rounded-[5px] bg-[#edf8f2] px-[7px] py-[3px] text-[11px] font-medium text-[#18794e]">Booked</span></div><p className="mt-1 text-[14px] font-medium">{tender.origin} → {tender.destination}</p><p className="mt-1 text-[12px] text-[#5b5b5b]">{order?.customer_name || "Customer not linked"} · {tender.partner_name} · {titleCase(tender.mode)}</p><p className="mt-1 text-[11px] text-[#737373]">{tender.tender_reference} · {tender.order_id} · Booked {dateTime(tender.booked_at)}</p></div>
          <div className="flex flex-wrap gap-2"><Link href={`/admin/tenders?tender=${encodeURIComponent(tender.tender_reference)}`} className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Tender workspace</Link>{tender.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(tender.shipment_reference)}`} className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Open shipment</Link> : null}</div>
        </div>
        <nav className="mt-5 flex h-9 items-end gap-5 overflow-x-auto text-[12px] font-medium"><span className="relative flex h-8 shrink-0 items-center text-[#141414]">Overview<span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#dc143c]"/></span><Link href={`/admin/rating/${encodeURIComponent(tender.order_id)}`} className="flex h-8 shrink-0 items-center text-[#5b5b5b] hover:text-[#141414]">Transport Order</Link><Link href={`/admin/tenders?tender=${encodeURIComponent(tender.tender_reference)}`} className="flex h-8 shrink-0 items-center text-[#5b5b5b] hover:text-[#141414]">Tender</Link>{tender.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(tender.shipment_reference)}`} className="flex h-8 shrink-0 items-center text-[#5b5b5b] hover:text-[#141414]">Shipment / Job File</Link> : null}</nav>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,800px)_351px]">
        <div className="min-w-0 lg:border-r lg:border-[#e2e2e2] lg:pr-7">
          <Section title="Booking basis"><Grid><Datum label="Originating order" value={tender.order_id}/><Datum label="Accepted tender" value={tender.tender_reference}/><Datum label="Partner / carrier" value={tender.partner_name}/><Datum label="Commercial outcome" value={commercialBasis}/><Datum label="Agreed procurement" value={bookedAmount}/><Datum label="Rate card snapshot" value={tender.rate_card_id}/></Grid><p className="mt-4 text-[12px] leading-[19px] text-[#5b5b5b]">Booking was requested from the accepted tender outcome. Later editable Partner rates do not replace this recorded procurement basis.</p></Section>

          <Section title="Execution handoff">
            <div className="border-y border-[#e2e2e2] bg-white">
              <ConnectedRow label="Booking confirmed" value={tender.booking_reference || "Confirmed"} meta={dateTime(tender.booked_at)} state="complete"/>
              <ConnectedRow label="Shipment created" value={tender.shipment_reference || "Not linked"} meta={tender.shipment_reference ? "Execution record created by the booking workflow" : "No shipment reference is exposed on this booking"} state={tender.shipment_reference ? "complete" : "pending"}/>
              <ConnectedRow label="Digital Job File" value={tender.shipment_reference || "Not linked"} meta={tender.shipment_reference ? "Opened with the shipment execution record" : "No Job File reference is exposed"} state={tender.shipment_reference ? "complete" : "pending"}/>
            </div>
          </Section>

          <Section title="Booking details"><Grid><Datum label="Partner booking reference" value={tender.booking_reference || "Not recorded"}/><Datum label="Pickup confirmation" value={tender.pickup_confirmation || "Not recorded"}/><Datum label="Mode" value={titleCase(tender.mode)}/><Datum label="Service" value={tender.service || "Not specified"}/><Datum label="Equipment" value={tender.equipment || order?.equipment || "Not specified"}/><Datum label="Planned pickup" value={shortDate(tender.pickup_date || order?.pickup_date || null)}/></Grid></Section>

          {order ? <Section title="Cargo"><Grid><Datum label="Weight" value={`${order.weight_kg.toLocaleString()} kg`}/><Datum label="Volume" value={`${order.volume_cbm.toLocaleString()} CBM`}/><Datum label="Pieces" value={order.pieces.toLocaleString()}/><Datum label="Containers" value={order.container_count.toLocaleString()}/></Grid></Section> : null}

          <Section title="Partner response"><Grid><Datum label="Channel" value={tender.channel}/><Datum label="Sent" value={dateTime(tender.sent_at)}/><Datum label="Responded" value={dateTime(tender.responded_at)}/><Datum label="Response deadline" value={dateTime(tender.response_due_at)}/></Grid>{tender.response_note ? <p className="mt-4 whitespace-pre-wrap text-[12px] leading-[19px] text-[#5b5b5b]">{tender.response_note}</p> : null}</Section>
        </div>

        <aside className="bg-white px-6 py-5 lg:min-h-[720px]">
          <p className="text-[11px] font-medium text-[#737373]">NEXT ACTION</p><h2 className="mt-1 text-[15px] font-semibold leading-[22px]">Move booking into execution</h2><p className="mt-1 text-[12px] leading-[19px] text-[#5b5b5b]">The commercial handoff is complete. Continue through the linked shipment, pickup and Job File rather than mutating booking authority here.</p>
          <div className="mt-5 border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">OWNERSHIP</p><DetailRow label="Branch" value={order?.branch || "Not exposed"}/><DetailRow label="Created by" value={tender.created_by_name || tender.created_by_email}/><DetailRow label="Customer" value={order?.customer_name || "Not linked"}/></div>
          <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">LINKED RECORDS</p><LinkRow label="Transport Order" value={tender.order_id} href={`/admin/rating/${encodeURIComponent(tender.order_id)}`}/><LinkRow label="Tender" value={tender.tender_reference} href={`/admin/tenders?tender=${encodeURIComponent(tender.tender_reference)}`}/>{tender.shipment_reference ? <LinkRow label="Shipment / Job File" value={tender.shipment_reference} href={`/admin/jobs/${encodeURIComponent(tender.shipment_reference)}`}/> : <DetailRow label="Shipment" value="Not linked"/>}</div>
          <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">EXECUTION</p>{tender.shipment_reference ? <div className="mt-3 flex flex-col gap-2"><Link href={`/admin/jobs/${encodeURIComponent(tender.shipment_reference)}`} className="inline-flex h-8 items-center justify-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Open shipment</Link><Link href={`/admin/pickups?shipment=${encodeURIComponent(tender.shipment_reference)}`} className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Open pickup workflow</Link></div> : <p className="mt-2 text-[12px] leading-[19px] text-[#5b5b5b]">No shipment reference is currently available from the booking record.</p>}</div>
          <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">AUDIT FACTS</p><DetailRow label="Booked" value={dateTime(tender.booked_at)}/><DetailRow label="Updated" value={dateTime(tender.updated_at)}/></div>
        </aside>
      </div>
    </div>
  </main>;
}

function NotBooked({ tender }: { tender: TmsTender }) {
  return <main className="min-h-[calc(100vh-54px)] bg-[#f6f6f3] px-4 py-8 text-[#141414] sm:px-6 lg:px-7"><div className="mx-auto max-w-[900px] border-y border-[#e2e2e2] bg-white px-6 py-8"><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#737373]">{tender.tender_reference}</p><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-semibold">Booking not confirmed</h1><span className="rounded-[5px] bg-[#fff7e6] px-[7px] py-[3px] text-[11px] font-medium text-[#945b00]">{titleCase(tender.status)}</span></div><p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#5b5b5b]">This tender has not produced an authoritative booking. Only an accepted or valid counter-offer can request booking, and the server decides whether that transition is valid.</p><div className="mt-6 flex gap-2"><Link href={`/admin/tenders?tender=${encodeURIComponent(tender.tender_reference)}`} className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Return to tender</Link><Link href={`/admin/rating/${encodeURIComponent(tender.order_id)}`} className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Transport Order</Link></div></div></main>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#e2e2e2] py-6"><h2 className="mb-4 text-[14px] font-semibold">{title}</h2>{children}</section>; }
function Grid({ children }: { children: React.ReactNode }) { return <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>; }
function Datum({ label, value }: { label: string; value: string }) { return <div><dt className="text-[11px] font-medium text-[#737373]">{label}</dt><dd className="mt-1 break-words text-[13px] font-medium leading-[19px]">{value}</dd></div>; }
function ConnectedRow({ label, value, meta, state }: { label: string; value: string; meta: string; state: "complete" | "pending" }) { return <div className="grid gap-2 border-b border-[#e2e2e2] px-4 py-3 last:border-b-0 sm:grid-cols-[150px_1fr_auto]"><p className="text-[12px] font-medium text-[#5b5b5b]">{label}</p><div><p className="text-[13px] font-semibold">{value}</p><p className="mt-0.5 text-[11px] text-[#737373]">{meta}</p></div><span className={`self-start rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium ${state === "complete" ? "bg-[#edf8f2] text-[#18794e]" : "bg-[#fff7e6] text-[#945b00]"}`}>{state === "complete" ? "Created" : "Pending"}</span></div>; }
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-[88px_1fr] gap-3 py-[5px] text-[12px]"><span className="text-[#737373]">{label}</span><span className="break-words font-medium">{value}</span></div>; }
function LinkRow({ label, value, href }: { label: string; value: string; href: string }) { return <div className="grid grid-cols-[88px_1fr] gap-3 py-[5px] text-[12px]"><span className="text-[#737373]">{label}</span><Link href={href} className="break-words font-semibold text-[#141414] hover:text-[#dc143c]">{value}</Link></div>; }
function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) { return <main className={`grid place-items-center bg-[#f6f6f3] p-6 text-[#141414] ${embedded ? "min-h-[calc(100vh-54px)]" : "min-h-screen"}`}><section className="w-full max-w-xl border-y border-[#e2e2e2] bg-white p-8"><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#dc143c]">KCPL Booking</p><h1 className="mt-3 text-[22px] font-semibold">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#5b5b5b]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/tenders" className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Tender Workspace</Link><Link href="/admin/rating" className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Transport Orders</Link></div></section></main>; }
