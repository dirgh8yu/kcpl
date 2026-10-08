"use client";

import Link from "next/link";
import { freightModeLabel } from "../freight-mode";
import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Truck, X } from "lucide-react";
import {
  OpsBadge,
  OpsEmptyState,
  OpsFacts,
  OpsFact,
  OpsInlineAlert,
  OpsInspectorHeader,
  OpsInspectorSection,
  OpsNoMatches,
  OpsPage,
  OpsPageHeader,
  OpsScopeTabs,
  OpsRegisterToolbar,
  OpsResultCount,
  OpsSearch,
  OpsTableWrap,
} from "../operations-ui";
import { MineToggle, ownedBy, useMineFilter, type CurrentStaff } from "../mine-filter";
import { useWorkspaceQuery } from "../use-workspace-query";
import { deliveryAttemptStatusLabels, type DeliveryQueueRow, type DeliverySummary } from "./delivery-control";

type Focus = "all" | "ready" | "active" | "failed" | "pod_pending" | "verified";

/** One focus → delivery-state mapping instead of a four-branch filter chain. */
const FOCUS_STATE: Record<Exclude<Focus, "all">, DeliveryQueueRow["delivery_state"]> = {
  ready: "not_started",
  active: "delivery_active",
  failed: "delivery_failed",
  pod_pending: "delivered_pod_pending",
  verified: "pod_verified",
};

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

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

function Inspector({ row, onClose, inspectorRef }: { row: DeliveryQueueRow; onClose: () => void; inspectorRef: React.RefObject<HTMLElement | null> }) {
  return <aside ref={inspectorRef} className="ops-inspector" aria-label={`Delivery ${row.reference}`}>
    <OpsInspectorHeader
      kicker={row.reference}
      title={row.customer_name}
      subtitle={`${row.origin} → ${row.destination} · ${freightModeLabel(row.mode)}`}
      actions={<button type="button" className="ops-inspector-close" onClick={onClose} aria-label="Close delivery inspector"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
    />

    <div className="ops-inspector-scroll">
      <div className="ops-inspector-body">
        <div className="flex flex-wrap gap-1.5">
          <OpsBadge tone={stateTone(row)} dot>{stateLabel(row)}</OpsBadge>
          <OpsBadge tone={podTone(row)} dot>{podLabel(row)}</OpsBadge>
        </div>

        {row.delivery_state === "delivered_pod_pending" ? <OpsInlineAlert tone="warning" icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Proof still needs checking.</strong> The delivery is recorded; someone needs to check the proof of delivery before the job can close.</OpsInlineAlert> : null}
        {row.delivery_state === "delivery_failed" ? <OpsInlineAlert tone="danger" icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Delivery failed.</strong> See what went wrong before booking the next attempt.</OpsInlineAlert> : null}
        {row.delivery_state === "pod_verified" ? <OpsInlineAlert tone="info" icon={<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Proof checked.</strong> The job can close once its other steps are done.</OpsInlineAlert> : null}

        <OpsInspectorSection title="Delivery">
          <OpsFacts>
            <OpsFact label="Branch">{row.primary_branch}</OpsFact>
            <OpsFact label="Current location">{row.current_location || "Not recorded"}</OpsFact>
            <OpsFact label="Latest attempt">{row.last_attempt_status ? deliveryAttemptStatusLabels[row.last_attempt_status] : "No attempt recorded"}</OpsFact>
            <OpsFact label="Attempt time">{dateTime(row.last_attempt_at)}</OpsFact>
            <OpsFact label="Next delivery">{dateTime(row.next_delivery_at)}</OpsFact>
            <OpsFact label="Recipient">{row.recipient_name || "Not recorded"}</OpsFact>
            <OpsFact label="POD evidence" warning={row.pod_status === "rejected"}>{`${row.pod_evidence_count} item${row.pod_evidence_count === 1 ? "" : "s"} · ${podLabel(row)}`}</OpsFact>
          </OpsFacts>
        </OpsInspectorSection>
      </div>
    </div>

    <footer className="ops-inspector-footer">
      <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}#delivery-pod`} className="ops-button" data-variant="primary" data-size="md">Open Delivery & POD control</Link>
      <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="secondary" data-size="md">Open Job File</Link>
    </footer>
  </aside>;
}

export function DeliveryWorkspace({ initialRows, initialSummary, initialQuery = "", currentStaff }: { initialRows: DeliveryQueueRow[]; initialSummary: DeliverySummary; initialQuery?: string; currentStaff: CurrentStaff }) {
  const [mine, setMine] = useMineFilter("delivery");
  const { params, update } = useWorkspaceQuery();
  const requestedFocus = params.get("view");
  const focus: Focus = requestedFocus === "ready" || requestedFocus === "active" || requestedFocus === "failed" || requestedFocus === "pod_pending" || requestedFocus === "verified" ? requestedFocus : "all";
  const query = params.get("q") ?? initialQuery;
  const selectedReference = params.get("selected");

  const rows = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return initialRows.filter((row) => {
      if (focus !== "all" && row.delivery_state !== FOCUS_STATE[focus]) return false;
      if (mine && !ownedBy(currentStaff, { uid: row.owner_uid, email: row.owner_email })) return false;
      if (!terms.length) return true;
      const haystack = [row.reference, row.customer_name, row.origin, row.destination, row.mode, row.primary_branch, row.current_location ?? "", row.recipient_name ?? "", row.last_attempt_status ?? ""].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [currentStaff, focus, initialRows, mine, query]);

  const filtersActive = Boolean(query.trim()) || focus !== "all";

  function reset() {
    update({ q: null, view: null, selected: null });
  }

  const setFocus = (next: Focus) => update({ view: next === "all" ? null : next, selected: null });
  const selected = selectedReference ? initialRows.find((row) => row.reference === selectedReference) ?? null : null;
  const compact = selected !== null;
  const inspectorRef = useRef<HTMLElement | null>(null);


  // Escape closes the inspector, as it does on the other registers.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      update({ selected: null });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, update]);

  // Stacked layouts put the inspector under the queue; bring it into view.
  useEffect(() => {
    if (!selected) return;
    window.requestAnimationFrame(() => {
      if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inspectorRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  }, [selected]);

  return <OpsPage>
    <div className="delivery-control-page">
      <OpsPageHeader
        title="Delivery & POD"
        description="Deliveries to make and proof of delivery to check."
      />

      <div className="px-4 pb-8 md:px-6">
        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null })} placeholder="Search shipment, customer, branch…" aria-label="Search delivery and POD queue"/>}
          actions={(
            <>
              <MineToggle mine={mine} onChange={setMine}/>
              {filtersActive ? <button type="button" className="ops-inline-alert-action" onClick={reset}>Reset</button> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <OpsResultCount count={rows.length} searching={Boolean(query.trim())}/>
            </>
          )}
          tabs={<OpsScopeTabs<Focus> label="Delivery stage" value={focus} onChange={setFocus} items={[
            { value: "all", label: "All", count: initialRows.length },
            { value: "ready", label: "Ready", count: initialSummary.ready },
            { value: "active", label: "Out for delivery", count: initialSummary.out_for_delivery },
            { value: "failed", label: "Failed or refused", count: initialSummary.failed_or_refused },
            { value: "pod_pending", label: "Proof to check", count: initialSummary.delivered_pod_pending },
            { value: "verified", label: "Proof verified", count: initialSummary.pod_verified },
          ]}/>}
        />

        <div className="ops-register-layout" data-inspector={selected ? "open" : undefined}>
          <section className="ops-surface" aria-label="Delivery and POD register">
            {rows.length ? (
              <OpsTableWrap>
                <table className="ops-table ops-register-table delivery-table ops-stack-table" data-compact={compact || undefined} aria-label="Delivery and POD queue">
                  <thead>
                    <tr>
                      <th>Shipment</th>
                      <th>Consignee · route</th>
                      <th>Branch</th>
                      <th>Scheduled / attempt</th>
                      <th>Delivery state</th>
                      <th>POD evidence</th>
                      <th className="ops-cell-open"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isSelected = selectedReference === row.reference;
                      const exception = row.delivery_state === "delivery_failed" || row.delivery_state === "delivered_pod_pending";
                      return <tr
                        key={row.reference}
                        data-selected={isSelected || undefined}
                        aria-current={isSelected || undefined}
                        tabIndex={0}
                        aria-label={`Open delivery record for ${row.reference}, ${row.customer_name}, ${stateLabel(row)}`}
                        onClick={() => update({ selected: row.reference }, "push")}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); update({ selected: row.reference }, "push"); } }}
                      >
                        <td data-cell="primary">
                          <span className="ops-cell-primary ops-mono ops-cell-id">{row.reference}</span>
                          <span className="ops-cell-secondary">{freightModeLabel(row.mode)}</span>
                        </td>
                        <td data-cell="route">
                          <span className="ops-cell-primary ops-cell-clamp">{row.customer_name}</span>
                          <span className="ops-cell-secondary ops-cell-clamp">{row.origin} → {row.destination}</span>
                        </td>
                        <td data-cell="meta"><span className="ops-cell-muted">{row.primary_branch}</span></td>
                        <td data-cell="meta">
                          <span className="ops-cell-primary">{row.next_delivery_at ? dateTime(row.next_delivery_at) : row.last_attempt_at ? dateTime(row.last_attempt_at) : "Not scheduled"}</span>
                          {row.last_attempt_status || row.attempt_count ? <span className="ops-cell-secondary">{row.last_attempt_status ? deliveryAttemptStatusLabels[row.last_attempt_status] : `${row.attempt_count} attempt${row.attempt_count === 1 ? "" : "s"}`}</span> : null}
                        </td>
                        <td data-cell="status">
                          <span className="delivery-state-cell">
                            <OpsBadge tone={stateTone(row)} dot>{stateLabel(row)}</OpsBadge>
                            {row.delivery_state === "pod_verified" ? <CheckCircle2 size={14} strokeWidth={1.75} className="delivery-state-icon" aria-hidden="true"/> : exception ? <AlertTriangle size={14} strokeWidth={1.75} className="delivery-state-icon" data-danger={row.delivery_state === "delivery_failed" || undefined} aria-hidden="true"/> : null}
                          </span>
                        </td>
                        <td data-cell="meta" data-label="Proof">
                          <span className="ops-cell-primary"><OpsBadge tone={podTone(row)} dot>{podLabel(row)}</OpsBadge></span>
                          {row.pod_evidence_count ? <span className="ops-cell-secondary">{row.pod_evidence_count} item{row.pod_evidence_count === 1 ? "" : "s"}</span> : null}
                        </td>
                        <td data-cell="open" className="ops-cell-open">
                          <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}#delivery-pod`} className="ops-row-open" onClick={(event) => event.stopPropagation()} aria-label={`Open Delivery and POD control for ${row.reference}`} tabIndex={-1}>
                            <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/>
                          </Link>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (filtersActive ? <OpsNoMatches noun="shipments" onClear={reset}/> : <OpsEmptyState compact icon={<Truck size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No final-mile movements" description="No accessible shipments are currently in the final-mile queue."/>)}
          </section>

          {selected ? <Inspector row={selected} onClose={() => update({ selected: null })} inspectorRef={inspectorRef}/> : null}
        </div>
      </div>
    </div>
  </OpsPage>;
}
