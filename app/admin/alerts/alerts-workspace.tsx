"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, History, RefreshCw, ShieldAlert } from "lucide-react";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity, type AutomationAlertStatus } from "./alert-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface, OpsTableWrap, OpsToolbar } from "../operations-ui";

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

  const noFilters = !query.trim() && severity === "all";
  const emptyState = counts.active === 0 && status === "active" && noFilters
    ? <OpsEmptyState kind="healthy" icon={<CheckCircle2 size={18}/>} title="No active alerts" description="The operational queue is clear. Resolved history remains available without cluttering active work." action={counts.resolved ? <OpsButton variant="secondary" size="sm" onClick={() => setStatus("resolved")}>View resolved history</OpsButton> : <OpsButton variant="secondary" size="sm" onClick={() => action("evaluate")} disabled={evaluating}>{evaluating ? "Checking…" : "Check now"}</OpsButton>}/>
    : <OpsEmptyState kind="search" icon={<History size={18}/>} title={status === "resolved" ? "No resolved history yet" : "No alerts match this view"} description={status === "resolved" ? "Resolved and automatically cleared alerts will appear here as the system is used." : "Nothing matches the current search and filters."} action={<OpsButton variant="secondary" size="sm" onClick={reset}>Reset view</OpsButton>}/>;

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Operations · Attention desk"
      title="Tasks & Alerts"
      description="Triage overdue work, shipment risk, Customs blockers and finance escalation. Acknowledge records review; resolve only after the underlying condition is handled."
      meta={<><span>{roleLabel}</span><span>Nepal time</span><span>{visible.length} shown</span></>}
      actions={<><Link href="/admin/command-centre" className="ops-button" data-variant="secondary">Overview</Link><OpsButton variant="primary" onClick={() => action("evaluate")} disabled={evaluating}><RefreshCw size={14} className={evaluating ? "app-refreshing" : ""}/>{evaluating ? "Checking…" : "Check now"}</OpsButton></>}
    />

    <OpsStatStrip>
      <OpsStat label="Active" value={counts.active} active={status === "active" && severity === "all"} onClick={() => { setStatus("active"); setSeverity("all"); }}/>
      <OpsStat label="Critical" value={counts.critical} tone={counts.critical ? "danger" : "neutral"} active={status === "active" && severity === "critical"} onClick={() => { setStatus("active"); setSeverity(severity === "critical" ? "all" : "critical"); }}/>
      <OpsStat label="Warnings" value={counts.warning} tone={counts.warning ? "warning" : "neutral"} active={status === "active" && severity === "warning"} onClick={() => { setStatus("active"); setSeverity(severity === "warning" ? "all" : "warning"); }}/>
      <OpsStat label="Acknowledged" value={counts.acknowledged} active={status === "acknowledged"} onClick={() => { setStatus(status === "acknowledged" ? "active" : "acknowledged"); setSeverity("all"); }}/>
      <OpsStat label="Resolved" value={counts.resolved} active={status === "resolved"} onClick={() => { setStatus(status === "resolved" ? "active" : "resolved"); setSeverity("all"); }}/>
    </OpsStatStrip>

    <div className="ops-content-wide grid gap-4">
      {notice ? <OpsNotice tone={noticeTone} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

      <OpsSurface title="Attention queue" description="Highest-severity active conditions remain first. Search and filters never change the underlying alert state." flush>
        <div className="px-4 sm:px-5">
          <OpsToolbar>
            <OpsSearch className="flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, owner, branch or exception"/>
            <select className="ops-select" value={severity} onChange={(event) => setSeverity(event.target.value as "all" | AutomationAlertSeverity)} aria-label="Filter by severity">
              <option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option>
            </select>
            <select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filter by alert state">
              <option value="active">Active alerts</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="all">All history</option>
            </select>
            <OpsButton variant="secondary" onClick={reset}>Reset</OpsButton>
          </OpsToolbar>
        </div>

        {visible.length ? <OpsTableWrap>
          <table className="ops-table">
            <thead><tr><th>Severity</th><th>Alert</th><th>State</th><th>Ownership</th><th>Last triggered</th><th>Actions</th></tr></thead>
            <tbody>{visible.map((alert) => {
              const busy = busyId === alert.id;
              const resolved = alert.status === "resolved";
              return <tr key={alert.id} data-selected={!resolved && alert.severity === "critical" ? "true" : undefined}>
                <td><div className="flex flex-wrap gap-1"><OpsBadge tone={severityTone(alert.severity)} dot>{alert.severity}</OpsBadge>{alert.escalated_at ? <OpsBadge tone="danger">Escalated</OpsBadge> : null}</div></td>
                <td><div className="max-w-xl"><strong className="block">{alert.title}</strong><span className="mt-1 block text-sm text-[var(--admin-muted)]">{alert.detail}</span><span className="mt-1 block text-xs text-[var(--admin-faint)]">{automationAlertTypeLabels[alert.type]} · <OpsMono>{alert.entity_id}</OpsMono>{alert.parent_reference ? <> · Parent <OpsMono>{alert.parent_reference}</OpsMono></> : null}</span></div></td>
                <td><OpsBadge tone={statusTone(alert.status)}>{alert.status}</OpsBadge></td>
                <td><div className="text-sm"><span className="block">{alert.assigned_to_name || alert.assigned_to_email || "No assigned owner"}</span><span className="block text-xs text-[var(--admin-faint)]">{alert.branch || "Branch not attached"}</span></div></td>
                <td><div className="text-xs text-[var(--admin-muted)]"><span className="block">{dateTime(alert.last_triggered_at)}</span>{alert.acknowledged_at ? <span className="block">Acknowledged {dateTime(alert.acknowledged_at)}</span> : null}{alert.resolved_at ? <span className="block">Resolved {dateTime(alert.resolved_at)}</span> : null}</div></td>
                <td><div className="flex flex-wrap justify-end gap-2"><Link href={alert.action_path} className="ops-button" data-variant={resolved ? "secondary" : "primary"} data-size="sm">Open record</Link>{alert.status === "open" ? <OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => action("acknowledge", alert.id)}>{busy ? "Working…" : "Acknowledge"}</OpsButton> : null}{!resolved ? <OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => action("resolve", alert.id)}><CheckCircle2 size={13}/>{busy ? "Working…" : "Resolve"}</OpsButton> : null}</div></td>
              </tr>;
            })}</tbody>
          </table>
        </OpsTableWrap> : <div className="p-4 sm:p-5">{emptyState}</div>}
      </OpsSurface>

      <OpsSurface title={<span className="inline-flex items-center gap-2"><ShieldAlert size={16}/>Control rule</span>} priority="info">
        <p className="text-sm text-[var(--admin-muted)]">Acknowledging an alert records review but does not transfer ownership. Resolving closes the current alert; if the condition persists, the next automation evaluation can reopen it.</p>
      </OpsSurface>
    </div>
  </OpsPage>;
}
