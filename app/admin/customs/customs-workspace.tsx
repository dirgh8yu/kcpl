"use client";

import Link from "next/link";
import { freightModeLabel } from "../freight-mode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, ShieldAlert, Sparkles, X } from "lucide-react";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsFacts,
  OpsFact,
  OpsFilterSelect,
  OpsInlineAlert,
  OpsInspectorHeader,
  OpsInspectorSection,
  OpsNoMatches,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsScopeTabs,
  OpsRegisterToolbar,
  OpsSearch,
  OpsTableWrap,
} from "../operations-ui";
import type { CustomsAgentOption } from "./customs-clearance";
import type { SuggestedChecklist as SuggestedChecklistData } from "./checklist-recommender";
import { CustomsClearanceEditor } from "./customs-clearance-editor";
import { MineToggle, ownedBy, useMineFilter, type CurrentStaff } from "../mine-filter";
import type { CustomsDeskRow } from "./customs-data.server";
import { customsClearanceStatusLabels } from "./customs-policy";

type RiskFilter = "all" | CustomsDeskRow["risk"];
type StateFilter = "all" | "held" | CustomsDeskRow["state"];
type Notice = { tone: "success" | "danger"; text: string } | null;


function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(date);
}

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function directionLabel(direction: CustomsDeskRow["document_direction"]) {
  if (direction === "cross_trade") return "Cross-trade";
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

function riskTone(risk: CustomsDeskRow["risk"]): "danger" | "warning" | "neutral" {
  if (risk === "critical") return "danger";
  if (risk === "warning") return "warning";
  return "neutral";
}

function stateTone(state: CustomsDeskRow["state"]): "danger" | "warning" | "success" | "info" {
  if (state === "blocked") return "danger";
  if (state === "in_progress" || state === "awaiting_release") return "warning";
  if (state === "released") return "success";
  return "info";
}

export function stateLabel(state: CustomsDeskRow["state"]) {
  if (state === "in_progress") return "In progress";
  if (state === "awaiting_release") return "Awaiting release";
  if (state === "released") return "Customs released";
  if (state === "ready") return "Checklist ready";
  return "Blocked";
}

// "Held" is an authority hold recorded on the clearance, whatever stage the
// checklist is at; the rest follow the clearance through its stages.
const STATE_TABS: Array<{ value: StateFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "blocked", label: "Blocked" },
  { value: "held", label: "Held" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_release", label: "Awaiting release" },
  { value: "ready", label: "Checklist ready" },
  { value: "released", label: "Released" },
];

function inScope(row: CustomsDeskRow, scope: StateFilter) {
  if (scope === "all") return true;
  if (scope === "held") return row.clearance.status === "held";
  return row.state === scope;
}

/**
 * Checklist suggested by comparable completed shipments on the same lane. The
 * recommender is pure and the data already carries its evidence, so this is a
 * straight render: no fetching, no state, no invented documents.
 */
function SuggestedChecklist({ row }: { row: { suggested_checklist: SuggestedChecklistData; missing_documents: { type: string }[] } }) {
  const suggested = row.suggested_checklist;
  if (!suggested.available) return null;
  const missingTypes = new Set(row.missing_documents.map((item) => item.type));
  return (
    <div className="customs-suggest">
      <p className="customs-suggest-head"><Sparkles size={13} strokeWidth={1.75} aria-hidden="true"/>Suggested by {suggested.comparableCount} completed shipment{suggested.comparableCount === 1 ? "" : "s"} on this lane</p>
      <ul className="customs-suggest-list">
        {suggested.suggestions.map((item) => (
          <li key={item.documentType} data-missing={missingTypes.has(item.documentType) || undefined}>
            <span className="customs-suggest-label">{item.label}</span>
            <span className="customs-suggest-support">{Math.round(item.share * 100)}%</span>
          </li>
        ))}
      </ul>
      <p className="customs-suggest-note">Learned from comparable completed shipments — not a compliance requirement.</p>
    </div>
  );
}

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

function Inspector({
  row,
  agents,
  busy,
  onClose,
  onCompleteStep,
  inspectorRef,
}: {
  row: CustomsDeskRow;
  agents: CustomsAgentOption[];
  busy: string;
  onClose: () => void;
  onCompleteStep: (row: CustomsDeskRow, stepId: string) => Promise<void>;
  inspectorRef: React.RefObject<HTMLElement | null>;
}) {
  const checklistReady = row.state === "ready";
  const released = row.state === "released";
  const held = row.clearance.status === "held";

  return <aside ref={inspectorRef} className="ops-inspector" aria-label={`Customs clearance ${row.reference}`}>
    <OpsInspectorHeader
      kicker={row.reference}
      title={row.customer_name}
      subtitle={`${row.branch || "Branch repair needed"} · ${freightModeLabel(row.mode)} · ${row.assigned_to_name || row.assigned_to_email || "Unassigned"}`}
      actions={<button type="button" className="ops-inspector-close" onClick={onClose} aria-label="Close clearance inspector"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
    />

    <div className="ops-inspector-scroll">
      <div className="ops-inspector-body">
        <div className="flex flex-wrap gap-1.5">
          <OpsBadge tone={stateTone(row.state)} dot>{stateLabel(row.state)}</OpsBadge>
          {row.risk === "normal" ? null : <OpsBadge tone={riskTone(row.risk)}>{row.risk === "critical" ? "High risk" : "Watch"}</OpsBadge>}
        </div>

        {checklistReady && !released ? <OpsInlineAlert tone="warning" icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Checklist done, not released yet.</strong> Record the release once customs confirms it.</OpsInlineAlert> : null}
        {released ? <OpsInlineAlert tone="info" icon={<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Customs released.</strong> Official release confirmed{row.clearance.declaration_reference ? ` · ${row.clearance.declaration_reference}` : ""}{row.clearance.entry_point ? ` · ${row.clearance.entry_point}` : ""}.</OpsInlineAlert> : null}
        {held ? <OpsInlineAlert tone="danger" icon={<ShieldAlert size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Customs hold.</strong> {row.clearance.hold_reason || "Customs is holding this shipment. Sort out what they need before it can move."}</OpsInlineAlert> : null}

        <OpsInspectorSection title="Clearance record">
          <OpsFacts columns={2}>
            <OpsFact label="Direction">{directionLabel(row.document_direction)}</OpsFact>
            <OpsFact label="Border point" warning={false}>{row.clearance.entry_point || "Not recorded"}</OpsFact>
            <OpsFact label="Declaration">{row.clearance.declaration_reference || "Not recorded"}</OpsFact>
            <OpsFact label="Agent">{row.clearance.agent_name || "Not recorded"}</OpsFact>
            <OpsFact label="Current location">{row.current_location || "Not recorded"}</OpsFact>
            <OpsFact label="ETA">{dateLabel(row.eta)}</OpsFact>
            <OpsFact label="Last update">{dateTime(row.clearance.updated_at)}</OpsFact>
            <OpsFact label="Quote ref">{row.quote_reference || "Not recorded"}</OpsFact>
          </OpsFacts>
        </OpsInspectorSection>

        {row.customs_integrity_warnings.length ? (
          <OpsInspectorSection title="Integrity warnings">
            <ul className="customs-warning-list">
              {row.customs_integrity_warnings.map((item) => <li key={item}><AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true"/><span>{item}</span></li>)}
            </ul>
          </OpsInspectorSection>
        ) : null}

        <OpsInspectorSection title="Clearance checklist">
          {row.open_steps.length ? (
            <ol className="customs-step-list">
              {row.open_steps.map((step) => {
                const stepBusy = busy === `${row.reference}:${step.id}`;
                return <li key={step.id} className="customs-step-row">
                  <Circle size={15} strokeWidth={1.75} className="customs-step-dot" aria-hidden="true"/>
                  <div className="customs-step-copy">
                    <span className="customs-step-title">{step.title}</span>
                    {step.detail ? <span className="customs-step-detail">{step.detail}</span> : null}
                    <span className="customs-step-action"><OpsButton size="xs" variant="secondary" disabled={stepBusy} onClick={() => void onCompleteStep(row, step.id)}>{stepBusy ? "Saving…" : "Mark complete"}</OpsButton></span>
                  </div>
                </li>;
              })}
            </ol>
          ) : <p className="customs-step-clear"><CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>Required checklist is complete.</p>}
        </OpsInspectorSection>

        {row.dwell_warning.active && row.dwell_warning.message ? (
          <OpsInspectorSection title="Clearance pace">
            <p className="customs-dwell-warning"><AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true"/><span>{row.dwell_warning.message}</span></p>
          </OpsInspectorSection>
        ) : null}

        <OpsInspectorSection title="Document readiness">
          <p className="customs-docs-summary">{row.document_present} of {row.document_required} required documents ready</p>
          {row.missing_documents.length ? (
            <ul className="customs-warning-list">
              {row.missing_documents.map((item) => <li key={item.type} data-warning="true"><AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true"/><span>{item.label} · {item.reason}</span></li>)}
            </ul>
          ) : <p className="customs-step-clear"><CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>Required documents are ready.</p>}
          {row.document_advisories.length ? <p className="customs-docs-advisory">{row.document_advisories.join(" · ")}</p> : null}
          <SuggestedChecklist row={row} />
        </OpsInspectorSection>

        <OpsInspectorSection tinted title="Customs clearance record" action={<OpsBadge tone="neutral">{customsClearanceStatusLabels[row.clearance.status]}</OpsBadge>}>
          <CustomsClearanceEditor row={row} agents={agents}/>
        </OpsInspectorSection>
      </div>
    </div>

    <footer className="ops-inspector-footer">
      <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="primary" data-size="md">Open full Job File</Link>
    </footer>
  </aside>;
}

export function CustomsWorkspace({ initialRows, customsAgents, currentStaff }: { initialRows: CustomsDeskRow[]; customsAgents: CustomsAgentOption[]; currentStaff: CurrentStaff }) {
  const [mine, setMine] = useMineFilter("customs");
  const router = useRouter();
  const rows = initialRows;
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [state, setState] = useState<StateFilter>("all");
  // Inspector selection deep-links through ?selected= so a desk row can be
  // shared or bookmarked; replaceState keeps the back button honest.
  const [selectedReference, setSelectedReference] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("selected");
  });
  const updateSelectedReference = useCallback((value: string | null) => {
    setSelectedReference(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("selected", value);
    else url.searchParams.delete("selected");
    window.history.replaceState(null, "", url);
  }, []);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const branches = useMemo(() => kcplBranches.filter((item) => rows.some((row) => row.handling_branches.includes(item))), [rows]);
  const branchOptions = useMemo(() => branches.map((item) => ({ value: item, label: item })), [branches]);

  const stateCounts = useMemo(() => Object.fromEntries(STATE_TABS.map((tab) => [tab.value, rows.filter((row) => inScope(row, tab.value)).length])) as Record<StateFilter, number>, [rows]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (branch !== "all" && !row.handling_branches.includes(branch)) return false;
      if (risk !== "all" && row.risk !== risk) return false;
      if (!inScope(row, state)) return false;
      if (mine && !ownedBy(currentStaff, { email: row.assigned_to_email })) return false;
      if (!terms.length) return true;
      const haystack = [row.reference, row.quote_reference, row.customer_name, row.origin, row.destination, row.mode, row.document_direction, row.branch ?? "", row.assigned_to_name ?? "", row.assigned_to_email ?? "", row.current_location ?? "", row.clearance.status, row.clearance.entry_point ?? "", row.clearance.declaration_reference ?? "", row.clearance.agent_name ?? "", row.clearance.hold_reason ?? "", row.clearance.release_evidence ?? "", ...row.open_steps.map((step) => `${step.title} ${step.detail ?? ""}`), ...row.missing_documents.map((document) => `${document.label} ${document.reason}`), ...row.document_advisories, ...row.customs_integrity_warnings].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [branch, currentStaff, mine, query, risk, rows, state]);

  const selected = selectedReference ? rows.find((row) => row.reference === selectedReference) ?? null : null;

  async function completeStep(row: CustomsDeskRow, stepId: string) {
    setBusy(`${row.reference}:${stepId}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(row.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "toggle_customs", stepId, completed: true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not complete the customs step.");
      setNotice({ tone: "success", text: "Customs step completed. The queue is refreshing from the shipment record." });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not complete the customs step." });
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setQuery("");
    setBranch("all");
    setRisk("all");
    setState("all");
  }

  function setStateFilter(nextState: StateFilter) {
    setState(nextState);
    setSelectedReference(null);
  }

  const filtersActive = Boolean(query.trim()) || branch !== "all" || risk !== "all" || state !== "all";
  const compact = selected !== null;
  const inspectorRef = useRef<HTMLElement | null>(null);

  // Escape closes the inspector, as it does on the other registers.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      updateSelectedReference(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, updateSelectedReference]);

  // Stacked layouts put the inspector under the queue; bring it into view.
  useEffect(() => {
    if (!selected) return;
    window.requestAnimationFrame(() => {
      if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inspectorRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  }, [selected]);

  return <OpsPage className="customs-clearance-register">
    <div className="customs-clearance-page">
      <OpsPageHeader
        title="Customs"
        description="Shipments waiting on customs. Record each release with its evidence."
      />

      <div className="px-4 pb-8 md:px-6">
        {notice ? <div className="mb-3"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, declaration, agent…" aria-label="Search customs clearance"/>}
          actions={(
            <>
              <OpsFilterSelect label="Branch" value={branch} allLabel="All branches" options={branchOptions} onChange={(value) => setBranch(value === "all" ? "all" : value as KcplBranch)}/>
              <OpsFilterSelect label="Risk" value={risk} allLabel="All risk" options={[{ value: "critical", label: "Critical" }, { value: "warning", label: "Warning" }, { value: "normal", label: "Normal" }]} onChange={(value) => setRisk(value as RiskFilter)}/>
              <MineToggle mine={mine} onChange={setMine}/>
              {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{visible.length === rows.length ? `${rows.length} shipments` : `${visible.length} of ${rows.length}`}</span>
            </>
          )}
          tabs={<OpsScopeTabs label="Clearance stage" items={STATE_TABS.map((tab) => ({ ...tab, count: stateCounts[tab.value] }))} value={state} onChange={setStateFilter}/>}
        />

        <div className="ops-register-layout" data-inspector={selected ? "open" : undefined}>
          <section className="ops-surface" aria-label="Customs clearance queue">
            {visible.length ? (
              <OpsTableWrap>
                <table className="ops-table ops-register-table customs-table ops-stack-table" data-compact={compact || undefined} aria-label="Customs clearance desk">
                  <thead>
                    <tr>
                      <th>Shipment</th>
                      <th>Customer · Branch</th>
                      {compact ? null : <th>Border point</th>}
                      <th>Status</th>
                      <th>Risk</th>
                      <th>Checklist</th>
                      {compact ? null : <th>Owner</th>}
                      <th className="ops-cell-open"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => {
                      const selectedRow = selectedReference === row.reference;
                      const progress = row.customs_required > 0 ? row.customs_completed / row.customs_required : 0;
                      return <tr
                        key={row.reference}
                        data-selected={selectedRow || undefined}
                        aria-current={selectedRow || undefined}
                        tabIndex={0}
                        aria-label={`Open clearance for ${row.reference}, ${row.customer_name}, ${stateLabel(row.state)}`}
                        onClick={() => updateSelectedReference(row.reference)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); updateSelectedReference(row.reference); } }}
                      >
                        <td data-cell="primary">
                          <span className="ops-cell-primary ops-mono ops-cell-id">{row.reference}</span>
                          <span className="ops-cell-secondary">{freightModeLabel(row.mode)} · {directionLabel(row.document_direction)}</span>
                        </td>
                        <td data-cell="route">
                          <span className="ops-cell-primary ops-cell-clamp">{row.customer_name}</span>
                          <span className="ops-cell-secondary">{row.branch || "Branch repair needed"}</span>
                        </td>
                        {compact ? null : <td data-cell="meta" data-label="Border"><span className="ops-cell-muted">{row.clearance.entry_point || "—"}</span></td>}
                        {/* One badge per row: where the desk stands. Customs' own status
                            is the line under it; risk is text, and only when raised. */}
                        <td data-cell="status">
                          <OpsBadge tone={stateTone(row.state)} dot>{stateLabel(row.state)}</OpsBadge>
                          {row.state === "released" ? null : <span className="ops-cell-secondary">Customs: {customsClearanceStatusLabels[row.clearance.status]}</span>}
                        </td>
                        <td data-cell="meta">{row.risk === "normal" ? null : <span className="customs-risk" data-risk={row.risk}>{row.risk === "critical" ? "High" : "Watch"}</span>}</td>
                        <td data-cell="meta" data-label="Checklist">
                          <div className="customs-checklist-cell">
                            <div className="customs-checklist-track"><div className="customs-checklist-fill" data-complete={progress === 1 || undefined} style={{ width: `${Math.round(progress * 100)}%` }}/></div>
                            <span className="ops-cell-muted">{row.customs_completed}/{row.customs_required}</span>
                          </div>
                        </td>
                        {compact ? null : <td data-cell="meta">{row.assigned_to_name || row.assigned_to_email || <span className="customs-unassigned">Unassigned</span>}</td>}
                        <td data-cell="open" className="ops-cell-open">
                          <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="ops-row-open" onClick={(event) => event.stopPropagation()} aria-label={`Open Job File for ${row.reference}`} tabIndex={-1}>
                            <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/>
                          </Link>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (filtersActive ? <OpsNoMatches noun="customs entries" onClear={reset}/> : <OpsEmptyState compact icon={<ShieldAlert size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No customs entries" description="No shipments are currently in customs clearance."/>)}
            {visible.length ? <footer className="ops-register-footer"><span>{visible.length} shipment{visible.length === 1 ? "" : "s"} in this view</span></footer> : null}
          </section>

          {selected ? <Inspector row={selected} agents={customsAgents} busy={busy} onClose={() => updateSelectedReference(null)} onCompleteStep={completeStep} inspectorRef={inspectorRef}/> : null}
        </div>
      </div>
    </div>
  </OpsPage>;
}
