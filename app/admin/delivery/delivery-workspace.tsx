"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Truck, X } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsFilterChip, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsToolbar } from "../operations-ui";
import { deliveryPulseRows, RegisterPulseStrip } from "../register-pulse-strip";
import type { CommandCentreData } from "../command-centre/command-centre-data";
import { useWorkspaceQuery } from "../use-workspace-query";
import { deliveryAttemptStatusLabels, type DeliveryQueueRow, type DeliverySummary } from "./delivery-control";

type Focus = "all" | "active" | "failed" | "pod_pending" | "verified";

function dateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function stateLabel(row: DeliveryQueueRow) {
  if (row.delivery_state === "pod_verified") return "POD verified";
  if (row.delivery_state === "delivered_pod_pending") return "POD pending";
  if (row.delivery_state === "delivery_failed") return "Delivery exception";
  if (row.delivery_state === "delivery_active") return "Delivery active";
  return "Ready for delivery";
}

function stateTone(row: DeliveryQueueRow): "success" | "warning" | "danger" | "info" | "neutral" {
  if (row.delivery_state === "pod_verified") return "success";
  if (row.delivery_state === "delivered_pod_pending") return "warning";
  if (row.delivery_state === "delivery_failed") return "danger";
  if (row.delivery_state === "delivery_active") return "info";
  return "neutral";
}

function podLabel(row: DeliveryQueueRow) {
  if (row.pod_status === "verified") return "Verified";
  if (row.pod_status === "received") return "Evidence received";
  if (row.pod_status === "rejected") return "Rejected";
  return "Not received";
}

function podTone(row: DeliveryQueueRow): "success" | "warning" | "danger" | "neutral" {
  if (row.pod_status === "verified") return "success";
  if (row.pod_status === "received") return "warning";
  if (row.pod_status === "rejected") return "danger";
  return "neutral";
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--admin-muted)" }}>{label}</div><div style={{ marginTop: 2, fontSize: 13 }}>{value}</div></div>;
}

function Inspector({ row, onClose }: { row: DeliveryQueueRow; onClose: () => void }) {
  return <aside style={{ width: 390, flexShrink: 0, border: "1px solid var(--admin-line)", borderRadius: "var(--app-surface-radius)", background: "var(--admin-surface)", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: 16, borderBottom: "1px solid var(--admin-line)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 3, fontSize: 12, color: "var(--admin-muted)" }}><OpsMono>{row.reference}</OpsMono></div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{row.customer_name}</div>
        <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--admin-muted)" }}>{row.origin} → {row.destination} · {row.mode}</div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close delivery inspector" style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: 0, borderRadius: "var(--app-radius)", background: "transparent", color: "var(--admin-muted)", cursor: "pointer" }}><X size={16}/></button>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--admin-line)", background: "var(--admin-surface-muted)" }}>
      <div><div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>Delivery state</div><OpsBadge tone={stateTone(row)}>{stateLabel(row)}</OpsBadge></div>
      <div><div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>POD evidence</div><OpsBadge tone={podTone(row)}>{podLabel(row)}</OpsBadge></div>
    </div>

    {row.delivery_state === "delivered_pod_pending" ? <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--admin-line)", borderLeft: "4px solid var(--admin-warning)", background: "var(--admin-warning-bg)" }}><div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><AlertTriangle size={15} style={{ color: "var(--admin-warning)", flexShrink: 0, marginTop: 2 }}/><div><div style={{ color: "var(--admin-warning)", fontSize: 13, fontWeight: 700 }}>Delivered ≠ POD verified</div><div style={{ marginTop: 3, fontSize: 12.5 }}>Delivery is recorded, but verified proof of delivery is still required before canonical closeout is satisfied.</div></div></div></div> : null}
    {row.delivery_state === "delivery_failed" ? <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--admin-line)", borderLeft: "4px solid var(--admin-danger)", background: "var(--admin-danger-bg)" }}><div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><AlertTriangle size={15} style={{ color: "var(--admin-danger)", flexShrink: 0, marginTop: 2 }}/><div><div style={{ color: "var(--admin-danger)", fontSize: 13, fontWeight: 700 }}>Delivery exception</div><div style={{ marginTop: 3, fontSize: 12.5 }}>Review the failed or refused attempt before scheduling the next final-mile action.</div></div></div></div> : null}
    {row.delivery_state === "pod_verified" ? <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--admin-line)", borderLeft: "4px solid var(--admin-success)", background: "var(--admin-success-bg)" }}><div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><CheckCircle2 size={15} style={{ color: "var(--admin-success)", flexShrink: 0, marginTop: 2 }}/><div><div style={{ color: "var(--admin-success)", fontSize: 13, fontWeight: 700 }}>POD verified</div><div style={{ marginTop: 3, fontSize: 12.5 }}>Final-mile evidence is verified, subject to remaining Digital Job File closeout policy checks.</div></div></div></div> : null}

    <div style={{ display: "grid", gap: 11, padding: 16 }}>
      <Detail label="Branch" value={row.primary_branch}/>
      <Detail label="Current location" value={row.current_location || "Not recorded"}/>
      <Detail label="Latest attempt" value={row.last_attempt_status ? deliveryAttemptStatusLabels[row.last_attempt_status] : "No attempt recorded"}/>
      <Detail label="Attempt time" value={dateTime(row.last_attempt_at)}/>
      <Detail label="Next delivery" value={dateTime(row.next_delivery_at)}/>
      <Detail label="Recipient" value={row.recipient_name || "Not recorded"}/>
      <Detail label="POD evidence" value={`${row.pod_evidence_count} item${row.pod_evidence_count === 1 ? "" : "s"} · ${podLabel(row)}`}/>
    </div>

    <div style={{ display: "grid", gap: 8, padding: "0 16px 16px" }}>
      <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}#delivery-pod`} className="ops-button" data-variant="primary">Open Delivery & POD control</Link>
      <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="secondary">Open Job File</Link>
    </div>
  </aside>;
}

export function DeliveryWorkspace({ initialRows, initialSummary, initialQuery = "", pulseData = null }: { initialRows: DeliveryQueueRow[]; initialSummary: DeliverySummary; initialQuery?: string; pulseData?: CommandCentreData | null }) {
  const { params, update } = useWorkspaceQuery();
  const requestedFocus = params.get("view");
  const focus: Focus = requestedFocus === "active" || requestedFocus === "failed" || requestedFocus === "pod_pending" || requestedFocus === "verified" ? requestedFocus : "all";
  const query = params.get("q") ?? initialQuery;
  const selectedReference = params.get("selected");

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

  const filtersActive = Boolean(query.trim()) || focus !== "all";

  function reset() {
    update({ q: null, view: null, selected: null });
  }

  const setFocus = (next: Focus) => update({ view: next === "all" ? null : next, selected: null });
  const selected = selectedReference ? initialRows.find((row) => row.reference === selectedReference) ?? null : null;
  return <OpsPage>
    <div className="delivery-control-page">
      <OpsPageHeader eyebrow="Shipment execution" title="Delivery & POD" description={`Last-mile execution queue · ${initialRows.length} deliveries · POD evidence received ≠ POD verified`} actions={<><Link href="/admin/visibility" className="ops-button" data-variant="secondary" data-size="sm">Live Visibility</Link><Link href="/admin/shipments" className="ops-button" data-variant="secondary" data-size="sm">Shipments</Link></>}/>

      {pulseData ? <RegisterPulseStrip initialData={pulseData} rows={deliveryPulseRows} urlParam="dpulse"/> : null}

      {initialSummary.delivered_pod_pending > 0 ? <div style={{ marginBottom: 16 }}><OpsNotice tone="warning"><span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><AlertTriangle size={15}/><strong>{initialSummary.delivered_pod_pending} delivered movement{initialSummary.delivered_pod_pending === 1 ? "" : "s"} awaiting verified POD.</strong></span></OpsNotice></div> : null}

      <div className="delivery-control-workspace">
        <div className="delivery-control-queue">
          <OpsToolbar className="delivery-control-toolbar">
            <OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null })} placeholder="Search shipment, customer, branch…" aria-label="Search delivery and POD queue"/>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Delivery state filter">
              <OpsFilterChip active={focus === "all"} onClick={() => setFocus("all")}>All</OpsFilterChip>
              <OpsFilterChip active={focus === "active"} onClick={() => setFocus("active")}>Delivery active</OpsFilterChip>
              <OpsFilterChip active={focus === "failed"} onClick={() => setFocus("failed")}>Failed / refused</OpsFilterChip>
              <OpsFilterChip active={focus === "pod_pending"} onClick={() => setFocus("pod_pending")}>POD pending</OpsFilterChip>
              <OpsFilterChip active={focus === "verified"} onClick={() => setFocus("verified")}>POD verified</OpsFilterChip>
            </div>
            {filtersActive ? <OpsButton size="sm" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--admin-muted)" }}>{rows.length} entries</span>
          </OpsToolbar>

          <section style={{ border: "1px solid var(--admin-line)", borderRadius: "var(--app-surface-radius)", background: "var(--admin-surface)", overflow: "hidden" }}>
            {rows.length ? <div style={{ overflowX: "auto" }}><table className="ops-table" style={{ minWidth: 980 }}><thead><tr><th>Shipment</th><th>Consignee / route</th><th>Branch</th><th>Scheduled / attempt</th><th>Delivery state</th><th>POD evidence</th><th>Closeout</th></tr></thead><tbody>{rows.map((row) => {
              const isSelected = selectedReference === row.reference;
              const exception = row.delivery_state === "delivery_failed" || row.delivery_state === "delivered_pod_pending";
              return <tr key={row.reference} data-selected={isSelected ? "true" : undefined} tabIndex={0} onClick={() => update({ selected: row.reference }, "push")} onKeyDown={(event) => { if (event.key === "Enter") update({ selected: row.reference }, "push"); }} style={{ cursor: "pointer" }}>
                <td><div style={{ fontWeight: 500 }}><OpsMono>{row.reference}</OpsMono></div><div style={{ marginTop: 2, fontSize: 12, color: "var(--admin-muted)" }}>{row.mode}</div></td>
                <td><div style={{ fontWeight: 500 }}>{row.customer_name}</div><div style={{ marginTop: 2, fontSize: 12, color: "var(--admin-muted)" }}>{row.origin} → {row.destination}</div></td>
                <td>{row.primary_branch}</td>
                <td><div>{row.next_delivery_at ? dateTime(row.next_delivery_at) : row.last_attempt_at ? dateTime(row.last_attempt_at) : "Not scheduled"}</div><div style={{ marginTop: 2, fontSize: 12, color: "var(--admin-muted)" }}>{row.last_attempt_status ? deliveryAttemptStatusLabels[row.last_attempt_status] : `${row.attempt_count} attempt${row.attempt_count === 1 ? "" : "s"}`}</div></td>
                <td><OpsBadge tone={stateTone(row)}>{stateLabel(row)}</OpsBadge></td>
                <td><OpsBadge tone={podTone(row)}>{podLabel(row)}</OpsBadge><div style={{ marginTop: 3, fontSize: 12, color: "var(--admin-muted)" }}>{row.pod_evidence_count} item{row.pod_evidence_count === 1 ? "" : "s"}</div></td>
                <td><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}#delivery-pod`} aria-label={`Open Delivery and POD control for ${row.reference}`} onClick={(event) => event.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, minHeight: 24 }}>{row.delivery_state === "pod_verified" ? <CheckCircle2 size={15} style={{ color: "var(--admin-success)" }}/> : exception ? <AlertTriangle size={15} style={{ color: row.delivery_state === "delivery_failed" ? "var(--admin-danger)" : "var(--admin-warning)" }}/> : <Truck size={15} style={{ color: "var(--admin-muted)" }}/>}</Link></td>
              </tr>;
            })}</tbody></table></div> : <OpsEmptyState kind="search" icon={<Truck size={18}/>} title={filtersActive ? "No results" : "No final-mile movements"} description={filtersActive ? "Try changing or resetting the current filters." : "No accessible shipments are currently in the final-mile queue."} action={filtersActive ? <OpsButton size="sm" variant="secondary" onClick={reset}>Reset view</OpsButton> : undefined}/>} 
          </section>
        </div>

        {selected ? <Inspector row={selected} onClose={() => update({ selected: null })}/> : null}
      </div>
    </div>
  </OpsPage>;
}