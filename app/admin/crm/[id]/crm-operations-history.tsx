import { ArrowRight, CalendarDays, CircleDollarSign, MapPin, PackageCheck, Plane, Ship, Truck } from "lucide-react";
import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types";
import type { CrmOperationsHistory, CrmQuoteHistoryItem, CrmShipmentHistoryItem } from "../crm-operations-history.server";

const quoteStatusLabels: Record<string, string> = {
  new: "New",
  reviewing: "Pending",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

const quoteStatusStyles: Record<string, string> = {
  new: "border-sky-200 bg-sky-50 text-sky-700",
  reviewing: "border-amber-200 bg-amber-50 text-amber-800",
  quoted: "border-violet-200 bg-violet-50 text-violet-700",
  won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  lost: "border-rose-200 bg-rose-50 text-rose-700",
};

const shipmentStatusStyles: Record<ShipmentStatus, string> = {
  booking_confirmed: "border-sky-200 bg-sky-50 text-sky-700",
  preparing: "border-indigo-200 bg-indigo-50 text-indigo-700",
  in_transit: "border-violet-200 bg-violet-50 text-violet-700",
  customs_clearance: "border-amber-200 bg-amber-50 text-amber-800",
  out_for_delivery: "border-cyan-200 bg-cyan-50 text-cyan-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  exception: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: string | null, currency: string) {
  if (!value) return "Not priced";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 3 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-AU")}`;
  }
}

function ModeIcon({ mode }: { mode: string }) {
  if (mode === "air") return <Plane size={14} />;
  if (mode === "sea") return <Ship size={14} />;
  return <Truck size={14} />;
}

export function CrmOperationsHistoryPanel({ history, showCommercial }: { history: CrmOperationsHistory; showCommercial: boolean }) {
  const hasHistory = history.quotes.length > 0 || history.shipments.length > 0;
  return (
    <section className="bg-[#f4f1e9] px-5 pb-14 lg:px-8">
      <div className="mx-auto max-w-[1500px] rounded-[28px] border border-black/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 p-6 sm:p-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.19em] text-[#b78a3e]">Customer journey</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-[#10263f]">Quotes & shipments</h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-black/45">The commercial and operational history tied to this CRM account. Confirmed quote ownership now flows into shipment ownership automatically.</p>
          </div>
          <div className="flex gap-2 text-xs font-black text-black/45">
            <span className="rounded-full bg-[#f4f1e9] px-3 py-2">{history.quotes.length} quotes</span>
            <span className="rounded-full bg-[#f4f1e9] px-3 py-2">{history.shipments.length} shipments</span>
          </div>
        </div>

        {!hasHistory ? (
          <div className="p-10 text-center text-sm text-black/45">No confirmed quote or shipment history yet. Confirm an enquiry match and it will appear here.</div>
        ) : (
          <div className="grid gap-0 xl:grid-cols-2">
            <div className="p-6 sm:p-8 xl:border-r xl:border-black/10">
              <div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CircleDollarSign size={17} className="text-[#b78a3e]"/><h3 className="text-sm font-black">Quote history</h3></div><span className="text-[10px] font-bold text-black/35">Newest first</span></div>
              <div className="space-y-3">
                {history.quotes.map((quote) => <QuoteHistoryRow key={quote.reference} quote={quote} showCommercial={showCommercial} />)}
              </div>
            </div>

            <div className="border-t border-black/10 p-6 sm:p-8 xl:border-t-0">
              <div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><PackageCheck size={17} className="text-[#b78a3e]"/><h3 className="text-sm font-black">Shipment history</h3></div><span className="text-[10px] font-bold text-black/35">Live operational records</span></div>
              <div className="space-y-3">
                {history.shipments.length ? history.shipments.map((shipment) => <ShipmentHistoryRow key={shipment.reference} shipment={shipment} />) : <div className="rounded-2xl border border-dashed border-black/10 p-6 text-xs text-black/40">No shipments have been created for this customer yet.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function QuoteHistoryRow({ quote, showCommercial }: { quote: CrmQuoteHistoryItem; showCommercial: boolean }) {
  const style = quoteStatusStyles[quote.status] ?? "border-black/10 bg-stone-50 text-stone-600";
  return (
    <article className="rounded-2xl border border-black/10 bg-[#faf9f5] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><strong className="text-xs text-[#10263f]">{quote.reference}</strong><div className="mt-2 flex items-center gap-2 text-xs font-bold text-black/55"><ModeIcon mode={quote.mode}/><span>{quote.origin}</span><ArrowRight size={12}/><span>{quote.destination}</span></div></div>
        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.09em] ${style}`}>{quoteStatusLabels[quote.status] ?? quote.status}</span>
      </div>
      <div className={`mt-4 grid gap-3 border-t border-black/10 pt-3 text-[10px] ${showCommercial ? "grid-cols-2" : "grid-cols-1"}`}>
        {showCommercial ? <div><p className="font-black uppercase tracking-[.1em] text-black/30">Quote value</p><p className="mt-1 font-bold text-black/65">{formatMoney(quote.quoted_amount, quote.currency)}</p></div> : null}
        <div><p className="font-black uppercase tracking-[.1em] text-black/30">Updated</p><p className="mt-1 font-bold text-black/65">{formatDate(quote.updated_at || quote.created_at)}</p></div>
      </div>
      {quote.shipment_reference ? <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[10px] font-bold text-black/50">Shipment: <span className="text-[#10263f]">{quote.shipment_reference}</span></p> : null}
    </article>
  );
}

function ShipmentHistoryRow({ shipment }: { shipment: CrmShipmentHistoryItem }) {
  return (
    <article className="rounded-2xl border border-black/10 bg-[#faf9f5] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><strong className="text-xs text-[#10263f]">{shipment.reference}</strong><p className="mt-1 text-[10px] font-bold text-black/35">From {shipment.quote_reference}</p></div>
        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] ${shipmentStatusStyles[shipment.status]}`}>{shipmentStatusLabels[shipment.status]}</span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-black/55"><ModeIcon mode={shipment.mode}/><span>{shipment.origin || "Origin"}</span><ArrowRight size={12}/><span>{shipment.destination || "Destination"}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/10 pt-3 text-[10px]">
        <div><p className="flex items-center gap-1 font-black uppercase tracking-[.1em] text-black/30"><MapPin size={10}/>Current</p><p className="mt-1 font-bold text-black/65">{shipment.current_location || "Not updated"}</p></div>
        <div><p className="flex items-center gap-1 font-black uppercase tracking-[.1em] text-black/30"><CalendarDays size={10}/>ETA</p><p className="mt-1 font-bold text-black/65">{formatDate(shipment.eta)}</p></div>
        <div><p className="font-black uppercase tracking-[.1em] text-black/30">Carrier</p><p className="mt-1 font-bold text-black/65">{shipment.carrier || "Not assigned"}</p></div>
        <div><p className="font-black uppercase tracking-[.1em] text-black/30">Carrier ref</p><p className="mt-1 font-bold text-black/65">{shipment.carrier_reference || "Not assigned"}</p></div>
      </div>
    </article>
  );
}
