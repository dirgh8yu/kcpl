"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, GripVertical, Truck, X } from "lucide-react";
import {
  OpsBadge,
  OpsEmptyState,
  OpsFacts,
  OpsFact,
  OpsInlineAlert,
  OpsInspectorHeader,
  OpsInspectorSection,
  OpsKpiRail,
  OpsButton,
  OpsPage,
  OpsPageHeader,
  OpsRailMetric,
  OpsRegisterToolbar,
  OpsScopeTabs,
  OpsSearch,
  OpsTableWrap,
} from "../operations-ui";
import { deliveryPulseRows, RegisterPulseStrip } from "../register-pulse-strip";
import { ArrangeableGrid } from "../arrangeable-grid";
import "../arrangeable-grid.css";
import { presetForStateIn, savedLayoutForState, WORKSPACE_PRESETS } from "../operations-arrangeable";
import { useStaffArrangement } from "../use-staff-arrangement";
import { CustomiseMenu, CustomiseRow } from "../ops-register";
import type { CommandCentreData } from "../command-centre/command-centre-data";
import { useWorkspaceQuery } from "../use-workspace-query";
import { deliveryAttemptStatusLabels, type DeliveryQueueRow, type DeliverySummary } from "./delivery-control";

type Focus = "all" | "active" | "failed" | "pod_pending" | "verified";

/** One focus → delivery-state mapping instead of a four-branch filter chain. */
const FOCUS_STATE: Record<Exclude<Focus, "all">, DeliveryQueueRow["delivery_state"]> = {
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

type DeliverySectionId = "pulse" | "rail" | "queue";
const DELIVERY_SECTION_LABELS: Record<DeliverySectionId, string> = { pulse: "Live pulse", rail: "Delivery summary", queue: "Delivery queue" };

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

const FOCUS_TABS: Array<{ value: Focus; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Delivery active" },
  { value: "failed", label: "Failed / refused" },
  { value: "pod_pending", label: "POD pending" },
  { value: "verified", label: "POD verified" },
];

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

function Inspector({ row, onClose, inspectorRef }: { row: DeliveryQueueRow; onClose: () => void; inspectorRef: React.RefObject<HTMLElement | null> }) {
  return <aside ref={inspectorRef} className="ops-inspector" aria-label={`Delivery ${row.reference}`}>
    <OpsInspectorHeader
      kicker={row.reference}
      title={row.customer_name}
      subtitle={`${row.origin} → ${row.destination} · ${row.mode}`}
      actions={<button type="button" className="ops-inspector-close" onClick={onClose} aria-label="Close delivery inspector"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
    />

    <div className="ops-inspector-scroll">
      <div className="ops-inspector-body">
        <div className="flex flex-wrap gap-1.5">
          <OpsBadge tone={stateTone(row)} dot>{stateLabel(row)}</OpsBadge>
          <OpsBadge tone={podTone(row)} dot>{podLabel(row)}</OpsBadge>
        </div>

        {row.delivery_state === "delivered_pod_pending" ? <OpsInlineAlert tone="warning" icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Delivered ≠ POD verified.</strong> Delivery is recorded, but verified proof of delivery is still required before canonical closeout is satisfied.</OpsInlineAlert> : null}
        {row.delivery_state === "delivery_failed" ? <OpsInlineAlert tone="danger" icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Delivery exception.</strong> Review the failed or refused attempt before scheduling the next final-mile action.</OpsInlineAlert> : null}
        {row.delivery_state === "pod_verified" ? <OpsInlineAlert tone="info" icon={<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>POD verified.</strong> Final-mile evidence is verified, subject to remaining Digital Job File closeout policy checks.</OpsInlineAlert> : null}

        <OpsInspectorSection title="Final-mile record">
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

export function DeliveryWorkspace({ initialRows, initialSummary, initialQuery = "", pulseData = null }: { initialRows: DeliveryQueueRow[]; initialSummary: DeliverySummary; initialQuery?: string; pulseData?: CommandCentreData | null }) {
  const { params, update } = useWorkspaceQuery();
  const requestedFocus = params.get("view");
  const focus: Focus = requestedFocus === "active" || requestedFocus === "failed" || requestedFocus === "pod_pending" || requestedFocus === "verified" ? requestedFocus : "all";
  const query = params.get("q") ?? initialQuery;
  const selectedReference = params.get("selected");

  const rows = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return initialRows.filter((row) => {
      if (focus !== "all" && row.delivery_state !== FOCUS_STATE[focus]) return false;
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
  const compact = selected !== null;
  const inspectorRef = useRef<HTMLElement | null>(null);

  // Per-staff workspace layout: pulse strip, summary rail and queue are
  // arrangeable sections persisted server-side (same primitive as Overview).
  const {
    state: arrangement,
    status: arrangeStatus,
    applyState: setArrangement,
    toggleHidden,
    moveSectionToward,
    resetArrangement,
    saved,
    saveCurrentAs,
    deleteSaved,
  } = useStaffArrangement("delivery");
  const [arranging, setArranging] = useState(false);
  const [arrangeMenu, setArrangeMenu] = useState(false);
  const activePreset = presetForStateIn("delivery", arrangement);
  const savedMatch = savedLayoutForState(saved, arrangement);
  const onSectionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, id: DeliverySectionId) => {
      if (!arranging || event.defaultPrevented) return;
      if ((event.altKey || event.metaKey) && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        const target = event.target as HTMLElement | null;
        if (target && target.closest("input, textarea, select")) return;
        event.preventDefault();
        moveSectionToward(id, event.key === "ArrowUp" ? "up" : "down");
        return;
      }
      if ((event.key === "h" || event.key === "H") && document.activeElement === event.currentTarget) {
        event.preventDefault();
        toggleHidden(id);
      }
    },
    [arranging, moveSectionToward, toggleHidden],
  );

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

  const focusCounts = useMemo(() => ({
    all: initialRows.length,
    active: initialRows.filter((row) => row.delivery_state === "delivery_active").length,
    failed: initialRows.filter((row) => row.delivery_state === "delivery_failed").length,
    pod_pending: initialRows.filter((row) => row.delivery_state === "delivered_pod_pending").length,
    verified: initialRows.filter((row) => row.delivery_state === "pod_verified").length,
  }), [initialRows]);

  return <OpsPage>
    <div className="delivery-control-page">
      <OpsPageHeader
        eyebrow="Shipment execution"
        title="Delivery & POD"
        description={`Last-mile execution queue · ${initialRows.length} deliveries · POD evidence received ≠ POD verified`}
        actions={<><Link href="/admin/visibility" className="ops-button" data-variant="secondary" data-size="sm">Live Visibility</Link><Link href="/admin/shipments" className="ops-button" data-variant="secondary" data-size="sm">Shipments</Link></>}
      />

      <div className="px-4 pt-3 md:px-6">
        <CustomiseRow
          arranging={arranging}
          onToggle={() => { setArranging(v => !v); setArrangeMenu(false); }}
          arrangeMenu={arrangeMenu}
          onToggleMenu={() => setArrangeMenu(v => !v)}
          arrangement={arrangement}
          presets={WORKSPACE_PRESETS.delivery}
          activePreset={activePreset}
          applyPreset={preset => setArrangement(preset.layout)}
          onReset={resetArrangement}
          status={arrangeStatus}
          sectionLabels={DELIVERY_SECTION_LABELS}
          saved={saved}
          onSaveCurrent={saveCurrentAs}
          onDeleteSaved={deleteSaved}
          savedMatchId={savedMatch?.id ?? null}
          onApplySaved={(layout) => setArrangement({ order: layout.order, hidden: layout.hidden })}
        />
        <CustomiseMenu open={arranging && arrangeMenu} arrangement={arrangement} onToggle={toggleHidden} sectionLabels={DELIVERY_SECTION_LABELS}/>
      </div>

      <ArrangeableGrid
        workspace="delivery"
        state={arrangement}
        onChange={setArrangement}
        arranging={arranging}
      >
        {(id: DeliverySectionId, { handleProps, hidden }) => {
          if (hidden) return null;
          const handle = (
            <button type="button" className="ops-arrange-handle" {...handleProps} aria-label={`Move ${DELIVERY_SECTION_LABELS[id]}`} tabIndex={arranging ? 0 : -1} onKeyDown={(event) => onSectionKeyDown(event, id)}>
              <GripVertical size={13} strokeWidth={1.75} aria-hidden="true"/>
            </button>
          );
          if (id === "pulse") {
            return (
              <>
                {handle}
                {pulseData ? <RegisterPulseStrip initialData={pulseData} rows={deliveryPulseRows} urlParam="dpulse"/> : null}
              </>
            );
          }
          if (id === "rail") {
            return (
              <div className="px-4 pt-3 md:px-6">
                {handle}
                {/* One flat rail; each segment activates the view it already mapped to. */}
                <OpsKpiRail label="Delivery summary">
                  <OpsRailMetric label="Ready" value={initialSummary.ready} active={focus === "all"} onClick={() => setFocus("all")}/>
                  <OpsRailMetric label="Out for delivery" value={initialSummary.out_for_delivery} tone="info" active={focus === "active"} onClick={() => setFocus(focus === "active" ? "all" : "active")}/>
                  <OpsRailMetric label="Failed / refused" value={initialSummary.failed_or_refused} tone="danger" active={focus === "failed"} onClick={() => setFocus(focus === "failed" ? "all" : "failed")}/>
                  <OpsRailMetric label="POD pending" value={initialSummary.delivered_pod_pending} tone="warning" active={focus === "pod_pending"} onClick={() => setFocus(focus === "pod_pending" ? "all" : "pod_pending")} title="Delivered but awaiting verified POD"/>
                  <OpsRailMetric label="POD verified" value={initialSummary.pod_verified} tone="success" active={focus === "verified"} onClick={() => setFocus(focus === "verified" ? "all" : "verified")}/>
                </OpsKpiRail>
              </div>
            );
          }
          return (
      <div className="px-4 pb-8 md:px-6">
        {handle}
        {initialSummary.delivered_pod_pending > 0 ? <div className="mb-3"><OpsInlineAlert tone="warning" icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>} actions={<button type="button" className="ops-inline-alert-action" aria-pressed={focus === "pod_pending"} onClick={() => setFocus("pod_pending")}>Show POD pending</button>}><strong>{initialSummary.delivered_pod_pending} delivered movement{initialSummary.delivered_pod_pending === 1 ? "" : "s"} awaiting verified POD.</strong></OpsInlineAlert></div> : null}
        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null })} placeholder="Search shipment, customer, branch…" aria-label="Search delivery and POD queue"/>}
          actions={(
            <>
              {filtersActive ? <button type="button" className="ops-inline-alert-action" onClick={reset}>Reset</button> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{rows.length === initialRows.length ? `${initialRows.length} deliveries` : `${rows.length} of ${initialRows.length}`}</span>
            </>
          )}
          tabs={<OpsScopeTabs label="Delivery state views" items={FOCUS_TABS.map((tab) => ({ ...tab, count: focusCounts[tab.value] }))} value={focus} onChange={setFocus}/>}
        />

        <div className="ops-register-layout" data-inspector={selected ? "open" : undefined}>
          <section className="ops-surface" aria-label="Delivery and POD register">
            {rows.length ? (
              <OpsTableWrap>
                <table className="ops-table ops-register-table delivery-table" data-compact={compact || undefined} aria-label="Delivery and POD queue">
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
                        <td>
                          <span className="ops-cell-primary ops-mono ops-cell-id">{row.reference}</span>
                          <span className="ops-cell-secondary">{row.mode}</span>
                        </td>
                        <td>
                          <span className="ops-cell-primary ops-cell-clamp">{row.customer_name}</span>
                          <span className="ops-cell-secondary ops-cell-clamp">{row.origin} → {row.destination}</span>
                        </td>
                        <td><span className="ops-cell-muted">{row.primary_branch}</span></td>
                        <td>
                          <span className="ops-cell-primary">{row.next_delivery_at ? dateTime(row.next_delivery_at) : row.last_attempt_at ? dateTime(row.last_attempt_at) : "Not scheduled"}</span>
                          <span className="ops-cell-secondary">{row.last_attempt_status ? deliveryAttemptStatusLabels[row.last_attempt_status] : `${row.attempt_count} attempt${row.attempt_count === 1 ? "" : "s"}`}</span>
                        </td>
                        <td>
                          <span className="delivery-state-cell">
                            <OpsBadge tone={stateTone(row)} dot>{stateLabel(row)}</OpsBadge>
                            {row.delivery_state === "pod_verified" ? <CheckCircle2 size={14} strokeWidth={1.75} className="delivery-state-icon" aria-hidden="true"/> : exception ? <AlertTriangle size={14} strokeWidth={1.75} className="delivery-state-icon" data-danger={row.delivery_state === "delivery_failed" || undefined} aria-hidden="true"/> : null}
                          </span>
                        </td>
                        <td>
                          <span className="ops-cell-primary"><OpsBadge tone={podTone(row)} dot>{podLabel(row)}</OpsBadge></span>
                          <span className="ops-cell-secondary">{row.pod_evidence_count} item{row.pod_evidence_count === 1 ? "" : "s"}</span>
                        </td>
                        <td className="ops-cell-open">
                          <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}#delivery-pod`} className="ops-row-open" onClick={(event) => event.stopPropagation()} aria-label={`Open Delivery and POD control for ${row.reference}`} tabIndex={-1}>
                            <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/>
                          </Link>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : <OpsEmptyState compact kind="search" icon={<Truck size={16} strokeWidth={1.75} aria-hidden="true"/>} title={filtersActive ? "No results" : "No final-mile movements"} description={filtersActive ? "Try changing or resetting the current filters." : "No accessible shipments are currently in the final-mile queue."} action={filtersActive ? <OpsButton size="sm" variant="secondary" onClick={reset}>Reset view</OpsButton> : undefined}/>}
            {rows.length ? <footer className="ops-register-footer"><span>{rows.length} deliver{rows.length === 1 ? "y" : "ies"} in this view</span></footer> : null}
          </section>

          {selected ? <Inspector row={selected} onClose={() => update({ selected: null })} inspectorRef={inspectorRef}/> : null}
        </div>
      </div>
          );
        }}
      </ArrangeableGrid>
    </div>
  </OpsPage>;
}
