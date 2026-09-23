"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { crmCurrencies, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import type { TmsOrder } from "../rating/tms-rating";
import { OpsActiveFilters, OpsBadge, OpsButton, OpsEmptyState, OpsFact, OpsFacts, OpsField, OpsFilterSelect, OpsInspectorHeader, OpsInspectorSection, OpsKpiRail, OpsNotice, OpsPage, OpsPageHeader, OpsRailMetric, OpsRegisterToolbar, OpsScopeTabs, OpsSearch, OpsSurface, OpsTableWrap, type OpsActiveFilter } from "../operations-ui";
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

const channelLabels: Record<TmsTenderChannel, string> = { manual: "Manual", email: "Email", edi_204: "EDI 204" };

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

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

function stateTone(status: TmsTenderStatus): "neutral" | "info" | "warning" | "success" {
  if (status === "accepted" || status === "booked") return "success";
  if (status === "sent") return "info";
  if (status === "countered") return "warning";
  return "neutral";
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
  // Booking navigates through the router so the confirmed tender keeps the app shell.
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [tenders, setTenders] = useState(initialTenders);
  const firstTender = initialTenders[0] ?? null;
  const firstOrder = firstTender ? initialOrders.find((order) => order.id === firstTender.order_id) : initialOrders.find((order) => ["selected", "tendering"].includes(order.status)) ?? initialOrders[0];
  const [selectedTenderId, setSelectedTenderId] = useState("");
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

  const selected = tenders.find((tender) => tender.id === selectedTenderId) ?? null;
  const selectedTenderOrder = selected ? orders.find((order) => order.id === selected.order_id) ?? null : null;
  const awaiting = tenders.filter((tender) => tender.status === "sent").length;
  const accepted = tenders.filter((tender) => tender.status === "accepted" || tender.status === "countered").length;
  const expired = tenders.filter((tender) => tender.status === "expired").length;
  const booked = tenders.filter((tender) => tender.status === "booked").length;

  const scopeOptions = [
    { value: "active", label: "Active" },
    { value: "all", label: "All states" },
    ...Object.entries(tmsTenderStatusLabels).map(([value, label]) => ({ value, label })),
  ] as const;

  function chooseOrder(id: string) {
    const order = orders.find((item) => item.id === id);
    setSelectedOrderId(id);
    setCustomerId(order?.customer_id ?? "");
    setNotice(null);
  }

  const inspectorRef = useRef<HTMLElement>(null);
  function openTender(id: string) {
    setSelectedTenderId(id);
    // Stacked layouts put the inspector under the register; bring it into view.
    window.requestAnimationFrame(() => {
      if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inspectorRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  }

  // Escape closes the inspector, as it does on the other registers.
  const hasSelection = selected !== null;
  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      setSelectedTenderId("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSelection]);

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
      router.push(`/admin/tenders/${encodeURIComponent(tender.id)}`);
      router.refresh();
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Booking could not be confirmed." });
      setBusy(false);
    }
  }

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<StatusFilter, number>> = { active: tenders.filter((tender) => tenderIsActive(tender.status)).length, all: tenders.length };
    for (const status of Object.keys(tmsTenderStatusLabels) as TmsTenderStatus[]) counts[status] = tenders.filter((tender) => tender.status === status).length;
    return counts;
  }, [tenders]);
  const filtersActive = Boolean(query.trim()) || status !== "active" || channelFilter !== "all";
  const compact = selected !== null;
  const activeFilters: OpsActiveFilter[] = channelFilter !== "all" ? [{ key: "channel", label: channelLabels[channelFilter], title: `Channel: ${channelLabels[channelFilter]}`, onRemove: () => setChannelFilter("all") }] : [];
  const eligibleOrders = orders.filter((order) => ["selected", "tendering"].includes(order.status));

  return (
    <OpsPage>
      <OpsPageHeader
        title="Tender & Booking"
        description={`${awaiting} awaiting response · ${accepted} accepted / countered · ${expired} expired · ${booked} booked`}
        actions={<>
          <OpsButton variant="secondary" onClick={refresh} disabled={busy}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true"/>Refresh</OpsButton>
          {canManage ? <OpsButton variant="primary" onClick={() => setShowCreate((value) => !value)} aria-expanded={showCreate}><Plus size={16} strokeWidth={1.75} aria-hidden="true"/>Create tender</OpsButton> : null}
        </>}
      />

      <div className="px-4 pb-8 pt-4 md:px-6">
        <OpsKpiRail label="Tender desk summary">
          <OpsRailMetric label="Awaiting response" value={awaiting} active={status === "sent"} onClick={() => setStatus(status === "sent" ? "active" : "sent")} title="Show tenders awaiting a carrier response"/>
          <OpsRailMetric label="Accepted / countered" value={accepted}/>
          <OpsRailMetric label="Expired" value={expired} tone={expired ? "warning" : "neutral"} active={status === "expired"} onClick={() => setStatus(status === "expired" ? "active" : "expired")} title="Show expired tenders"/>
          <OpsRailMetric label="Booked" value={booked} active={status === "booked"} onClick={() => setStatus(status === "booked" ? "active" : "booked")} title="Show booked tenders"/>
        </OpsKpiRail>

        {notice ? <div className="plan-notice"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

        {showCreate && canManage ? (
          <div className="plan-panel">
            <OpsSurface
              density="compact"
              title="Create tender"
              description="Tender only from a transport order with an authoritative selected procurement rate."
              action={<button type="button" className="ops-inspector-close" onClick={() => setShowCreate(false)} aria-label="Close create tender"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
            >
              <form onSubmit={createTender}>
                <div className="ops-form-grid">
                  <OpsField label="Transport order" className="ops-form-wide">
                    <select value={selectedOrderId} onChange={(event) => chooseOrder(event.target.value)}>
                      {eligibleOrders.length ? null : <option value="">No eligible orders</option>}
                      {eligibleOrders.map((order) => <option key={order.id} value={order.id}>{order.id} · {order.origin} → {order.destination}</option>)}
                    </select>
                  </OpsField>
                  {selectedOrder && !selectedOrder.customer_id ? (
                    <div className="ops-form-inline ops-form-wide">
                      <OpsField label="Link customer">
                        <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                          <option value="">Choose customer…</option>
                          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.branch}</option>)}
                        </select>
                      </OpsField>
                      <OpsButton size="sm" onClick={linkCustomer} disabled={!customerId || busy}>Link</OpsButton>
                    </div>
                  ) : (
                    <div className="ops-field ops-form-wide"><span className="ops-field-label">Customer</span><span className="ops-form-value">{selectedOrder?.customer_name || "Choose an eligible order"}</span></div>
                  )}
                  <OpsField label="Channel">
                    <select value={channel} onChange={(event) => setChannel(event.target.value as TmsTenderChannel)}>
                      <option value="manual">Manual / phone / WhatsApp</option>
                      <option value="email">Email</option>
                    </select>
                  </OpsField>
                  <OpsField label="Response deadline"><input required type="datetime-local" value={responseDueAt} onChange={(event) => setResponseDueAt(event.target.value)}/></OpsField>
                  <OpsField label="Recipient name"><input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Partner contact"/></OpsField>
                  <OpsField label={channel === "email" ? "Recipient email" : "Recipient email (optional)"}><input required={channel === "email"} type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="operations@carrier.com"/></OpsField>
                </div>
                <div className="ops-form-actions">
                  <OpsButton type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</OpsButton>
                  <OpsButton type="submit" size="sm" variant="primary" disabled={busy || !selectedOrder?.customer_id}>{busy ? "Creating…" : channel === "email" ? "Send tender" : "Record tender"}</OpsButton>
                </div>
              </form>
            </OpsSurface>
          </div>
        ) : null}

        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tender, order, partner, customer…" aria-label="Search tenders"/>}
          actions={<>
            <OpsFilterSelect label="Channel" value={channelFilter} allLabel="All channels" options={(Object.keys(channelLabels) as TmsTenderChannel[]).map((value) => ({ value, label: channelLabels[value] }))} onChange={(value) => setChannelFilter(value as "all" | TmsTenderChannel)}/>
            {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={() => { setQuery(""); setStatus("active"); setChannelFilter("all"); }}>Reset</OpsButton> : null}
            <span className="ops-toolbar-divider" aria-hidden="true"/>
            <span className="ops-result-count" aria-live="polite">{filtered.length === tenders.length ? `${tenders.length} tenders` : `${filtered.length} of ${tenders.length}`}</span>
          </>}
          tabs={<OpsScopeTabs<StatusFilter> label="Tender state" items={scopeOptions.map((option) => ({ value: option.value as StatusFilter, label: option.label, count: statusCounts[option.value as StatusFilter] }))} value={status} onChange={(value) => setStatus(value)}/>}
        />
        <OpsActiveFilters chips={activeFilters}/>

        <div className="ops-register-layout" data-inspector={selected ? "open" : undefined}>
          <section className="ops-surface" aria-label="Tender register">
            {filtered.length ? <OpsTableWrap>
              <table className="ops-table ops-register-table tender-table" data-compact={compact || undefined} aria-label="Tenders">
                <thead>
                  <tr>
                    <th>Tender</th>
                    <th>Route</th>
                    {compact ? null : <th>Partner</th>}
                    <th className="ops-col-num">Commercial</th>
                    <th>State</th>
                    {compact ? null : <th>Deadline</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tender) => {
                    const chosen = selected?.id === tender.id;
                    return (
                      <tr key={tender.id} tabIndex={0} data-selected={chosen || undefined} aria-current={chosen || undefined} onClick={() => openTender(tender.id)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openTender(tender.id); } }}>
                        <td>
                          <span className="ops-cell-primary ops-mono ops-cell-id">{tender.tender_reference}</span>
                          <span className="ops-cell-secondary ops-mono">{tender.order_id}</span>
                        </td>
                        <td>
                          <span className="ops-cell-primary ops-cell-clamp" title={`${tender.origin} → ${tender.destination}`}>{tender.origin} → {tender.destination}</span>
                          <span className="ops-cell-secondary">{compact ? tender.partner_name : tender.mode}</span>
                        </td>
                        {compact ? null : <td>
                          <span className="ops-cell-primary ops-cell-clamp" title={tender.partner_name}>{tender.partner_name}</span>
                          <span className="ops-cell-secondary">{channelLabels[tender.channel]}</span>
                        </td>}
                        <td className="ops-col-num"><span className="ops-num">{finalCommercial(tender)}</span></td>
                        <td><OpsBadge tone={stateTone(tender.status)}>{tmsTenderStatusLabels[tender.status]}</OpsBadge></td>
                        {compact ? null : <td><span className="ops-cell-muted plan-nowrap">{shortDate(tender.response_due_at)}</span></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </OpsTableWrap> : <OpsEmptyState compact kind="search" icon={<Send size={16} strokeWidth={1.75} aria-hidden="true"/>} title={filtersActive ? "No tenders match this view" : "No tenders yet"} description={filtersActive ? "Change or reset the filters." : "Create a tender from an eligible transport order."} action={filtersActive ? <OpsButton variant="secondary" size="sm" onClick={() => { setQuery(""); setStatus("active"); setChannelFilter("all"); }}>Reset filters</OpsButton> : undefined}/>}
            {filtered.length ? <footer className="ops-register-footer"><span>{filtered.length} tender{filtered.length === 1 ? "" : "s"} in this view</span></footer> : null}
          </section>

          {selected ? (
            <TenderInspector
              tender={selected}
              order={selectedTenderOrder}
              inspectorRef={inspectorRef}
              onClose={() => setSelectedTenderId("")}
              canManage={canManage}
              busy={busy}
              counterFor={counterFor}
              setCounterFor={setCounterFor}
              counterCost={counterCost}
              setCounterCost={setCounterCost}
              counterCurrency={counterCurrency}
              setCounterCurrency={setCounterCurrency}
              responseNote={responseNote}
              setResponseNote={setResponseNote}
              bookingFor={bookingFor}
              setBookingFor={setBookingFor}
              bookingReference={bookingReference}
              setBookingReference={setBookingReference}
              pickupConfirmation={pickupConfirmation}
              setPickupConfirmation={setPickupConfirmation}
              onRespond={respond}
              onCancel={cancel}
              onBook={book}
            />
          ) : null}
        </div>
      </div>
    </OpsPage>
  );
}

function TenderInspector({ tender, order, inspectorRef, onClose, canManage, busy, counterFor, setCounterFor, counterCost, setCounterCost, counterCurrency, setCounterCurrency, responseNote, setResponseNote, bookingFor, setBookingFor, bookingReference, setBookingReference, pickupConfirmation, setPickupConfirmation, onRespond, onCancel, onBook }: {
  tender: TmsTender; order: TmsOrder | null; inspectorRef: RefObject<HTMLElement | null>; onClose: () => void; canManage: boolean; busy: boolean;
  counterFor: string | null; setCounterFor: (value: string | null) => void; counterCost: string; setCounterCost: (value: string) => void; counterCurrency: CrmCurrency; setCounterCurrency: (value: CrmCurrency) => void; responseNote: string; setResponseNote: (value: string) => void; bookingFor: string | null; setBookingFor: (value: string | null) => void; bookingReference: string; setBookingReference: (value: string) => void; pickupConfirmation: string; setPickupConfirmation: (value: string) => void;
  onRespond: (tender: TmsTender, status: "accepted" | "rejected" | "countered") => Promise<void>; onCancel: (tender: TmsTender) => Promise<void>; onBook: (tender: TmsTender) => Promise<void>;
}) {
  const canBook = tenderCanBook(tender.status);
  return (
    <aside ref={inspectorRef} className="ops-inspector" aria-label={`Tender ${tender.tender_reference}`}>
      <OpsInspectorHeader
        kicker={tender.tender_reference}
        title={tender.partner_name}
        subtitle={`${tender.origin} → ${tender.destination} · ${tender.mode}`}
        actions={<>
          <OpsBadge tone={stateTone(tender.status)}>{tmsTenderStatusLabels[tender.status]}</OpsBadge>
          <button type="button" className="ops-inspector-close" onClick={onClose} aria-label="Close tender inspector"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>
        </>}
      />
      <div className="ops-inspector-scroll">
        <div className="ops-inspector-body">
          <OpsInspectorSection title="Procurement basis">
            <OpsFacts>
              <OpsFact label="Order">{tender.order_id}</OpsFact>
              <OpsFact label="Customer" warning={!order?.customer_name}>{order?.customer_name || "Not linked"}</OpsFact>
              <OpsFact label="Offered">{money(tender.offered_cost, tender.currency)}</OpsFact>
              {tender.counter_cost !== null ? <OpsFact label="Counter">{money(tender.counter_cost, tender.counter_currency)}</OpsFact> : null}
              <OpsFact label="Channel">{channelLabels[tender.channel]}</OpsFact>
              <OpsFact label="Deadline">{dateTime(tender.response_due_at)}</OpsFact>
            </OpsFacts>
          </OpsInspectorSection>

          {tender.response_note ? (
            <OpsInspectorSection title="Response note">
              <p className="plan-note">{tender.response_note}</p>
            </OpsInspectorSection>
          ) : null}

          {tender.status === "booked" ? (
            <OpsInspectorSection title="Booking">
              <OpsFacts>
                <OpsFact label="Reference">{tender.booking_reference || "Not recorded"}</OpsFact>
                <OpsFact label="Shipment">{tender.shipment_reference || "Not linked"}</OpsFact>
              </OpsFacts>
              <div className="ops-inspector-actions plan-section-actions">
                <Link href={`/admin/tenders/${encodeURIComponent(tender.id)}`} className="ops-button" data-size="sm" data-variant="secondary">Open booking confirmation</Link>
              </div>
            </OpsInspectorSection>
          ) : null}

          {canManage && tender.status === "sent" ? (
            <OpsInspectorSection title="Carrier response">
              <div className="ops-inspector-actions">
                <OpsButton size="sm" onClick={() => onRespond(tender, "accepted")} disabled={busy}>Accepted</OpsButton>
                <OpsButton size="sm" onClick={() => onRespond(tender, "rejected")} disabled={busy}>Rejected</OpsButton>
                <OpsButton size="sm" variant="ghost" onClick={() => setCounterFor(counterFor === tender.id ? null : tender.id)} aria-expanded={counterFor === tender.id}>Counter-offer</OpsButton>
              </div>
              {counterFor === tender.id ? (
                <div className="ops-inspector-form plan-subform">
                  <OpsField label="Counter amount"><input type="number" min="0" step="0.01" value={counterCost} onChange={(event) => setCounterCost(event.target.value)}/></OpsField>
                  <OpsField label="Currency"><select value={counterCurrency} onChange={(event) => setCounterCurrency(event.target.value as CrmCurrency)}>{crmCurrencies.map((value) => <option key={value}>{value}</option>)}</select></OpsField>
                  <OpsField label="Conditions / note" className="col-span-full"><input value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder="Validity, timing, exclusions…"/></OpsField>
                  <div className="col-span-full"><OpsButton size="sm" variant="primary" onClick={() => onRespond(tender, "countered")} disabled={!counterCost || busy}>Record counter-offer</OpsButton></div>
                </div>
              ) : null}
            </OpsInspectorSection>
          ) : null}

          {canManage && canBook ? (
            <OpsInspectorSection title="Booking authority">
              <p className="ops-inspector-hint">Only this accepted or valid counter-offer can request booking. The server remains authoritative.</p>
              {bookingFor === tender.id ? (
                <div className="ops-inspector-form plan-subform">
                  <OpsField label="Partner booking reference" className="col-span-full"><input value={bookingReference} onChange={(event) => setBookingReference(event.target.value)} placeholder="Booking / confirmation number"/></OpsField>
                  <OpsField label="Pickup confirmation / notes" className="col-span-full"><input value={pickupConfirmation} onChange={(event) => setPickupConfirmation(event.target.value)} placeholder="Pickup slot, equipment, conditions…"/></OpsField>
                  <div className="col-span-full ops-inspector-actions">
                    <OpsButton size="sm" variant="ghost" onClick={() => setBookingFor(null)}>Cancel</OpsButton>
                    <OpsButton size="sm" variant="primary" onClick={() => onBook(tender)} disabled={!bookingReference.trim() || busy}>{busy ? "Confirming…" : "Confirm booking"}</OpsButton>
                  </div>
                </div>
              ) : (
                <div className="ops-inspector-actions plan-section-actions"><OpsButton size="sm" variant="primary" onClick={() => setBookingFor(tender.id)}>Confirm booking</OpsButton></div>
              )}
            </OpsInspectorSection>
          ) : null}
        </div>
      </div>
      {canManage && tenderCanCancel(tender.status) ? (
        <footer className="ops-inspector-footer">
          <OpsButton size="sm" variant="danger" onClick={() => onCancel(tender)} disabled={busy}>Cancel tender</OpsButton>
        </footer>
      ) : null}
    </aside>
  );
}
