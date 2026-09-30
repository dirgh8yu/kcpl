"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Link2 } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsNotice } from "../../operations-ui";
import type { CrmQuoteLinkItem } from "../crm-quote-links.server";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(date);
}

/** Website enquiries that belong to this customer: the ones KCPL matched and
 *  someone should confirm, then the ones already linked. */
export function CrmQuoteMatchPanel({
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
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);

  async function confirm(item: CrmQuoteLinkItem) {
    setBusy(item.reference);
    setNotice(null);
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
      setNotice({ text: `${item.reference} linked to this customer.`, tone: "success" });
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Could not link the quote.", tone: "danger" });
    } finally {
      setBusy("");
    }
  }

  if (!linked.length && !suggested.length) return <OpsEmptyState compact icon={<Link2 size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No enquiries to match" description="Website enquiries from this customer’s company or email appear here to confirm."/>;

  return (
    <div className="crm-tool-panel">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
      {suggested.length ? <section><p className="crm-tool-heading">Needs confirming · {suggested.length}</p><div className="crm-quote-list">{suggested.map((item) => <QuoteRow key={item.reference} item={item} action={<OpsButton size="sm" variant="primary" disabled={busy === item.reference} onClick={() => confirm(item)}><Link2 size={13} strokeWidth={1.75} aria-hidden="true"/>{busy === item.reference ? "Linking…" : "Confirm"}</OpsButton>}/>)}</div></section> : null}
      {linked.length ? <section><p className="crm-tool-heading">Linked · {linked.length}</p><div className="crm-quote-list">{linked.slice(0, 12).map((item) => <QuoteRow key={item.reference} item={item} action={<OpsBadge tone="success" dot>Linked</OpsBadge>}/>)}</div></section> : null}
    </div>
  );
}

function QuoteRow({ item, action }: { item: CrmQuoteLinkItem; action: React.ReactNode }) {
  return <div className="crm-quote-row">
    <div className="min-w-0">
      <strong className="ops-mono block">{item.reference}</strong>
      <p className="ops-route"><span>{item.origin}</span><ArrowRight size={11} className="ops-route-arrow" aria-hidden="true"/><span>{item.destination}</span></p>
      <p className="crm-quote-meta">{item.company_name || item.contact_name} · {formatDate(item.created_at)}{item.match_reason ? ` · matched by ${item.match_reason.replaceAll("_", " ").replace(/^./, (letter) => letter.toLowerCase())}` : ""}</p>
    </div>
    {action}
  </div>;
}
