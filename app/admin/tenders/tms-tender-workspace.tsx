"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Clock3, Mail, RefreshCw, Send, Ship, UserRoundCheck, XCircle } from "lucide-react";
import { crmCurrencies, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
import type { TmsOrder } from "../rating/tms-rating";
import {
  tenderCanBook,
  tenderCanCancel,
  tenderIsActive,
  tmsTenderStatusLabels,
  type TmsTender,
  type TmsTenderChannel,
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

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return "Not set";
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function statusTone(status: TmsTender["status"]) {
  if (status === "booked") return "success" as const;
  if (status === "accepted") return "success" as const;
  if (status === "countered") return "warning" as const;
  if (status === "sent") return "info" as const;
  if (status === "rejected" || status === "cancelled" || status === "expired") return "neutral" as const;
  return "neutral" as const;
}

function localDeadlineDefault() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function TmsTenderWorkspace({ initialOrders, initialTenders, customers, canManage }: {
  initialOrders: TmsOrder[];
  initialTenders: TmsTender[];
  customers: CustomerOption[];
  canManage: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [tenders, setTenders] = useState(initialTenders);
  const firstOrder = initialOrders.find((order) => ["selected", "tendering", "booked"].includes(order.status)) ?? initialOrders[0];
  const [selectedOrderId, setSelectedOrderId] = useState(firstOrder?.id ?? "");
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
  const selectedTenders = useMemo(() => tenders.filter((tender) => tender.order_id === selectedOrderId), [tenders, selectedOrderId]);
  const activeCount = tenders.filter((tender) => tenderIsActive(tender.status)).length;
  const bookedCount = tenders.filter((tender) => tender.status === "booked").length;
  const pendingResponse = tenders.filter((tender) => tender.status === "sent").length;
  const acceptedCount = tenders.filter((tender) => tender.status === "accepted" || tender.status === "countered").length;

  function chooseOrder(id: string) {
    const order = orders.find((item) => item.id === id);
    setSelectedOrderId(id);
    setCustomerId(order?.customer_id ?? "");
    setNotice(null);
  }

  async function refresh() {
    setBusy(true); setNotice(null);
    try {
      const [orderResponse, tenderResponse] = await Promise.all([
        fetch("/api/admin/rating", { cache: "no-store" }),
        fetch("/api/admin/tenders", { cache: "no-store" }),
      ]);
      const orderData = await orderResponse.json() as ApiResponse;
      const tenderData = await tenderResponse.json() as ApiResponse;
      if (!orderResponse.ok || !orderData.ok || !orderData.orders) throw new Error(orderData.error || "Orders could not be refreshed.");
      if (!tenderResponse.ok || !tenderData.ok || !tenderData.tenders) throw new Error(tenderData.error || "Tenders could not be refreshed.");
      setOrders(orderData.orders); setTenders(tenderData.tenders);
      setNotice({ tone: "success", text: "Tender Desk refreshed." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tender Desk could not be refreshed." }); }
    finally { setBusy(false); }
  }

  async function linkCustomer() {
    if (!selectedOrder || !customerId) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/tenders/customer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: selectedOrder.id, customerId }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.customerId || !data.customerName) throw new Error(data.error || "Customer could not be linked.");
      setOrders((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, customer_id: data.customerId!, customer_name: data.customerName! } : order));
      setNotice({ tone: "success", text: `${data.customerName} linked to ${selectedOrder.id}.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Customer could not be linked." }); }
    finally { setBusy(false); }
  }

  async function createTender(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrder) return;
    if (!selectedOrder.customer_id) { setNotice({ tone: "warning", text: "Link a KCPL customer before tendering so a confirmed booking can open a Digital Job File." }); return; }
    setBusy(true); setNotice(null);
    try {
      const deadline = new Date(responseDueAt).toISOString();
      const response = await fetch("/api/admin/tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", orderId: selectedOrder.id, channel, recipientName, recipientEmail, responseDueAt: deadline }) });
      const data = await response.json() as ApiResponse;
      if (data.tender) {
        setTenders((current) => [data.tender!, ...current.filter((item) => item.id !== data.tender!.id)]);
        setOrders((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, status: "tendering" } : order));
      }
      if (!response.ok || !data.ok || !data.tender) throw new Error(data.error || "Tender could not be created.");
      setRecipientName(""); setRecipientEmail(""); setResponseDueAt(localDeadlineDefault());
      setNotice({ tone: "success", text: data.emailSent ? `${data.tender.tender_reference} created and sent by email.` : `${data.tender.tender_reference} created for manual dispatch.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tender could not be created." }); }
    finally { setBusy(false); }
  }

  async function respond(tender: TmsTender, status: "accepted" | "rejected" | "countered") {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "respond", tenderId: tender.id, status, note: responseNote, counterCost: status === "countered" ? Number(counterCost) : null, counterCurrency: status === "countered" ? counterCurrency : null }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.tender) throw new Error(data.error || "Tender response could not be recorded.");
      setTenders((current) => current.map((item) => item.id === tender.id ? data.tender! : item));
      if (status === "rejected") setOrders((current) => current.map((order) => order.id === tender.order_id ? { ...order, status: "selected" } : order));
      setCounterFor(null); setCounterCost(""); setResponseNote("");
      setNotice({ tone: "success", text: status === "countered" ? "Counter-offer recorded and preserved in the tender audit trail." : `Tender marked ${status}.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tender response could not be recorded." }); }
    finally { setBusy(false); }
  }

  async function cancel(tender: TmsTender) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel", tenderId: tender.id, note: responseNote }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Tender could not be cancelled.");
      setTenders((current) => current.map((item) => item.id === tender.id ? { ...item, status: "cancelled", response_note: responseNote || null } : item));
      setOrders((current) => current.map((order) => order.id === tender.order_id ? { ...order, status: "selected" } : order));
      setResponseNote(""); setNotice({ tone: "success", text: "Tender cancelled. The order is available for re-tendering." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Tender could not be cancelled." }); }
    finally { setBusy(false); }
  }

  async function book(tender: TmsTender) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/tenders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "book", tenderId: tender.id, bookingReference, pickupConfirmation }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.shipmentReference) throw new Error(data.error || "Booking could not be confirmed.");
      const finalCurrency = tender.status === "countered" ? tender.counter_currency : tender.currency;
      const finalCost = tender.status === "countered" ? tender.counter_cost : tender.offered_cost;
      setTenders((current) => current.map((item) => item.id === tender.id ? { ...item, status: "booked", booking_reference: bookingReference, pickup_confirmation: pickupConfirmation || null, shipment_reference: data.shipmentReference!, final_cost: finalCost, final_currency: finalCurrency, booked_at: new Date().toISOString() } : item));
      setOrders((current) => current.map((order) => order.id === tender.order_id ? { ...order, status: "booked", selected_cost: finalCost, selected_currency: finalCurrency } : order));
      setBookingFor(null); setBookingReference(""); setPickupConfirmation("");
      setNotice({ tone: "success", text: `Booking confirmed. Digital Job File ${data.shipmentReference} has been opened.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Booking could not be confirmed." }); }
    finally { setBusy(false); }
  }

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Transportation management"
        title="Tender Desk"
        description="Tender selected Partner buy rates, capture acceptance/rejection/counter-offers, re-tender safely and convert confirmed bookings into Digital Job Files."
        actions={<div className="flex gap-2"><Link href="/admin/rating" className="ops-button" data-variant="secondary" data-size="sm">Rate Desk <ArrowRight size={12}/></Link><OpsButton size="sm" onClick={refresh} disabled={busy}><RefreshCw size={13}/> Refresh</OpsButton></div>}
      />

      <OpsStatStrip>
        <OpsStat label="Awaiting response" value={pendingResponse} tone={pendingResponse ? "warning" : "neutral"} icon={<Clock3 size={13}/>}/>
        <OpsStat label="Active tenders" value={activeCount} tone={activeCount ? "info" : "neutral"} icon={<Send size={13}/>}/>
        <OpsStat label="Accepted / countered" value={acceptedCount} tone={acceptedCount ? "success" : "neutral"} icon={<CheckCircle2 size={13}/>}/>
        <OpsStat label="Booked" value={bookedCount} tone="success" icon={<Ship size={13}/>}/>
      </OpsStatStrip>

      {notice ? <div className="mt-4"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <OpsSurface eyebrow="Planning orders" title="Orders ready for procurement" description="Choose an order that already has a selected Partner buy rate.">
          <div className="space-y-2">
            {orders.length ? orders.map((order) => <button key={order.id} type="button" onClick={() => chooseOrder(order.id)} className={`w-full rounded-[11px] border p-3 text-left ${selectedOrderId === order.id ? "border-[#d48a76] bg-[#fff8f4]" : "border-[#e7dfd8] bg-white"}`}>
              <div className="flex items-start justify-between gap-2"><OpsMono>{order.id}</OpsMono><OpsBadge tone={order.status === "booked" ? "success" : order.status === "tendering" ? "info" : order.status === "selected" ? "warning" : "neutral"}>{order.status}</OpsBadge></div>
              <strong className="mt-2 block text-[11px] text-[#443d38]">{order.origin} → {order.destination}</strong>
              <p className="mt-1 text-[9px] text-[#887f78]">{order.customer_name || "Customer not linked"} · {order.branch}</p>
            </button>) : <OpsEmptyState compact title="No transport orders" description="Create an order and select a Partner buy rate in Rate Desk first."/>}
          </div>
        </OpsSurface>

        <div className="space-y-4">
          {!selectedOrder ? <OpsSurface><OpsEmptyState title="Choose a transport order" description="Tender controls appear after an order is selected."/></OpsSurface> : <>
            <OpsSurface eyebrow="Order control" title={`${selectedOrder.origin} → ${selectedOrder.destination}`} description={`${selectedOrder.id} · ${selectedOrder.mode} · ${selectedOrder.branch}`}>
              <div className="grid gap-3 md:grid-cols-3">
                <div><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#938980]">Selected procurement</p><p className="mt-1 text-[12px] font-bold text-[#403933]">{money(selectedOrder.selected_cost, selectedOrder.selected_currency)}</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#938980]">Customer</p><p className="mt-1 text-[12px] font-bold text-[#403933]">{selectedOrder.customer_name || "Not linked"}</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#938980]">State</p><div className="mt-1"><OpsBadge tone={selectedOrder.status === "booked" ? "success" : selectedOrder.status === "tendering" ? "info" : "warning"}>{selectedOrder.status}</OpsBadge></div></div>
              </div>
              {!selectedOrder.customer_id && canManage ? <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]"><OpsField label="Link customer before tendering"><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Choose customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.branch}</option>)}</select></OpsField><div className="flex items-end"><OpsButton onClick={linkCustomer} disabled={!customerId || busy}><UserRoundCheck size={13}/> Link customer</OpsButton></div></div> : null}
            </OpsSurface>

            {canManage && selectedOrder.status === "selected" ? <OpsSurface eyebrow="Tender" title="Send / record tender" description="The selected buy rate is snapshotted into the tender, so later rate-card edits cannot rewrite procurement history.">
              <form onSubmit={createTender} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <OpsField label="Channel"><select value={channel} onChange={(event) => setChannel(event.target.value as TmsTenderChannel)}><option value="manual">Manual / phone / WhatsApp</option><option value="email">Email via SendGrid</option></select></OpsField>
                <OpsField label="Response deadline"><input required type="datetime-local" value={responseDueAt} onChange={(event) => setResponseDueAt(event.target.value)}/></OpsField>
                <OpsField label="Recipient name"><input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Partner contact"/></OpsField>
                <OpsField label={channel === "email" ? "Recipient email" : "Recipient email (optional)"}><input required={channel === "email"} type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="operations@carrier.com"/></OpsField>
                <div className="md:col-span-2 xl:col-span-4 flex justify-end"><OpsButton type="submit" variant="primary" disabled={busy || !selectedOrder.customer_id}><Send size={13}/>{channel === "email" ? "Send tender" : "Record tender"}</OpsButton></div>
              </form>
            </OpsSurface> : null}

            <OpsSurface eyebrow="Tender history" title="Procurement decisions" description="Every response and booking is retained against the transport order.">
              <div className="space-y-3">
                {selectedTenders.length ? selectedTenders.map((tender) => <div key={tender.id} className="rounded-[13px] border border-[#e7dfd8] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><OpsMono>{tender.tender_reference}</OpsMono><OpsBadge tone={statusTone(tender.status)}>{tmsTenderStatusLabels[tender.status]}</OpsBadge>{tender.channel === "email" ? <OpsBadge tone="info"><Mail size={10}/> Email</OpsBadge> : <OpsBadge>Manual</OpsBadge>}</div><strong className="mt-2 block text-[12px] text-[#403933]">{tender.partner_name}</strong><p className="mt-1 text-[9px] text-[#887f78]">Offered {money(tender.offered_cost, tender.currency)} · due {dateTime(tender.response_due_at)}</p></div>{tender.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(tender.shipment_reference)}`} className="ops-button" data-variant="primary" data-size="sm">Open Job File <ArrowRight size={12}/></Link> : null}</div>

                  {tender.counter_cost !== null ? <p className="mt-3 rounded-[9px] bg-[#fff8ee] px-3 py-2 text-[10px] text-[#795d34]">Counter-offer: <strong>{money(tender.counter_cost, tender.counter_currency)}</strong>{tender.response_note ? ` · ${tender.response_note}` : ""}</p> : tender.response_note ? <p className="mt-3 text-[10px] leading-5 text-[#766d66]">{tender.response_note}</p> : null}

                  {canManage && tender.status === "sent" ? <div className="mt-4 flex flex-wrap gap-2"><OpsButton size="sm" onClick={() => respond(tender, "accepted")} disabled={busy}><CheckCircle2 size={12}/> Accepted</OpsButton><OpsButton size="sm" onClick={() => respond(tender, "rejected")} disabled={busy}><XCircle size={12}/> Rejected</OpsButton><OpsButton size="sm" onClick={() => setCounterFor(counterFor === tender.id ? null : tender.id)} disabled={busy}>Counter-offer</OpsButton>{tenderCanCancel(tender.status) ? <OpsButton size="sm" variant="danger" onClick={() => cancel(tender)} disabled={busy}>Cancel</OpsButton> : null}</div> : null}

                  {counterFor === tender.id ? <div className="mt-3 grid gap-2 md:grid-cols-[1fr_150px_1.4fr_auto]"><OpsField label="Counter amount"><input type="number" min="0" step="0.01" value={counterCost} onChange={(event) => setCounterCost(event.target.value)}/></OpsField><OpsField label="Currency"><select value={counterCurrency} onChange={(event) => setCounterCurrency(event.target.value as CrmCurrency)}>{crmCurrencies.map((value) => <option key={value}>{value}</option>)}</select></OpsField><OpsField label="Conditions / note"><input value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder="Validity, equipment, timing, exclusions…"/></OpsField><div className="flex items-end"><OpsButton variant="primary" onClick={() => respond(tender, "countered")} disabled={!counterCost || busy}>Record</OpsButton></div></div> : null}

                  {canManage && tenderCanBook(tender.status) ? <div className="mt-4">{bookingFor === tender.id ? <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_auto]"><OpsField label="Carrier / partner booking reference"><input required value={bookingReference} onChange={(event) => setBookingReference(event.target.value)} placeholder="Booking / confirmation number"/></OpsField><OpsField label="Pickup confirmation / notes"><input value={pickupConfirmation} onChange={(event) => setPickupConfirmation(event.target.value)} placeholder="Pickup slot, equipment confirmation, conditions…"/></OpsField><div className="flex items-end"><OpsButton variant="primary" onClick={() => book(tender)} disabled={!bookingReference.trim() || busy}><Ship size={13}/> Confirm booking</OpsButton></div></div> : <OpsButton size="sm" variant="primary" onClick={() => setBookingFor(tender.id)}><Ship size={12}/> Book accepted tender</OpsButton>}</div> : null}
                </div>) : <OpsEmptyState compact title="No tenders for this order" description="Select a Partner buy rate in Rate Desk, link a customer, then create the first tender."/>}
              </div>
            </OpsSurface>
          </>}
        </div>
      </div>
    </OpsPage>
  );
}
