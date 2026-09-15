"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Info, RefreshCw } from "lucide-react";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity, type AutomationAlertStatus } from "./alert-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsSearch, OpsStat, OpsStatStrip } from "../operations-ui";
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

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: "var(--app-control-height)",
    padding: "0 12px",
    border: `1px solid ${active ? "var(--admin-crimson)" : "var(--admin-line)"}`,
    borderRadius: "var(--app-radius)",
    background: active ? "var(--admin-crimson)" : "var(--admin-surface)",
    color: active ? "white" : "var(--admin-muted)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
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
  if (severity === "critical") return <AlertTriangle size={15} style={{ color: "var(--admin-danger)", flexShrink: 0 }}/>;
  if (severity === "warning") return <AlertTriangle size={15} style={{ color: "var(--admin-warning)", flexShrink: 0 }}/>;
  return <Info size={15} style={{ color: "var(--admin-info)", flexShrink: 0 }}/>;
}

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

  return <OpsPage>
    <div className="alerts-workspace-page">
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: "32px", letterSpacing: "-.02em" }}>Tasks & Alerts</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--admin-muted)" }}>Operational exceptions — ordered by severity · {counts.active} active · {roleLabel}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="sm">Overview</Link>
          <OpsButton variant="primary" onClick={() => void action("evaluate")} disabled={evaluating}><RefreshCw size={14} className={evaluating ? "app-refreshing" : ""}/>{evaluating ? "Checking…" : "Check now"}</OpsButton>
        </div>
      </header>

      {counts.critical > 0 ? <div style={{ marginBottom: 16 }}><OpsNotice tone="danger"><span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><AlertTriangle size={15}/><strong>{counts.critical} critical exception{counts.critical === 1 ? "" : "s"} require immediate review.</strong></span></OpsNotice></div> : null}
      {notice ? <div style={{ marginBottom: 16 }}><OpsNotice tone={noticeTone} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}

      <OpsStatStrip className="alerts-stat-strip">
        <OpsStat label="Active" value={counts.active} detail="Needs an operational outcome" tone={counts.active ? "warning" : "success"} active={status === "active"} onClick={() => setStatus("active")} />
        <OpsStat label="Critical" value={counts.critical} detail="Immediate review" tone={counts.critical ? "danger" : "success"} active={severity === "critical"} onClick={() => setSeverity("critical")} />
        <OpsStat label="Acknowledged" value={counts.acknowledged} detail="Reviewed, not resolved" tone="info" active={status === "acknowledged"} onClick={() => setStatus("acknowledged")} />
        <OpsStat label="Resolved" value={counts.resolved} detail="Retained history" tone="neutral" active={status === "resolved"} onClick={() => setStatus("resolved")} />
      </OpsStatStrip>

      <div className="alerts-workspace-toolbar">
        <OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null })} placeholder="Search alert, shipment, owner…" aria-label="Search tasks and alerts"/>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Severity filter">
          <button type="button" style={chipStyle(severity === "all")} onClick={() => setSeverity("all")}>All severities</button>
          <button type="button" style={chipStyle(severity === "critical")} onClick={() => setSeverity("critical")}>Critical {counts.critical}</button>
          <button type="button" style={chipStyle(severity === "warning")} onClick={() => setSeverity("warning")}>Warning {counts.warning}</button>
          <button type="button" style={chipStyle(severity === "info")} onClick={() => setSeverity("info")}>Info</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Status filter">
          <button type="button" style={chipStyle(status === "active")} onClick={() => setStatus("active")}>Active {counts.active}</button>
          <button type="button" style={chipStyle(status === "open")} onClick={() => setStatus("open")}>Open {counts.open}</button>
          <button type="button" style={chipStyle(status === "acknowledged")} onClick={() => setStatus("acknowledged")}>Acknowledged {counts.acknowledged}</button>
          <button type="button" style={chipStyle(status === "resolved")} onClick={() => setStatus("resolved")}>Resolved {counts.resolved}</button>
          <button type="button" style={chipStyle(status === "all")} onClick={() => setStatus("all")}>All history</button>
        </div>
        {filtersActive ? <OpsButton size="sm" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--admin-muted)" }}>{visible.length} showing</span>
      </div>

      <section style={{ border: "1px solid var(--admin-line)", borderRadius: "var(--app-surface-radius)", background: "var(--admin-surface)", overflow: "hidden" }}>
        {visible.length ? visible.map((alert, index) => {
          const busy = busyId === alert.id;
          const resolved = alert.status === "resolved";
          return <div key={alert.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 16px", borderBottom: index < visible.length - 1 ? "1px solid var(--admin-line)" : "none", background: !resolved && alert.severity === "critical" ? "var(--admin-danger-bg)" : "transparent", opacity: resolved ? .7 : 1 }}>
            <div style={{ marginTop: 1 }}><SeverityIcon severity={alert.severity}/></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                <OpsBadge tone={severityTone(alert.severity)}>{alert.severity}</OpsBadge>
                <OpsBadge>{automationAlertTypeLabels[alert.type]}</OpsBadge>
                <OpsBadge tone={statusTone(alert.status)}>{alert.status}</OpsBadge>
                {alert.escalated_at ? <OpsBadge tone="danger">Escalated</OpsBadge> : null}
                <OpsMono>{alert.entity_id}</OpsMono>
                {alert.assigned_to_name || alert.assigned_to_email ? <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>· {alert.assigned_to_name || alert.assigned_to_email}</span> : null}
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--admin-muted)" }}><Clock3 size={11}/>{ageLabel(alert.last_triggered_at)}</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--admin-ink)" }}>{alert.title}</div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--admin-muted)" }}>{alert.detail}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 5, fontSize: 11.5, color: "var(--admin-faint)" }}>
                <span>{alert.branch || "No branch"}</span>
                {alert.parent_reference ? <span>Parent {alert.parent_reference}</span> : null}
                <span>Triggered {dateTime(alert.last_triggered_at)}</span>
                {alert.acknowledged_at ? <span>Acknowledged {dateTime(alert.acknowledged_at)} by {alert.acknowledged_by_name || alert.acknowledged_by_email || "recorded operator"}</span> : null}
                {alert.resolved_at ? <span>Resolved {dateTime(alert.resolved_at)} by {alert.resolved_by_name || alert.resolved_by_email || "recorded operator"}</span> : null}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Link href={alert.action_path} className="ops-button" data-variant={resolved ? "secondary" : "primary"} data-size="sm">Open record</Link>
              {alert.status === "open" ? <OpsButton size="sm" variant="secondary" disabled={busy} onClick={() => void action("acknowledge", alert.id)}>{busy ? "Working…" : "Acknowledge"}</OpsButton> : null}
              {!resolved ? <OpsButton size="sm" variant="ghost" disabled={busy} onClick={() => void action("resolve", alert.id)}><CheckCircle2 size={12}/>{busy ? "Working…" : "Resolve"}</OpsButton> : null}
            </div>
          </div>;
        }) : <OpsEmptyState kind={counts.active === 0 && status === "active" && !filtersActive ? "healthy" : "search"} icon={<CheckCircle2 size={18}/>} title={counts.active === 0 && status === "active" && !filtersActive ? "No active alerts" : "No alerts match this view"} description={counts.active === 0 && status === "active" && !filtersActive ? "The operational exception queue is clear. Resolved history remains available." : "Change the search or filters to widen the view."} action={filtersActive ? <OpsButton size="sm" variant="secondary" onClick={reset}>Reset view</OpsButton> : counts.resolved ? <OpsButton size="sm" variant="secondary" onClick={() => setStatus("resolved")}>View resolved history</OpsButton> : undefined}/>} 
      </section>

      <div style={{ marginTop: 16 }}><OpsNotice tone="neutral">Acknowledging an alert records review but does not transfer ownership. Resolving closes the current alert; if the condition persists, the next automation evaluation can reopen it.</OpsNotice></div>
    </div>
  </OpsPage>;
}