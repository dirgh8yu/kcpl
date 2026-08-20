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
    <div className="fixed bottom-4 right-4 z-[80] w-[min(420px,calc(100vw-2rem))] text-[#1c2025] sm:bottom-5 sm:right-5">
      {open ? <section aria-label="Customer quote links" className="mb-2 max-h-[min(68vh,620px)] overflow-y-auto rounded-xl border border-[#dfe2e6] bg-white shadow-[0_18px_48px_rgb(15_23_42/.16)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#e8eaed] bg-white px-4 py-3.5">
          <div><p className="ops-eyebrow">Quote relationships</p><h3 className="text-sm font-semibold tracking-[-.01em]">Customer enquiry links</h3><p className="mt-1 text-[11px] text-[#7c848d]">Confirm likely matches before they become part of this customer record.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#dfe2e6] bg-white text-[#6f7780] hover:bg-[#f6f7f8]" aria-label="Close customer quote links"><X size={14}/></button>
        </div>
        <div className="p-3.5">
          {notice ? <div role="status" aria-live="polite" className="mb-3 rounded-lg border border-[#e5dfd1] bg-[#faf7f0] px-3 py-2.5 text-[11px] font-medium text-[#765f3b]">{notice}</div> : null}
          {suggested.length ? <section aria-labelledby="suggested-quote-links"><div className="mb-2 flex items-center justify-between"><p id="suggested-quote-links" className="text-[10px] font-semibold text-[#7c848d]">Needs confirmation</p><span className="rounded-md border border-[#eadfca] bg-[#fbf7ef] px-2 py-1 text-[9px] font-semibold text-[#8a6734]">{suggested.length}</span></div><div className="space-y-2">{suggested.map((item) => <QuoteRow key={item.reference} item={item} action={<button type="button" disabled={busy === item.reference} onClick={() => confirm(item)} className="ops-button ops-button-primary !min-h-8 !px-2.5 !text-[10px]"><Link2 size={11}/>{busy === item.reference ? "Linking…" : "Confirm"}</button>}/>)}</div></section> : null}
          {linked.length ? <section aria-labelledby="linked-quote-links" className={suggested.length ? "mt-5 border-t border-[#eceef0] pt-4" : ""}><div className="mb-2 flex items-center justify-between"><p id="linked-quote-links" className="text-[10px] font-semibold text-[#7c848d]">Linked quotes</p><span className="rounded-md border border-[#d8e9df] bg-[#f2f8f4] px-2 py-1 text-[9px] font-semibold text-[#397052]">{linked.length}</span></div><div className="space-y-2">{linked.slice(0, 12).map((item) => <QuoteRow key={item.reference} item={item} action={<span aria-label="Linked" className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#d8e9df] bg-[#f2f8f4] text-[#397052]"><Check size={13}/></span>}/>)}</div></section> : null}
        </div>
      </section> : null}
      <button type="button" aria-expanded={open} aria-label={open ? "Hide customer quote links" : "Show customer quote links"} onClick={() => setOpen((value) => !value)} className="ml-auto flex min-h-11 items-center gap-3 rounded-lg border border-[#dfe2e6] bg-white px-3.5 py-2.5 text-left shadow-[0_10px_30px_rgb(15_23_42/.12)] hover:bg-[#fafafa]">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#f0f2ff] text-[#5367d9]"><Link2 size={15}/></span>
        <span className="min-w-0"><span className="block text-[9px] font-semibold uppercase tracking-[.08em] text-[#9299a1]">Customer enquiries</span><strong className="mt-0.5 block truncate text-[11px] font-semibold text-[#31363c]">{suggested.length ? `${suggested.length} match${suggested.length === 1 ? "" : "es"} to confirm` : `${linked.length} linked quote${linked.length === 1 ? "" : "s"}`}</strong></span>
      </button>
    </div>
  );
}

function QuoteRow({ item, action }: { item: CrmQuoteLinkItem; action: React.ReactNode }) {
  return <div className="rounded-lg border border-[#e3e6e9] bg-[#fbfbfb] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="text-[11px] font-semibold text-[#31363c]">{item.reference}</strong><p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] font-medium text-[#6f7780]"><span className="truncate">{item.origin}</span><ArrowRight size={10} className="shrink-0"/><span className="truncate">{item.destination}</span></p></div>{action}</div><p className="mt-2 truncate text-[10px] text-[#858c94]">{item.company_name || item.contact_name} · {formatDate(item.created_at)}</p>{item.match_reason ? <p className="mt-1 text-[9px] font-semibold text-[#8a6734]">Matched by {item.match_reason.replace("_", " ")}</p> : null}</div>;
}
