"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link2,
  Mail,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  Plus,
  Send,
  UserRound,
} from "lucide-react";
import { quoteCurrencies } from "./admin-data";
import type { QuoteCrmMatch, QuoteCurrency, QuoteDetail, QuoteStatus, QuoteSummary } from "./admin-data";
import { AdminShipmentPanel } from "./admin-shipment-panel";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsSearch, OpsSurface } from "./operations-ui";
import { SavedFilterViews } from "./saved-filter-views";

const statusLabels: Record<QuoteStatus, string> = { new: "New", reviewing: "Reviewing", quoted: "Quoted", won: "Won", lost: "Lost" };
const statusOptions: Array<"all" | QuoteStatus> = ["all", "new", "reviewing", "quoted", "won", "lost"];
const detailTabs = ["overview", "pricing", "shipment", "activity"] as const;
type DetailTab = (typeof detailTabs)[number];

const modeLabels: Record<string, string> = { air: "Air freight", sea: "Sea freight", road: "Road freight", unsure: "Mode not decided" };

function statusTone(status: QuoteStatus): "info" | "warning" | "violet" | "success" | "danger" {
  if (status === "new") return "info";
  if (status === "reviewing") return "warning";
  if (status === "quoted") return "violet";
  if (status === "won") return "success";
  return "danger";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function cargoDimensions(quote: QuoteDetail) {
  if (![quote.length, quote.width, quote.height].some(Boolean)) return "Not provided";
  return `${quote.length || "—"} × ${quote.width || "—"} × ${quote.height || "—"} ${quote.dimension_unit || ""}`.trim();
}

function cargoWeight(quote: QuoteDetail) {
  return quote.weight ? `${quote.weight} ${quote.weight_unit || ""}`.trim() : "Not provided";
}

function amountNumber(value: string | null) {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function formatMoney(value: string | number, currency: QuoteCurrency) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function commercialMetrics(quote: QuoteDetail) {
  const quoted = amountNumber(quote.quoted_amount);
  const cost = amountNumber(quote.internal_cost);
  if (quoted === null || quoted <= 0 || cost === null) return null;
  const profit = quoted - cost;
  return { quoted, cost, profit, margin: (profit / quoted) * 100 };
}

function quoteEmail(quote: QuoteDetail) {
  const price = quote.quoted_amount ? formatMoney(quote.quoted_amount, quote.quote_currency) : "To be confirmed";
  const validity = quote.valid_until ? formatDateOnly(quote.valid_until) : "As discussed";
  const greetingName = quote.contact_name.trim().split(/\s+/)[0] || quote.contact_name;
  const lines = [
    `Dear ${greetingName},`, "", "Thank you for your freight enquiry with Kapileshwor Cargo Pvt. Ltd. (KCPL).", "",
    `Quote reference: ${quote.reference}`, `Route: ${quote.origin} → ${quote.destination}`,
    `Mode: ${modeLabels[quote.mode] ?? quote.mode}`, `Quoted price: ${price}`, `Valid until: ${validity}`,
  ];
  if (quote.customer_quote_note?.trim()) lines.push("", quote.customer_quote_note.trim());
  lines.push("", "Please reply to this email if you would like to proceed or if you need any changes to the quotation.", "", "Regards,", "Kapileshwor Cargo Pvt. Ltd. (KCPL)");
  return { subject: `KCPL Freight Quote ${quote.reference}: ${quote.origin} to ${quote.destination}`, body: lines.join("\n") };
}

export function AdminDashboard({ initialQuotes }: { initialQuotes: QuoteSummary[] }) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [selectedReference, setSelectedReference] = useState(initialQuotes[0]?.reference ?? "");
  const [detail, setDetail] = useState<QuoteDetail | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuoteStatus>("all");
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [loading, setLoading] = useState(Boolean(initialQuotes[0]));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [manualCustomerId, setManualCustomerId] = useState("");

  const statusCounts = useMemo<Record<QuoteStatus, number>>(() => ({
    new: quotes.filter((quote) => quote.status === "new").length,
    reviewing: quotes.filter((quote) => quote.status === "reviewing").length,
    quoted: quotes.filter((quote) => quote.status === "quoted").length,
    won: quotes.filter((quote) => quote.status === "won").length,
    lost: quotes.filter((quote) => quote.status === "lost").length,
  }), [quotes]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (statusFilter !== "all" && quote.status !== statusFilter) return false;
      if (!needle) return true;
      return [quote.reference, quote.origin, quote.destination, quote.contact_name, quote.company_name ?? "", quote.assigned_to ?? ""].join(" ").toLowerCase().includes(needle);
    });
  }, [query, quotes, statusFilter]);

  const loadDetail = useCallback(async (reference: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/admin/quotes/${encodeURIComponent(reference)}`, { cache: "no-store", signal });
    const data = await response.json() as { quote?: QuoteDetail; error?: string };
    if (!response.ok || !data.quote) throw new Error(data.error || "Could not load the enquiry.");
    setDetail(data.quote);
    return data.quote;
  }, []);

  useEffect(() => {
    if (!selectedReference) return;
    const controller = new AbortController();
    loadDetail(selectedReference, controller.signal)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDetail(null);
        setNotice(error instanceof Error ? error.message : "Could not load the enquiry.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [loadDetail, selectedReference]);

  function selectQuote(reference: string) {
    if (reference === selectedReference) return;
    setLoading(true); setDetail(null); setNotice(""); setActiveTab("overview"); setManualCustomerId(""); setSelectedReference(reference);
  }

  async function refreshDetail(message?: string) {
    if (!detail) return;
    const next = await loadDetail(detail.reference);
    setManualCustomerId("");
    if (message) setNotice(message);
    if (next.shipment) setQuotes((current) => current.map((quote) => quote.reference === next.reference ? { ...quote, status: next.status, assigned_to: next.assigned_to } : quote));
  }

  async function linkCustomer(customerId: string) {
    if (!detail || !customerId.trim()) return;
    setSaving(true); setNotice("");
    try {
      const id = customerId.trim().toUpperCase();
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(id)}/quote-links`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quoteReference: detail.reference }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not confirm the CRM customer.");
      await refreshDetail(`CRM customer ${id} confirmed for this enquiry.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not confirm the CRM customer."); }
    finally { setSaving(false); }
  }

  async function createCustomerFromEnquiry() {
    if (!detail) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create_customer" }),
      });
      const data = await response.json() as { customerId?: string; error?: string; matches?: QuoteCrmMatch[] };
      if (!response.ok) {
        if (data.matches?.length) setDetail((current) => current ? { ...current, crm_matches: data.matches ?? current.crm_matches, crm_match_state: "suggested" } : current);
        throw new Error(data.error || "Could not create the CRM customer.");
      }
      await refreshDetail(`Customer ${data.customerId ?? "record"} created and linked to this enquiry.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create the CRM customer."); }
    finally { setSaving(false); }
  }

  async function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    if (detail.status === "won" && !detail.customer_id) {
      setNotice("Confirm or create the CRM customer before marking this quote Won.");
      return;
    }
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "workflow", status: detail.status, assignedTo: detail.assigned_to ?? "" }),
      });
      const data = await response.json() as { shipment?: QuoteDetail["shipment"]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the enquiry workflow.");
      setQuotes((current) => current.map((quote) => quote.reference === detail.reference ? { ...quote, status: detail.status, assigned_to: detail.assigned_to } : quote));
      if (data.shipment) {
        setDetail((current) => current ? { ...current, shipment: data.shipment ?? current.shipment } : current);
        setNotice(`Quote won. Shipment ${data.shipment.reference} and its controlled Job File are ready.`);
        setActiveTab("shipment");
      } else setNotice("Enquiry workflow updated.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the enquiry workflow."); }
    finally { setSaving(false); }
  }

  async function persistCommercial(showNotice = true) {
    if (!detail) return false;
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "commercial", currency: detail.quote_currency, quotedAmount: detail.quoted_amount ?? "", internalCost: detail.internal_cost ?? "", validUntil: detail.valid_until ?? "", customerNote: detail.customer_quote_note ?? "" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save pricing.");
      if (showNotice) setNotice("Pricing saved.");
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save pricing."); return false; }
    finally { setSaving(false); }
  }

  async function saveCommercial(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await persistCommercial(); }

  async function sendQuote() {
    if (!detail) return;
    if (!detail.quoted_amount?.trim()) { setNotice("Add a customer price before preparing the quote email."); return; }
    const saved = await persistCommercial(false);
    if (!saved) return;
    const email = quoteEmail(detail);
    setNotice("Quote saved. Opening a customer email draft.");
    window.location.href = `mailto:${encodeURIComponent(detail.contact_email)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !noteDraft.trim()) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: noteDraft }) });
      const data = await response.json() as { note?: QuoteDetail["notes"][number]; error?: string };
      if (!response.ok || !data.note) throw new Error(data.error || "Could not save the note.");
      setDetail((current) => current ? { ...current, notes: [data.note!, ...current.notes], note_count: current.note_count + 1 } : current);
      setQuotes((current) => current.map((quote) => quote.reference === detail.reference ? { ...quote, note_count: quote.note_count + 1 } : quote));
      setNoteDraft(""); setNotice("Internal note added.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the note."); }
    finally { setSaving(false); }
  }

  const metrics = detail ? commercialMetrics(detail) : null;

  return (
    <main className="min-h-[calc(100vh-58px)] bg-[#f8f6f3]">
      <div className="ops-split">
        <aside className="ops-split-list flex max-h-[46vh] min-h-0 flex-col lg:max-h-[calc(100vh-58px)]">
          <div className="border-b border-[#e9e2dc] p-4">
            <div className="flex items-end justify-between gap-3"><div><p className="ops-eyebrow">Enquiry desk</p><h1 className="mt-1 text-[18px] font-[730] tracking-[-.035em] text-[#3b342f]">Freight requests</h1></div><span className="text-[9px] font-semibold text-[#9c928a]">{filtered.length}/{quotes.length}</span></div>
            <OpsSearch className="mt-3" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, customer or route"/>
            <div className="ops-filter-pills mt-3">{statusOptions.map((item) => <button key={item} type="button" className="ops-filter-pill" data-active={statusFilter === item || undefined} onClick={() => setStatusFilter(item)}>{item === "all" ? "All" : statusLabels[item]} <span className="ml-1 opacity-55">{item === "all" ? quotes.length : statusCounts[item]}</span></button>)}</div>
            <SavedFilterViews storageKey="kcpl-enquiry-saved-views-v1" query={query} status={statusFilter} onApply={(view) => { setQuery(view.query); setStatusFilter(view.status); }}/>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length ? filtered.map((quote) => {
              const selected = selectedReference === quote.reference;
              return <button key={quote.reference} type="button" onClick={() => selectQuote(quote.reference)} className="ops-record-row block w-full border-b border-[#eee7e1] px-4 py-3.5 text-left" data-selected={selected || undefined}>
                <div className="flex items-center justify-between gap-2"><OpsMono className="truncate text-[10px] text-[#514840]">{quote.reference}</OpsMono><OpsBadge tone={statusTone(quote.status)} dot>{statusLabels[quote.status]}</OpsBadge></div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#514840]"><span className="truncate">{quote.origin}</span><ArrowRight size={11} className="shrink-0 text-[#c47b64]"/><span className="truncate">{quote.destination}</span></div>
                <p className="mt-1 truncate text-[9px] text-[#857b73]">{quote.company_name || quote.contact_name}{quote.assigned_to ? ` · ${quote.assigned_to}` : ""}</p>
                <div className="mt-2 flex items-center justify-between text-[8px] text-[#a0968e]"><span>{formatDate(quote.created_at)}</span>{quote.note_count ? <span className="flex items-center gap-1"><MessageSquareText size={10}/>{quote.note_count}</span> : null}</div>
              </button>;
            }) : <OpsEmptyState title="No enquiries match" description="Try a different status or search term."/>}
          </div>
        </aside>

        <section className="ops-split-detail min-h-0 overflow-y-auto">
          {!selectedReference ? <OpsEmptyState icon={<Package size={18}/>} title="Choose an enquiry" description="Select a freight request from the inbox to review cargo, price the job and convert it into a shipment."/> : null}
          {loading ? <div className="grid min-h-[55vh] place-items-center text-[10px] font-semibold text-[#90867e]">Loading enquiry…</div> : null}
          {!loading && selectedReference && !detail ? <div className="p-5"><OpsNotice tone="danger">{notice || "This enquiry could not be loaded."}</OpsNotice></div> : null}

          {!loading && detail ? <>
            <header className="sticky top-[58px] z-20 border-b border-[#e8e0d9] bg-[#fffdfa]/94 px-5 py-4 backdrop-blur-xl lg:top-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><OpsMono className="text-[9px] text-[#a06451]">{detail.reference}</OpsMono><OpsBadge tone={statusTone(detail.status)} dot>{statusLabels[detail.status]}</OpsBadge>{detail.customer_id ? <OpsBadge tone="success">CRM linked</OpsBadge> : <OpsBadge tone="warning">CRM customer required</OpsBadge>}</div><h2 className="mt-2 flex items-center gap-2 text-[22px] font-[735] tracking-[-.045em] text-[#3a322d]"><span className="truncate">{detail.origin}</span><ArrowRight size={15} className="shrink-0 text-[#c87960]"/><span className="truncate">{detail.destination}</span></h2><p className="mt-1 text-[9px] text-[#968c84]">{detail.company_name || detail.contact_name} · received {formatDate(detail.created_at)}</p></div>
                <div className="flex flex-wrap items-center gap-2"><a href={`mailto:${detail.contact_email}`} className="ops-button" data-variant="secondary" data-size="sm"><Mail size={11}/>Email</a>{detail.phone ? <a href={`tel:${detail.phone}`} className="ops-button" data-variant="secondary" data-size="sm"><Phone size={11}/>Call</a> : null}{detail.quoted_amount ? <OpsButton variant="primary" size="sm" onClick={sendQuote}><Send size={11}/>Prepare quote email</OpsButton> : null}</div>
              </div>
              <nav className="ops-segmented mt-4">{detailTabs.map((tab) => <button key={tab} type="button" data-active={activeTab === tab || undefined} onClick={() => setActiveTab(tab)}>{tab === "activity" ? `Activity${detail.note_count ? ` · ${detail.note_count}` : ""}` : tab}</button>)}</nav>
            </header>

            <div className="ops-content ops-stack">
              {notice ? <OpsNotice tone={notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("required") || notice.toLowerCase().includes("duplicate") ? "warning" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

              {activeTab === "overview" ? <div className="ops-grid-main">
                <div className="ops-stack">
                  <OpsSurface eyebrow="Request" title="Cargo & route" description="The customer’s original freight requirement.">
                    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><Info icon={<MapPin size={12}/>} label="Route" value={`${detail.origin} → ${detail.destination}`}/><Info icon={<Package size={12}/>} label="Mode" value={modeLabels[detail.mode] ?? detail.mode}/><Info label="Cargo type" value={detail.cargo_type || "Not provided"}/><Info label="Weight" value={cargoWeight(detail)}/><Info label="Dimensions" value={cargoDimensions(detail)}/><Info icon={<Clock3 size={12}/>} label="Preferred timing" value={detail.timing || "Not provided"}/></div>
                    {detail.requirements ? <div className="mt-5 border-t border-[#eee7e1] pt-4"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9d938b]">Customer requirements</p><p className="mt-2 whitespace-pre-wrap text-[10px] leading-6 text-[#6c625a]">{detail.requirements}</p></div> : null}
                  </OpsSurface>
                  <OpsSurface eyebrow="Contact" title="Customer"><div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><Info icon={<UserRound size={12}/>} label="Name" value={detail.contact_name}/><Info icon={<Building2 size={12}/>} label="Company" value={detail.company_name || "Not provided"}/><Info icon={<Mail size={12}/>} label="Email" value={detail.contact_email} href={`mailto:${detail.contact_email}`}/><Info icon={<Phone size={12}/>} label="Phone" value={detail.phone || "Not provided"} href={detail.phone ? `tel:${detail.phone}` : undefined}/><Info icon={<CalendarDays size={12}/>} label="Validity" value={detail.valid_until ? formatDateOnly(detail.valid_until) : "Not set"}/></div></OpsSurface>
                </div>

                <aside className="ops-stack xl:sticky xl:top-[132px]">
                  <CustomerControl detail={detail} saving={saving} manualCustomerId={manualCustomerId} onManualCustomerId={setManualCustomerId} onLink={linkCustomer} onCreate={createCustomerFromEnquiry}/>
                  <OpsSurface eyebrow="Workflow" title="Ownership & status" description={detail.customer_id ? "Customer ownership is confirmed. Won conversion can safely create the shipment and Job File." : "Won is intentionally blocked until a CRM customer is confirmed."}>
                    <form onSubmit={saveQuote} className="grid gap-3"><OpsField label="Status"><select value={detail.status} onChange={(event) => setDetail({ ...detail, status: event.target.value as QuoteStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></OpsField><OpsField label="Assigned to"><input value={detail.assigned_to ?? ""} onChange={(event) => setDetail({ ...detail, assigned_to: event.target.value })} placeholder="Staff member or branch" maxLength={120}/></OpsField><OpsButton variant="primary" disabled={saving || (detail.status === "won" && !detail.customer_id)}>{saving ? "Saving…" : detail.status === "won" && !detail.customer_id ? "Confirm customer first" : "Save workflow"}</OpsButton></form>
                  </OpsSurface>
                  <OpsSurface eyebrow="Commercial" title="Quote snapshot"><div className="grid grid-cols-2 gap-2"><Snapshot label="Customer price" value={detail.quoted_amount ? formatMoney(detail.quoted_amount, detail.quote_currency) : "Not quoted"}/><Snapshot label="Margin" value={metrics ? `${metrics.margin.toFixed(1)}%` : "—"}/></div><OpsButton variant="ghost" size="sm" className="mt-3" onClick={() => setActiveTab("pricing")}>Open pricing workspace <ArrowRight size={11}/></OpsButton></OpsSurface>
                  {detail.shipment ? <OpsSurface eyebrow="Won business" title={<OpsMono>{detail.shipment.reference}</OpsMono>} description="A shipment and controlled Digital Job File already exist for this quote."><div className="flex flex-wrap gap-2"><OpsButton variant="ghost" size="sm" onClick={() => setActiveTab("shipment")}>Shipment workspace</OpsButton><a href={`/admin/jobs/${encodeURIComponent(detail.shipment.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Digital Job File</a></div></OpsSurface> : null}
                </aside>
              </div> : null}

              {activeTab === "pricing" ? <OpsSurface eyebrow="Pricing worksheet" title="Build the customer offer" description="Sell price, internal cost and margin stay visible together. Internal cost never enters the customer email.">
                <form onSubmit={saveCommercial} className="grid gap-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><OpsField label="Currency"><select value={detail.quote_currency} onChange={(event) => setDetail({ ...detail, quote_currency: event.target.value as QuoteCurrency })}>{quoteCurrencies.map((currency) => <option value={currency} key={currency}>{currency}</option>)}</select></OpsField><OpsField label="Customer price"><input inputMode="decimal" value={detail.quoted_amount ?? ""} onChange={(event) => setDetail({ ...detail, quoted_amount: event.target.value })} placeholder="0.00"/></OpsField><OpsField label="Internal cost" hint="KCPL only"><input inputMode="decimal" value={detail.internal_cost ?? ""} onChange={(event) => setDetail({ ...detail, internal_cost: event.target.value })} placeholder="0.00"/></OpsField><OpsField label="Valid until"><input type="date" value={detail.valid_until ?? ""} onChange={(event) => setDetail({ ...detail, valid_until: event.target.value })}/></OpsField></div>
                  <div className="grid gap-2 sm:grid-cols-4"><PricingMetric label="Sell" value={detail.quoted_amount ? formatMoney(detail.quoted_amount, detail.quote_currency) : "—"}/><PricingMetric label="Cost" value={detail.internal_cost ? formatMoney(detail.internal_cost, detail.quote_currency) : "—"}/><PricingMetric label="Profit" value={metrics ? formatMoney(metrics.profit, detail.quote_currency) : "—"} tone={metrics && metrics.profit < 0 ? "danger" : "success"}/><PricingMetric label="Margin" value={metrics ? `${metrics.margin.toFixed(1)}%` : "—"} tone={metrics && metrics.margin < 10 ? "warning" : "success"}/></div>
                  <OpsField label="Customer-facing note" hint="Included in the prepared quote email"><textarea value={detail.customer_quote_note ?? ""} onChange={(event) => setDetail({ ...detail, customer_quote_note: event.target.value })} placeholder="Scope, inclusions, exclusions, transit assumptions or next steps…"/></OpsField>
                  <div className="flex flex-wrap gap-2"><OpsButton variant="primary" disabled={saving}>{saving ? "Saving…" : "Save pricing"}</OpsButton><OpsButton type="button" variant="secondary" disabled={saving || !detail.quoted_amount?.trim()} onClick={sendQuote}><Send size={12}/>Save & prepare email</OpsButton></div>
                </form>
              </OpsSurface> : null}

              {activeTab === "shipment" ? <OpsSurface eyebrow="Shipment" title={detail.shipment ? <OpsMono>{detail.shipment.reference}</OpsMono> : "Shipment workspace"} description={detail.shipment ? "Continue operational tracking without leaving the enquiry context. Workflow guards apply to controlled status changes." : detail.customer_id ? "A shipment is created automatically when this enquiry is saved as Won." : "Confirm the CRM customer first; then Won will create the shipment automatically."}><AdminShipmentPanel shipment={detail.shipment} quoteStatus={detail.status} onShipmentChange={(shipment) => setDetail((current) => current ? { ...current, shipment } : current)} onNotice={setNotice}/></OpsSurface> : null}

              {activeTab === "activity" ? <OpsSurface eyebrow="Internal activity" title="Notes & decisions" description="A lightweight record of the conversation around this enquiry.">
                <form onSubmit={addNote} className="flex flex-col gap-2 sm:flex-row"><textarea className="ops-input min-h-[74px] flex-1 resize-y" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add an internal note, customer callback, pricing decision or follow-up…"/><OpsButton variant="primary" disabled={saving || !noteDraft.trim()}><MessageSquareText size={12}/>Add note</OpsButton></form>
                <div className="mt-5 divide-y divide-[#eee7e1]">{detail.notes.length ? detail.notes.map((note) => <article key={note.id} className="py-3.5"><p className="whitespace-pre-wrap text-[10px] leading-5 text-[#615850]">{note.note}</p><p className="mt-2 text-[8px] font-semibold text-[#9e948c]">{note.author_name || note.author_email} · {formatDate(note.created_at)}</p></article>) : <OpsEmptyState icon={<MessageSquareText size={17}/>} title="No internal notes yet" description="Use notes for decisions and follow-ups that do not belong in the customer-facing quote."/>}</div>
              </OpsSurface> : null}
            </div>
          </> : null}
        </section>
      </div>
    </main>
  );
}

function CustomerControl({ detail, saving, manualCustomerId, onManualCustomerId, onLink, onCreate }: { detail: QuoteDetail; saving: boolean; manualCustomerId: string; onManualCustomerId: (value: string) => void; onLink: (customerId: string) => void; onCreate: () => void }) {
  if (detail.customer_id) {
    return <OpsSurface eyebrow="CRM customer" title="Confirmed account" description="This ownership flows into the shipment, Job File, Customer 360 and Finance."><div className="flex items-center justify-between gap-3 rounded-[11px] border border-[#d8e2d8] bg-[#f4f8f4] p-3"><div className="min-w-0"><p className="flex items-center gap-1.5 text-[9px] font-bold text-[#607563]"><CheckCircle2 size={12}/>Customer linked</p><OpsMono className="mt-1 block truncate text-[9px] text-[#667067]">{detail.customer_id}</OpsMono></div><a href={`/admin/crm/${encodeURIComponent(detail.customer_id)}`} className="ops-button" data-variant="secondary" data-size="sm">Customer 360 <ArrowRight size={10}/></a></div></OpsSurface>;
  }

  return <OpsSurface eyebrow="CRM customer" title="Confirm customer before Won" description="We will never invent the customer relationship. Confirm a suggested account, enter a known KCPL-C reference, or create a new prospect only when no duplicate exists.">
    {detail.crm_matches.length ? <div className="grid gap-2">{detail.crm_matches.slice(0, 4).map((match) => <button type="button" disabled={saving} key={match.id} onClick={() => onLink(match.id)} className="flex items-center justify-between gap-3 rounded-[11px] border border-[#e7dfd8] bg-[#faf8f5] p-3 text-left transition hover:border-[#d9c2b7] hover:bg-[#fff8f4]"><div className="min-w-0"><p className="truncate text-[9px] font-bold text-[#514840]">{match.display_name}</p><p className="mt-1 text-[8px] text-[#948a82]">Match: {match.reason || "existing CRM details"} · <OpsMono>{match.id}</OpsMono></p></div><span className="shrink-0 text-[8px] font-bold text-[#b36a55]">Confirm</span></button>)}</div> : <div className="rounded-[11px] border border-[#eadfd4] bg-[#fffaf4] p-3 text-[9px] leading-5 text-[#806f60]">No existing CRM match was found for this enquiry.</div>}
    <div className="mt-3 grid gap-2"><OpsField label="Known customer reference" hint="Optional"><input value={manualCustomerId} onChange={(event) => onManualCustomerId(event.target.value.toUpperCase())} placeholder="KCPL-C-…"/></OpsField><div className="flex flex-wrap gap-2"><OpsButton variant="secondary" size="sm" type="button" disabled={saving || !manualCustomerId.trim()} onClick={() => onLink(manualCustomerId)}><Link2 size={11}/>Link reference</OpsButton><OpsButton variant="primary" size="sm" type="button" disabled={saving} onClick={onCreate}><Plus size={11}/>Create from enquiry</OpsButton></div></div>
  </OpsSurface>;
}

function Info({ icon, label, value, href }: { icon?: React.ReactNode; label: string; value: string; href?: string }) {
  const content = <p className="mt-1.5 break-words text-[10px] font-semibold text-[#5c534c]">{value}</p>;
  return <div><p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">{icon}{label}</p>{href ? <a href={href} className="hover:underline">{content}</a> : content}</div>;
}

function Snapshot({ label, value }: { label: string; value: string }) { return <div className="rounded-[12px] border border-[#ebe3dc] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#9b9189]">{label}</p><p className="mt-1.5 text-[11px] font-bold text-[#514840]">{value}</p></div>; }

function PricingMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <div className="rounded-[13px] border border-[#e8e0d9] bg-[#faf7f4] p-4"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">{label}</p><strong className={`mt-1.5 block text-[17px] tracking-[-.035em] ${tone === "success" ? "text-[#66806b]" : tone === "warning" ? "text-[#9a682f]" : tone === "danger" ? "text-[#b65355]" : "text-[#4d443e]"}`}>{value}</strong></div>;
}
