"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Clock3,
  Mail,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import { quoteCurrencies } from "./admin-data";
import type { QuoteCurrency, QuoteDetail, QuoteStatus, QuoteSummary } from "./admin-data";
import { AdminShipmentPanel } from "./admin-shipment-panel";
import { OpsButton, OpsEmptyState, OpsErrorState, OpsPanel, OpsStatusBadge, OpsSkeletonRows } from "./operations-ui";

const statusLabels: Record<QuoteStatus, string> = {
  new: "New",
  reviewing: "Pending",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

const statusOptions: Array<"all" | QuoteStatus> = ["all", "new", "reviewing", "quoted", "won", "lost"];
const detailTabs = ["overview", "commercial", "shipment", "activity"] as const;
type DetailTab = (typeof detailTabs)[number];

const modeLabels: Record<string, string> = {
  air: "Air freight",
  sea: "Sea freight",
  road: "Road freight",
  unsure: "Mode not decided",
};

function statusTone(status: QuoteStatus): "neutral" | "info" | "success" | "warning" | "danger" | "accent" {
  if (status === "new") return "info";
  if (status === "reviewing") return "warning";
  if (status === "quoted") return "accent";
  if (status === "won") return "success";
  return "danger";
}

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
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 3 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function commercialMetrics(quote: QuoteDetail) {
  const quoted = amountNumber(quote.quoted_amount);
  const cost = amountNumber(quote.internal_cost);
  if (quoted === null || quoted <= 0 || cost === null) return null;
  const profit = quoted - cost;
  return { profit, margin: (profit / quoted) * 100 };
}

function quoteEmail(quote: QuoteDetail) {
  const price = quote.quoted_amount ? formatMoney(quote.quoted_amount, quote.quote_currency) : "To be confirmed";
  const validity = quote.valid_until ? formatDateOnly(quote.valid_until) : "As discussed";
  const greetingName = quote.contact_name.trim().split(/\s+/)[0] || quote.contact_name;
  const lines = [
    `Dear ${greetingName},`, "", "Thank you for your freight enquiry with Kapileshwor Cargo Pvt. Ltd. (KCPL).", "",
    `Quote reference: ${quote.reference}`, `Route: ${quote.origin} → ${quote.destination}`, `Mode: ${modeLabels[quote.mode] ?? quote.mode}`, `Quoted price: ${price}`, `Valid until: ${validity}`,
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

  useEffect(() => {
    if (!selectedReference) return;
    const controller = new AbortController();
    fetch(`/api/admin/quotes/${encodeURIComponent(selectedReference)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { ok?: boolean; quote?: QuoteDetail; error?: string };
        if (!response.ok || !data.quote) throw new Error(data.error || "Could not load the quote.");
        setDetail(data.quote);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDetail(null);
        setNotice(error instanceof Error ? error.message : "Could not load the quote.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [selectedReference]);

  function selectQuote(reference: string) {
    if (reference === selectedReference) return;
    setDetail(null);
    setNotice("");
    setLoading(true);
    setActiveTab("overview");
    setSelectedReference(reference);
  }

  async function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "workflow", status: detail.status, assignedTo: detail.assigned_to ?? "" }),
      });
      const data = await response.json() as { ok?: boolean; shipment?: QuoteDetail["shipment"]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the quote.");
      setQuotes((current) => current.map((quote) => quote.reference === detail.reference ? { ...quote, status: detail.status, assigned_to: detail.assigned_to } : quote));
      if (data.shipment) {
        setDetail((current) => current ? { ...current, shipment: data.shipment ?? current.shipment } : current);
        setNotice(`Quote won. Shipment ${data.shipment.reference} is ready.`);
        setActiveTab("shipment");
      } else {
        setNotice("Quote workflow updated.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the quote.");
    } finally { setSaving(false); }
  }

  async function persistCommercial(showNotice = true) {
    if (!detail) return false;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "commercial", currency: detail.quote_currency, quotedAmount: detail.quoted_amount ?? "", internalCost: detail.internal_cost ?? "", validUntil: detail.valid_until ?? "", customerNote: detail.customer_quote_note ?? "" }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the commercial quote.");
      if (showNotice) setNotice("Commercial quote saved.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the commercial quote.");
      return false;
    } finally { setSaving(false); }
  }

  async function saveCommercial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistCommercial();
  }

  async function sendQuote() {
    if (!detail) return;
    if (!detail.quoted_amount?.trim()) { setNotice("Add a quoted price before sending the customer email."); return; }
    const saved = await persistCommercial(false);
    if (!saved) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}/email`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await response.json() as { ok?: boolean; to?: string; status?: QuoteStatus; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not send the quote email.");
      const nextStatus = data.status ?? detail.status;
      setDetail((current) => current ? { ...current, status: nextStatus } : current);
      setQuotes((current) => current.map((quote) => quote.reference === detail.reference ? { ...quote, status: nextStatus } : quote));
      setNotice(`Quote emailed to ${data.to || detail.contact_email}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not send the quote email.");
    } finally { setSaving(false); }
  }

  function openQuoteDraft() {
    if (!detail) return;
    const email = quoteEmail(detail);
    window.location.href = `mailto:${encodeURIComponent(detail.contact_email)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !noteDraft.trim()) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: noteDraft }) });
      const data = await response.json() as { ok?: boolean; note?: QuoteDetail["notes"][number]; error?: string };
      if (!response.ok || !data.note) throw new Error(data.error || "Could not save the note.");
      setDetail((current) => current ? { ...current, notes: [data.note!, ...current.notes], note_count: current.note_count + 1 } : current);
      setQuotes((current) => current.map((quote) => quote.reference === detail.reference ? { ...quote, note_count: quote.note_count + 1 } : quote));
      setNoteDraft("");
      setNotice("Internal note added.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the note.");
    } finally { setSaving(false); }
  }

  const metrics = detail ? commercialMetrics(detail) : null;

  return <main className="min-h-[calc(100vh-48px)]">
    <div className="grid min-h-[calc(100vh-48px)] lg:h-[calc(100vh-48px)] lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex max-h-[46vh] min-h-0 flex-col border-b border-[#e3e5e8] bg-white lg:max-h-none lg:border-b-0 lg:border-r">
        <div className="border-b border-[#eceef0] p-3.5">
          <div className="flex items-end justify-between gap-3"><div><p className="ops-eyebrow">Commercial</p><h1 className="text-sm font-semibold text-[#282d33]">Enquiries & Quotes</h1></div><span className="text-[10px] text-[#9299a0]">{filtered.length}/{quotes.length}</span></div>
          <label className="ops-search-field mt-3 w-full"><Search size={13} className="text-[#8b9299]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, route or customer"/></label>
          <div className="mt-2.5 flex gap-1 overflow-x-auto pb-1">{statusOptions.map((status) => {
            const active = statusFilter === status;
            const count = status === "all" ? quotes.length : statusCounts[status];
            return <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`whitespace-nowrap rounded-md border px-2 py-1.5 text-[10px] font-medium ${active ? "border-[#d8ddf8] bg-[#eef0ff] text-[#4655a0]" : "border-[#e1e4e7] bg-white text-[#717982] hover:bg-[#fafafa]"}`}>{status === "all" ? "All" : statusLabels[status]} <span className="ml-1 opacity-55">{count}</span></button>;
          })}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length ? filtered.map((quote) => {
            const selected = selectedReference === quote.reference;
            return <button key={quote.reference} type="button" onClick={() => selectQuote(quote.reference)} className={`relative block w-full border-b border-[#eff1f2] px-3.5 py-3 text-left ${selected ? "bg-[#f7f8fc]" : "hover:bg-[#fafafa]"}`}>
              {selected ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-[#6878c5]"/> : null}
              <div className="flex items-center justify-between gap-2"><strong className="truncate text-[11px] font-semibold text-[#343a40]">{quote.reference}</strong><OpsStatusBadge tone={statusTone(quote.status)}>{statusLabels[quote.status]}</OpsStatusBadge></div>
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-[#414850]"><span className="truncate">{quote.origin}</span><ArrowRight size={11} className="shrink-0 text-[#a0a6ac]"/><span className="truncate">{quote.destination}</span></div>
              <p className="mt-1 truncate text-[10px] text-[#838b93]">{quote.company_name || quote.contact_name}{quote.assigned_to ? ` · ${quote.assigned_to}` : ""}</p>
              <div className="mt-1.5 flex items-center justify-between text-[9px] text-[#a0a6ac]"><span>{formatDate(quote.created_at)}</span>{quote.note_count > 0 ? <span className="flex items-center gap-1"><MessageSquareText size={10}/>{quote.note_count}</span> : null}</div>
            </button>;
          }) : <OpsEmptyState compact title="No enquiries match" detail="Adjust the search or status filter."/>}
        </div>
      </aside>

      <section className="min-w-0 overflow-y-auto bg-[var(--ops-bg)]">
        {!selectedReference ? <OpsEmptyState title="No quote enquiries yet" detail="New website enquiries will appear here automatically."/> : null}
        {loading ? <div className="mx-auto max-w-[1250px] p-4 sm:p-5"><div className="ops-panel"><div className="h-20 animate-pulse border-b border-[#eceef0] bg-white"/><OpsSkeletonRows rows={6} columns={3}/></div></div> : null}
        {!loading && selectedReference && !detail ? <OpsErrorState title="This enquiry could not be loaded" detail="The quote list remains available. Select another enquiry or retry by reselecting this record."/> : null}

        {!loading && detail ? <>
          <div className="sticky top-0 z-20 border-b border-[#e3e5e8] bg-white/95 backdrop-blur-xl">
            <div className="px-4 py-3.5 sm:px-5 lg:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold text-[#727b84]">{detail.reference}</span><OpsStatusBadge tone={statusTone(detail.status)}>{statusLabels[detail.status]}</OpsStatusBadge></div><h2 className="mt-1 flex min-w-0 items-center gap-2 text-xl font-semibold tracking-[-.03em] text-[#20252a]"><span className="truncate">{detail.origin}</span><ArrowRight size={15} className="shrink-0 text-[#8d96bd]"/><span className="truncate">{detail.destination}</span></h2><p className="mt-1 text-[10px] text-[#9299a0]">Received {formatDate(detail.created_at)} · {modeLabels[detail.mode] ?? detail.mode}</p></div>
                <div className="flex items-center gap-2"><a href={`mailto:${detail.contact_email}`} className="ops-button ops-button-secondary"><Mail size={12}/>Email</a>{detail.phone ? <a href={`tel:${detail.phone}`} className="ops-button ops-button-secondary"><Phone size={12}/>Call</a> : null}</div>
              </div>
            </div>
            <nav className="flex overflow-x-auto px-3 sm:px-4 lg:px-5" aria-label="Quote sections">{detailTabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`relative flex h-10 items-center px-3 text-[11px] font-medium capitalize ${activeTab === tab ? "text-[#303a75]" : "text-[#737b84] hover:text-[#333940]"}`}>{tab}{tab === "activity" && detail.note_count > 0 ? <span className="ml-1.5 rounded bg-[#f1f2f3] px-1.5 py-0.5 text-[9px]">{detail.note_count}</span> : null}{activeTab === tab ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-[#5367d9]"/> : null}</button>)}</nav>
          </div>

          <div className="mx-auto max-w-[1250px] p-3 sm:p-4 lg:p-5">
            {notice ? <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#e2e5e8] bg-white px-3.5 py-2.5 text-[11px] text-[#59616a]"><span>{notice}</span><button type="button" onClick={() => setNotice("")} className="font-semibold text-[#6570a7]">Dismiss</button></div> : null}

            {activeTab === "overview" ? <div className="ops-grid-2">
              <div className="ops-stack">
                <OpsPanel title="Cargo details" eyebrow="Enquiry">
                  <div className="grid gap-x-7 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3"><Info icon={<MapPin size={13}/>} label="Route" value={`${detail.origin} → ${detail.destination}`}/><Info icon={<Package size={13}/>} label="Mode" value={modeLabels[detail.mode] ?? detail.mode}/><Info label="Cargo type" value={detail.cargo_type || "Not provided"}/><Info label="Weight" value={cargoWeight(detail)}/><Info label="Dimensions" value={cargoDimensions(detail)}/><Info icon={<Clock3 size={13}/>} label="Preferred timing" value={detail.timing || "Not provided"}/></div>{detail.requirements ? <div className="border-t border-[#eceef0] px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#858c94]">Customer requirements</p><p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-5 text-[#59616a]">{detail.requirements}</p></div> : null}
                </OpsPanel>
                <OpsPanel title="Customer" eyebrow="Contact"><div className="grid gap-x-7 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3"><Info icon={<UserRound size={13}/>} label="Name" value={detail.contact_name}/><Info icon={<Building2 size={13}/>} label="Company" value={detail.company_name || "Not provided"}/><Info icon={<Mail size={13}/>} label="Email" value={detail.contact_email} href={`mailto:${detail.contact_email}`}/><Info icon={<Phone size={13}/>} label="Phone" value={detail.phone || "Not provided"} href={detail.phone ? `tel:${detail.phone}` : undefined}/><Info icon={<CalendarDays size={13}/>} label="Quote validity" value={detail.valid_until ? formatDateOnly(detail.valid_until) : "Not set"}/></div></OpsPanel>
              </div>

              <div className="ops-stack">
                <OpsPanel title="Ownership & status" eyebrow="Workflow">
                  <form onSubmit={saveQuote} className="space-y-3 p-4"><Field label="Status"><select value={detail.status} onChange={(event) => setDetail({ ...detail, status: event.target.value as QuoteStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Assigned to"><input value={detail.assigned_to ?? ""} onChange={(event) => setDetail({ ...detail, assigned_to: event.target.value })} placeholder="Staff member or branch" maxLength={120}/></Field><OpsButton tone="primary" type="submit" disabled={saving} className="w-full">{saving ? "Saving…" : "Save workflow"}</OpsButton></form>
                </OpsPanel>
                <OpsPanel title="Commercial snapshot" eyebrow="Pricing"><div className="grid grid-cols-2 gap-px bg-[#eceef0]"><Snapshot label="Customer price" value={detail.quoted_amount ? formatMoney(detail.quoted_amount, detail.quote_currency) : "Not quoted"}/><Snapshot label="Margin" value={metrics ? `${metrics.margin.toFixed(1)}%` : "—"} positive={metrics ? metrics.margin >= 0 : undefined}/></div><div className="border-t border-[#eceef0] p-3"><button type="button" onClick={() => setActiveTab("commercial")} className="text-[11px] font-semibold text-[#5367a8]">Open pricing workspace →</button></div></OpsPanel>
                {detail.shipment ? <OpsPanel title="Active shipment" eyebrow="Operations" action={<OpsStatusBadge tone="success">Created</OpsStatusBadge>}><div className="p-4"><p className="text-sm font-semibold text-[#30363d]">{detail.shipment.reference}</p><div className="mt-3 flex flex-wrap gap-2"><OpsButton onClick={() => setActiveTab("shipment")}>Shipment workspace</OpsButton><OpsButton href={`/admin/jobs/${encodeURIComponent(detail.shipment.reference)}`} tone="primary">Digital Job File</OpsButton></div></div></OpsPanel> : null}
              </div>
            </div> : null}

            {activeTab === "commercial" ? <OpsPanel title="Pricing & customer offer" eyebrow="Commercial" description="Internal cost never appears in the customer email.">
              <form onSubmit={saveCommercial} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Currency"><select value={detail.quote_currency} onChange={(event) => setDetail({ ...detail, quote_currency: event.target.value as QuoteCurrency })}>{quoteCurrencies.map((currency) => <option value={currency} key={currency}>{currency}</option>)}</select></Field><Field label="Quoted price"><input inputMode="decimal" value={detail.quoted_amount ?? ""} onChange={(event) => setDetail({ ...detail, quoted_amount: event.target.value })} placeholder="0.00" maxLength={16}/></Field><Field label="Internal cost" hint="Never included in customer email"><input inputMode="decimal" value={detail.internal_cost ?? ""} onChange={(event) => setDetail({ ...detail, internal_cost: event.target.value })} placeholder="0.00" maxLength={16}/></Field><Field label="Valid until"><input type="date" value={detail.valid_until ?? ""} onChange={(event) => setDetail({ ...detail, valid_until: event.target.value })}/></Field>
                <div className="grid gap-px overflow-hidden rounded-lg border border-[#e3e5e8] bg-[#e3e5e8] md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:max-w-xl"><Snapshot label="Gross profit" value={metrics ? formatMoney(metrics.profit, detail.quote_currency) : "—"} positive={metrics ? metrics.profit >= 0 : undefined}/><Snapshot label="Margin" value={metrics ? `${metrics.margin.toFixed(1)}%` : "—"} positive={metrics ? metrics.margin >= 0 : undefined}/></div>
                <div className="md:col-span-2 xl:col-span-4"><Field label="Customer quote note"><textarea rows={5} value={detail.customer_quote_note ?? ""} onChange={(event) => setDetail({ ...detail, customer_quote_note: event.target.value })} placeholder="Inclusions, exclusions, transit notes or payment terms…" maxLength={4000}/></Field></div>
                <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-4"><OpsButton tone="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save quote"}</OpsButton><OpsButton type="button" disabled={saving || !detail.quoted_amount?.trim()} onClick={() => void sendQuote()}><Send size={12}/>{saving ? "Sending…" : "Send quote by email"}</OpsButton><OpsButton type="button" disabled={saving || !detail.quoted_amount?.trim()} onClick={openQuoteDraft}>Open email draft</OpsButton></div>
              </form>
            </OpsPanel> : null}

            {activeTab === "shipment" ? (detail.shipment || detail.status === "won" ? <AdminShipmentPanel shipment={detail.shipment} quoteStatus={detail.status} onShipmentChange={(shipment) => setDetail((current) => current ? { ...current, shipment } : current)} onNotice={setNotice}/> : <OpsPanel title="Shipment workspace" eyebrow="Operations"><OpsEmptyState compact title="No shipment record yet" detail="A shipment is created automatically when the quote is marked Won. Update the workflow status when the customer confirms."/></OpsPanel>) : null}

            {activeTab === "activity" ? <OpsPanel title="Team notes" eyebrow="Internal activity" description="Private notes for the KCPL team.">
              <form onSubmit={addNote} className="border-b border-[#eceef0] p-4"><Field label="Add internal note"><textarea rows={4} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add a private note for the KCPL team…" maxLength={3000}/></Field><div className="mt-2 flex justify-end"><OpsButton tone="primary" type="submit" disabled={saving || !noteDraft.trim()}>Add note</OpsButton></div></form>
              {detail.notes.length ? <div className="divide-y divide-[#eceef0]">{detail.notes.map((note) => <div key={note.id} className="px-4 py-3"><p className="whitespace-pre-wrap text-[11px] leading-5 text-[#4f575f]">{note.note}</p><p className="mt-1.5 text-[9px] text-[#969da4]">{note.author_name} · {formatDate(note.created_at)}</p></div>)}</div> : <OpsEmptyState compact title="No internal notes" detail="Add context for handoffs, negotiation or follow-up."/>}
            </OpsPanel> : null}
          </div>
        </> : null}
      </section>
    </div>
  </main>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}{hint ? <span className="mt-1 block text-[9px] text-[#9aa2a9]">{hint}</span> : null}</label>;
}

function Info({ icon, label, value, href }: { icon?: ReactNode; label: string; value: string; href?: string }) {
  const content = href ? <a href={href} className="font-medium text-[#5367a8] hover:underline">{value}</a> : <strong className="font-medium text-[#414850]">{value}</strong>;
  return <div className="flex gap-2.5">{icon ? <span className="mt-0.5 text-[#8791b8]">{icon}</span> : null}<div className="min-w-0"><p className="text-[9px] font-medium uppercase tracking-[.05em] text-[#959ca3]">{label}</p><div className="mt-1 break-words text-[11px] leading-5">{content}</div></div></div>;
}

function Snapshot({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div className="bg-white p-3"><p className="text-[9px] text-[#90979e]">{label}</p><p className={`mt-1 text-[13px] font-semibold ${positive === true ? "text-[#397052]" : positive === false ? "text-[#9a4d55]" : "text-[#343a40]"}`}>{value}</p></div>;
}
