"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Info, RefreshCw, Search } from "lucide-react";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity, type AutomationAlertStatus } from "./alert-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage } from "../operations-ui";

type StatusFilter = "active" | "all" | AutomationAlertStatus;
type NoticeTone = "success" | "danger" | "warning";
type EvaluationResult = { active?: number; created?: number; updated?: number; resolved?: number; payable_alerts?: number; credit_holds?: number; credit_holds_authorized?: boolean };

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
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<"all" | AutomationAlertSeverity>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("success");

  const counts = useMemo(() => ({
    active: alerts.filter((alert) => alert.status !== "resolved").length,
    critical: alerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved").length,
    warning: alerts.filter((alert) => alert.severity === "warning" && alert.status !== "resolved").length,
    resolved: alerts.filter((alert) => alert.status === "resolved").length,
  }), [alerts]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const severityOrder = { critical: 3, warning: 2, info: 1 } as const;
    return alerts.filter((alert) => {
      if (severity !== "all" && alert.severity !== severity) return false;
      if (status === "active" && alert.status === "resolved") return false;
      if (status !== "active" && status !== "all" && alert.status !== status) return false;
      if (!terms.length) return true;
      const haystack = [alert.title, alert.detail, alert.entity_id, alert.parent_reference ?? "", alert.branch ?? "", alert.assigned_to_name ?? "", alert.assigned_to_email ?? "", automationAlertTypeLabels[alert.type]].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort((a, b) => Number(b.status !== "resolved") - Number(a.status !== "resolved") || severityOrder[b.severity] - severityOrder[a.severity] || b.last_triggered_at.localeCompare(a.last_triggered_at));
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
        setNotice(`Checks complete. ${activeConditions} active automated condition${activeConditions === 1 ? "" : "s"}.`);
      } else if (actionName === "acknowledge") setNotice("Alert acknowledged. The condition remains active until it is resolved.");
      else setNotice("Alert resolved. If the underlying condition persists, automation can reopen it.");
    } catch (error) {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Alert action failed.");
    } finally {
      setEvaluating(false);
      setBusyId(null);
    }
  }

  function reset() { setQuery(""); setSeverity("all"); setStatus("active"); }

  return <OpsPage>
    <div style={{ padding: "var(--app-page-gap)", minHeight: "calc(100dvh - var(--app-toolbar-height))" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: "32px", letterSpacing: "-.02em" }}>Tasks & Alerts</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--admin-muted)" }}>Operational exceptions — ordered by severity · {counts.active} active · {roleLabel}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}><OpsButton variant="primary" onClick={() => void action("evaluate")} disabled={evaluating}><RefreshCw size={14} className={evaluating ? "app-refreshing" : ""}/>{evaluating ? "Checking…" : "Check now"}</OpsButton></div>
      </header>

      {counts.critical > 0 ? <div style={{ marginBottom: 16 }}><OpsNotice tone="danger"><span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><AlertTriangle size={15}/><strong>{counts.critical} critical exception{counts.critical === 1 ? "" : "s"} require immediate review.</strong></span></OpsNotice></div> : null}
      {notice ? <div style={{ marginBottom: 16 }}><OpsNotice tone={noticeTone} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, height: "var(--app-control-height)", padding: "0 12px", width: 280, border: "1px solid var(--admin-line)", borderRadius: "var(--app-radius)", background: "var(--admin-surface)" }}><Search size={14} style={{ color: "var(--admin-muted)" }}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search alert, shipment, owner…" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", font: "inherit", fontSize: 13.5 }}/></label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Severity filter">
          <button type="button" style={chipStyle(severity === "all")} onClick={() => setSeverity("all")}>All</button>
          <button type="button" style={chipStyle(severity === "critical")} onClick={() => setSeverity("critical")}>Critical</button>
          <button type="button" style={chipStyle(severity === "warning")} onClick={() => setSeverity("warning")}>Warning</button>
          <button type="button" style={chipStyle(severity === "info")} onClick={() => setSeverity("info")}>Info</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Status filter">
          <button type="button" style={chipStyle(status === "active")} onClick={() => setStatus("active")}>Active</button>
          <button type="button" style={chipStyle(status === "open")} onClick={() => setStatus("open")}>Open</button>
          <button type="button" style={chipStyle(status === "acknowledged")} onClick={() => setStatus("acknowledged")}>Acknowledged</button>
          <button type="button" style={chipStyle(status === "resolved")} onClick={() => setStatus("resolved")}>Resolved</button>
        </div>
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
                <OpsMono>{alert.entity_id}</OpsMono>
                {alert.assigned_to_name || alert.assigned_to_email ? <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>· {alert.assigned_to_name || alert.assigned_to_email}</span> : null}
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--admin-muted)" }}><Clock3 size={11}/>{ageLabel(alert.last_triggered_at)}</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--admin-ink)" }}>{alert.title}</div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--admin-muted)" }}>{alert.detail}</div>
              <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--admin-faint)" }}>{alert.branch || "No branch"}{alert.parent_reference ? ` · Parent ${alert.parent_reference}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
              <Link href={alert.action_path} className="ops-button" data-variant="secondary" data-size="sm">Open record</Link>
              {alert.status === "open" ? <OpsButton size="sm" variant="secondary" disabled={busy} onClick={() => void action("acknowledge", alert.id)}>{busy ? "Working…" : "Acknowledge"}</OpsButton> : null}
              {!resolved ? <OpsButton size="sm" variant="ghost" disabled={busy} onClick={() => void action("resolve", alert.id)}><CheckCircle2 size={12}/>{busy ? "Working…" : "Resolve"}</OpsButton> : null}
            </div>
          </div>;
        }) : <OpsEmptyState kind={counts.active === 0 && status === "active" ? "healthy" : "search"} icon={<CheckCircle2 size={18}/>} title={counts.active === 0 && status === "active" ? "No active alerts" : "No alerts match this view"} description={counts.active === 0 && status === "active" ? "The operational exception queue is clear." : "Change the search or filters to widen the view."} action={<OpsButton size="sm" variant="secondary" onClick={reset}>Reset view</OpsButton>}/>} 
      </section>
    </div>
  </OpsPage>;
}
