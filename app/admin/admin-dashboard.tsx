"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Clock3,
  LogOut,
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

const statusLabels: Record<QuoteStatus, string> = {
  new: "New",
  reviewing: "Pending",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

const statusStyles: Record<QuoteStatus, { chip: string; dot: string }> = {
  new: { chip: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  reviewing: { chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  quoted: { chip: "border-violet-200 bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  won: { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  lost: { chip: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

const statusOptions: Array<"all" | QuoteStatus> = ["all", "new", "reviewing", "quoted", "won", "lost"];
const detailTabs = ["overview", "commercial", "shipment", "activity"] as const;
type DetailTab = (typeof detailTabs)[number];

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-sm text-[#10263f] outline-none transition focus:border-[#aa8748] focus:bg-white";

const modeLabels: Record<string, string> = {
  air: "Air freight",
  sea: "Sea freight",
  road: "Road freight",
  unsure: "Mode not decided",
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
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      maximumFractionDigits: 3,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-AU")}`;
  }
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
    `Dear ${greetingName},`,
    "",
    "Thank you for your freight enquiry with Kapileshwor Cargo Pvt. Ltd. (KCPL).",
    "",
    `Quote reference: ${quote.reference}`,
    `Route: ${quote.origin} → ${quote.destination}`,
    `Mode: ${modeLabels[quote.mode] ?? quote.mode}`,
    `Quoted price: ${price}`,
    `Valid until: ${validity}`,
  ];

  if (quote.customer_quote_note?.trim()) lines.push("", quote.customer_quote_note.trim());

  lines.push(
    "",
    "Please reply to this email if you would like to proceed or if you need any changes to the quotation.",
    "",
    "Regards,",
    "Kapileshwor Cargo Pvt. Ltd. (KCPL)",
  );

  return {
    subject: `KCPL Freight Quote ${quote.reference}: ${quote.origin} to ${quote.destination}`,
    body: lines.join("\n"),
  };
}

export function AdminDashboard({ initialQuotes, userName, signOutPath }: { initialQuotes: QuoteSummary[]; userName: string; signOutPath: string }) {
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
      return [quote.reference, quote.origin, quote.destination, quote.contact_name, quote.company_name ?? "", quote.assigned_to ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
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
      setQuotes((current) => current.map((quote) => quote.reference === detail.reference
        ? { ...quote, status: detail.status, assigned_to: detail.assigned_to }
        : quote));
      if (data.shipment) {
        setDetail((current) => current ? { ...current, shipment: data.shipment ?? current.shipment } : current);
        setNotice(`Quote won. Shipment ${data.shipment.reference} is ready.`);
      } else {
        setNotice("Quote workflow updated.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the quote.");
    } finally {
      setSaving(false);
    }
  }

  async function persistCommercial(showNotice = true) {
    if (!detail) return false;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "commercial",
          currency: detail.quote_currency,
          quotedAmount: detail.quoted_amount ?? "",
          internalCost: detail.internal_cost ?? "",
          validUntil: detail.valid_until ?? "",
          customerNote: detail.customer_quote_note ?? "",
        }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the commercial quote.");
      if (showNotice) setNotice("Commercial quote saved.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the commercial quote.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveCommercial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistCommercial();
  }

  async function sendQuote() {
    if (!detail) return;
    if (!detail.quoted_amount?.trim()) {
      setNotice("Add a quoted price before preparing the customer email.");
      return;
    }
    const saved = await persistCommercial(false);
    if (!saved) return;
    const email = quoteEmail(detail);
    setNotice("Quote saved. Opening a customer email draft.");
    window.location.href = `mailto:${encodeURIComponent(detail.contact_email)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !noteDraft.trim()) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(detail.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: noteDraft }),
      });
      const data = await response.json() as { ok?: boolean; note?: QuoteDetail["notes"][number]; error?: string };
      if (!response.ok || !data.note) throw new Error(data.error || "Could not save the note.");
      setDetail((current) => current ? { ...current, notes: [data.note!, ...current.notes], note_count: current.note_count + 1 } : current);
      setQuotes((current) => current.map((quote) => quote.reference === detail.reference
        ? { ...quote, note_count: quote.note_count + 1 }
        : quote));
      setNoteDraft("");
      setNotice("Internal note added.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  }

  const metrics = detail ? commercialMetrics(detail) : null;

  return <main className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
    <header className="h-16 border-b border-white/10 bg-[#10263f] px-4 text-white lg:px-6">
      <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d4ad62] text-xs font-black text-[#10263f]">K</div>
          <div className="min-w-0"><p className="truncate text-sm font-bold">KCPL Operations</p><p className="truncate text-[11px] text-white/50">Freight control desk</p></div>
        </div>
        <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-[10px] uppercase tracking-[.12em] text-white/40">Signed in</p><p className="max-w-48 truncate text-xs font-semibold">{userName}</p></div><a href={signOutPath} className="flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-semibold transition hover:bg-white/10">Sign out <LogOut size={13}/></a></div>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1800px] lg:h-[calc(100vh-64px)] lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r border-[#dfe3e8] bg-white">
        <div className="border-b border-[#e8ebee] p-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#84909b]" size={16}/><input className="h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#f8f9fa] pl-9 pr-3 text-sm outline-none transition focus:border-[#9e7b3e] focus:bg-white" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search enquiries"/></div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {statusOptions.map((status) => {
              const active = statusFilter === status;
              const count = status === "all" ? quotes.length : statusCounts[status];
              return <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition ${active ? "border-[#10263f] bg-[#10263f] text-white" : "border-[#e1e5e9] bg-white text-[#5f6b76] hover:bg-[#f5f6f7]"}`}>{status === "all" ? "All" : statusLabels[status]} <span className={active ? "text-white/55" : "text-[#9aa3ab]"}>{count}</span></button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-[#8b949d]"><span>{filtered.length} shown</span>{statusFilter !== "all" && <button type="button" onClick={() => setStatusFilter("all")} className="font-semibold text-[#765b2d] hover:underline">Clear filter</button>}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="p-6 text-sm leading-6 text-[#7b858f]">No enquiries match this view.</div>}
          {filtered.map((quote) => {
            const selected = selectedReference === quote.reference;
            return <button key={quote.reference} type="button" onClick={() => selectQuote(quote.reference)} className={`block w-full border-b border-[#edf0f2] px-4 py-3.5 text-left transition ${selected ? "bg-[#f2f4f5] shadow-[inset_3px_0_0_#b78a3e]" : "hover:bg-[#fafbfb]"}`}>
              <div className="flex items-center justify-between gap-3"><strong className="truncate text-xs font-bold text-[#263a50]">{quote.reference}</strong><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyles[quote.status].chip}`}><span className={`h-1.5 w-1.5 rounded-full ${statusStyles[quote.status].dot}`}/>{statusLabels[quote.status]}</span></div>
              <div className="mt-2 flex min-w-0 items-center gap-1.5 text-sm font-semibold"><span className="truncate">{quote.origin}</span><ArrowRight size={13} className="shrink-0 text-[#9ca4ab]"/><span className="truncate">{quote.destination}</span></div>
              <p className="mt-1 truncate text-xs text-[#69747e]">{quote.company_name || quote.contact_name}{quote.assigned_to ? ` · ${quote.assigned_to}` : ""}</p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-[#9aa3ab]"><span>{formatDate(quote.created_at)}</span>{quote.note_count > 0 && <span className="flex items-center gap-1"><MessageSquareText size={11}/>{quote.note_count}</span>}</div>
            </button>;
          })}
        </div>
      </aside>

      <section className="min-w-0 overflow-y-auto">
        {!selectedReference && <EmptyState/>}
        {loading && <div className="flex min-h-[60vh] items-center justify-center text-sm text-[#7c8791]">Loading enquiry…</div>}
        {!loading && selectedReference && !detail && <div className="m-6 rounded-xl border border-rose-200 bg-white p-6 text-sm text-rose-700">{notice || "This enquiry could not be loaded."}</div>}

        {!loading && detail && <>
          <div className="sticky top-0 z-20 border-b border-[#dfe3e8] bg-white/95 backdrop-blur">
            <div className="px-5 py-4 lg:px-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-[#8a6c36]">{detail.reference}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyles[detail.status].chip}`}>{statusLabels[detail.status]}</span></div><h1 className="mt-1 flex min-w-0 items-center gap-2 text-xl font-bold tracking-[-.02em] sm:text-2xl"><span className="truncate">{detail.origin}</span><ArrowRight size={18} className="shrink-0 text-[#b78a3e]"/><span className="truncate">{detail.destination}</span></h1><p className="mt-1 text-xs text-[#87919a]">Received {formatDate(detail.created_at)}</p></div>
                <div className="flex items-center gap-2"><a href={`mailto:${detail.contact_email}`} className="rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#f7f8f9]">Email customer</a>{detail.phone && <a href={`tel:${detail.phone}`} className="rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#f7f8f9]">Call</a>}</div>
              </div>
            </div>
            <nav className="flex gap-5 overflow-x-auto px-5 lg:px-7">
              {detailTabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`border-b-2 pb-3 text-xs font-semibold capitalize transition ${activeTab === tab ? "border-[#b78a3e] text-[#10263f]" : "border-transparent text-[#7b858e] hover:text-[#10263f]"}`}>{tab}{tab === "activity" && detail.note_count > 0 ? ` (${detail.note_count})` : ""}</button>)}
            </nav>
          </div>

          <div className="mx-auto max-w-[1280px] p-4 sm:p-5 lg:p-7">
            {notice && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#dfe3e8] bg-white px-4 py-3 text-xs font-medium text-[#42505e]"><span>{notice}</span><button type="button" onClick={() => setNotice("")} className="text-[#88929a] hover:text-[#10263f]">Dismiss</button></div>}

            {activeTab === "overview" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
              <div className="space-y-4">
                <Panel title="Cargo details" eyebrow="Enquiry">
                  <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Info icon={<MapPin size={16}/>} label="Route" value={`${detail.origin} → ${detail.destination}`}/>
                    <Info icon={<Package size={16}/>} label="Mode" value={modeLabels[detail.mode] ?? detail.mode}/>
                    <Info label="Cargo type" value={detail.cargo_type || "Not provided"}/>
                    <Info label="Weight" value={cargoWeight(detail)}/>
                    <Info label="Dimensions" value={cargoDimensions(detail)}/>
                    <Info icon={<Clock3 size={16}/>} label="Preferred timing" value={detail.timing || "Not provided"}/>
                  </div>
                  {detail.requirements && <div className="mt-5 border-t border-[#edf0f2] pt-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#89929a]">Customer requirements</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4f5b66]">{detail.requirements}</p></div>}
                </Panel>

                <Panel title="Customer" eyebrow="Contact">
                  <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Info icon={<UserRound size={16}/>} label="Name" value={detail.contact_name}/>
                    <Info icon={<Building2 size={16}/>} label="Company" value={detail.company_name || "Not provided"}/>
                    <Info icon={<Mail size={16}/>} label="Email" value={detail.contact_email} href={`mailto:${detail.contact_email}`}/>
                    <Info icon={<Phone size={16}/>} label="Phone" value={detail.phone || "Not provided"} href={detail.phone ? `tel:${detail.phone}` : undefined}/>
                    <Info icon={<CalendarDays size={16}/>} label="Quote validity" value={detail.valid_until ? formatDateOnly(detail.valid_until) : "Not set"}/>
                  </div>
                </Panel>
              </div>

              <div className="space-y-4">
                <form onSubmit={saveQuote} className="rounded-xl border border-[#dfe3e8] bg-white p-4">
                  <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#89929a]">Workflow</p><h2 className="mt-1 text-base font-bold">Ownership & status</h2></div>
                  <label className="block text-[11px] font-semibold text-[#5e6973]">Status<select className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none ${statusStyles[detail.status].chip}`} value={detail.status} onChange={(event) => setDetail({ ...detail, status: event.target.value as QuoteStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                  <label className="mt-3 block text-[11px] font-semibold text-[#5e6973]">Assigned to<input className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-sm outline-none focus:border-[#aa8748] focus:bg-white" value={detail.assigned_to ?? ""} onChange={(event) => setDetail({ ...detail, assigned_to: event.target.value })} placeholder="Staff member or branch" maxLength={120}/></label>
                  <button disabled={saving} className="mt-4 h-10 w-full rounded-lg bg-[#10263f] px-4 text-xs font-bold text-white transition hover:bg-[#183651] disabled:opacity-50" type="submit">{saving ? "Saving…" : "Save workflow"}</button>
                </form>

                <div className="rounded-xl border border-[#dfe3e8] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#89929a]">Commercial snapshot</p><div className="mt-3 grid grid-cols-2 gap-3"><Metric label="Customer price" value={detail.quoted_amount ? formatMoney(detail.quoted_amount, detail.quote_currency) : "Not quoted"}/><Metric label="Margin" value={metrics ? `${metrics.margin.toFixed(1)}%` : "—"}/></div><button type="button" onClick={() => setActiveTab("commercial")} className="mt-3 text-xs font-bold text-[#80612e] hover:underline">Open pricing workspace →</button></div>

                {detail.shipment && <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-emerald-700">Active shipment</p><p className="mt-1 text-sm font-bold text-[#173c2d]">{detail.shipment.reference}</p><button type="button" onClick={() => setActiveTab("shipment")} className="mt-3 text-xs font-bold text-emerald-800 hover:underline">Open shipment workspace →</button></div>}
              </div>
            </div>}

            {activeTab === "commercial" && <Panel title="Pricing & customer offer" eyebrow="Commercial">
              <form onSubmit={saveCommercial} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Currency"><select className={inputClass} value={detail.quote_currency} onChange={(event) => setDetail({ ...detail, quote_currency: event.target.value as QuoteCurrency })}>{quoteCurrencies.map((currency) => <option value={currency} key={currency}>{currency}</option>)}</select></Field>
                <Field label="Quoted price"><input inputMode="decimal" className={inputClass} value={detail.quoted_amount ?? ""} onChange={(event) => setDetail({ ...detail, quoted_amount: event.target.value })} placeholder="0.00" maxLength={16}/></Field>
                <Field label="Internal cost" hint="Never included in customer email"><input inputMode="decimal" className={inputClass} value={detail.internal_cost ?? ""} onChange={(event) => setDetail({ ...detail, internal_cost: event.target.value })} placeholder="0.00" maxLength={16}/></Field>
                <Field label="Valid until"><input type="date" className={inputClass} value={detail.valid_until ?? ""} onChange={(event) => setDetail({ ...detail, valid_until: event.target.value })}/></Field>

                <div className="grid gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:max-w-xl"><Metric label="Gross profit" value={metrics ? formatMoney(metrics.profit, detail.quote_currency) : "—"} negative={Boolean(metrics && metrics.profit < 0)}/><Metric label="Margin" value={metrics ? `${metrics.margin.toFixed(1)}%` : "—"} negative={Boolean(metrics && metrics.margin < 0)}/></div>

                <label className="md:col-span-2 xl:col-span-4"><span className="text-[11px] font-semibold text-[#5f6973]">Customer quote note</span><textarea className="mt-1.5 min-h-28 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] p-3 text-sm leading-6 outline-none focus:border-[#aa8748] focus:bg-white" value={detail.customer_quote_note ?? ""} onChange={(event) => setDetail({ ...detail, customer_quote_note: event.target.value })} placeholder="Inclusions, exclusions, transit notes or payment terms…" maxLength={4000}/></label>

                <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-4"><button disabled={saving} className="h-10 rounded-lg bg-[#10263f] px-4 text-xs font-bold text-white disabled:opacity-50" type="submit">{saving ? "Saving…" : "Save quote"}</button><button disabled={saving || !detail.quoted_amount?.trim()} onClick={sendQuote} className="flex h-10 items-center gap-2 rounded-lg bg-[#b78a3e] px-4 text-xs font-bold text-white disabled:opacity-40" type="button"><Send size={14}/> Prepare customer email</button></div>
              </form>
            </Panel>}

            {activeTab === "shipment" && (detail.shipment || detail.status === "won" ? <AdminShipmentPanel shipment={detail.shipment} quoteStatus={detail.status} onShipmentChange={(shipment) => setDetail((current) => current ? { ...current, shipment } : current)} onNotice={setNotice}/> : <Panel title="Shipment workspace" eyebrow="Operations"><p className="text-sm leading-6 text-[#66717b]">A shipment record is created automatically when the quote is marked as Won. Update the workflow status from Overview when the customer confirms.</p></Panel>)}

            {activeTab === "activity" && <Panel title="Team notes" eyebrow="Internal activity">
              <form onSubmit={addNote}><textarea className="min-h-24 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] p-3 text-sm leading-6 outline-none focus:border-[#aa8748] focus:bg-white" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add a private note for the KCPL team…" maxLength={3000}/><div className="mt-2 flex justify-end"><button disabled={saving || !noteDraft.trim()} type="submit" className="h-9 rounded-lg bg-[#10263f] px-4 text-xs font-bold text-white disabled:opacity-50">Add note</button></div></form>
              <div className="mt-5 divide-y divide-[#edf0f2] border-t border-[#edf0f2]">{detail.notes.length === 0 && <p className="py-5 text-sm text-[#828c95]">No internal notes yet.</p>}{detail.notes.map((note) => <div key={note.id} className="py-4"><p className="whitespace-pre-wrap text-sm leading-6 text-[#46525e]">{note.note}</p><p className="mt-2 text-[10px] font-medium text-[#9099a1]">{note.author_name} · {formatDate(note.created_at)}</p></div>)}</div>
            </Panel>}
          </div>
        </>}
      </section>
    </div>
  </main>;
}

function EmptyState() {
  return <div className="flex min-h-[70vh] items-center justify-center p-6"><div className="max-w-sm text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#dfe3e8] bg-white text-[#9a783d]"><Package size={19}/></div><h2 className="mt-4 text-lg font-bold">No quote enquiries yet</h2><p className="mt-1 text-sm leading-6 text-[#7d8790]">New website enquiries will appear here automatically.</p></div></div>;
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return <article className="rounded-xl border border-[#dfe3e8] bg-white p-4 sm:p-5"><div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8b744d]">{eyebrow}</p><h2 className="mt-1 text-base font-bold tracking-[-.01em]">{title}</h2></div>{children}</article>;
}

function Metric({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return <div className="rounded-lg border border-[#e4e7ea] bg-[#f8f9fa] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#89939c]">{label}</p><p className={`mt-1.5 text-base font-bold ${negative ? "text-rose-700" : "text-[#10263f]"}`}>{value}</p></div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label><span className="text-[11px] font-semibold text-[#5f6973]">{label}</span>{children}{hint && <span className="mt-1 block text-[10px] text-[#9aa2a9]">{hint}</span>}</label>;
}

function Info({ icon, label, value, href }: { icon?: ReactNode; label: string; value: string; href?: string }) {
  const content = href ? <a href={href} className="font-semibold text-[#10263f] underline decoration-[#b78a3e]/35 underline-offset-4">{value}</a> : <strong className="font-semibold text-[#263a50]">{value}</strong>;
  return <div className="flex gap-2.5">{icon && <span className="mt-0.5 text-[#a27e3d]">{icon}</span>}<div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#939ca4]">{label}</p><div className="mt-1 break-words text-sm leading-5">{content}</div></div></div>;
}
