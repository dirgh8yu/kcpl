"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, PackageCheck, Search, Truck } from "lucide-react";
import { OpsBadge, OpsEmptyState, OpsPage } from "../operations-ui";
import { deliveryAttemptStatusLabels, type DeliveryQueueRow, type DeliverySummary } from "./delivery-control";

type Focus = "all" | "active" | "failed" | "pod_pending" | "verified";

function dateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date) + " NPT";
}

function stateBadge(row: DeliveryQueueRow) {
  if (row.delivery_state === "pod_verified") return <OpsBadge tone="success">POD verified</OpsBadge>;
  if (row.delivery_state === "delivered_pod_pending") return <OpsBadge tone="warning">POD pending</OpsBadge>;
  if (row.delivery_state === "delivery_failed") return <OpsBadge tone="danger">Delivery exception</OpsBadge>;
  if (row.delivery_state === "delivery_active") return <OpsBadge tone="info">Delivery active</OpsBadge>;
  return <OpsBadge tone="neutral">Ready for delivery</OpsBadge>;
}

function Metric({ label, value, active, alert, onClick, icon }: { label: string; value: number; active?: boolean; alert?: boolean; onClick: () => void; icon: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`min-h-[108px] border-b border-[#D6D6D0] px-4 py-5 text-left transition-colors hover:bg-[#EEEEE8] sm:border-b-0 sm:border-r sm:last:border-r-0 ${active ? "bg-[#EEEEE8]" : ""}`}><span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.07em] text-[#5B5B57]"><span>{label}</span><span className={active ? "text-[#DC143C]" : "text-[#777771]"}>{icon}</span></span><strong className={`mt-4 block text-[32px] font-normal leading-none tracking-[-0.045em] ${alert && value ? "text-[#DC143C]" : "text-[#101010]"}`}>{value}</strong></button>;
}

function focusName(focus: Focus) {
  if (focus === "active") return "Delivery active";
  if (focus === "failed") return "Failed / refused";
  if (focus === "pod_pending") return "POD pending";
  if (focus === "verified") return "POD verified";
  return "All final-mile movements";
}

export function DeliveryWorkspace({ initialRows, initialSummary, initialQuery = "" }: { initialRows: DeliveryQueueRow[]; initialSummary: DeliverySummary; initialQuery?: string }) {
  const [focus, setFocus] = useState<Focus>("all");
  const [query, setQuery] = useState(initialQuery);
  const rows = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return initialRows.filter((row) => {
      if (focus === "active" && row.delivery_state !== "delivery_active") return false;
      if (focus === "failed" && row.delivery_state !== "delivery_failed") return false;
      if (focus === "pod_pending" && row.delivery_state !== "delivered_pod_pending") return false;
      if (focus === "verified" && row.delivery_state !== "pod_verified") return false;
      if (!terms.length) return true;
      const haystack = [row.reference, row.customer_name, row.origin, row.destination, row.mode, row.primary_branch, row.current_location ?? "", row.recipient_name ?? "", row.last_attempt_status ?? ""].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [focus, initialRows, query]);

  return <OpsPage><main className="min-h-[calc(100vh-64px)] bg-[#F6F6F3] text-[#101010]"><div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
    <header className="grid gap-6 border-b border-[#101010] pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><div><p className="text-[10px] uppercase tracking-[0.11em] text-[#DC143C]">Operations · Final mile</p><h1 className="mt-3 text-[clamp(36px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.04em]">Delivery & POD Control</h1><p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#5B5B57]">Control final-mile attempts, delivery exceptions and proof-of-delivery closeout. Canonical completion depends on verified POD inside the Digital Job File.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/visibility" className="inline-flex h-10 items-center border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Live Visibility</Link><Link href="/admin/shipments" className="inline-flex h-10 items-center border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white hover:border-[#B61032] hover:bg-[#B61032]">Shipments</Link></div></header>

    <section className="grid border-b border-[#D6D6D0] sm:grid-cols-5"><Metric label="Ready" value={initialSummary.ready} active={focus === "all"} onClick={() => setFocus("all")} icon={<PackageCheck size={13}/>}/><Metric label="Delivery active" value={initialSummary.out_for_delivery} active={focus === "active"} onClick={() => setFocus("active")} icon={<Truck size={13}/>}/><Metric label="Failed / refused" value={initialSummary.failed_or_refused} alert active={focus === "failed"} onClick={() => setFocus("failed")} icon={<AlertTriangle size={13}/>}/><Metric label="POD pending" value={initialSummary.delivered_pod_pending} alert active={focus === "pod_pending"} onClick={() => setFocus("pod_pending")} icon={<Clock3 size={13}/>}/><Metric label="POD verified" value={initialSummary.pod_verified} active={focus === "verified"} onClick={() => setFocus("verified")} icon={<CheckCircle2 size={13}/>}/></section>

    <section className="mt-6 border-y border-[#D6D6D0]">
      <div className="flex flex-col gap-3 border-b border-[#101010] py-4 sm:flex-row sm:items-center"><label className="flex h-10 min-w-0 flex-1 items-center border border-[#BDBDB6] bg-white px-3"><Search size={13} className="mr-2 text-[#777771]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, branch, route or recipient…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8A8A84]"/></label><button type="button" onClick={() => { setQuery(""); setFocus("all"); }} className="h-10 border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Reset</button><span className="text-[11px] text-[#5B5B57]">{focusName(focus)} · {rows.length} shown</span></div>

      {!rows.length ? <div className="py-14"><OpsEmptyState icon={<Search size={18}/>} title="No delivery movements match this view" description="Change the filter or search terms to see another final-mile queue."/></div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] table-fixed border-collapse text-left"><thead><tr className="h-11 border-b border-[#101010] text-[10px] uppercase tracking-[0.06em] text-[#5B5B57]"><th className="w-[145px] px-3 font-normal">Shipment</th><th className="w-[230px] px-3 font-normal">Customer / route</th><th className="w-[170px] px-3 font-normal">Delivery state</th><th className="w-[190px] px-3 font-normal">Latest attempt</th><th className="w-[155px] px-3 font-normal">POD control</th><th className="w-[120px] px-3 text-right font-normal">Action</th></tr></thead><tbody>{rows.map((row) => {
        const exception = row.delivery_state === "delivery_failed" || row.delivery_state === "delivered_pod_pending";
        return <tr key={row.reference} className={`h-[76px] border-b border-[#D6D6D0] transition-colors hover:bg-[#EEEEE8] ${exception ? "bg-[#DC143C]/[0.018]" : ""}`}><td className="relative px-3">{exception ? <span className="absolute bottom-2 left-0 top-2 w-[2px] bg-[#DC143C]"/> : null}<Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="text-[12px] font-medium hover:text-[#DC143C]">{row.reference}</Link><div className="mt-1 text-[10px] text-[#777771]">{row.primary_branch}</div></td><td className="px-3"><div className="truncate text-[12px] font-medium">{row.customer_name}</div><div className="mt-1 truncate text-[10px] text-[#777771]">{row.origin} → {row.destination} · {row.mode}</div></td><td className="px-3">{stateBadge(row)}<div className="mt-2 truncate text-[10px] text-[#777771]">{row.current_location || "Location not recorded"}</div></td><td className="px-3"><div className="text-[11px] font-medium text-[#4F4F4A]">{row.last_attempt_status ? deliveryAttemptStatusLabels[row.last_attempt_status] : "No attempt yet"}</div><div className="mt-1 text-[10px] leading-4 text-[#777771]">{row.next_delivery_at ? `Next ${dateTime(row.next_delivery_at)}` : dateTime(row.last_attempt_at)}</div></td><td className="px-3"><div className="text-[11px] font-medium capitalize text-[#4F4F4A]">{row.pod_status.replaceAll("_", " ")}</div><div className="mt-1 text-[10px] text-[#777771]">{row.pod_evidence_count} evidence item{row.pod_evidence_count === 1 ? "" : "s"}{row.recipient_name ? ` · ${row.recipient_name}` : ""}</div></td><td className="px-3 text-right"><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}#delivery-pod`} className={`inline-flex h-9 items-center border px-3 text-[11px] ${exception ? "border-[#DC143C] bg-[#DC143C] text-white hover:bg-[#B61032]" : "border-[#A5A5A0] hover:border-[#101010] hover:bg-white"}`}>Open control</Link></td></tr>;
      })}</tbody></table></div>}
    </section>

    <div className="mt-5 grid gap-0 border-y border-[#D6D6D0] md:grid-cols-3"><div className="p-5 md:border-r md:border-[#D6D6D0]"><p className="text-[10px] font-medium text-[#DC143C]">01</p><h2 className="mt-5 text-[18px] font-normal tracking-[-0.025em]">Attempt</h2><p className="mt-2 text-[11px] leading-5 text-[#777771]">Record the final-mile movement and any failed or refused delivery directly in the Job File.</p></div><div className="border-t border-[#D6D6D0] p-5 md:border-r md:border-t-0 md:border-[#D6D6D0]"><p className="text-[10px] font-medium text-[#DC143C]">02</p><h2 className="mt-5 text-[18px] font-normal tracking-[-0.025em]">Evidence</h2><p className="mt-2 text-[11px] leading-5 text-[#777771]">Capture recipient and POD evidence so the closeout has an auditable record, not just a status change.</p></div><div className="border-t border-[#D6D6D0] p-5 md:border-t-0"><p className="text-[10px] font-medium text-[#DC143C]">03</p><h2 className="mt-5 text-[18px] font-normal tracking-[-0.025em]">Verify & close</h2><p className="mt-2 text-[11px] leading-5 text-[#777771]">Verified POD seals the delivery record and allows canonical shipment completion to be satisfied.</p></div></div>
  </div></main></OpsPage>;
}
