"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity, type AutomationAlertStatus } from "./alert-data";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsFilterSelect,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsRegisterToolbar,
  OpsScopeTabs,
  OpsSearch,
} from "../operations-ui";
import { useWorkspaceQuery } from "../use-workspace-query";
import { MineToggle, ownedBy, useMineFilter, type CurrentStaff } from "../mine-filter";

type StatusFilter = "active" | "all" | AutomationAlertStatus;
type NoticeTone = "success" | "danger" | "warning";
type EvaluationResult = { active?: number; created?: number; updated?: number; resolved?: number; payable_alerts?: number; credit_holds?: number; credit_holds_authorized?: boolean };

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short" }).format(date)} NPT`;
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

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

export function AlertsWorkspace({ initialAlerts, currentStaff }: { initialAlerts: AutomationAlert[]; currentStaff: CurrentStaff }) {
  const [mine, setMine] = useMineFilter("alerts");
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
      if (mine && !ownedBy(currentStaff, { email: alert.assigned_to_email })) return false;
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
  }, [alerts, currentStaff, mine, query, severity, status]);

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

  // Several alerts at once: the same one-alert action, applied in turn, so
  // each keeps its own audit entry. Only alerts in the right state are sent.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  function tick(id: string) {
    setTicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  async function bulk(actionName: "acknowledge" | "resolve") {
    const targets = alerts.filter((alert) => ticked.has(alert.id) && (actionName === "acknowledge" ? alert.status === "open" : alert.status !== "resolved"));
    if (!targets.length) return;
    setBulkBusy(true);
    setNotice("");
    let done = 0;
    const failed: string[] = [];
    for (const alert of targets) {
      try {
        const response = await fetch("/api/admin/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: actionName, alertId: alert.id }) });
        if (response.ok) done += 1; else failed.push(alert.entity_id);
      } catch { failed.push(alert.entity_id); }
    }
    await reload().catch(() => undefined);
    setTicked(new Set());
    setBulkBusy(false);
    setNoticeTone(failed.length ? "danger" : "success");
    setNotice(`${done} alert${done === 1 ? "" : "s"} ${actionName === "acknowledge" ? "acknowledged" : "resolved"}.${failed.length ? ` Not changed: ${failed.join(", ")}. Try those again.` : ""}`);
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

  return <OpsPage>
    <div className="alerts-workspace-page">
      <OpsPageHeader
        title="Tasks & alerts"
        description="Problems and follow-ups, most urgent first."
        actions={<><OpsButton variant="primary" onClick={() => void action("evaluate")} disabled={evaluating}><RefreshCw size={14} strokeWidth={1.75} className={evaluating ? "app-refreshing" : ""}/>{evaluating ? "Checking…" : "Check now"}</OpsButton></>}
      />

      <div className="px-4 pb-8 md:px-6">
        {notice ? <div className="mb-3"><OpsNotice tone={noticeTone} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}

        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null })} placeholder="Search alert, shipment, owner…" aria-label="Search tasks and alerts"/>}
          actions={(
            <>
              <OpsFilterSelect label="Severity" value={severity} allLabel="All severities" options={[{ value: "critical", label: `Critical (${counts.critical})` }, { value: "warning", label: `Warning (${counts.warning})` }, { value: "info", label: "Info" }]} onChange={(value) => setSeverity(value as "all" | AutomationAlertSeverity)}/>
              <MineToggle mine={mine} onChange={setMine}/>
              {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{visible.length} showing</span>
            </>
          )}
          tabs={<OpsScopeTabs label="Alert status" items={STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label, count: statusCounts[tab.value] }))} value={status} onChange={setStatus}/>}
        />

        {ticked.size ? <div className="ops-bulk-bar" role="region" aria-label="Selected alerts">
          <strong>{ticked.size} selected</strong>
          <OpsButton variant="secondary" size="sm" disabled={bulkBusy} onClick={() => void bulk("acknowledge")}>Acknowledge</OpsButton>
          <OpsButton variant="primary" size="sm" disabled={bulkBusy} onClick={() => void bulk("resolve")}><CheckCircle2 size={12} strokeWidth={1.75}/>{bulkBusy ? "Working…" : "Resolve"}</OpsButton>
          <OpsButton variant="ghost" size="sm" disabled={bulkBusy} onClick={() => setTicked(new Set())}>Clear</OpsButton>
        </div> : null}
        <section className="ops-surface" aria-label="Alert queue">
          {visible.length ? visible.map((alert) => {
            const busy = busyId === alert.id;
            const resolved = alert.status === "resolved";
            const owner = alert.assigned_to_name || alert.assigned_to_email;
            const history = alert.resolved_at
              ? `Resolved by ${alert.resolved_by_name || alert.resolved_by_email || "a colleague"}`
              : alert.acknowledged_at ? `Seen by ${alert.acknowledged_by_name || alert.acknowledged_by_email || "a colleague"}` : null;
            return <div key={alert.id} className="alerts-row" data-resolved={resolved || undefined} data-critical={!resolved && alert.severity === "critical" ? "true" : undefined}>
              {resolved ? <span className="alerts-row-tick" aria-hidden="true"/> : <input type="checkbox" className="alerts-row-tick" checked={ticked.has(alert.id)} onChange={() => tick(alert.id)} aria-label={`Select ${alert.title} for ${alert.entity_id}`}/>}
              <div className="alerts-row-icon" role="img" aria-label={`${alert.severity} severity`} title={`${alert.severity[0].toUpperCase()}${alert.severity.slice(1)}`}><SeverityIcon severity={alert.severity}/></div>
              {/* Two lines: what and which record, then the detail, who, where and
                  when. The alert type repeated the title, so search keeps it instead. */}
              <div className="alerts-row-main">
                <div className="alerts-row-line">
                  <Link href={alert.action_path} className="alerts-row-link">{alert.title}</Link>
                  <OpsMono>{alert.entity_id}</OpsMono>
                  {alert.escalated_at && !resolved ? <OpsBadge tone="danger">Escalated</OpsBadge> : null}
                </div>
                <div className="alerts-row-sub" title={`Triggered ${dateTime(alert.last_triggered_at)}`}>
                  {[alert.detail, owner, alert.branch, ageLabel(alert.last_triggered_at), history].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="alerts-row-actions">
                {/* One next step per alert: acknowledge it, then resolve it. */}
                {alert.status === "open" ? <OpsButton size="sm" variant="secondary" disabled={busy} onClick={() => void action("acknowledge", alert.id)}>{busy ? "Working…" : "Acknowledge"}</OpsButton> : null}
                {alert.status === "acknowledged" ? <OpsButton size="sm" variant="secondary" disabled={busy} onClick={() => void action("resolve", alert.id)}><CheckCircle2 size={12} strokeWidth={1.75}/>{busy ? "Working…" : "Resolve"}</OpsButton> : null}
              </div>
            </div>;
          }) : <OpsEmptyState compact kind={counts.active === 0 && status === "active" && !filtersActive ? "healthy" : "search"} icon={<CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true"/>} title={counts.active === 0 && status === "active" && !filtersActive ? "No active alerts" : "No alerts match this view"} description={counts.active === 0 && status === "active" && !filtersActive ? "The operational exception queue is clear. Resolved history remains available." : "Change the search or filters to widen the view."} action={filtersActive ? <OpsButton size="sm" variant="secondary" onClick={reset}>Reset view</OpsButton> : counts.resolved ? <OpsButton size="sm" variant="secondary" onClick={() => setStatus("resolved")}>View resolved history</OpsButton> : undefined}/>}
        </section>

        <p className="alerts-footnote">Acknowledge says someone has seen it; the alert stays open until it’s resolved. A resolved alert comes back if the problem is still there at the next check.</p>
      </div>
    </div>
  </OpsPage>;
}
