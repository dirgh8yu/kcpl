"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, PackageCheck, Search, Truck } from "lucide-react";
import { OpsBadge, OpsEmptyState, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
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

export function DeliveryWorkspace({ initialRows, initialSummary }: { initialRows: DeliveryQueueRow[]; initialSummary: DeliverySummary }) {
  const [focus, setFocus] = useState<Focus>("all");
  const [query, setQuery] = useState("");
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

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Final mile"
      title="Delivery & POD Control"
      description="Control final-mile attempts, failed or refused deliveries and proof-of-delivery closeout. Verified POD is sealed into the Digital Job File and can satisfy operational closeout."
      actions={<><Link href="/admin/visibility" className="ops-button" data-variant="secondary" data-size="md">Live Visibility</Link><Link href="/admin/shipments" className="ops-button" data-variant="primary" data-size="md">Shipments</Link></>}
    />
    <OpsStatStrip>
      <OpsStat label="Ready" value={initialSummary.ready} icon={<PackageCheck size={13}/>} active={focus === "all"} onClick={() => setFocus("all")}/>
      <OpsStat label="Delivery active" value={initialSummary.out_for_delivery} icon={<Truck size={13}/>} active={focus === "active"} onClick={() => setFocus("active")}/>
      <OpsStat label="Failed / refused" value={initialSummary.failed_or_refused} icon={<AlertTriangle size={13}/>} tone={initialSummary.failed_or_refused ? "danger" : "neutral"} active={focus === "failed"} onClick={() => setFocus("failed")}/>
      <OpsStat label="POD pending" value={initialSummary.delivered_pod_pending} icon={<Clock3 size={13}/>} tone={initialSummary.delivered_pod_pending ? "warning" : "neutral"} active={focus === "pod_pending"} onClick={() => setFocus("pod_pending")}/>
      <OpsStat label="POD verified" value={initialSummary.pod_verified} icon={<CheckCircle2 size={13}/>} active={focus === "verified"} onClick={() => setFocus("verified")}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      <OpsSurface eyebrow="Control tower" title="Final-mile queue" description={`${rows.length} delivery movement${rows.length === 1 ? "" : "s"} shown.`}>
        <div className="mb-4 max-w-xl"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, branch, route or recipient…"/></div>
        {!rows.length ? <OpsEmptyState icon={<Search size={18}/>} title="No delivery movements match this view" description="Change the filter or search terms to see another final-mile queue."/> : (
          <div className="overflow-x-auto rounded-[12px] border border-[#e8e1db]">
            <table className="min-w-full text-left text-[11px]">
              <thead className="bg-[#faf7f4] text-[#81776f]"><tr><th className="px-4 py-3">Shipment</th><th className="px-4 py-3">Customer / route</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Attempt</th><th className="px-4 py-3">POD</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.reference} className="border-t border-[#eee7e2] bg-white align-top">
                <td className="px-4 py-3"><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="font-bold text-[#3f3833] hover:underline">{row.reference}</Link><div className="mt-1 text-[10px] text-[#91877f]">{row.primary_branch}</div></td>
                <td className="px-4 py-3"><div className="font-semibold text-[#514943]">{row.customer_name}</div><div className="mt-1 text-[#8b8179]">{row.origin} → {row.destination} · {row.mode}</div></td>
                <td className="px-4 py-3">{stateBadge(row)}<div className="mt-2 text-[10px] text-[#8b8179]">{row.current_location || "Location not recorded"}</div></td>
                <td className="px-4 py-3"><div className="font-semibold text-[#5d554f]">{row.last_attempt_status ? deliveryAttemptStatusLabels[row.last_attempt_status] : "No attempt yet"}</div><div className="mt-1 text-[10px] text-[#938981]">{row.next_delivery_at ? `Next ${dateTime(row.next_delivery_at)}` : dateTime(row.last_attempt_at)}</div></td>
                <td className="px-4 py-3"><div className="font-semibold capitalize text-[#5d554f]">{row.pod_status.replaceAll("_", " ")}</div><div className="mt-1 text-[10px] text-[#938981]">{row.pod_evidence_count} evidence item{row.pod_evidence_count === 1 ? "" : "s"}</div></td>
                <td className="px-4 py-3 text-right"><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}#delivery-pod`} className="ops-button" data-variant="secondary" data-size="sm">Open control</Link></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </OpsSurface>
    </div>
  </OpsPage>;
}
