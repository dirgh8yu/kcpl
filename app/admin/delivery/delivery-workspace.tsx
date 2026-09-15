"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, PackageCheck, Truck } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface, OpsTableWrap, OpsToolbar } from "../operations-ui";
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
  if (row.delivery_state === "delivered_pod_pending") return <OpsBadge tone="warning">Delivered · POD pending</OpsBadge>;
  if (row.delivery_state === "delivery_failed") return <OpsBadge tone="danger">Delivery exception</OpsBadge>;
  if (row.delivery_state === "delivery_active") return <OpsBadge tone="info">Delivery active</OpsBadge>;
  return <OpsBadge>Ready for delivery</OpsBadge>;
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
  const [selectedReference, setSelectedReference] = useState<string | null>(initialRows[0]?.reference ?? null);

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

  const selected = initialRows.find((row) => row.reference === selectedReference) ?? rows[0] ?? null;

  function reset() {
    setQuery("");
    setFocus("all");
  }

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Operations · Final mile"
      title="Delivery & POD"
      description="Control final-mile attempts, delivery exceptions and proof-of-delivery closeout. A delivered movement is not the same authority as verified POD."
      meta={<><span>{initialRows.length} accessible movements</span><span>{rows.length} shown</span></>}
      actions={<><Link href="/admin/visibility" className="ops-button" data-variant="secondary">Live Visibility</Link><Link href="/admin/shipments" className="ops-button" data-variant="primary">Shipments</Link></>}
    />

    <OpsStatStrip>
      <OpsStat label="Ready" value={initialSummary.ready} icon={<PackageCheck size={13}/>} active={focus === "all"} onClick={() => setFocus("all")}/>
      <OpsStat label="Delivery active" value={initialSummary.out_for_delivery} icon={<Truck size={13}/>} tone="info" active={focus === "active"} onClick={() => setFocus(focus === "active" ? "all" : "active")}/>
      <OpsStat label="Failed / refused" value={initialSummary.failed_or_refused} icon={<AlertTriangle size={13}/>} tone={initialSummary.failed_or_refused ? "danger" : "neutral"} active={focus === "failed"} onClick={() => setFocus(focus === "failed" ? "all" : "failed")}/>
      <OpsStat label="POD pending" value={initialSummary.delivered_pod_pending} icon={<Clock3 size={13}/>} tone={initialSummary.delivered_pod_pending ? "warning" : "neutral"} active={focus === "pod_pending"} onClick={() => setFocus(focus === "pod_pending" ? "all" : "pod_pending")}/>
      <OpsStat label="POD verified" value={initialSummary.pod_verified} icon={<CheckCircle2 size={13}/>} tone="success" active={focus === "verified"} onClick={() => setFocus(focus === "verified" ? "all" : "verified")}/>
    </OpsStatStrip>

    <div className="ops-content-wide grid gap-4">
      <OpsToolbar>
        <OpsSearch className="flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, branch, route or recipient"/>
        <span className="text-sm text-[var(--admin-muted)]">{focusName(focus)} · {rows.length} shown</span>
        <OpsButton variant="secondary" onClick={reset}>Reset</OpsButton>
      </OpsToolbar>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <OpsSurface className="lg:col-span-2" title="Final-mile queue" description="Select a movement to inspect the authoritative delivery and POD state." flush>
          {rows.length ? <OpsTableWrap>
            <table className="ops-table">
              <thead><tr><th>Shipment</th><th>Customer / route</th><th>Delivery state</th><th>Latest attempt</th><th>POD</th><th>Action</th></tr></thead>
              <tbody>{rows.map((row) => {
                const exception = row.delivery_state === "delivery_failed" || row.delivery_state === "delivered_pod_pending";
                const isSelected = selected?.reference === row.reference;
                return <tr key={row.reference} data-selected={isSelected ? "true" : undefined}>
                  <td><button type="button" onClick={() => setSelectedReference(row.reference)} className="text-left font-semibold hover:text-[var(--admin-crimson)]">{row.reference}</button><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.primary_branch}</span></td>
                  <td><strong className="block">{row.customer_name}</strong><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.origin} → {row.destination} · {row.mode}</span></td>
                  <td>{stateBadge(row)}<span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.current_location || "Location not recorded"}</span></td>
                  <td><span className="block">{row.last_attempt_status ? deliveryAttemptStatusLabels[row.last_attempt_status] : "No attempt yet"}</span><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.next_delivery_at ? `Next ${dateTime(row.next_delivery_at)}` : dateTime(row.last_attempt_at)}</span></td>
                  <td><OpsBadge tone={row.pod_status === "verified" ? "success" : row.pod_status === "rejected" ? "danger" : row.pod_status === "received" ? "warning" : "neutral"}>{row.pod_status.replaceAll("_", " ")}</OpsBadge><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.pod_evidence_count} evidence item{row.pod_evidence_count === 1 ? "" : "s"}</span></td>
                  <td><div className="flex justify-end gap-2"><OpsButton size="sm" variant={exception ? "primary" : "secondary"} onClick={() => setSelectedReference(row.reference)}>Inspect</OpsButton><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}#delivery-pod`} className="ops-button" data-variant="ghost" data-size="sm">Open control</Link></div></td>
                </tr>;
              })}</tbody>
            </table>
          </OpsTableWrap> : <div className="p-5"><OpsEmptyState kind="search" title="No delivery movements match this view" description="Change the filter or search terms to see another final-mile queue." action={<OpsButton size="sm" variant="secondary" onClick={reset}>Reset view</OpsButton>}/></div>}
        </OpsSurface>

        <OpsSurface
          eyebrow="Selected movement"
          title={selected ? selected.reference : "No movement selected"}
          description={selected ? `${selected.customer_name} · ${selected.origin} → ${selected.destination}` : "Select a movement from the queue to inspect delivery evidence and closeout readiness."}
          priority={selected?.delivery_state === "delivery_failed" ? "danger" : selected?.delivery_state === "delivered_pod_pending" ? "warning" : selected?.delivery_state === "pod_verified" ? "success" : "normal"}
        >
          {selected ? <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">{stateBadge(selected)}<OpsBadge>{selected.primary_branch}</OpsBadge></div>
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-xs text-[var(--admin-faint)]">Current location</dt><dd className="mt-1 font-medium">{selected.current_location || "Not recorded"}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Latest attempt</dt><dd className="mt-1 font-medium">{selected.last_attempt_status ? deliveryAttemptStatusLabels[selected.last_attempt_status] : "No attempt recorded"}</dd><dd className="text-xs text-[var(--admin-muted)]">{dateTime(selected.last_attempt_at)}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Recipient</dt><dd className="mt-1 font-medium">{selected.recipient_name || "Not recorded"}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">POD evidence</dt><dd className="mt-1 font-medium">{selected.pod_evidence_count} item{selected.pod_evidence_count === 1 ? "" : "s"} · {selected.pod_status.replaceAll("_", " ")}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Next delivery</dt><dd className="mt-1 font-medium">{dateTime(selected.next_delivery_at)}</dd></div>
            </dl>
            {selected.delivery_state === "delivered_pod_pending" ? <div className="ops-notice" data-tone="warning" role="status"><span>Delivered status is recorded, but verified POD is still required before canonical closeout can be satisfied.</span></div> : null}
            {selected.delivery_state === "delivery_failed" ? <div className="ops-notice" data-tone="danger" role="alert"><span>A failed or refused delivery is an operational exception. Review the attempt before scheduling the next action.</span></div> : null}
            {selected.delivery_state === "pod_verified" ? <div className="ops-notice" data-tone="success" role="status"><span>POD is verified. Delivery evidence satisfies the final-mile evidence requirement for closeout, subject to the remaining Job File policy checks.</span></div> : null}
            <div className="grid gap-2"><Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}#delivery-pod`} className="ops-button" data-variant="primary">Open Delivery & POD control</Link><Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}`} className="ops-button" data-variant="secondary">Open Job File</Link></div>
          </div> : <OpsEmptyState compact title="No movement selected" description="Choose a row from the final-mile queue."/>}
        </OpsSurface>
      </div>
    </div>
  </OpsPage>;
}
