"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, GripVertical, Info, RefreshCw } from "lucide-react";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity, type AutomationAlertStatus } from "./alert-data";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsInlineAlert,
  OpsKpiRail,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsRailMetric,
  OpsRegisterToolbar,
  OpsScopeTabs,
  OpsSearch,
} from "../operations-ui";
import { ArrangeableGrid } from "../arrangeable-grid";
import {
  presetForStateIn,
  savedLayoutForState,
  WORKSPACE_PRESETS,
  type SavedLayout,
} from "../operations-arrangeable";
import { CustomiseMenu, CustomiseRow } from "../ops-register";
import { useStaffArrangement } from "../use-staff-arrangement";
import { useWorkspaceQuery } from "../use-workspace-query";

type StatusFilter = "active" | "all" | AutomationAlertStatus;
type NoticeTone = "success" | "danger" | "warning";
type EvaluationResult = { active?: number; created?: number; updated?: number; resolved?: number; payable_alerts?: number; credit_holds?: number; credit_holds_authorized?: boolean };

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short" }).format(date)} NPT`;
}

function severityTone(value: AutomationAlertSeverity): "info" | "warning" | "danger" {
  return value === "critical" ? "danger" : value === "warning" ? "warning" : "info";
}

function statusTone(value: AutomationAlertStatus): "info" | "success" | "neutral" {
  return value === "open" ? "info" : value === "acknowledged" ? "success" : "neutral";
}

function ageLabel(value: string) {
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return value;
  const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SeverityIcon({ severity }: { severity: AutomationAlertSeverity }) {
  if (severity === "critical") return <AlertTriangle size={15} strokeWidth={1.75} className="alerts-severity-icon" data-tone="danger" aria-hidden="true"/>;
  if (severity === "warning") return <AlertTriangle size={15} strokeWidth={1.75} className="alerts-severity-icon" data-tone="warning" aria-hidden="true"/>;
  return <Info size={15} strokeWidth={1.75} className="alerts-severity-icon" data-tone="info" aria-hidden="true"/>;
}

/** Sections exposed to the workspace-layout customise primitive. */
const ALERTS_SECTION_LABELS: Record<"rail" | "register", string> = {
  rail: "Alert summary",
  register: "Alert queue",
};

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All history" },
];

export function AlertsWorkspace({ initialAlerts, roleLabel }: { initialAlerts: AutomationAlert[]; roleLabel: string }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const { params, update } = useWorkspaceQuery();
  const query = params.get("q") ?? "";
  const severityValue = params.get("severity");
  const severity: "all" | AutomationAlertSeverity = severityValue === "critical" || severityValue === "warning" || severityValue === "info" ? severityValue : "all";
  const statusValue = params.get("status");
  const status: StatusFilter = statusValue === "all" || statusValue === "open" || statusValue === "acknowledged" || statusValue === "resolved" ? statusValue : "active";
  const [busyId, setBusyId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("success");

  const counts = useMemo(() => ({
    active: alerts.filter((alert) => alert.status !== "resolved").length,
    open: alerts.filter((alert) => alert.status === "open").length,
    critical: alerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved").length,
    warning: alerts.filter((alert) => alert.severity === "warning" && alert.status !== "resolved").length,
    acknowledged: alerts.filter((alert) => alert.status === "acknowledged").length,
    resolved: alerts.filter((alert) => alert.status === "resolved").length,
  }), [alerts]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const severityOrder = { critical: 3, warning: 2, info: 1 } as const;
    const stateOrder = { open: 2, acknowledged: 1, resolved: 0 } as const;
    return alerts.filter((alert) => {
      if (severity !== "all" && alert.severity !== severity) return false;
      if (status === "active" && alert.status === "resolved") return false;
      if (status !== "active" && status !== "all" && alert.status !== status) return false;
      if (!terms.length) return true;
      const haystack = [
        alert.title,
        alert.detail,
        alert.entity_id,
        alert.parent_reference ?? "",
        alert.branch ?? "",
        alert.assigned_to_name ?? "",
        alert.assigned_to_email ?? "",
        alert.acknowledged_by_name ?? "",
        alert.acknowledged_by_email ?? "",
        alert.resolved_by_name ?? "",
        alert.resolved_by_email ?? "",
        alert.status,
        alert.severity,
        automationAlertTypeLabels[alert.type],
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort((a, b) => Number(b.status !== "resolved") - Number(a.status !== "resolved") || severityOrder[b.severity] - severityOrder[a.severity] || stateOrder[b.status] - stateOrder[a.status] || b.last_triggered_at.localeCompare(a.last_triggered_at));
  }, [alerts, query, severity, status]);

  async function reload() {
    const response = await fetch("/api/admin/alerts", { cache: "no-store" });
    const data = await response.json() as { alerts?: AutomationAlert[]; error?: string };
    if (!response.ok || !data.alerts) throw new Error(data.error || "Could not reload alerts.");
    setAlerts(data.alerts);
  }

  async function action(actionName: "evaluate" | "acknowledge" | "resolve", alertId?: string) {
    if (actionName === "evaluate") setEvaluating(true); else setBusyId(alertId ?? null);
    setNotice("");
    try {
      const response = await fetch("/api/admin/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: actionName, alertId }) });
      const data = await response.json() as { ok?: boolean; error?: string; result?: EvaluationResult };
      if (!response.ok) throw new Error(data.error || "Alert action failed.");
      await reload();
      setNoticeTone("success");
      if (actionName === "evaluate") {
        const activeConditions = (data.result?.active ?? 0) + (data.result?.payable_alerts ?? 0);
        const holds = data.result?.credit_holds ?? 0;
        setNotice(`Checks complete. ${activeConditions} active automated condition${activeConditions === 1 ? "" : "s"}${holds ? `; ${holds} authorised credit hold${holds === 1 ? "" : "s"} applied` : ""}.`);
      } else if (actionName === "acknowledge") {
        setNotice("Alert acknowledged. This records review, not ownership; the condition remains active until it is resolved.");
      } else {
        setNotice("Alert marked resolved. If the underlying condition still exists, the next automation check will reopen it.");
      }
    } catch (error) {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Alert action failed.");
    } finally {
      setEvaluating(false);
      setBusyId(null);
    }
  }

  function reset() { update({ q: null, severity: null, status: null }); }
  const setSeverity = (value: "all" | AutomationAlertSeverity) => update({ severity: value === "all" ? null : value });
  const setStatus = (value: StatusFilter) => update({ status: value === "active" ? null : value });

  const filtersActive = Boolean(query.trim()) || severity !== "all" || status !== "active";

  const statusCounts = useMemo(() => ({
    active: counts.active,
    open: counts.open,
    acknowledged: counts.acknowledged,
    resolved: counts.resolved,
    all: alerts.length,
  }), [alerts.length, counts]);

  // Per-staff workspace layout: the summary rail and the alert queue are
  // arrangeable sections persisted server-side (same primitive as Shipments).
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
  } = useStaffArrangement("alerts");

  const [arranging, setArranging] = useState(false);
  const [arrangeMenu, setArrangeMenu] = useState(false);
  const activePreset = presetForStateIn("alerts", arrangement);
  const savedMatch = savedLayoutForState(saved, arrangement);

  const onSectionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, id: "rail" | "register") => {
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

  return <OpsPage>
    <div className="alerts-workspace-page">
      <OpsPageHeader
        eyebrow="Operational control"
        title="Tasks & Alerts"
        description={`Operational exceptions ordered by severity · ${counts.active} active · ${roleLabel}`}
        actions={<><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="sm">Overview</Link><OpsButton variant="primary" onClick={() => void action("evaluate")} disabled={evaluating}><RefreshCw size={14} strokeWidth={1.75} className={evaluating ? "app-refreshing" : ""}/>{evaluating ? "Checking…" : "Check now"}</OpsButton></>}
      />

      <div className="px-4 pt-3 md:px-6">
        <CustomiseRow
          arranging={arranging}
          onToggle={() => { setArranging(v => !v); setArrangeMenu(false); }}
          arrangeMenu={arrangeMenu}
          onToggleMenu={() => setArrangeMenu(v => !v)}
          arrangement={arrangement}
          presets={WORKSPACE_PRESETS.alerts}
          activePreset={activePreset}
          applyPreset={preset => setArrangement(preset.layout)}
          onReset={resetArrangement}
          status={arrangeStatus}
          sectionLabels={ALERTS_SECTION_LABELS}
          saved={saved}
          onSaveCurrent={saveCurrentAs}
          onDeleteSaved={deleteSaved}
          savedMatchId={savedMatch?.id ?? null}
          onApplySaved={(layout: SavedLayout) => setArrangement({ order: layout.order, hidden: layout.hidden })}
        />
        <CustomiseMenu open={arranging && arrangeMenu} arrangement={arrangement} onToggle={toggleHidden} sectionLabels={ALERTS_SECTION_LABELS}/>
      </div>

      <div className="px-4 pt-3 md:px-6">
        <ArrangeableGrid
          workspace="alerts"
          state={arrangement}
          onChange={setArrangement}
          arranging={arranging}
        >
          {(id: "rail" | "register", { handleProps, hidden }) => {
            if (hidden) return null;
            const handle = (
              <button
                type="button"
                className="ops-arrange-handle"
                {...handleProps}
                aria-label={`Move ${ALERTS_SECTION_LABELS[id]}`}
                tabIndex={arranging ? 0 : -1}
                onKeyDown={(event) => onSectionKeyDown(event, id)}
              >
                <GripVertical size={13} strokeWidth={1.75} aria-hidden="true"/>
              </button>
            );
            if (id === "rail") {
              return (
          <div className="px-4 pt-3 md:px-6">
            {handle}
            <OpsKpiRail label="Alert summary">
          <OpsRailMetric label="Critical" value={counts.critical} tone="danger" active={severity === "critical"} onClick={() => setSeverity(severity === "critical" ? "all" : "critical")} title="Critical severity, unresolved"/>
          <OpsRailMetric label="Warning" value={counts.warning} tone="warning" active={severity === "warning"} onClick={() => setSeverity(severity === "warning" ? "all" : "warning")} title="Warning severity, unresolved"/>
          <OpsRailMetric label="Open" value={counts.open} tone="info" active={status === "open"} onClick={() => setStatus(status === "open" ? "active" : "open")}/>
          <OpsRailMetric label="Acknowledged" value={counts.acknowledged} active={status === "acknowledged"} onClick={() => setStatus(status === "acknowledged" ? "active" : "acknowledged")}/>
          <OpsRailMetric label="Active" value={counts.active} active={status === "active"} onClick={() => setStatus("active")} title="Not yet resolved"/>
          <OpsRailMetric label="Resolved" value={counts.resolved} tone="success" active={status === "resolved"} onClick={() => setStatus(status === "resolved" ? "active" : "resolved")}/>
            </OpsKpiRail>
          </div>
            );
          }
          return (
      <div className="px-4 pb-8 md:px-6">
        {handle}
        {counts.critical > 0 ? <div className="mb-3"><OpsInlineAlert tone="danger" icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>} actions={<button type="button" className="ops-inline-alert-action" aria-pressed={severity === "critical"} onClick={() => setSeverity("critical")}>Show critical</button>}><strong>{counts.critical} critical exception{counts.critical === 1 ? "" : "s"}</strong> require immediate review.</OpsInlineAlert></div> : null}
        {notice ? <div className="mb-3"><OpsNotice tone={noticeTone} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}

        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null })} placeholder="Search alert, shipment, owner…" aria-label="Search tasks and alerts"/>}
          actions={(
            <>
              {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{visible.length} showing</span>
            </>
          )}
          tabs={(
            <div className="alerts-toolbar-tabs">
              <OpsScopeTabs label="Severity filter" items={[
                { value: "all", label: "All severities", count: undefined },
                { value: "critical", label: "Critical", count: counts.critical },
                { value: "warning", label: "Warning", count: counts.warning },
                { value: "info", label: "Info", count: undefined },
              ]} value={severity} onChange={(value) => setSeverity(value)}/>
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <OpsScopeTabs label="Status views" items={STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label, count: statusCounts[tab.value] }))} value={status} onChange={setStatus}/>
            </div>
          )}
        />

        <section className="ops-surface" aria-label="Alert queue">
          {visible.length ? visible.map((alert) => {
            const busy = busyId === alert.id;
            const resolved = alert.status === "resolved";
            return <div key={alert.id} className="alerts-row" data-resolved={resolved || undefined} data-critical={!resolved && alert.severity === "critical" ? "true" : undefined}>
              <div className="alerts-row-icon"><SeverityIcon severity={alert.severity}/></div>
              <div className="alerts-row-main">
                <div className="alerts-row-meta">
                  <OpsBadge tone={severityTone(alert.severity)} dot>{alert.severity}</OpsBadge>
                  <OpsBadge>{automationAlertTypeLabels[alert.type]}</OpsBadge>
                  <OpsBadge tone={statusTone(alert.status)}>{alert.status}</OpsBadge>
                  {alert.escalated_at ? <OpsBadge tone="danger">Escalated</OpsBadge> : null}
                  <OpsMono>{alert.entity_id}</OpsMono>
                  {alert.assigned_to_name || alert.assigned_to_email ? <span className="alerts-row-owner">· {alert.assigned_to_name || alert.assigned_to_email}</span> : null}
                  <span className="alerts-row-age"><Clock3 size={11} strokeWidth={1.75} aria-hidden="true"/>{ageLabel(alert.last_triggered_at)}</span>
                </div>
                <div className="alerts-row-title">{alert.title}</div>
                <div className="alerts-row-detail">{alert.detail}</div>
                <div className="alerts-row-context">
                  <span>{alert.branch || "No branch"}</span>
                  {alert.parent_reference ? <span>Parent {alert.parent_reference}</span> : null}
                  <span>Triggered {dateTime(alert.last_triggered_at)}</span>
                  {alert.acknowledged_at ? <span>Acknowledged {dateTime(alert.acknowledged_at)} by {alert.acknowledged_by_name || alert.acknowledged_by_email || "recorded operator"}</span> : null}
                  {alert.resolved_at ? <span>Resolved {dateTime(alert.resolved_at)} by {alert.resolved_by_name || alert.resolved_by_email || "recorded operator"}</span> : null}
                </div>
              </div>
              <div className="alerts-row-actions">
                <Link href={alert.action_path} className="ops-button" data-variant="secondary" data-size="sm">Open record</Link>
                {alert.status === "open" ? <OpsButton size="sm" variant="secondary" disabled={busy} onClick={() => void action("acknowledge", alert.id)}>{busy ? "Working…" : "Acknowledge"}</OpsButton> : null}
                {!resolved ? <OpsButton size="sm" variant="ghost" disabled={busy} onClick={() => void action("resolve", alert.id)}><CheckCircle2 size={12} strokeWidth={1.75}/>{busy ? "Working…" : "Resolve"}</OpsButton> : null}
              </div>
            </div>;
          }) : <OpsEmptyState compact kind={counts.active === 0 && status === "active" && !filtersActive ? "healthy" : "search"} icon={<CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true"/>} title={counts.active === 0 && status === "active" && !filtersActive ? "No active alerts" : "No alerts match this view"} description={counts.active === 0 && status === "active" && !filtersActive ? "The operational exception queue is clear. Resolved history remains available." : "Change the search or filters to widen the view."} action={filtersActive ? <OpsButton size="sm" variant="secondary" onClick={reset}>Reset view</OpsButton> : counts.resolved ? <OpsButton size="sm" variant="secondary" onClick={() => setStatus("resolved")}>View resolved history</OpsButton> : undefined}/>}
        </section>

        <div className="mt-4"><OpsNotice tone="neutral">Acknowledging an alert records review but does not transfer ownership. Resolving closes the current alert; if the condition persists, the next automation evaluation can reopen it.</OpsNotice></div>
      </div>
            );
          }}
        </ArrangeableGrid>
      </div>
    </div>
  </OpsPage>;
}
