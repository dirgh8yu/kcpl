"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, Link2, X } from "lucide-react";
import type { CrmQuoteLinkItem } from "../crm-quote-links.server";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

export function CrmQuoteMatchDock({
  customerId,
  initialLinked,
  initialSuggested,
}: {
  customerId: string;
  initialLinked: CrmQuoteLinkItem[];
  initialSuggested: CrmQuoteLinkItem[];
}) {
  const router = useRouter();
  const [linked, setLinked] = useState(initialLinked);
  const [suggested, setSuggested] = useState(initialSuggested);
  const [open, setOpen] = useState(initialSuggested.length > 0);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function confirm(item: CrmQuoteLinkItem) {
    setBusy(item.reference);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customerId)}/quote-links`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quoteReference: item.reference }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not link the quote.");
      setSuggested((current) => current.filter((quote) => quote.reference !== item.reference));
      setLinked((current) => [{ ...item, customer_id: customerId }, ...current.filter((quote) => quote.reference !== item.reference)]);
      setNotice(`${item.reference} linked to this customer.`);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not link the quote.");
    } finally {
      setBusy("");
    }
  }

  const total = linked.length + suggested.length;
  if (!total) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[80] w-[min(430px,calc(100vw-2.5rem))] text-[#10263f]">
      {open ? <div className="mb-3 max-h-[70vh] overflow-y-auto rounded-[22px] border border-black/10 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-black/10 bg-[#10263f] p-5 text-white">
          <div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#d4ad62]">Quote relationship</p><h3 className="mt-1 text-base font-black">CRM enquiry links</h3></div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-white/60 hover:bg-white/10" aria-label="Close quote links"><X size={14} /></button>
        </div>
        <div className="p-4">
          {notice ? <div className="mb-3 rounded-xl bg-[#fff8e8] p-3 text-xs font-bold text-[#6d5427]">{notice}</div> : null}
          {suggested.length ? <section><p className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-amber-700">Needs confirmation · {suggested.length}</p><div className="space-y-2">{suggested.map((item) => <QuoteRow key={item.reference} item={item} action={<button type="button" disabled={busy === item.reference} onClick={() => confirm(item)} className="flex shrink-0 items-center gap-1 rounded-lg bg-[#10263f] px-2.5 py-2 text-[9px] font-black text-white disabled:opacity-50"><Link2 size={11} />{busy === item.reference ? "Linking" : "Confirm"}</button>} />)}</div></section> : null}
          {linked.length ? <section className={suggested.length ? "mt-5" : ""}><p className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-emerald-700">Linked quotes · {linked.length}</p><div className="space-y-2">{linked.slice(0, 12).map((item) => <QuoteRow key={item.reference} item={item} action={<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check size={13} /></span>} />)}</div></section> : null}
        </div>
      </div> : null}
      <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto flex items-center gap-3 rounded-2xl bg-[#0b1724] px-4 py-3 text-left text-white shadow-xl">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d4ad62] text-[#10263f]"><Link2 size={16} /></span>
        <span><span className="block text-[9px] font-black uppercase tracking-[.13em] text-white/45">Customer enquiries</span><strong className="mt-0.5 block text-xs">{suggested.length ? `${suggested.length} match${suggested.length === 1 ? "" : "es"} to confirm` : `${linked.length} linked quote${linked.length === 1 ? "" : "s"}`}</strong></span>
      </button>
    </div>
  );
}

function QuoteRow({ item, action }: { item: CrmQuoteLinkItem; action: React.ReactNode }) {
  return <div className="rounded-xl border border-black/10 bg-[#faf9f5] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="text-xs">{item.reference}</strong><p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-black/45"><span className="truncate">{item.origin}</span><ArrowRight size={10} /><span className="truncate">{item.destination}</span></p></div>{action}</div><p className="mt-2 truncate text-[10px] text-black/45">{item.company_name || item.contact_name} · {formatDate(item.created_at)}</p>{item.match_reason ? <p className="mt-1 text-[9px] font-black uppercase tracking-[.08em] text-amber-700">Matched by {item.match_reason.replace("_", " ")}</p> : null}</div>;
}
