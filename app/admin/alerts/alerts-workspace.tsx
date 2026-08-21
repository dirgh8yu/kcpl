"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, BellRing, Check, CheckCircle2, History, RefreshCw, ShieldAlert } from "lucide-react";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity, type AutomationAlertStatus } from "./alert-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";

type StatusFilter = "active" | "all" | AutomationAlertStatus;
type NoticeTone = "success" | "danger" | "warning";
type EvaluationResult = {
  active?: number;
  created?: number;
  updated?: number;
  resolved?: number;
  payable_alerts?: number;
  credit_holds?: number;
  credit_holds_authorized?: boolean;
};

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
    }).sort((a, b) => {
      const activeDifference = Number(b.status !== "resolved") - Number(a.status !== "resolved");
      if (activeDifference) return activeDifference;
      return severityOrder[b.severity] - severityOrder[a.severity]
        || stateOrder[b.status] - stateOrder[a.status]
        || b.last_triggered_at.localeCompare(a.last_triggered_at);
    });
  }, [alerts, query, severity, status]);

  async function reload() {
    const response = await fetch("/api/admin/alerts", { cache: "no-store" });
    const data = await response.json() as { alerts?: AutomationAlert[]; error?: string };
    if (!response.ok || !data.alerts) throw new Error(data.error || "Could not reload alerts.");
    setAlerts(data.alerts);
  }

  async function action(actionName: "evaluate" | "acknowledge" | "resolve", alertId?: string) {
    if (actionName === "evaluate") setEvaluating(true);
    else setBusyId(alertId ?? null);
    setNotice("");
    try {
      const response = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: actionName, alertId }),
      });
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

  function reset() {
    setQuery("");
    setSeverity("all");
    setStatus("active");
  }

  function showCritical() {
    const alreadyActive = status === "active" && severity === "critical";
    setStatus("active");
    setSeverity(alreadyActive ? "all" : "critical");
  }

  function showWarnings() {
    const alreadyActive = status === "active" && severity === "warning";
    setStatus("active");
    setSeverity(alreadyActive ? "all" : "warning");
  }

  const noFilters = !query.trim() && severity === "all";
  const emptyState = counts.active === 0 && status === "active" && noFilters ? (
    <OpsEmptyState
      kind="healthy"
      icon={<CheckCircle2 size={18}/>}
      title="No active alerts"
      description="The current queue is clear. Historical resolved alerts remain available without cluttering active work."
      action={counts.resolved ? <OpsButton variant="secondary" size="sm" onClick={() => setStatus("resolved")}>View resolved history</OpsButton> : <OpsButton variant="secondary" size="sm" onClick={() => action("evaluate")} disabled={evaluating}>{evaluating ? "Checking…" : "Check now"}</OpsButton>}
    />
  ) : status === "resolved" && counts.resolved === 0 && noFilters ? (
    <OpsEmptyState
      kind="search"
      icon={<History size={18}/>}
      title="No resolved history yet"
      description="Resolved and automatically cleared alerts will appear here as the system is used."
      action={<OpsButton variant="secondary" size="sm" onClick={reset}>Back to active alerts</OpsButton>}
    />
  ) : (
    <OpsEmptyState
      kind="search"
      icon={<CheckCircle2 size={18}/>}
      title="No alerts match this view"
      description="Nothing matches the current search and filters."
      action={<OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton>}
    />
  );

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Attention desk"
        title="Tasks & alerts"
        description="A single queue for overdue work, shipment exceptions, customs risk, quote follow-up and finance escalation. Acknowledge means reviewed, not assigned. Resolve only after the underlying condition is handled. Check now re-evaluates the rules; credit holds are applied only when the signed-in role is authorised to manage credit."
        meta={<><span>{roleLabel}</span><span>{counts.active} active</span><span>{counts.resolved} resolved in history</span><span>Times shown in Nepal time</span></>}
        actions={<><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations home</Link><OpsButton variant="primary" onClick={() => action("evaluate")} disabled={evaluating}><RefreshCw size={13} className={evaluating ? "animate-spin" : ""}/>{evaluating ? "Checking…" : "Check now"}</OpsButton></>}
      />

      <OpsStatStrip>
        <OpsStat label="Active" value={counts.active} icon={<BellRing size={13}/>} active={status === "active" && severity === "all"} onClick={() => { setStatus("active"); setSeverity("all"); }}/>
        <OpsStat label="Critical" value={counts.critical} icon={<ShieldAlert size={13}/>} tone={counts.critical ? "danger" : "neutral"} active={status === "active" && severity === "critical"} onClick={showCritical}/>
        <OpsStat label="Warnings" value={counts.warning} icon={<AlertTriangle size={13}/>} tone={counts.warning ? "warning" : "neutral"} active={status === "active" && severity === "warning"} onClick={showWarnings}/>
        <OpsStat label="Acknowledged" value={counts.acknowledged} icon={<Check size={13}/>} tone="info" active={status === "acknowledged"} onClick={() => { setStatus(status === "acknowledged" ? "active" : "acknowledged"); setSeverity("all"); }}/>
        <OpsStat label="Resolved" value={counts.resolved} icon={<History size={13}/>} active={status === "resolved"} onClick={() => { setStatus(status === "resolved" ? "active" : "resolved"); setSeverity("all"); }}/>
      </OpsStatStrip>

      <div className="ops-content ops-stack">
        {notice ? <OpsNotice tone={noticeTone} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

        <OpsSurface eyebrow="Operational inbox" title={status === "resolved" ? "Resolved history" : "What needs attention"} description={`${visible.length} record${visible.length === 1 ? "" : "s"} match this view. Active exceptions stay ahead of history; severity and recency determine the order.`} flush>
          <div className="ops-toolbar">
            <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search multiple terms: shipment owner branch overdue…"/>
            <select className="ops-select" value={severity} onChange={(event) => setSeverity(event.target.value as "all" | AutomationAlertSeverity)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select>
            <select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="active">Active alerts</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="all">All history</option></select>
            <OpsButton variant="ghost" size="sm" onClick={reset}>Reset</OpsButton>
          </div>

          {visible.length ? (
            <div className="divide-y divide-[#eee7e1]">
              {visible.map((alert) => {
                const busy = busyId === alert.id;
                return (
                  <article key={alert.id} className={`group grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[8px_minmax(0,1fr)_auto] lg:items-start ${alert.status === "resolved" ? "bg-[#fcfaf8]" : ""}`}>
                    <span className={`hidden h-full min-h-16 w-1.5 rounded-full lg:block ${alert.status === "resolved" ? "bg-[#d8d0ca]" : alert.severity === "critical" ? "bg-[#ae434a]" : alert.severity === "warning" ? "bg-[#d29a4b]" : "bg-[#3f7295]"}`} aria-hidden="true"/>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <OpsBadge tone={severityTone(alert.severity)} dot>{alert.severity}</OpsBadge>
                        <OpsBadge>{automationAlertTypeLabels[alert.type]}</OpsBadge>
                        <OpsBadge tone={statusTone(alert.status)}>{alert.status}</OpsBadge>
                        {alert.escalated_at ? <OpsBadge tone="danger">Escalated</OpsBadge> : null}
                      </div>
                      <h3 className="mt-2.5 text-[13px] font-[720] tracking-[-.018em] text-[#342f2b]">{alert.title}</h3>
                      <p className="mt-1 max-w-[920px] text-[11px] leading-5 text-[#706963]">{alert.detail}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-[#8d867f]">
                        <span>{alert.branch || "Branch not attached"}</span>
                        <span>{alert.assigned_to_name || alert.assigned_to_email ? `Assigned ${alert.assigned_to_name || alert.assigned_to_email}` : "No assigned owner"}</span>
                        <span>First {dateTime(alert.first_triggered_at)}</span>
                        <span>Last {dateTime(alert.last_triggered_at)}</span>
                        {alert.escalated_at ? <span>Escalated {dateTime(alert.escalated_at)}</span> : null}
                        {alert.acknowledged_at ? <span>Acknowledged {dateTime(alert.acknowledged_at)}{alert.acknowledged_by_name ? ` by ${alert.acknowledged_by_name}` : ""}</span> : null}
                        {alert.resolved_at ? <span>Resolved {dateTime(alert.resolved_at)}{alert.resolved_by_name ? ` by ${alert.resolved_by_name}` : ""}</span> : null}
                        {alert.parent_reference ? <span>Parent <OpsMono>{alert.parent_reference}</OpsMono></span> : null}
                        <span>Record <OpsMono>{alert.entity_id}</OpsMono></span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Link href={alert.action_path} className="ops-button" data-variant={alert.status === "resolved" ? "secondary" : "primary"} data-size="sm">Open record</Link>
                      {alert.status === "open" ? <OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => action("acknowledge", alert.id)}>{busy ? "Working…" : "Acknowledge"}</OpsButton> : null}
                      {alert.status !== "resolved" ? <OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => action("resolve", alert.id)}><CheckCircle2 size={12}/>{busy ? "Working…" : "Resolve"}</OpsButton> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : emptyState}
        </OpsSurface>
      </div>
    </OpsPage>
  );
}
