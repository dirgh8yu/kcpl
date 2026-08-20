"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, Building2, Clock3, LogOut, Mail, MapPin, MessageSquareText, Package, Phone, Search, UserRound } from "lucide-react";
import type { QuoteDetail, QuoteStatus, QuoteSummary } from "./admin-data";

const statusLabels: Record<QuoteStatus, string> = {
  new: "New",
  reviewing: "Pending",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

const statusStyles: Record<QuoteStatus, { chip: string; stripe: string }> = {
  new: {
    chip: "border border-sky-200 bg-sky-50 text-sky-700",
    stripe: "border-l-sky-400",
  },
  reviewing: {
    chip: "border border-amber-200 bg-amber-50 text-amber-800",
    stripe: "border-l-amber-400",
  },
  quoted: {
    chip: "border border-violet-200 bg-violet-50 text-violet-700",
    stripe: "border-l-violet-400",
  },
  won: {
    chip: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    stripe: "border-l-emerald-500",
  },
  lost: {
    chip: "border border-rose-200 bg-rose-50 text-rose-700",
    stripe: "border-l-rose-500",
  },
};

const statusOptions: Array<"all" | QuoteStatus> = ["all", "new", "reviewing", "quoted", "won", "lost"];
const summaryStatuses: QuoteStatus[] = ["new", "reviewing", "quoted", "won", "lost"];

const modeLabels: Record<string, string> = {
  air: "Air freight",
  sea: "Sea freight",
  road: "Road freight",
  unsure: "Mode not decided",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function cargoDimensions(quote: QuoteDetail) {
  if (![quote.length, quote.width, quote.height].some(Boolean)) return "Not provided";
  return `${quote.length || "—"} × ${quote.width || "—"} × ${quote.height || "—"} ${quote.dimension_unit || ""}`.trim();
}

function cargoWeight(quote: QuoteDetail) {
  return quote.weight ? `${quote.weight} ${quote.weight_unit || ""}`.trim() : "Not provided";
}

export function AdminDashboard({ initialQuotes, userName, signOutPath }: { initialQuotes: QuoteSummary[]; userName: string; signOutPath: string }) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [selectedReference, setSelectedReference] = useState(initialQuotes[0]?.reference ?? "");
  const [detail, setDetail] = useState<QuoteDetail | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuoteStatus>("all");
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
    fetch(`/api/admin/quotes/${encodeURIComponent(selectedReference)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
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
        body: JSON.stringify({ status: detail.status, assignedTo: detail.assigned_to ?? "" }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the quote.");

      setQuotes((current) => current.map((quote) => quote.reference === detail.reference
        ? { ...quote, status: detail.status, assigned_to: detail.assigned_to }
        : quote));
      setNotice("Quote workflow updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the quote.");
    } finally {
      setSaving(false);
    }
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

  return <main className="min-h-screen bg-[#f4f1e9] text-[#10263f]">
    <header className="border-b border-black/10 bg-[#10263f] px-5 py-5 text-white lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.24em] text-[#d4ad62]">KCPL Operations</p><h1 className="mt-1 text-2xl font-black tracking-[-.03em]">Freight enquiry desk</h1></div>
        <div className="flex items-center gap-4"><div className="text-right text-sm text-white/70"><p>Signed in as</p><strong className="text-white">{userName}</strong></div><a href={signOutPath} className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-white transition hover:bg-white/10">Sign out <LogOut size={14}/></a></div>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1600px] lg:min-h-[calc(100vh-89px)] lg:grid-cols-[380px_1fr]">
      <aside className="border-r border-black/10 bg-white">
        <div className="sticky top-0 border-b border-black/10 bg-white p-5">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35" size={17}/><input className="w-full rounded-xl border border-black/10 bg-[#f8f7f2] py-3 pl-10 pr-3 text-sm outline-none transition focus:border-[#b78a3e]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search quotes, clients, routes"/></div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {statusOptions.map((status) => {
              const active = statusFilter === status;
              if (status === "all") {
                return <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? "border-[#10263f] bg-[#10263f] text-white shadow-sm" : "border-black/10 bg-[#eeeae0] text-[#425365] hover:bg-[#e7e2d7]"}`}>All</button>;
              }
              return <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${statusStyles[status].chip} ${active ? "ring-2 ring-current/20 ring-offset-1" : "opacity-80 hover:opacity-100"}`}>{statusLabels[status]}</button>;
            })}
          </div>
        </div>

        <div className="divide-y divide-black/10">
          {filtered.length === 0 && <div className="p-8 text-sm leading-6 text-black/50">No enquiries match this view.</div>}
          {filtered.map((quote) => <button key={quote.reference} type="button" onClick={() => selectQuote(quote.reference)} className={`block w-full border-l-4 p-5 text-left transition ${statusStyles[quote.status].stripe} ${selectedReference === quote.reference ? "bg-[#f4f1e9]" : "hover:bg-[#faf9f5]"}`}>
            <div className="flex items-start justify-between gap-3"><strong className="text-sm">{quote.reference}</strong><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.1em] ${statusStyles[quote.status].chip}`}>{statusLabels[quote.status] ?? quote.status}</span></div>
            <div className="mt-3 flex items-center gap-2 text-sm font-bold"><span className="truncate">{quote.origin}</span><ArrowRight size={14} className="shrink-0 text-[#b78a3e]"/><span className="truncate">{quote.destination}</span></div>
            <p className="mt-2 truncate text-xs text-black/55">{quote.company_name || quote.contact_name}{quote.assigned_to ? ` · ${quote.assigned_to}` : ""}</p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-black/45"><span>{formatDate(quote.created_at)}</span>{quote.note_count > 0 && <span className="flex items-center gap-1"><MessageSquareText size={12}/>{quote.note_count}</span>}</div>
          </button>)}
        </div>
      </aside>

      <section className="p-5 lg:p-8 xl:p-10">
        <div className="mx-auto mb-6 max-w-5xl">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-black/35">Pipeline overview</p><h2 className="mt-1 text-lg font-black tracking-[-.02em]">{quotes.length} total enquiries</h2></div>
            {statusFilter !== "all" && <button type="button" onClick={() => setStatusFilter("all")} className="text-xs font-bold text-black/45 underline decoration-black/20 underline-offset-4 transition hover:text-[#10263f]">Clear status filter</button>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {summaryStatuses.map((status) => {
              const active = statusFilter === status;
              return <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(active ? "all" : status)}
                className={`rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${statusStyles[status].chip} ${active ? "ring-2 ring-current/25 ring-offset-2" : ""}`}
              >
                <p className="text-[10px] font-black uppercase tracking-[.14em] opacity-70">{statusLabels[status]}</p>
                <p className="mt-2 text-3xl font-black tracking-[-.05em]">{statusCounts[status]}</p>
                <p className="mt-1 text-[11px] font-semibold opacity-60">{statusCounts[status] === 1 ? "enquiry" : "enquiries"}</p>
              </button>;
            })}
          </div>
        </div>

        {!selectedReference && <div className="mx-auto mt-20 max-w-xl rounded-3xl border border-black/10 bg-white p-10 text-center"><Package className="mx-auto text-[#b78a3e]"/><h2 className="mt-5 text-2xl font-black">No quote enquiries yet.</h2><p className="mt-2 text-sm leading-6 text-black/55">New website enquiries will appear here automatically.</p></div>}
        {loading && <div className="mx-auto mt-20 max-w-xl text-center text-sm text-black/50">Loading enquiry…</div>}
        {!loading && selectedReference && !detail && <div className="mx-auto mt-20 max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-700">{notice || "This enquiry could not be loaded."}</div>}

        {!loading && detail && <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#b78a3e]">{detail.reference}</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">{detail.origin} <span className="text-[#b78a3e]">→</span> {detail.destination}</h2><p className="mt-2 text-sm text-black/50">Received {formatDate(detail.created_at)}</p></div>
            <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[.12em] shadow-sm ${statusStyles[detail.status].chip}`}>{statusLabels[detail.status]}</span>
          </div>

          {notice && <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm font-semibold">{notice}</div>}

          <form onSubmit={saveQuote} className="grid gap-4 rounded-3xl border border-black/10 bg-white p-5 sm:grid-cols-2 sm:p-7">
            <label className="text-xs font-black uppercase tracking-[.13em] text-black/45">Workflow status<select className={`mt-2 w-full rounded-xl p-3 text-sm font-bold outline-none ${statusStyles[detail.status].chip}`} value={detail.status} onChange={(event) => setDetail({ ...detail, status: event.target.value as QuoteStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label className="text-xs font-black uppercase tracking-[.13em] text-black/45">Assigned to<input className="mt-2 w-full rounded-xl border border-black/10 bg-[#f8f7f2] p-3 text-sm text-[#10263f]" value={detail.assigned_to ?? ""} onChange={(event) => setDetail({ ...detail, assigned_to: event.target.value })} placeholder="Staff member or branch" maxLength={120}/></label>
            <div className="sm:col-span-2"><button disabled={saving} className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white disabled:opacity-50" type="submit">{saving ? "Saving…" : "Save workflow"}</button></div>
          </form>

          <div className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-3xl border border-black/10 bg-white p-6 sm:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-[#b78a3e]">Cargo</p><div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Info icon={<MapPin size={18}/>} label="Route" value={`${detail.origin} → ${detail.destination}`}/>
              <Info icon={<Package size={18}/>} label="Mode" value={modeLabels[detail.mode] ?? detail.mode}/>
              <Info label="Cargo type" value={detail.cargo_type || "Not provided"}/>
              <Info label="Weight" value={cargoWeight(detail)}/>
              <Info label="Dimensions" value={cargoDimensions(detail)}/>
              <Info icon={<Clock3 size={18}/>} label="Preferred timing" value={detail.timing || "Not provided"}/>
            </div>{detail.requirements && <div className="mt-6 border-t border-black/10 pt-5"><p className="text-[11px] font-black uppercase tracking-[.14em] text-black/40">Special handling / notes from customer</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/70">{detail.requirements}</p></div>}</article>

            <article className="rounded-3xl border border-black/10 bg-white p-6 sm:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-[#b78a3e]">Customer</p><div className="mt-6 space-y-5">
              <Info icon={<UserRound size={18}/>} label="Name" value={detail.contact_name}/>
              <Info icon={<Building2 size={18}/>} label="Company" value={detail.company_name || "Not provided"}/>
              <Info icon={<Mail size={18}/>} label="Email" value={detail.contact_email} href={`mailto:${detail.contact_email}`}/>
              <Info icon={<Phone size={18}/>} label="Phone" value={detail.phone || "Not provided"} href={detail.phone ? `tel:${detail.phone}` : undefined}/>
            </div></article>
          </div>

          <article className="rounded-3xl border border-black/10 bg-white p-6 sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#b78a3e]">Internal activity</p><h3 className="mt-2 text-xl font-black">Team notes</h3></div><MessageSquareText className="text-[#b78a3e]"/></div>
            <form onSubmit={addNote} className="mt-6"><textarea className="w-full rounded-2xl border border-black/10 bg-[#f8f7f2] p-4 text-sm leading-6 outline-none focus:border-[#b78a3e]" rows={4} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add a private note for the KCPL team…" maxLength={3000}/><div className="mt-3 flex justify-end"><button disabled={saving || !noteDraft.trim()} type="submit" className="rounded-xl bg-[#b78a3e] px-5 py-3 text-sm font-black text-white disabled:opacity-50">Add internal note</button></div></form>
            <div className="mt-7 space-y-4 border-t border-black/10 pt-6">{detail.notes.length === 0 && <p className="text-sm text-black/45">No internal notes yet.</p>}{detail.notes.map((note) => <div key={note.id} className="rounded-2xl bg-[#f8f7f2] p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-black/75">{note.note}</p><p className="mt-3 text-[11px] font-semibold text-black/40">{note.author_name} · {formatDate(note.created_at)}</p></div>)}</div>
          </article>
        </div>}
      </section>
    </div>
  </main>;
}

function Info({ icon, label, value, href }: { icon?: ReactNode; label: string; value: string; href?: string }) {
  const content = href ? <a href={href} className="font-bold text-[#10263f] underline decoration-[#b78a3e]/40 underline-offset-4">{value}</a> : <strong className="font-bold text-[#10263f]">{value}</strong>;
  return <div className="flex gap-3">{icon && <span className="mt-0.5 text-[#b78a3e]">{icon}</span>}<div><p className="text-[10px] font-black uppercase tracking-[.13em] text-black/35">{label}</p><div className="mt-1 text-sm leading-6">{content}</div></div></div>;
}