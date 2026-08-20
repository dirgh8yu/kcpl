import { ArrowRight, CalendarDays, Clock3, MapPin, Search, Truck } from "lucide-react";
import { Container } from "../components/container";
import { PageShell } from "../components/page-shell";
import { company } from "../company-data";
import { createPageMetadata } from "../seo";
import { shipmentStatusLabels, type PublicShipmentTracking, type ShipmentStatus } from "../shipment-types";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Shipment Tracking",
  description: "Track a KCPL shipment using the shipment reference provided by the operations team.",
  path: "/tracking",
});

const modeLabels: Record<string, string> = {
  air: "Air freight",
  sea: "Sea freight",
  road: "Road freight",
  unsure: "Freight movement",
};

const statusStyles: Record<ShipmentStatus, string> = {
  booking_confirmed: "border-sky-200 bg-sky-50 text-sky-700",
  preparing: "border-amber-200 bg-amber-50 text-amber-800",
  in_transit: "border-indigo-200 bg-indigo-50 text-indigo-700",
  customs_clearance: "border-violet-200 bg-violet-50 text-violet-700",
  out_for_delivery: "border-cyan-200 bg-cyan-50 text-cyan-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  exception: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

async function loadTracking(reference: string) {
  try {
    const { getPublicShipmentTracking } = await import("../shipment-data.server");
    return await getPublicShipmentTracking(reference);
  } catch (error) {
    console.error("Failed to load KCPL public shipment tracking", error);
    return undefined;
  }
}

export default async function TrackingPage({
  searchParams,
}: {
  searchParams?: Promise<{ reference?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const reference = (params.reference ?? "").trim().toUpperCase().slice(0, 80);
  const tracking = reference ? await loadTracking(reference) : null;

  return <PageShell eyebrow="Shipment tracking" title="Follow your shipment journey." intro="Enter the KCPL shipment reference provided by our operations team to see the latest customer-safe movement updates.">
    <section className="section bg-offwhite">
      <Container>
        <div className="mx-auto max-w-5xl">
          <form action="/tracking" method="get" className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(8,35,63,.08)] sm:p-7">
            <label htmlFor="shipment-reference" className="text-xs font-black uppercase tracking-[.16em] text-gold">KCPL shipment reference</label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate" size={18}/><input id="shipment-reference" name="reference" defaultValue={reference} required autoComplete="off" placeholder="KCPL-S-20260820-XXXXXXXXXXXX" className="min-h-14 w-full border border-black/10 bg-offwhite pl-12 pr-4 text-sm font-bold uppercase tracking-[.04em] text-navy outline-none focus:border-gold"/></div>
              <button type="submit" className="min-h-14 bg-navy px-7 text-xs font-bold uppercase tracking-[.15em] text-white">Track shipment</button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate">The tracking portal never displays customer contact details, internal costs or private KCPL notes.</p>
          </form>

          {!reference && <div className="mt-8 grid gap-5 md:grid-cols-3">
            <TrackIntro icon={<Truck size={20}/>} title="One KCPL reference" text="Use the shipment reference issued after your freight booking is confirmed."/>
            <TrackIntro icon={<MapPin size={20}/>} title="Movement updates" text="See the latest location and customer-safe milestones published by KCPL operations."/>
            <TrackIntro icon={<CalendarDays size={20}/>} title="ETA visibility" text="When an estimated arrival date is available, it appears alongside the current shipment stage."/>
          </div>}

          {reference && tracking === null && <div className="mt-8 rounded-3xl border border-black/8 bg-white p-8 text-center sm:p-10"><p className="text-xs font-black uppercase tracking-[.16em] text-gold">Reference not found</p><h2 className="mt-3 text-2xl font-extrabold tracking-[-.03em] text-navy">We could not find that shipment.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate">Check the reference exactly as provided by KCPL. If the booking was only just confirmed, contact operations and we can verify the shipment record.</p><a href={`mailto:${company.email}?subject=${encodeURIComponent(`KCPL tracking help: ${reference}`)}`} className="mt-6 inline-flex min-h-12 items-center justify-center bg-navy px-6 text-xs font-bold uppercase tracking-[.14em] text-white">Contact operations</a></div>}

          {reference && tracking === undefined && <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center"><h2 className="text-xl font-extrabold text-navy">Tracking is temporarily unavailable.</h2><p className="mt-2 text-sm leading-6 text-slate">Your shipment data has not been exposed. Please contact KCPL operations for the latest update.</p></div>}

          {tracking && <TrackingResult tracking={tracking}/>} 
        </div>
      </Container>
    </section>
  </PageShell>;
}

function TrackingResult({ tracking }: { tracking: PublicShipmentTracking }) {
  return <div className="mt-8 space-y-6">
    <article className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-[0_20px_60px_rgba(8,35,63,.08)]">
      <div className="bg-navy p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-gold">{tracking.reference}</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{tracking.origin} <span className="text-gold">→</span> {tracking.destination}</h2><p className="mt-2 text-sm text-white/60">{modeLabels[tracking.mode] ?? tracking.mode}</p></div><span className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[.11em] ${statusStyles[tracking.status]}`}>{shipmentStatusLabels[tracking.status]}</span></div>
      </div>
      <div className="grid gap-px bg-black/8 sm:grid-cols-3">
        <TrackStat icon={<MapPin size={18}/>} label="Current location" value={tracking.current_location || "Update pending"}/>
        <TrackStat icon={<CalendarDays size={18}/>} label="Estimated arrival" value={tracking.eta ? formatDateOnly(tracking.eta) : "Not confirmed"}/>
        <TrackStat icon={<Truck size={18}/>} label="Carrier reference" value={tracking.carrier_reference || tracking.carrier || "Coordinated by KCPL"}/>
      </div>
      {tracking.customer_note && <div className="border-t border-black/8 p-6 sm:p-8"><p className="text-[10px] font-black uppercase tracking-[.14em] text-gold">Latest operations note</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate">{tracking.customer_note}</p></div>}
    </article>

    <article className="rounded-3xl border border-black/8 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-gold">Shipment timeline</p><h3 className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-navy">Latest movement events</h3></div><p className="text-xs font-semibold text-slate">Updated {formatDate(tracking.updated_at)}</p></div>
      <div className="mt-7 space-y-5">
        {tracking.events.length === 0 && <p className="text-sm text-slate">No public tracking events have been published yet.</p>}
        {tracking.events.map((event, index) => <div key={event.id} className="relative pl-9"><span className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ${index === 0 ? "bg-gold" : "bg-navy/25"}`}/>{index < tracking.events.length - 1 && <span className="absolute left-[6px] top-6 h-[calc(100%+8px)] w-px bg-black/10"/>}<div><div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-extrabold text-navy">{event.title}</h4><p className="flex items-center gap-1.5 text-xs font-semibold text-slate"><Clock3 size={12}/>{formatDate(event.event_time)}</p></div>{event.location && <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-gold"><MapPin size={12}/>{event.location}</p>}{event.details && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate">{event.details}</p>}</div></div>)}
      </div>
    </article>

    <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-[#efe8dc] p-6 sm:flex-row sm:items-center sm:p-8"><div><p className="text-xs font-black uppercase tracking-[.14em] text-gold">Need help?</p><p className="mt-2 text-sm leading-6 text-slate">KCPL operations can clarify shipment milestones or documentation requirements.</p></div><a href={`mailto:${company.email}?subject=${encodeURIComponent(`KCPL shipment ${tracking.reference}`)}`} className="inline-flex min-h-12 items-center gap-2 bg-navy px-6 text-xs font-bold uppercase tracking-[.14em] text-white">Contact KCPL <ArrowRight size={15}/></a></div>
  </div>;
}

function TrackStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="bg-white p-6"><div className="text-gold">{icon}</div><p className="mt-3 text-[10px] font-black uppercase tracking-[.14em] text-slate">{label}</p><p className="mt-2 text-sm font-extrabold text-navy">{value}</p></div>;
}

function TrackIntro({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-3xl border border-black/8 bg-white p-6"><div className="text-gold">{icon}</div><h2 className="mt-4 text-lg font-extrabold text-navy">{title}</h2><p className="mt-2 text-sm leading-6 text-slate">{text}</p></div>;
}
