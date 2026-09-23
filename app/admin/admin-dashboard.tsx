"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Mail,
  MessageSquareText,
  Package,
  Phone,
  Plus,
  Send,
} from "lucide-react";
import { quoteCurrencies } from "./admin-data";
import type { QuoteCrmMatch, QuoteCurrency, QuoteDetail, QuoteStatus, QuoteSummary } from "./admin-data";
import { AdminShipmentPanel } from "./admin-shipment-panel";
import { OpsBadge, OpsButton, OpsEmptyState, OpsFact, OpsFacts, OpsField, OpsInlineAlert, OpsInspectorNote, OpsKpiRail, OpsNotice, OpsPage, OpsPageHeader, OpsRailMetric, OpsSearch, OpsSurface } from "./operations-ui";
import { SavedFilterViews } from "./saved-filter-views";
import { StaffAssignmentPicker } from "./staff-assignment-picker";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";
const statusLabels: Record<QuoteStatus, string> = { new: "New", reviewing: "Reviewing", quoted: "Quoted", won: "Won", lost: "Lost" };
const detailTabs = ["overview", "pricing", "shipment", "activity"] as const;
const detailTabLabels: Record<DetailTab, string> = { overview: "Overview", pricing: "Pricing", shipment: "Shipment", activity: "Activity" };
type DetailTab = (typeof detailTabs)[number];
type NoticeTone = "neutral" | "success" | "warning" | "danger";
type NoticeState = { message: string; tone: NoticeTone };

const modeLabels: Record<string, string> = { air: "Air freight", sea: "Sea freight", road: "Road freight", rail: "Rail freight", multimodal: "Multimodal freight", unsure: "Mode not decided" };

function modeLabel(mode: string) {
  return (modeLabels[mode.toLowerCase()] ?? mode) || "Freight";
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
    assigned_to_name: detail.assigned_to_name,
    assigned_to_email: detail.assigned_to_email,
    assigned_to_phone: detail.assigned_to_phone,
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
        quote.assigned_to_email ?? "",
        quote.assigned_to_phone ?? "",
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
        body: JSON.stringify({
          action: "workflow",
          status: detail.status,
          assignedToName: detail.assigned_to_name ?? detail.assigned_to ?? "",
          assignedToEmail: detail.assigned_to_email ?? "",
          assignedToPhone: detail.assigned_to_phone ?? "",
        }),
      });
      const data = await response.json() as {
        status?: QuoteStatus;
        assignedTo?: string;
        assignedToName?: string;
        assignedToEmail?: string;
        assignedToPhone?: string;
        shipment?: QuoteDetail["shipment"];
        shipmentWarning?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Could not save the enquiry workflow.");

      const nextDetail: QuoteDetail = {
        ...detail,
        status: data.status ?? detail.status,
        assigned_to: data.assignedTo ?? detail.assigned_to,
        assigned_to_name: data.assignedToName ?? detail.assigned_to_name,
        assigned_to_email: data.assignedToEmail ?? detail.assigned_to_email,
        assigned_to_phone: data.assignedToPhone ?? detail.assigned_to_phone,
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
    <OpsPage>
      <OpsPageHeader
        title="Freight enquiries"
        description={`Website enquiries reviewed, quoted and converted into KCPL shipments · ${filtered.length} of ${quotes.length} shown`}
      />

      <div className="px-4 pb-8 pt-4 md:px-6">
        <OpsKpiRail label="Enquiry pipeline">
          <OpsRailMetric label="All" value={quotes.length} active={statusFilter === "all"} onClick={() => setStatusFilter("all")}/>
          <OpsRailMetric label="New" value={statusCounts.new} active={statusFilter === "new"} onClick={() => setStatusFilter(statusFilter === "new" ? "all" : "new")}/>
          <OpsRailMetric label="Reviewing" value={statusCounts.reviewing} tone={statusCounts.reviewing ? "warning" : "neutral"} active={statusFilter === "reviewing"} onClick={() => setStatusFilter(statusFilter === "reviewing" ? "all" : "reviewing")}/>
          <OpsRailMetric label="Quoted" value={statusCounts.quoted} active={statusFilter === "quoted"} onClick={() => setStatusFilter(statusFilter === "quoted" ? "all" : "quoted")}/>
          <OpsRailMetric label="Won" value={statusCounts.won} active={statusFilter === "won"} onClick={() => setStatusFilter(statusFilter === "won" ? "all" : "won")}/>
          <OpsRailMetric label="Lost" value={statusCounts.lost} active={statusFilter === "lost"} onClick={() => setStatusFilter(statusFilter === "lost" ? "all" : "lost")}/>
        </OpsKpiRail>

        <div className="enq-layout">
          <aside className="enq-list" aria-label="Enquiry inbox">
            <div className="enq-list-controls">
              <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, route, cargo, contact or reference" aria-label="Search enquiries"/>
              <SavedFilterViews storageKey="kcpl-enquiry-saved-views-v1" query={query} status={statusFilter} onApply={(view) => { setQuery(view.query); setStatusFilter(view.status); }}/>
            </div>
            <div className="enq-rows">
              {filtered.length ? filtered.map((quote) => {
                const selected = selectedReference === quote.reference;
                return <button key={quote.reference} type="button" onClick={() => selectQuote(quote.reference)} className="enq-row" data-selected={selected || undefined} aria-current={selected || undefined}>
                  <span className="enq-row-main">
                    <span className="enq-row-route"><span>{quote.origin || "Origin not recorded"}</span><ArrowRight size={12} strokeWidth={1.75} className="enq-route-arrow" aria-hidden="true"/><span>{quote.destination || "Destination not recorded"}</span></span>
                    <span className="enq-row-meta">{quote.company_name || quote.contact_name} · {modeLabel(quote.mode)}{quote.cargo_type ? ` · ${quote.cargo_type}` : ""}</span>
                    <span className="enq-row-foot"><span className="ops-mono">{quote.reference}</span> · {quote.assigned_to || "Unassigned"} · {formatDate(quote.created_at)}</span>
                  </span>
                  <span className="enq-row-side">
                    <OpsBadge tone={statusTone(quote.status)}>{statusLabels[quote.status]}</OpsBadge>
                    <span className="enq-row-signals">{quote.email_count ? <span title={`${quote.email_count} customer email${quote.email_count === 1 ? "" : "s"}`}><Mail size={12} strokeWidth={1.75} aria-hidden="true"/>{quote.email_count}</span> : null}{quote.note_count ? <span title={`${quote.note_count} internal note${quote.note_count === 1 ? "" : "s"}`}><MessageSquareText size={12} strokeWidth={1.75} aria-hidden="true"/>{quote.note_count}</span> : null}</span>
                  </span>
                </button>;
              }) : quotes.length ? <OpsEmptyState compact kind="search" title="No enquiries match" description="Change the search terms or the status filter above."/> : <OpsEmptyState compact kind="healthy" title="Enquiry inbox is clear" description="New website freight enquiries will appear here automatically."/>}
            </div>
          </aside>

          <section className="enq-detail" aria-label="Enquiry detail">
            {!selectedReference ? <section className="ops-surface" data-density="compact"><div className="ops-surface-body"><OpsEmptyState compact kind={quotes.length ? "neutral" : "healthy"} icon={quotes.length ? <Package size={16} strokeWidth={1.75} aria-hidden="true"/> : <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true"/>} title={quotes.length ? "Choose an enquiry" : "No enquiries waiting"} description={quotes.length ? "Select a freight enquiry to review the request, customer relationship, pricing and shipment handoff." : "The website enquiry inbox is currently clear."}/></div></section> : null}
            {loading ? <p className="enq-loading" role="status">Loading enquiry…</p> : null}
            {!loading && selectedReference && !detail ? <OpsNotice tone="danger">{notice?.message || "This enquiry could not be loaded."}</OpsNotice> : null}

            {!loading && detail ? <>
              <header className="enq-record-head">
                <div className="enq-record-top">
                  <div className="min-w-0">
                    <p className="ops-inspector-kicker">{detail.reference}</p>
                    <h2 className="enq-record-title"><span>{detail.origin || "Origin"}</span><ArrowRight size={16} strokeWidth={1.75} className="enq-route-arrow" aria-hidden="true"/><span>{detail.destination || "Destination"}</span></h2>
                    <p className="enq-record-meta">{detail.company_name || detail.contact_name} · {modeLabel(detail.mode)} · received {formatDate(detail.created_at)}</p>
                    <div className="plan-badges enq-record-badges"><OpsBadge tone={statusTone(detail.status)}>{statusLabels[detail.status]}</OpsBadge>{detail.customer_id ? <OpsBadge tone="success">CRM linked</OpsBadge> : <OpsBadge tone="warning">CRM customer required</OpsBadge>}</div>
                  </div>
                  <div className="ops-inspector-actions">
                    <a href={`mailto:${detail.contact_email}`} className="ops-button" data-variant="secondary" data-size="sm"><Mail size={14} strokeWidth={1.75} aria-hidden="true"/>Email contact</a>
                    {detail.phone ? <a href={`tel:${detail.phone}`} className="ops-button" data-variant="secondary" data-size="sm"><Phone size={14} strokeWidth={1.75} aria-hidden="true"/>Call</a> : null}
                    {canEditCommercial && detail.quoted_amount ? <OpsButton variant="primary" size="sm" disabled={saving} onClick={sendQuote}><Send size={14} strokeWidth={1.75} aria-hidden="true"/>{saving ? "Working…" : "Send quote email"}</OpsButton> : null}
                  </div>
                </div>
                <div className="ops-scope-tabs enq-tabs" role="group" aria-label="Enquiry sections">{availableTabs.map((tab) => <button key={tab} type="button" className="ops-scope-tab" data-active={activeTab === tab || undefined} aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>{detailTabLabels[tab]}{tab === "activity" ? <span className="ops-scope-count">{detail.note_count + detail.email_count}</span> : null}</button>)}</div>
              </header>

              <div className="enq-detail-body">
                {notice ? <OpsInlineAlert tone={notice.tone === "danger" ? "danger" : notice.tone === "warning" ? "warning" : notice.tone === "success" ? "success" : "neutral"}>{notice.message}</OpsInlineAlert> : null}

                {activeTab === "overview" ? <div className="enq-overview">
                  <div className="enq-overview-main">
                    <OpsSurface density="compact" title="Cargo & route" description="The customer's original freight requirement.">
                      <OpsFacts>
                        <OpsFact label="Route">{`${detail.origin || "Not recorded"} → ${detail.destination || "Not recorded"}`}</OpsFact>
                        <OpsFact label="Mode">{modeLabel(detail.mode)}</OpsFact>
                        <OpsFact label="Cargo type">{detail.cargo_type || "Not provided"}</OpsFact>
                        <OpsFact label="Weight">{cargoWeight(detail)}</OpsFact>
                        <OpsFact label="Dimensions">{cargoDimensions(detail)}</OpsFact>
                        <OpsFact label="Preferred timing">{detail.timing || "Not provided"}</OpsFact>
                      </OpsFacts>
                      {detail.requirements ? <div className="enq-requirements"><p className="enq-subhead">Customer requirements</p><p className="plan-note">{detail.requirements}</p></div> : null}
                    </OpsSurface>
                    <OpsSurface density="compact" title="Customer contact">
                      <OpsFacts>
                        <OpsFact label="Contact">{detail.contact_name}</OpsFact>
                        <OpsFact label="Company">{detail.company_name || "Not provided"}</OpsFact>
                        <OpsFact label="Email"><a href={`mailto:${detail.contact_email}`}>{detail.contact_email}</a></OpsFact>
                        <OpsFact label="Phone">{detail.phone ? <a href={`tel:${detail.phone}`}>{detail.phone}</a> : "Not provided"}</OpsFact>
                        <OpsFact label="Quote validity">{canViewCommercial && detail.valid_until ? formatDateOnly(detail.valid_until) : canViewCommercial ? "Not set" : "Commercial access required"}</OpsFact>
                      </OpsFacts>
                    </OpsSurface>
                  </div>

                  <aside className="enq-overview-side">
                    <CustomerControl detail={detail} saving={saving} manualCustomerId={manualCustomerId} onManualCustomerId={setManualCustomerId} onLink={linkCustomer} onCreate={createCustomerFromEnquiry}/>
                    <OpsSurface density="compact" title="Ownership & status" description={detail.status === "won" ? "Accepted and locked to its shipment. Ownership can still be updated." : detail.customer_id ? "Customer confirmed. Commercial staff can progress through Quoted, Won or Lost." : "Confirm the CRM customer before marking this enquiry Won."}>
                      <form onSubmit={saveQuote} className="ops-inspector-form enq-workflow">
                        <OpsField label="Status" className="col-span-full" hint={statusLocked ? detail.status === "won" ? "Won is final here. Continue from the Shipment or Digital Job File." : "Commercial access is required to change this status." : !canEditCommercial ? "You can move New and Reviewing enquiries while commercial states remain protected." : undefined}><select disabled={statusLocked} value={detail.status} onChange={(event) => setDetail({ ...detail, status: event.target.value as QuoteStatus })}>{workflowOptions.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></OpsField>
                        <OpsField label="Assigned to" className="col-span-full" hint="From People & branches; name, email and phone fill automatically."><StaffAssignmentPicker compact value={{ name: detail.assigned_to_name ?? detail.assigned_to ?? "", email: detail.assigned_to_email ?? "", phone: detail.assigned_to_phone ?? "" }} onChange={(staff) => setDetail({ ...detail, assigned_to: staff.name || staff.email || null, assigned_to_name: staff.name || null, assigned_to_email: staff.email || null, assigned_to_phone: staff.phone || null })}/></OpsField>
                        <div className="col-span-full"><OpsButton type="submit" variant="primary" size="sm" disabled={saving || (detail.status === "won" && !detail.customer_id)}>{saving ? "Saving…" : detail.status === "won" && !detail.customer_id ? "Confirm customer first" : "Save workflow"}</OpsButton></div>
                      </form>
                    </OpsSurface>
                    {canViewCommercial ? <OpsSurface density="compact" title="Quote snapshot" action={<OpsButton variant="ghost" size="xs" onClick={() => setActiveTab("pricing")}>Open pricing<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></OpsButton>}>
                      <OpsFacts>
                        <OpsFact label="Customer price">{detail.quoted_amount ? formatMoney(detail.quoted_amount, detail.quote_currency) : "Not quoted"}</OpsFact>
                        <OpsFact label="Margin">{metrics ? `${metrics.margin.toFixed(1)}%` : "—"}</OpsFact>
                      </OpsFacts>
                    </OpsSurface> : null}
                    {detail.shipment ? <OpsSurface density="compact" title={<span className="ops-mono">{detail.shipment.reference}</span>} description="A controlled shipment and Digital Job File exist for this accepted quote.">
                      <div className="ops-inspector-actions"><OpsButton variant="ghost" size="sm" onClick={() => setActiveTab("shipment")}>Shipment workspace</OpsButton><a href={`/admin/jobs/${encodeURIComponent(detail.shipment.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Digital Job File</a></div>
                    </OpsSurface> : null}
                  </aside>
                </div> : null}

                {activeTab === "pricing" && canViewCommercial ? <OpsSurface density="compact" title="Build the customer offer" description={canEditCommercial ? "Sell price, internal cost and margin stay visible together. Internal cost never enters the customer email." : "Commercial figures are visible to your role, but pricing changes require commercial edit access."}>
                  {!canEditCommercial ? <div className="plan-notice"><OpsInlineAlert tone="neutral">Pricing is read-only for your current KCPL role.</OpsInlineAlert></div> : null}
                  <form onSubmit={saveCommercial}>
                    <div className="ops-form-grid">
                      <OpsField label="Currency"><select disabled={!canEditCommercial} value={detail.quote_currency} onChange={(event) => setDetail({ ...detail, quote_currency: event.target.value as QuoteCurrency })}>{quoteCurrencies.map((currency) => <option value={currency} key={currency}>{currency}</option>)}</select></OpsField>
                      <OpsField label="Customer price"><input disabled={!canEditCommercial} inputMode="decimal" value={detail.quoted_amount ?? ""} onChange={(event) => setDetail({ ...detail, quoted_amount: event.target.value })} placeholder="0.00"/></OpsField>
                      <OpsField label="Internal cost" hint="KCPL only"><input disabled={!canEditCommercial} inputMode="decimal" value={detail.internal_cost ?? ""} onChange={(event) => setDetail({ ...detail, internal_cost: event.target.value })} placeholder="0.00"/></OpsField>
                      <OpsField label="Valid until"><input disabled={!canEditCommercial} type="date" value={detail.valid_until ?? ""} onChange={(event) => setDetail({ ...detail, valid_until: event.target.value })}/></OpsField>
                    </div>
                    <div className="enq-pricing-rail">
                      <OpsKpiRail label="Offer economics">
                        <OpsRailMetric label="Sell" value={detail.quoted_amount ? formatMoney(detail.quoted_amount, detail.quote_currency) : "—"}/>
                        <OpsRailMetric label="Cost" value={detail.internal_cost ? formatMoney(detail.internal_cost, detail.quote_currency) : "—"}/>
                        <OpsRailMetric label="Profit" value={metrics ? formatMoney(metrics.profit, detail.quote_currency) : "—"} tone={metrics && metrics.profit < 0 ? "danger" : "neutral"}/>
                        <OpsRailMetric label="Margin" value={metrics ? `${metrics.margin.toFixed(1)}%` : "—"} tone={metrics && metrics.margin < 10 ? "warning" : "neutral"}/>
                      </OpsKpiRail>
                    </div>
                    <div className="ops-form-grid">
                      <OpsField label="Customer-facing note" hint="Included in the quote email" className="ops-form-full"><textarea disabled={!canEditCommercial} value={detail.customer_quote_note ?? ""} onChange={(event) => setDetail({ ...detail, customer_quote_note: event.target.value })} placeholder="Scope, inclusions, exclusions, transit assumptions or next steps…"/></OpsField>
                    </div>
                    {canEditCommercial ? <div className="ops-form-actions enq-pricing-actions">
                      <OpsButton type="button" variant="ghost" size="sm" disabled={saving || !detail.quoted_amount?.trim()} onClick={openQuoteDraft}><Mail size={14} strokeWidth={1.75} aria-hidden="true"/>Open email draft</OpsButton>
                      <OpsButton type="submit" variant="secondary" size="sm" disabled={saving}>{saving ? "Saving…" : "Save pricing"}</OpsButton>
                      <OpsButton type="button" variant="primary" size="sm" disabled={saving || !detail.quoted_amount?.trim()} onClick={sendQuote}><Send size={14} strokeWidth={1.75} aria-hidden="true"/>Send quote email</OpsButton>
                    </div> : null}
                  </form>
                </OpsSurface> : null}

                {activeTab === "shipment" ? <OpsSurface density="compact" title={detail.shipment ? <span className="ops-mono">{detail.shipment.reference}</span> : "Shipment workspace"} description={detail.shipment ? "Continue operational tracking without leaving the enquiry. Workflow guards apply to controlled status changes." : detail.customer_id ? "A shipment is created automatically when this enquiry is saved as Won." : "Confirm the CRM customer first; then Won will create the shipment automatically."}><AdminShipmentPanel shipment={detail.shipment} quoteStatus={detail.status} onShipmentChange={(shipment) => setDetail((current) => current ? { ...current, shipment } : current)} onNotice={(message) => showNotice(message)}/></OpsSurface> : null}

                {activeTab === "activity" ? <OpsSurface density="compact" title="Activity & communications" description="Customer quote emails and internal notes in one chronological history.">
                  <form onSubmit={addNote} className="enq-note-form">
                    <textarea className="ops-input" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add an internal note, callback, pricing decision or follow-up…" maxLength={3000} aria-label="Internal note"/>
                    <OpsButton type="submit" variant="primary" size="sm" disabled={saving || !noteDraft.trim()}><MessageSquareText size={14} strokeWidth={1.75} aria-hidden="true"/>Add note</OpsButton>
                  </form>
                  {activityItems.length ? <ol className="enq-activity">{activityItems.map((item) => item.kind === "note" ? <li key={item.id}>
                    <span className="enq-activity-icon"><MessageSquareText size={14} strokeWidth={1.75} aria-hidden="true"/></span>
                    <div className="min-w-0">
                      <div className="enq-activity-head"><strong>Internal note</strong><span>{formatDate(item.note.created_at)}</span></div>
                      <p className="plan-note">{item.note.note}</p>
                      <p className="enq-activity-meta">{item.note.author_name || item.note.author_email}</p>
                    </div>
                  </li> : <li key={item.id}>
                    <span className="enq-activity-icon"><Mail size={14} strokeWidth={1.75} aria-hidden="true"/></span>
                    <div className="min-w-0">
                      <div className="enq-activity-head"><strong>Quote email sent</strong><OpsBadge tone="info">{item.communication.status || "sent"}</OpsBadge><span>{formatDate(item.at)}</span></div>
                      <p className="enq-activity-subject">{item.communication.subject || "KCPL freight quote"}</p>
                      <p className="enq-activity-meta">To {item.communication.to || detail.contact_email}{item.communication.provider ? ` · ${item.communication.provider}` : ""} · sent by {item.communication.actor_name || item.communication.actor_email || "KCPL staff"}</p>
                    </div>
                  </li>)}</ol> : <OpsEmptyState compact icon={<MessageSquareText size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No activity recorded yet" description="Internal notes and sent customer quote emails will appear here."/>}
                </OpsSurface> : null}
              </div>
            </> : null}
          </section>
        </div>
      </div>
    </OpsPage>
  );
}

function CustomerControl({ detail, saving, manualCustomerId, onManualCustomerId, onLink, onCreate }: { detail: QuoteDetail; saving: boolean; manualCustomerId: string; onManualCustomerId: (value: string) => void; onLink: (customerId: string) => void; onCreate: () => void }) {
  if (detail.customer_id) {
    return <OpsSurface density="compact" title="CRM customer" description="This relationship flows into the shipment, Job File, Customer 360 and Finance." action={<a href={`/admin/crm/${encodeURIComponent(detail.customer_id)}`} className="ops-button" data-variant="secondary" data-size="xs">Customer 360<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></a>}>
      <OpsFacts><OpsFact label="Linked account"><span className="ops-mono">{detail.customer_id}</span></OpsFact></OpsFacts>
    </OpsSurface>;
  }

  return <OpsSurface density="compact" title="Confirm customer before marking Won" description="Confirm a suggested account, enter a known KCPL customer reference, or create a new prospect only when no duplicate exists.">
    {detail.crm_matches.length ? <ul className="enq-matches">{detail.crm_matches.slice(0, 4).map((match) => <li key={match.id}><button type="button" disabled={saving} onClick={() => onLink(match.id)}>
      <span className="min-w-0"><strong>{match.display_name}</strong><span>{match.reason || "Existing CRM details match"} · <span className="ops-mono">{match.id}</span></span></span>
      <span className="enq-match-action">Confirm</span>
    </button></li>)}</ul> : <OpsInspectorNote tone="warning" title="No existing CRM match was found for this enquiry."/>}
    <div className="ops-inspector-form plan-subform">
      <OpsField label="Known customer reference" hint="Optional" className="col-span-full"><input value={manualCustomerId} onChange={(event) => onManualCustomerId(event.target.value.toUpperCase())} placeholder="KCPL-C-…"/></OpsField>
      <div className="col-span-full ops-inspector-actions">
        <OpsButton variant="secondary" size="sm" type="button" disabled={saving || !manualCustomerId.trim()} onClick={() => onLink(manualCustomerId)}><Link2 size={14} strokeWidth={1.75} aria-hidden="true"/>Link reference</OpsButton>
        <OpsButton variant="primary" size="sm" type="button" disabled={saving} onClick={onCreate}><Plus size={14} strokeWidth={1.75} aria-hidden="true"/>Create from enquiry</OpsButton>
      </div>
    </div>
  </OpsSurface>;
}
