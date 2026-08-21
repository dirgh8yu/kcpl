"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const NEPAL_TIME_ZONE = "Asia/Kathmandu";
const statusLabels: Record<QuoteStatus, string> = { new: "New", reviewing: "Reviewing", quoted: "Quoted", won: "Won", lost: "Lost" };
const statusOptions: Array<"all" | QuoteStatus> = ["all", "new", "reviewing", "quoted", "won", "lost"];
const detailTabs = ["overview", "pricing", "shipment", "activity"] as const;
const detailTabLabels: Record<DetailTab, string> = { overview: "Overview", pricing: "Pricing", shipment: "Shipment", activity: "Activity" };
type DetailTab = (typeof detailTabs)[number];
type NoticeTone = "neutral" | "success" | "warning" | "danger";
type NoticeState = { message: string; tone: NoticeTone };

const modeLabels: Record<string, string> = { air: "Air freight", sea: "Sea freight", road: "Road freight", rail: "Rail freight", multimodal: "Multimodal freight", unsure: "Mode not decided" };

function modeLabel(mode: string) {
  return modeLabels[mode.toLowerCase()] ?? mode || "Freight";
}

function statusTone(status: QuoteStatus): "neutral" | "info" | "warning" | "success" {
  if (status === "new") return "info";
  if (status === "reviewing") return "warning";
  if (status === "quoted") return "info";
  if (status === "won") return "success";
  return "neutral";
}

function noticeTone(message: string): NoticeTone {
  const value = message.toLowerCase();
  if (["could not", "failed", "unavailable", "not configured", "without a shipment"].some((term) => value.includes(term))) return "danger";
  if (["required", "must", "expired", "locked", "blocked", "duplicate", "reopen", "cannot", "warning"].some((term) => value.includes(term))) return "warning";
  return "success";
}

function formatDate(value: string) {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: NEPAL_TIME_ZONE }).format(date)} NPT`;
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(date);
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

function quoteEmailDraft(quote: QuoteDetail) {
  const price = quote.quoted_amount ? formatMoney(quote.quoted_amount, quote.quote_currency) : "To be confirmed";
  const validity = quote.valid_until ? formatDateOnly(quote.valid_until) : "As discussed";
  const greetingName = quote.contact_name.trim().split(/\s+/)[0] || quote.contact_name;
  const lines = [
    `Dear ${greetingName},`, "", "Thank you for your freight enquiry with Kapileshwor Cargo Pvt. Ltd. (KCPL).", "",
    `Quote reference: ${quote.reference}`, `Route: ${quote.origin} → ${quote.destination}`,
    `Mode: ${modeLabel(quote.mode)}`, `Quoted price: ${price}`, `Valid until: ${validity}`,
  ];
  if (quote.customer_quote_note?.trim()) lines.push("", quote.customer_quote_note.trim());
  lines.push("", "Please reply to this email if you would like to proceed or if you need any changes to the quotation.", "", "Regards,", "Kapileshwor Cargo Pvt. Ltd. (KCPL)");
  return { subject: `KCPL Freight Quote ${quote.reference}: ${quote.origin} to ${quote.destination}`, body: lines.join("\n") };
}

function summaryFromDetail(detail: QuoteDetail): QuoteSummary {
  return {
    reference: detail.reference,
    created_at: detail.created_at,
    status: detail.status,
    origin: detail.origin,
    destination: detail.destination,
    mode: detail.mode,
    cargo_type: detail.cargo_type,
    contact_name: detail.contact_name,
    contact_email: detail.contact_email,
    company_name: detail.company_name,
    phone: detail.phone,
    customer_id: detail.customer_id,
    assigned_to: detail.assigned_to,
    note_count: detail.note_count,
    email_count: detail.email_count,
    last_customer_email_at: detail.last_customer_email_at,
  };
}

function workflowStatuses(current: QuoteStatus, canEditCommercial: boolean): QuoteStatus[] {
  if (current === "won") return ["won"];
  if (canEditCommercial) return ["new", "reviewing", "quoted", "won", "lost"];
  if (current === "new" || current === "reviewing") return ["new", "reviewing"];
  return [current];
}

export function AdminDashboard({ initialQuotes, canViewCommercial, canEditCommercial }: { initialQuotes: QuoteSummary[]; canViewCommercial: boolean; canEditCommercial: boolean }) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [selectedReference, setSelectedReference] = useState(initialQuotes[0]?.reference ?? "");
  const [detail, setDetail] = useState<QuoteDetail | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuoteStatus>("all");
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [loading, setLoading] = useState(Boolean(initialQuotes[0]));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [manualCustomerId, setManualCustomerId] = useState("");
  const detailRequest = useRef(0);

  const showNotice = useCallback((message: string, tone?: NoticeTone) => {
    setNotice(message ? { message, tone: tone ?? noticeTone(message) } : null);
  }, []);

  const statusCounts = useMemo<Record<QuoteStatus, number>>(() => ({
    new: quotes.filter((quote) => quote.status === "new").length,
    reviewing: quotes.filter((quote) => quote.status === "reviewing").length,
    quoted: quotes.filter((quote) => quote.status === "quoted").length,
    won: quotes.filter((quote) => quote.status === "won").length,
    lost: quotes.filter((quote) => quote.status === "lost").length,
  }), [quotes]);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return quotes.filter((quote) => {
      if (statusFilter !== "all" && quote.status !== statusFilter) return false;
      if (!terms.length) return true;
      const haystack = [
        quote.reference,
        quote.origin,
        quote.destination,
        quote.contact_name,
        quote.contact_email,
        quote.company_name ?? "",
        quote.phone ?? "",
        quote.cargo_type ?? "",
        quote.customer_id ?? "",
        quote.assigned_to ?? "",
        modeLabel(quote.mode),
        statusLabels[quote.status],
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [query, quotes, statusFilter]);

  const availableTabs = useMemo(() => detailTabs.filter((tab) => tab !== "pricing" || canViewCommercial), [canViewCommercial]);
  const activityItems = useMemo(() => {
    if (!detail) return [];
    return [
      ...detail.notes.map((note) => ({ kind: "note" as const, id: `note-${note.id}`, at: note.created_at, note })),
      ...detail.communications.map((communication) => ({ kind: "email" as const, id: `email-${communication.id}`, at: communication.sent_at || communication.created_at, communication })),
    ].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  }, [detail]);

  const loadDetail = useCallback(async (reference: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/admin/quotes/${encodeURIComponent(reference)}`, { cache: "no-store", signal });
    const data = await response.json() as { quote?: QuoteDetail; error?: string };
    if (!response.ok || !data.quote) throw new Error(data.error || "Could not load the enquiry.");
    return data.quote;
  }, []);

  useEffect(() => {
    if (!selectedReference) return;
    const controller = new AbortController();
    const requestId = ++detailRequest.current;
    loadDetail(selectedReference, controller.signal)
      .then((quote) => {
        if (requestId !== detailRequest.current || controller.signal.aborted) return;
        setDetail(quote);
      })
      .catch((error) => {
        if (controller.signal.aborted || requestId !== detailRequest.current) return;
        setDetail(null);
        showNotice(error instanceof Error ? error.message : "Could not load the enquiry.", "danger");
      })
      .finally(() => {
        if (requestId === detailRequest.current && !controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadDetail, selectedReference, showNotice]);

  function syncSummary(next: QuoteDetail) {
    setQuotes((current) => current.map((quote) => quote.reference === next.reference ? summaryFromDetail(next) : quote));
  }

  function selectQuote(reference: string) {
    if (reference === selectedReference) return;
    setLoading(true);
    setDetail(null);
    setNotice(null);
    setActiveTab("overview");
    setManualCustomerId("");
    setSelectedReference(reference);
  }

  async function refreshDetail(message?: string, tone: NoticeTone = "success") {
    if (!detail) return null;
    const next = await loadDetail(detail.reference);
    setDetail(next);
    syncSummary(next);
    setManualCustomerId("");
    if (message) showNotice(message, tone);
    return next;
  }

  async function linkCustomer(customerId: string) {
    if (!detail || !customerId.trim()) return;
    setSaving(true); setNotice(null);
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
    } catch (error) { showNotice(error instanceof Error ? error.message : "Could not confirm the CRM customer."); }
    finally { setSaving(false); }
  }

  async function createCustomerFromEnquiry() {
    if (!detail) return;
    setSaving(true); setNotice(null);
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
    } catch (error) { showNotice(error instanceof Error ? error.message : "Could not create the CRM customer."); }
    finally { setSaving(false); }
  }

  async function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    if (detail.status === "won" && !detail.customer_id) {
      showNotice("Confirm or create the CRM customer before marking this quote Won.", "warning");
      return;
    }
    setSaving(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "workflow", status: detail.status, assignedTo: detail.assigned_to ?? "" }),
      });
      const data = await response.json() as { status?: QuoteStatus; assignedTo?: string; shipment?: QuoteDetail["shipment"]; shipmentWarning?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the enquiry workflow.");

      const nextDetail: QuoteDetail = {
        ...detail,
        status: data.status ?? detail.status,
        assigned_to: data.assignedTo ?? detail.assigned_to,
        shipment: data.shipment ?? detail.shipment,
      };
      setDetail(nextDetail);
      syncSummary(nextDetail);

      if (data.shipmentWarning) {
        showNotice(data.shipmentWarning, "warning");
      } else if (data.shipment) {
        showNotice(`Quote accepted. Shipment ${data.shipment.reference} and its controlled Job File are ready.`, "success");
        setActiveTab("shipment");
      } else {
        showNotice("Enquiry workflow updated.", "success");
      }
    } catch (error) { showNotice(error instanceof Error ? error.message : "Could not save the enquiry workflow."); }
    finally { setSaving(false); }
  }

  async function persistCommercial(showSuccess = true) {
    if (!detail) return false;
    if (!canEditCommercial) {
      showNotice("Your KCPL staff role has read-only access to commercial pricing.", "warning");
      return false;
    }
    setSaving(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "commercial", currency: detail.quote_currency, quotedAmount: detail.quoted_amount ?? "", internalCost: detail.internal_cost ?? "", validUntil: detail.valid_until ?? "", customerNote: detail.customer_quote_note ?? "" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save pricing.");
      if (showSuccess) showNotice("Pricing saved.", "success");
      return true;
    } catch (error) { showNotice(error instanceof Error ? error.message : "Could not save pricing."); return false; }
    finally { setSaving(false); }
  }

  async function saveCommercial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistCommercial();
  }

  async function sendQuote() {
    if (!detail || !canEditCommercial) return;
    if (!detail.quoted_amount?.trim() || Number(detail.quoted_amount) <= 0) {
      showNotice("Add a customer price greater than zero before sending the quote email.", "warning");
      return;
    }
    const saved = await persistCommercial(false);
    if (!saved) return;

    setSaving(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}/email`, { method: "POST" });
      const data = await response.json() as { status?: QuoteStatus; to?: string; sentAt?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "The customer quote email could not be sent.");
      const next = await refreshDetail(`Quote email sent to ${data.to || detail.contact_email} and recorded in Activity.`, "success");
      if (next) setActiveTab("activity");
    } catch (error) { showNotice(error instanceof Error ? error.message : "The customer quote email could not be sent."); }
    finally { setSaving(false); }
  }

  async function openQuoteDraft() {
    if (!detail || !canEditCommercial) return;
    if (!detail.quoted_amount?.trim()) {
      showNotice("Add a customer price before opening the quote draft.", "warning");
      return;
    }
    const saved = await persistCommercial(false);
    if (!saved) return;
    const email = quoteEmailDraft(detail);
    window.location.href = `mailto:${encodeURIComponent(detail.contact_email)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !noteDraft.trim()) return;
    setSaving(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: noteDraft }) });
      const data = await response.json() as { note?: QuoteDetail["notes"][number]; error?: string };
      if (!response.ok || !data.note) throw new Error(data.error || "Could not save the note.");
      const next = { ...detail, notes: [data.note, ...detail.notes], note_count: detail.note_count + 1 };
      setDetail(next);
      syncSummary(next);
      setNoteDraft("");
      showNotice("Internal note added.", "success");
    } catch (error) { showNotice(error instanceof Error ? error.message : "Could not save the note."); }
    finally { setSaving(false); }
  }

  const metrics = detail && canViewCommercial ? commercialMetrics(detail) : null;
  const workflowOptions = detail ? workflowStatuses(detail.status, canEditCommercial) : [];
  const statusLocked = Boolean(detail && (detail.status === "won" || (!canEditCommercial && detail.status !== "new" && detail.status !== "reviewing")));

  return (
    <main className="min-h-[calc(100vh-58px)] bg-[#f3f1ee]">
      <div className="ops-split">
        <aside className="ops-split-list flex max-h-[48vh] min-h-0 flex-col lg:max-h-[calc(100vh-58px)]">
          <div className="border-b border-[#e2ddd8] bg-white/70 p-4">
            <div className="flex items-end justify-between gap-3"><div><p className="ops-eyebrow">Enquiry desk</p><h1 className="mt-1 text-[20px] font-[730] tracking-[-.035em] text-[#2f2a26]">Freight enquiries</h1></div><span className="text-[10px] font-semibold text-[#817a73]">{filtered.length} of {quotes.length}</span></div>
            <OpsSearch className="mt-3" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, route, cargo, contact or reference" aria-label="Search enquiries"/>
            <div className="ops-filter-pills mt-3">{statusOptions.map((item) => <button key={item} type="button" className="ops-filter-pill" data-active={statusFilter === item || undefined} onClick={() => setStatusFilter(item)}>{item === "all" ? "All" : statusLabels[item]} <span className="ml-1 opacity-60">{item === "all" ? quotes.length : statusCounts[item]}</span></button>)}</div>
            <SavedFilterViews storageKey="kcpl-enquiry-saved-views-v1" query={query} status={statusFilter} onApply={(view) => { setQuery(view.query); setStatusFilter(view.status); }}/>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length ? filtered.map((quote) => {
              const selected = selectedReference === quote.reference;
              return <button key={quote.reference} type="button" onClick={() => selectQuote(quote.reference)} className="ops-record-row block w-full border-b border-[#e8e3de] px-4 py-3.5 text-left" data-selected={selected || undefined}>
                <div className="flex items-center justify-between gap-2"><div className="ops-route min-w-0 text-[13px] font-semibold"><span className="truncate">{quote.origin || "Origin not recorded"}</span><ArrowRight size={11} className="ops-route-arrow shrink-0"/><span className="truncate">{quote.destination || "Destination not recorded"}</span></div><OpsBadge tone={statusTone(quote.status)} dot>{statusLabels[quote.status]}</OpsBadge></div>
                <p className="mt-1.5 truncate text-[11px] font-semibold text-[#554f49]">{quote.company_name || quote.contact_name} · {modeLabel(quote.mode)}</p>
                {quote.cargo_type ? <p className="mt-1 truncate text-[10px] text-[#817a73]">{quote.cargo_type}</p> : null}
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[#817a73]"><span className="min-w-0 truncate"><OpsMono>{quote.reference}</OpsMono>{quote.assigned_to ? ` · ${quote.assigned_to}` : " · Unassigned"}</span><span className="flex shrink-0 items-center gap-2">{quote.email_count ? <span className="flex items-center gap-1" title={`${quote.email_count} customer email${quote.email_count === 1 ? "" : "s"}`}><Mail size={10}/>{quote.email_count}</span> : null}{quote.note_count ? <span className="flex items-center gap-1" title={`${quote.note_count} internal note${quote.note_count === 1 ? "" : "s"}`}><MessageSquareText size={10}/>{quote.note_count}</span> : null}</span></div>
                <p className="mt-1.5 text-[9px] text-[#9a928b]">Received {formatDate(quote.created_at)}</p>
              </button>;
            }) : quotes.length ? <OpsEmptyState kind="search" title="No enquiries match" description="Change the search terms, status filter or saved view."/> : <OpsEmptyState compact kind="healthy" icon={<CheckCircle2 size={16}/>} title="Enquiry inbox is clear" description="New website freight enquiries will appear here automatically."/>}
          </div>
        </aside>

        <section className="ops-split-detail min-h-0 overflow-y-auto">
          {!selectedReference ? <OpsEmptyState kind={quotes.length ? "neutral" : "healthy"} icon={quotes.length ? <Package size={18}/> : <CheckCircle2 size={18}/>} title={quotes.length ? "Choose an enquiry" : "No enquiries waiting"} description={quotes.length ? "Select a freight enquiry to review the request, customer relationship, pricing and shipment handoff." : "The website enquiry inbox is currently clear."}/> : null}
          {loading ? <div className="grid min-h-[55vh] place-items-center" role="status"><div className="text-center"><span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-[#dfd8d2] border-t-[#df7159]"/><p className="mt-3 text-[11px] font-semibold text-[#817a73]">Loading enquiry…</p></div></div> : null}
          {!loading && selectedReference && !detail ? <div className="p-5"><OpsNotice tone="danger">{notice?.message || "This enquiry could not be loaded."}</OpsNotice></div> : null}

          {!loading && detail ? <>
            <header className="sticky top-[58px] z-20 border-b border-[#dfd9d3] bg-white/95 px-5 py-4 backdrop-blur-xl lg:top-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><OpsBadge tone={statusTone(detail.status)} dot>{statusLabels[detail.status]}</OpsBadge>{detail.customer_id ? <OpsBadge tone="success">CRM linked</OpsBadge> : <OpsBadge tone="warning">CRM customer required</OpsBadge>}<OpsMono className="text-[10px] text-[#8b6a5d]">{detail.reference}</OpsMono></div><h2 className="mt-2 flex items-center gap-2 text-[24px] font-[735] tracking-[-.045em] text-[#2f2a26]"><span className="truncate">{detail.origin || "Origin"}</span><ArrowRight size={16} className="shrink-0 text-[#c87960]"/><span className="truncate">{detail.destination || "Destination"}</span></h2><p className="mt-1 text-[11px] text-[#817a73]">{detail.company_name || detail.contact_name} · {modeLabel(detail.mode)} · received {formatDate(detail.created_at)}</p></div>
                <div className="flex flex-wrap items-center gap-2"><a href={`mailto:${detail.contact_email}`} className="ops-button" data-variant="secondary" data-size="sm"><Mail size={11}/>Email contact</a>{detail.phone ? <a href={`tel:${detail.phone}`} className="ops-button" data-variant="secondary" data-size="sm"><Phone size={11}/>Call</a> : null}{canEditCommercial && detail.quoted_amount ? <OpsButton variant="primary" size="sm" disabled={saving} onClick={sendQuote}><Send size={11}/>{saving ? "Working…" : "Send quote email"}</OpsButton> : null}</div>
              </div>
              <nav className="ops-segmented mt-4" aria-label="Enquiry sections">{availableTabs.map((tab) => <button key={tab} type="button" data-active={activeTab === tab || undefined} onClick={() => setActiveTab(tab)}>{tab === "activity" ? `${detailTabLabels[tab]} · ${detail.note_count + detail.email_count}` : detailTabLabels[tab]}</button>)}</nav>
            </header>

            <div className="ops-content ops-stack">
              {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.message}</OpsNotice> : null}

              {activeTab === "overview" ? <div className="ops-grid-main">
                <div className="ops-stack">
                  <OpsSurface eyebrow="Request" title="Cargo & route" description="The customer's original freight requirement.">
                    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><Info icon={<MapPin size={12}/>} label="Route" value={`${detail.origin || "Not recorded"} → ${detail.destination || "Not recorded"}`}/><Info icon={<Package size={12}/>} label="Mode" value={modeLabel(detail.mode)}/><Info label="Cargo type" value={detail.cargo_type || "Not provided"}/><Info label="Weight" value={cargoWeight(detail)}/><Info label="Dimensions" value={cargoDimensions(detail)}/><Info icon={<Clock3 size={12}/>} label="Preferred timing" value={detail.timing || "Not provided"}/></div>
                    {detail.requirements ? <div className="mt-5 border-t border-[#e8e3de] pt-4"><p className="text-[10px] font-semibold text-[#817a73]">Customer requirements</p><p className="mt-2 whitespace-pre-wrap text-[12px] leading-6 text-[#625b55]">{detail.requirements}</p></div> : null}
                  </OpsSurface>
                  <OpsSurface eyebrow="Contact" title="Customer contact"><div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><Info icon={<UserRound size={12}/>} label="Contact" value={detail.contact_name}/><Info icon={<Building2 size={12}/>} label="Company" value={detail.company_name || "Not provided"}/><Info icon={<Mail size={12}/>} label="Email" value={detail.contact_email} href={`mailto:${detail.contact_email}`}/><Info icon={<Phone size={12}/>} label="Phone" value={detail.phone || "Not provided"} href={detail.phone ? `tel:${detail.phone}` : undefined}/><Info icon={<CalendarDays size={12}/>} label="Quote validity" value={canViewCommercial && detail.valid_until ? formatDateOnly(detail.valid_until) : canViewCommercial ? "Not set" : "Commercial access required"}/></div></OpsSurface>
                </div>

                <aside className="ops-stack xl:sticky xl:top-[132px]">
                  <CustomerControl detail={detail} saving={saving} manualCustomerId={manualCustomerId} onManualCustomerId={setManualCustomerId} onLink={linkCustomer} onCreate={createCustomerFromEnquiry}/>
                  <OpsSurface eyebrow="Workflow" title="Ownership & status" description={detail.status === "won" ? "This quote is accepted and locked to its shipment. Ownership can still be updated." : detail.customer_id ? "Customer ownership is confirmed. Commercial staff can progress the enquiry through Quoted, Won or Lost." : "Confirm the CRM customer before marking this enquiry Won."}>
                    <form onSubmit={saveQuote} className="grid gap-3"><OpsField label="Status" hint={statusLocked ? detail.status === "won" ? "Won is final here. Continue from the Shipment or Digital Job File." : "Commercial access is required to change this status." : !canEditCommercial ? "You can move New and Reviewing enquiries while commercial states remain protected." : undefined}><select disabled={statusLocked} value={detail.status} onChange={(event) => setDetail({ ...detail, status: event.target.value as QuoteStatus })}>{workflowOptions.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></OpsField><OpsField label="Assigned to"><input value={detail.assigned_to ?? ""} onChange={(event) => setDetail({ ...detail, assigned_to: event.target.value })} placeholder="Staff member or branch" maxLength={120}/></OpsField><OpsButton variant="primary" disabled={saving || (detail.status === "won" && !detail.customer_id)}>{saving ? "Saving…" : detail.status === "won" && !detail.customer_id ? "Confirm customer first" : "Save workflow"}</OpsButton></form>
                  </OpsSurface>
                  {canViewCommercial ? <OpsSurface eyebrow="Commercial" title="Quote snapshot"><div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[#e5e0db] bg-[#e5e0db]"><Snapshot label="Customer price" value={detail.quoted_amount ? formatMoney(detail.quoted_amount, detail.quote_currency) : "Not quoted"}/><Snapshot label="Margin" value={metrics ? `${metrics.margin.toFixed(1)}%` : "—"}/></div><OpsButton variant="ghost" size="sm" className="mt-3" onClick={() => setActiveTab("pricing")}>Open pricing <ArrowRight size={11}/></OpsButton></OpsSurface> : null}
                  {detail.shipment ? <OpsSurface eyebrow="Converted shipment" title={<OpsMono>{detail.shipment.reference}</OpsMono>} description="A controlled shipment and Digital Job File exist for this accepted quote."><div className="flex flex-wrap gap-2"><OpsButton variant="ghost" size="sm" onClick={() => setActiveTab("shipment")}>Shipment workspace</OpsButton><a href={`/admin/jobs/${encodeURIComponent(detail.shipment.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Digital Job File</a></div></OpsSurface> : null}
                </aside>
              </div> : null}

              {activeTab === "pricing" && canViewCommercial ? <OpsSurface eyebrow="Pricing worksheet" title="Build the customer offer" description={canEditCommercial ? "Sell price, internal cost and margin stay visible together. Internal cost never enters the customer email." : "Commercial figures are visible to your role, but pricing changes require commercial edit access."}>
                {!canEditCommercial ? <div className="mb-4"><OpsNotice tone="neutral">Pricing is read-only for your current KCPL role.</OpsNotice></div> : null}
                <form onSubmit={saveCommercial} className="grid gap-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><OpsField label="Currency"><select disabled={!canEditCommercial} value={detail.quote_currency} onChange={(event) => setDetail({ ...detail, quote_currency: event.target.value as QuoteCurrency })}>{quoteCurrencies.map((currency) => <option value={currency} key={currency}>{currency}</option>)}</select></OpsField><OpsField label="Customer price"><input disabled={!canEditCommercial} inputMode="decimal" value={detail.quoted_amount ?? ""} onChange={(event) => setDetail({ ...detail, quoted_amount: event.target.value })} placeholder="0.00"/></OpsField><OpsField label="Internal cost" hint="KCPL only"><input disabled={!canEditCommercial} inputMode="decimal" value={detail.internal_cost ?? ""} onChange={(event) => setDetail({ ...detail, internal_cost: event.target.value })} placeholder="0.00"/></OpsField><OpsField label="Valid until"><input disabled={!canEditCommercial} type="date" value={detail.valid_until ?? ""} onChange={(event) => setDetail({ ...detail, valid_until: event.target.value })}/></OpsField></div>
                  <div className="grid gap-px overflow-hidden rounded-[10px] border border-[#e5e0db] bg-[#e5e0db] sm:grid-cols-4"><PricingMetric label="Sell" value={detail.quoted_amount ? formatMoney(detail.quoted_amount, detail.quote_currency) : "—"}/><PricingMetric label="Cost" value={detail.internal_cost ? formatMoney(detail.internal_cost, detail.quote_currency) : "—"}/><PricingMetric label="Profit" value={metrics ? formatMoney(metrics.profit, detail.quote_currency) : "—"} tone={metrics && metrics.profit < 0 ? "danger" : "success"}/><PricingMetric label="Margin" value={metrics ? `${metrics.margin.toFixed(1)}%` : "—"} tone={metrics && metrics.margin < 10 ? "warning" : "success"}/></div>
                  <OpsField label="Customer-facing note" hint="Included in the quote email"><textarea disabled={!canEditCommercial} value={detail.customer_quote_note ?? ""} onChange={(event) => setDetail({ ...detail, customer_quote_note: event.target.value })} placeholder="Scope, inclusions, exclusions, transit assumptions or next steps…"/></OpsField>
                  {canEditCommercial ? <div className="flex flex-wrap gap-2"><OpsButton variant="secondary" disabled={saving}>{saving ? "Saving…" : "Save pricing"}</OpsButton><OpsButton type="button" variant="primary" disabled={saving || !detail.quoted_amount?.trim()} onClick={sendQuote}><Send size={12}/>Send quote email</OpsButton><OpsButton type="button" variant="ghost" disabled={saving || !detail.quoted_amount?.trim()} onClick={openQuoteDraft}><Mail size={12}/>Open email draft</OpsButton></div> : null}
                </form>
              </OpsSurface> : null}

              {activeTab === "shipment" ? <OpsSurface eyebrow="Shipment" title={detail.shipment ? <OpsMono>{detail.shipment.reference}</OpsMono> : "Shipment workspace"} description={detail.shipment ? "Continue operational tracking without leaving the enquiry context. Workflow guards apply to controlled status changes." : detail.customer_id ? "A shipment is created automatically when this enquiry is saved as Won." : "Confirm the CRM customer first; then Won will create the shipment automatically."}><AdminShipmentPanel shipment={detail.shipment} quoteStatus={detail.status} onShipmentChange={(shipment) => setDetail((current) => current ? { ...current, shipment } : current)} onNotice={(message) => showNotice(message)}/></OpsSurface> : null}

              {activeTab === "activity" ? <OpsSurface eyebrow="Audit trail" title="Activity & communications" description="Customer quote emails and internal notes are recorded here in one chronological history.">
                <form onSubmit={addNote} className="flex flex-col gap-2 sm:flex-row"><textarea className="ops-input min-h-[74px] flex-1 resize-y" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add an internal note, callback, pricing decision or follow-up…" maxLength={3000}/><OpsButton variant="primary" disabled={saving || !noteDraft.trim()}><MessageSquareText size={12}/>Add note</OpsButton></form>
                <div className="mt-5 divide-y divide-[#e8e3de]">{activityItems.length ? activityItems.map((item) => item.kind === "note" ? <article key={item.id} className="flex gap-3 py-4"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#f3f0ed] text-[#756d66]"><MessageSquareText size={13}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-[12px] text-[#403a36]">Internal note</strong><span className="text-[10px] text-[#817a73]">{formatDate(item.note.created_at)}</span></div><p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-6 text-[#625b55]">{item.note.note}</p><p className="mt-1.5 text-[10px] font-semibold text-[#817a73]">{item.note.author_name || item.note.author_email}</p></div></article> : <article key={item.id} className="flex gap-3 py-4"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#edf5fa] text-[#3f7295]"><Mail size={13}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-[12px] text-[#403a36]">Quote email sent</strong><OpsBadge tone="info">{item.communication.status || "sent"}</OpsBadge><span className="text-[10px] text-[#817a73]">{formatDate(item.at)}</span></div><p className="mt-1.5 break-words text-[12px] font-semibold text-[#554f49]">{item.communication.subject || "KCPL freight quote"}</p><p className="mt-1 text-[10px] text-[#817a73]">To {item.communication.to || detail.contact_email}{item.communication.provider ? ` · ${item.communication.provider}` : ""}</p><p className="mt-1 text-[10px] font-semibold text-[#817a73]">Sent by {item.communication.actor_name || item.communication.actor_email || "KCPL staff"}</p></div></article>) : <OpsEmptyState compact icon={<MessageSquareText size={17}/>} title="No activity recorded yet" description="Internal notes and sent customer quote emails will appear here."/>}</div>
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
    return <OpsSurface eyebrow="CRM customer" title="Confirmed account" description="This customer relationship flows into the shipment, Job File, Customer 360 and Finance."><div className="flex items-center justify-between gap-3 border-l-2 border-[#79a087] bg-[#f7faf7] px-3 py-2.5"><div className="min-w-0"><p className="flex items-center gap-1.5 text-[11px] font-bold text-[#567060]"><CheckCircle2 size={12}/>Customer linked</p><OpsMono className="mt-1 block truncate text-[10px] text-[#667067]">{detail.customer_id}</OpsMono></div><a href={`/admin/crm/${encodeURIComponent(detail.customer_id)}`} className="ops-button" data-variant="secondary" data-size="sm">Customer 360 <ArrowRight size={10}/></a></div></OpsSurface>;
  }

  return <OpsSurface priority="warning" eyebrow="CRM customer" title="Confirm customer before marking Won" description="Confirm a suggested account, enter a known KCPL customer reference, or create a new prospect only when no duplicate exists.">
    {detail.crm_matches.length ? <div className="grid gap-2">{detail.crm_matches.slice(0, 4).map((match) => <button type="button" disabled={saving} key={match.id} onClick={() => onLink(match.id)} className="flex items-center justify-between gap-3 rounded-[9px] border border-[#e2d9d2] bg-white p-3 text-left transition hover:border-[#d9c2b7] hover:bg-[#fff8f4]"><div className="min-w-0"><p className="truncate text-[11px] font-bold text-[#514840]">{match.display_name}</p><p className="mt-1 text-[10px] text-[#817a73]">{match.reason || "Existing CRM details match"} · <OpsMono>{match.id}</OpsMono></p></div><span className="shrink-0 text-[10px] font-bold text-[#b36a55]">Confirm</span></button>)}</div> : <div className="border-l-2 border-[#d7b479] bg-[#fffaf4] px-3 py-2.5 text-[11px] leading-5 text-[#756555]">No existing CRM match was found for this enquiry.</div>}
    <div className="mt-3 grid gap-2"><OpsField label="Known customer reference" hint="Optional"><input value={manualCustomerId} onChange={(event) => onManualCustomerId(event.target.value.toUpperCase())} placeholder="KCPL-C-…"/></OpsField><div className="flex flex-wrap gap-2"><OpsButton variant="secondary" size="sm" type="button" disabled={saving || !manualCustomerId.trim()} onClick={() => onLink(manualCustomerId)}><Link2 size={11}/>Link reference</OpsButton><OpsButton variant="primary" size="sm" type="button" disabled={saving} onClick={onCreate}><Plus size={11}/>Create from enquiry</OpsButton></div></div>
  </OpsSurface>;
}

function Info({ icon, label, value, href }: { icon?: React.ReactNode; label: string; value: string; href?: string }) {
  const content = <p className="mt-1.5 break-words text-[12px] font-semibold leading-5 text-[#554f49]">{value}</p>;
  return <div><p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#817a73]">{icon}{label}</p>{href ? <a href={href} className="hover:underline hover:underline-offset-2">{content}</a> : content}</div>;
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-3"><p className="text-[10px] font-semibold text-[#817a73]">{label}</p><p className="mt-1.5 text-[12px] font-bold text-[#514840]">{value}</p></div>;
}

function PricingMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <div className="bg-white p-4"><p className="text-[10px] font-semibold text-[#817a73]">{label}</p><strong className={`mt-1.5 block text-[18px] tracking-[-.035em] ${tone === "success" ? "text-[#47795a]" : tone === "warning" ? "text-[#9b682b]" : tone === "danger" ? "text-[#ae434a]" : "text-[#403a36]"}`}>{value}</strong></div>;
}