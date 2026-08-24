"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { crmCurrencies, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import type { TmsOrder } from "../rating/tms-rating";
import {
  tenderCanBook,
  tenderCanCancel,
  tenderIsActive,
  tmsTenderStatusLabels,
  type TmsTender,
  type TmsTenderChannel,
  type TmsTenderStatus,
} from "./tms-tendering";

type CustomerOption = { id: string; name: string; branch: KcplBranch };
type ApiResponse = {
  ok: boolean;
  error?: string;
  tenders?: TmsTender[];
  tender?: TmsTender;
  orders?: TmsOrder[];
  customerId?: string;
  customerName?: string;
  shipmentReference?: string;
  emailSent?: boolean;
};

type StatusFilter = "active" | "all" | TmsTenderStatus;

const tabs = [
  { label: "Orders", href: "/admin/rating" },
  { label: "Tenders", href: "/admin/tenders", active: true },
  { label: "Bookings", href: "/admin/tenders?state=booked" },
  { label: "Pickups", href: "/admin/pickups" },
  { label: "Shipments", href: "/admin/shipments" },
  { label: "Consolidations", href: "/admin/consolidation" },
];

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return "Not set";
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function shortDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: value.length === 10 ? "UTC" : "Asia/Kathmandu" }).format(date);
}

function statusClasses(status: TmsTenderStatus) {
  if (status === "accepted" || status === "booked") return "bg-[#edf8f2] text-[#18794e]";
  if (status === "sent") return "bg-[#eef5ff] text-[#2563a6]";
  if (status === "countered") return "bg-[#fff7e6] text-[#945b00]";
  if (status === "rejected" || status === "cancelled" || status === "expired") return "bg-[#f7f7f7] text-[#737373]";
  return "bg-[#f7f7f7] text-[#5b5b5b]";
}

function localDeadlineDefault() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function finalCommercial(tender: TmsTender) {
  if (tender.status === "booked" && tender.final_cost !== null && tender.final_currency) return money(tender.final_cost, tender.final_currency);
  if (tender.status === "countered" && tender.counter_cost !== null && tender.counter_currency) return money(tender.counter_cost, tender.counter_currency);
  return money(tender.offered_cost, tender.currency);
}

export function V4TenderWorkspace({ initialOrders, initialTenders, customers, canManage }: {
  initialOrders: TmsOrder[];
  initialTenders: TmsTender[];
  customers: CustomerOption[];
  canManage: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [tenders, setTenders] = useState(initialTenders);
  const firstTender = initialTenders[0] ?? null;
  const firstOrder = firstTender ? initialOrders.find((order) => order.id === firstTender.order_id) : initialOrders.find((order) => ["selected", "tendering"].includes(order.status)) ?? initialOrders[0];
  const [selectedTenderId, setSelectedTenderId] = useState(firstTender?.id ?? "");
  const [selectedOrderId, setSelectedOrderId] = useState(firstOrder?.id ?? "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [channelFilter, setChannelFilter] = useState<"all" | TmsTenderChannel>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [customerId, setCustomerId] = useState(firstOrder?.customer_id ?? "");
  const [channel, setChannel] = useState<TmsTenderChannel>("manual");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [responseDueAt, setResponseDueAt] = useState(localDeadlineDefault());
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterCost, setCounterCost] = useState("");
  const [counterCurrency, setCounterCurrency] = useState<CrmCurrency>("NPR");
  const [responseNote, setResponseNote] = useState("");
  const [bookingFor, setBookingFor] = useState<string | null>(null);
  const [bookingReference, setBookingReference] = useState("");
  const [pickupConfirmation, setPickupConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) ?? null, [orders, selectedOrderId]);
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return tenders.filter((tender) => {
      if (status === "active" && !tenderIsActive(tender.status)) return false;
      if (status !== "active" && status !== "all" && tender.status !== status) return false;
      if (channelFilter !== "all" && tender.channel !== channelFilter) return false;
      if (!terms.length) return true;
      const order = orders.find((item) => item.id === tender.order_id);
      const haystack = [tender.tender_reference, tender.order_id, tender.partner_name, tender.origin, tender.destination, tender.channel, tmsTenderStatusLabels[tender.status], order?.customer_name ?? ""].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }, [channelFilter, orders, query, status, tenders]);

  const selected = tenders.find((tender) => tender.id === selectedTenderId) ?? filtered[0] ?? null;
  const selectedTenderOrder = selected ? orders.find((order) => order.id === selected.order_id) ?? null : null;
  const awaiting = tenders.filter((tender) => tender.status === "sent").length;
  const accepted = tenders.filter((tender) => tender.status === "accepted" || tender.status === "countered").length;
  const expired = tenders.filter((tender) => tender.status === "expired").length;
  const booked = tenders.filter((tender) => tender.status === "booked").length;

  function chooseOrder(id: string) {
    const order = orders.find((item) => item.id === id);
    setSelectedOrderId(id);
    setCustomerId(order?.customer_id ?? "");
    setNotice(null);
  }

  async function refresh() {
    setBusy(true);
    setNotice(null);
    try {
      const [orderResponse, tenderResponse] = await Promise.all([
        fetch("/api/admin/rating", { cache: "no-store" }),
        fetch("/api/admin/tenders", { cache: "no-store" }),
      ]);
      const orderData = await orderResponse.json() as ApiResponse;
      const tenderData = await tenderResponse.json() as ApiResponse;
      if (!orderResponse.ok || !orderData.ok || !orderData.orders) throw new Error(orderData.error || "Orders could not be refreshed.");
      if (!tenderResponse.ok || !tenderData.ok || !tenderData.tenders) throw new Error(tenderData.error || "Tenders could not be refreshed.");
      setOrders(orderData.orders);
      setTenders(tenderData.tenders);
      setNotice({ tone: "success", text: "Tender Workspace refreshed." });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tender Workspace could not be refreshed." });
    } finally {
      setBusy(false);
    }
  }

  async function linkCustomer() {
    if (!selectedOrder || !customerId) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/tenders/customer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: selectedOrder.id, customerId }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.customerId || !data.customerName) throw new Error(data.error || "Customer could not be linked.");
      setOrders((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, customer_id: data.customerId!, customer_name: data.customerName! } : order));
      setNotice({ tone: "success", text: `${data.customerName} linked to ${selectedOrder.id}.` });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Customer could not be linked." });
    } finally { setBusy(false); }
  }

  async function createTender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder) return;
    if (!selectedOrder.customer_id) {
      setNotice({ tone: "warning", text: "Link a KCPL customer before tendering so a confirmed booking can open the correct execution record." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/tenders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", orderId: selectedOrder.id, channel, recipientName, recipientEmail, responseDueAt: new Date(responseDueAt).toISOString() }),
      });
      const data = await response.json() as ApiResponse;
      if (data.tender) {
        setTenders((current) => [data.tender!, ...current.filter((item) => item.id !== data.tender!.id)]);
        setOrders((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, status: "tendering" } : order));
        setSelectedTenderId(data.tender.id);
      }
      if (!response.ok || !data.ok || !data.tender) throw new Error(data.error || "Tender could not be created.");
      setRecipientName("");
      setRecipientEmail("");
      setResponseDueAt(localDeadlineDefault());
      setShowCreate(false);
      setNotice({ tone: "success", text: data.emailSent ? `${data.tender.tender_reference} created and sent by email.` : `${data.tender.tender_reference} created for manual dispatch.` });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tender could not be created." });
    } finally { setBusy(false); }
  }

  async function respond(tender: TmsTender, nextStatus: "accepted" | "rejected" | "countered") {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "respond", tenderId: tender.id, status: nextStatus, note: responseNote, counterCost: nextStatus === "countered" ? Number(counterCost) : null, counterCurrency: nextStatus === "countered" ? counterCurrency : null }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.tender) throw new Error(data.error || "Tender response could not be recorded.");
      setTenders((current) => current.map((item) => item.id === tender.id ? data.tender! : item));
      if (nextStatus === "rejected") setOrders((current) => current.map((order) => order.id === tender.order_id ? { ...order, status: "selected" } : order));
      setCounterFor(null);
      setCounterCost("");
      setResponseNote("");
      setNotice({ tone: "success", text: nextStatus === "countered" ? "Counter-offer recorded in the tender audit trail." : `Tender marked ${nextStatus}.` });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tender response could not be recorded." });
    } finally { setBusy(false); }
  }

  async function cancel(tender: TmsTender) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel", tenderId: tender.id, note: responseNote }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tender could not be cancelled.");
      setTenders((current) => current.map((item) => item.id === tender.id ? { ...item, status: "cancelled", response_note: responseNote || null } : item));
      setOrders((current) => current.map((order) => order.id === tender.order_id ? { ...order, status: "selected" } : order));
      setResponseNote("");
      setNotice({ tone: "success", text: "Tender cancelled. The order is available for re-tendering." });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tender could not be cancelled." });
    } finally { setBusy(false); }
  }

  async function book(tender: TmsTender) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "book", tenderId: tender.id, bookingReference, pickupConfirmation }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.shipmentReference) throw new Error(data.error || "Booking could not be confirmed.");
      window.location.assign(`/admin/tenders/${encodeURIComponent(tender.id)}`);
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Booking could not be confirmed." });
      setBusy(false);
    }
  }

  return <main className="min-h-[calc(100vh-54px)] bg-[#f6f6f3] px-4 pb-10 pt-6 text-[#141414] sm:px-6 lg:px-7">
    <div className="mx-auto w-full max-w-[1152px]">
      <header className="flex min-h-[60px] flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-[22px] font-semibold leading-[30px]">Tender Workspace</h1><p className="mt-[3px] text-[13px] leading-[19px] text-[#5b5b5b]">{awaiting} awaiting response · {accepted} accepted / countered · {expired} expired · {booked} booked</p></div>
        <div className="flex gap-2"><button type="button" onClick={refresh} disabled={busy} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold disabled:opacity-50">Refresh</button>{canManage ? <button type="button" onClick={() => setShowCreate((value) => !value)} className="h-8 rounded-[6px] bg-[#dc143c] px-4 text-[12px] font-semibold text-white">Create tender</button> : null}</div>
      </header>

      <nav className="flex h-11 items-center gap-5 overflow-x-auto border-b border-[#e2e2e2]" aria-label="Operations workflow">{tabs.map((tab) => <Link key={tab.label} href={tab.href} className={`relative flex h-10 shrink-0 items-center justify-center px-2 text-[13px] font-medium ${tab.active ? "text-[#141414]" : "text-[#5b5b5b] hover:text-[#141414]"}`}>{tab.label}{tab.active ? <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#dc143c]"/> : null}</Link>)}</nav>

      {notice ? <div className={`mt-4 flex min-h-10 items-center justify-between gap-3 border px-3 py-2 text-[12px] font-medium ${notice.tone === "success" ? "border-[#cfe8da] bg-[#f2faf6] text-[#18794e]" : notice.tone === "warning" ? "border-[#ead9ae] bg-[#fffaf0] text-[#945b00]" : "border-[#f0cccc] bg-[#fff6f6] text-[#a83232]"}`}><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} className="text-[11px] font-semibold">Dismiss</button></div> : null}

      {showCreate && canManage ? <section className="mt-4 border-y border-[#e2e2e2] bg-white px-4 py-5">
        <div className="mb-4"><p className="text-[14px] font-semibold">Create tender</p><p className="mt-1 text-[12px] text-[#5b5b5b]">Tender only from a transport order with an authoritative selected procurement rate.</p></div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]"><Field label="Transport order"><select value={selectedOrderId} onChange={(event) => chooseOrder(event.target.value)}><option value="">Choose order</option>{orders.filter((order) => ["selected", "tendering"].includes(order.status)).map((order) => <option key={order.id} value={order.id}>{order.id} · {order.origin} → {order.destination}</option>)}</select></Field>{selectedOrder && !selectedOrder.customer_id ? <div className="flex items-end gap-2"><Field label="Customer"><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Choose customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.branch}</option>)}</select></Field><button type="button" onClick={linkCustomer} disabled={!customerId || busy} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold disabled:opacity-50">Link</button></div> : <div className="flex items-end pb-1 text-[12px] text-[#5b5b5b]">{selectedOrder?.customer_name || "Choose an eligible order"}</div>}</div>
        <form onSubmit={createTender} className="mt-4 grid gap-3 md:grid-cols-4"><Field label="Channel"><select value={channel} onChange={(event) => setChannel(event.target.value as TmsTenderChannel)}><option value="manual">Manual / phone / WhatsApp</option><option value="email">Email</option></select></Field><Field label="Response deadline"><input required type="datetime-local" value={responseDueAt} onChange={(event) => setResponseDueAt(event.target.value)}/></Field><Field label="Recipient name"><input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Partner contact"/></Field><Field label={channel === "email" ? "Recipient email" : "Recipient email (optional)"}><input required={channel === "email"} type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="operations@carrier.com"/></Field><div className="flex justify-end gap-2 md:col-span-4"><button type="button" onClick={() => setShowCreate(false)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Cancel</button><button type="submit" disabled={busy || !selectedOrder?.customer_id} className="h-8 rounded-[6px] bg-[#dc143c] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? "Creating…" : channel === "email" ? "Send tender" : "Record tender"}</button></div></form>
      </section> : null}

      <div className="flex min-h-[58px] flex-wrap items-center gap-2 border-b border-[#e2e2e2] py-3">
        <label className="flex h-8 min-w-[260px] flex-1 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 md:max-w-[300px]"><span className="mr-2 text-[12px] text-[#737373]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tender, order, partner…" className="min-w-0 flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-[#737373]"/></label>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold"><option value="active">Active</option><option value="all">All states</option>{Object.entries(tmsTenderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as "all" | TmsTenderChannel)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold"><option value="all">All channels</option><option value="manual">Manual</option><option value="email">Email</option><option value="edi_204">EDI 204</option></select>
        <button type="button" onClick={() => { setQuery(""); setStatus("active"); setChannelFilter("all"); }} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Reset</button><span className="ml-auto text-[12px] font-medium text-[#5b5b5b]">{filtered.length} shown</span>
      </div>

      <section className="grid min-h-[650px] lg:grid-cols-[minmax(0,800px)_351px]">
        <div className="min-w-0 overflow-x-auto lg:border-r lg:border-[#e2e2e2]">
          <table className="w-full min-w-[800px] table-fixed border-collapse text-left"><thead><tr className="h-9 border-b border-[#e2e2e2] text-[11px] font-medium text-[#737373]"><th className="w-[150px] px-3 font-medium">TENDER</th><th className="w-[170px] px-3 font-medium">ORDER / ROUTE</th><th className="w-[150px] px-3 font-medium">PARTNER</th><th className="w-[120px] px-3 text-right font-medium">COMMERCIAL</th><th className="w-[110px] px-3 font-medium">STATE</th><th className="w-[100px] px-3 font-medium">DEADLINE</th></tr></thead>
            <tbody>{filtered.length ? filtered.map((tender) => {
              const chosen = selected?.id === tender.id;
              return <tr key={tender.id} onClick={() => setSelectedTenderId(tender.id)} className={`relative h-12 cursor-pointer border-b border-[#e2e2e2] text-[12px] transition hover:bg-[#fbfbf9] ${chosen ? "bg-[#fbfbf9]" : ""}`}><td className="relative px-3 text-[13px] font-semibold">{chosen ? <span className="absolute inset-y-0 left-0 w-0.5 bg-[#dc143c]"/> : null}<span className="block truncate">{tender.tender_reference}</span></td><td className="px-3"><span className="block truncate text-[12px] font-medium">{tender.order_id}</span><span className="mt-0.5 block truncate text-[11px] text-[#737373]">{tender.origin} → {tender.destination}</span></td><td className="px-3 text-[12px] font-medium text-[#5b5b5b]"><span className="block truncate">{tender.partner_name}</span></td><td className="px-3 text-right text-[12px] font-semibold tabular-nums">{finalCommercial(tender)}</td><td className="px-3"><span className={`inline-flex rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium ${statusClasses(tender.status)}`}>{tmsTenderStatusLabels[tender.status]}</span></td><td className="px-3 text-[12px] font-medium text-[#5b5b5b]">{shortDate(tender.response_due_at)}</td></tr>;
            }) : <tr><td colSpan={6} className="h-48 px-6 text-center"><p className="text-[14px] font-semibold">No tenders match this view</p><p className="mt-1 text-[12px] text-[#737373]">Change filters or create a tender from an eligible order.</p></td></tr>}</tbody></table>
        </div>
        <aside className="min-h-[650px] bg-white px-6 py-5">{selected ? <TenderInspector tender={selected} order={selectedTenderOrder} canManage={canManage} busy={busy} counterFor={counterFor} setCounterFor={setCounterFor} counterCost={counterCost} setCounterCost={setCounterCost} counterCurrency={counterCurrency} setCounterCurrency={setCounterCurrency} responseNote={responseNote} setResponseNote={setResponseNote} bookingFor={bookingFor} setBookingFor={setBookingFor} bookingReference={bookingReference} setBookingReference={setBookingReference} pickupConfirmation={pickupConfirmation} setPickupConfirmation={setPickupConfirmation} onRespond={respond} onCancel={cancel} onBook={book}/> : <div className="grid h-full place-items-center text-center"><div><p className="text-[14px] font-semibold">No tender selected</p><p className="mt-1 text-[12px] text-[#737373]">Choose a row to inspect procurement authority.</p></div></div>}</aside>
      </section>
    </div>
  </main>;
}

function TenderInspector({ tender, order, canManage, busy, counterFor, setCounterFor, counterCost, setCounterCost, counterCurrency, setCounterCurrency, responseNote, setResponseNote, bookingFor, setBookingFor, bookingReference, setBookingReference, pickupConfirmation, setPickupConfirmation, onRespond, onCancel, onBook }: {
  tender: TmsTender; order: TmsOrder | null; canManage: boolean; busy: boolean;
  counterFor: string | null; setCounterFor: (value: string | null) => void; counterCost: string; setCounterCost: (value: string) => void; counterCurrency: CrmCurrency; setCounterCurrency: (value: CrmCurrency) => void; responseNote: string; setResponseNote: (value: string) => void; bookingFor: string | null; setBookingFor: (value: string | null) => void; bookingReference: string; setBookingReference: (value: string) => void; pickupConfirmation: string; setPickupConfirmation: (value: string) => void;
  onRespond: (tender: TmsTender, status: "accepted" | "rejected" | "countered") => Promise<void>; onCancel: (tender: TmsTender) => Promise<void>; onBook: (tender: TmsTender) => Promise<void>;
}) {
  const canBook = tenderCanBook(tender.status);
  return <div className="flex h-full flex-col"><div className="min-h-[110px]"><p className="text-[11px] font-medium text-[#737373]">{tender.tender_reference}</p><h2 className="mt-1 text-[18px] font-semibold leading-[26px]">{tender.partner_name}</h2><p className="mt-1 text-[12px] text-[#5b5b5b]">{tender.origin} → {tender.destination} · {tender.mode}</p><span className={`mt-2 inline-flex rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium ${statusClasses(tender.status)}`}>{tmsTenderStatusLabels[tender.status]}</span></div>
    <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">PROCUREMENT BASIS</p><DetailRow label="Order" value={tender.order_id}/><DetailRow label="Customer" value={order?.customer_name || "Not linked"}/><DetailRow label="Offered" value={money(tender.offered_cost, tender.currency)}/>{tender.counter_cost !== null ? <DetailRow label="Counter" value={money(tender.counter_cost, tender.counter_currency)}/> : null}<DetailRow label="Channel" value={tender.channel}/><DetailRow label="Deadline" value={dateTime(tender.response_due_at)}/></div>
    {tender.response_note ? <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">RESPONSE NOTE</p><p className="mt-2 text-[12px] leading-[19px] text-[#5b5b5b]">{tender.response_note}</p></div> : null}
    {tender.status === "booked" ? <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">BOOKING</p><DetailRow label="Reference" value={tender.booking_reference || "Not recorded"}/><DetailRow label="Shipment" value={tender.shipment_reference || "Not linked"}/><Link href={`/admin/tenders/${encodeURIComponent(tender.id)}`} className="mt-3 inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Open booking confirmation</Link></div> : null}
    {canManage && tender.status === "sent" ? <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">CARRIER RESPONSE</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onRespond(tender, "accepted")} disabled={busy} className="h-8 rounded-[6px] border border-[#cfe8da] bg-[#f2faf6] px-3 text-[12px] font-semibold text-[#18794e]">Accepted</button><button type="button" onClick={() => onRespond(tender, "rejected")} disabled={busy} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Rejected</button><button type="button" onClick={() => setCounterFor(counterFor === tender.id ? null : tender.id)} className="h-8 rounded-[6px] border border-[#ead9ae] bg-[#fffaf0] px-3 text-[12px] font-semibold text-[#945b00]">Counter-offer</button></div>{counterFor === tender.id ? <div className="mt-3 space-y-2"><Field label="Counter amount"><input type="number" min="0" step="0.01" value={counterCost} onChange={(event) => setCounterCost(event.target.value)}/></Field><Field label="Currency"><select value={counterCurrency} onChange={(event) => setCounterCurrency(event.target.value as CrmCurrency)}>{crmCurrencies.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Conditions / note"><input value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder="Validity, timing, exclusions…"/></Field><button type="button" onClick={() => onRespond(tender, "countered")} disabled={!counterCost || busy} className="h-8 rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white disabled:opacity-50">Record counter-offer</button></div> : null}</div> : null}
    {canManage && canBook ? <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">BOOKING AUTHORITY</p><p className="mt-1 text-[12px] leading-[19px] text-[#5b5b5b]">Only this accepted or valid counter-offer can request booking. The server remains authoritative.</p>{bookingFor === tender.id ? <div className="mt-3 space-y-2"><Field label="Partner booking reference"><input value={bookingReference} onChange={(event) => setBookingReference(event.target.value)} placeholder="Booking / confirmation number"/></Field><Field label="Pickup confirmation / notes"><input value={pickupConfirmation} onChange={(event) => setPickupConfirmation(event.target.value)} placeholder="Pickup slot, equipment, conditions…"/></Field><div className="flex gap-2"><button type="button" onClick={() => setBookingFor(null)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Cancel</button><button type="button" onClick={() => onBook(tender)} disabled={!bookingReference.trim() || busy} className="h-8 rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? "Confirming…" : "Confirm booking"}</button></div></div> : <button type="button" onClick={() => setBookingFor(tender.id)} className="mt-3 h-8 rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Confirm booking</button>}</div> : null}
    {canManage && tenderCanCancel(tender.status) ? <div className="mt-auto border-t border-[#e2e2e2] pt-4"><button type="button" onClick={() => onCancel(tender)} disabled={busy} className="text-[12px] font-semibold text-[#a83232]">Cancel tender</button></div> : null}
  </div>;
}

function DetailRow({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-[82px_1fr] gap-3 py-[5px] text-[12px]"><span className="text-[#737373]">{label}</span><span className="break-words font-medium">{value}</span></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block min-w-0 text-[11px] font-medium text-[#5b5b5b]"><span className="mb-1.5 block">{label}</span><span className="block [&_input]:h-8 [&_input]:w-full [&_input]:rounded-[6px] [&_input]:border [&_input]:border-[#e2e2e2] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[12px] [&_input]:font-medium [&_input]:outline-none [&_select]:h-8 [&_select]:w-full [&_select]:rounded-[6px] [&_select]:border [&_select]:border-[#e2e2e2] [&_select]:bg-white [&_select]:px-3 [&_select]:text-[12px] [&_select]:font-medium [&_select]:outline-none">{children}</span></label>; }
