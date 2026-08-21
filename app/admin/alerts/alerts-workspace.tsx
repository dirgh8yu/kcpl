"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, BellRing, Check, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity, type AutomationAlertStatus } from "./alert-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function severityTone(value: AutomationAlertSeverity): "info" | "warning" | "danger" {
  return value === "critical" ? "danger" : value === "warning" ? "warning" : "info";
}

type Focus = "all" | "open" | "critical" | "warning" | "acknowledged";

export function AlertsWorkspace({ initialAlerts, roleLabel }: { initialAlerts: AutomationAlert[]; roleLabel: string }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<"all" | AutomationAlertSeverity>("all");
  const [status, setStatus] = useState<"all" | AutomationAlertStatus>("all");
  const [focus, setFocus] = useState<Focus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [notice, setNotice] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return alerts.filter((alert) => {
      if (severity !== "all" && alert.severity !== severity) return false;
      if (status !== "all" && alert.status !== status) return false;
      if (focus === "open" && alert.status !== "open") return false;
      if (focus === "critical" && (alert.severity !== "critical" || alert.status === "resolved")) return false;
      if (focus === "warning" && (alert.severity !== "warning" || alert.status === "resolved")) return false;
      if (focus === "acknowledged" && alert.status !== "acknowledged") return false;
      if (!needle) return true;
      return [alert.title, alert.detail, alert.entity_id, alert.parent_reference ?? "", alert.branch ?? "", alert.assigned_to_name ?? "", alert.assigned_to_email ?? "", automationAlertTypeLabels[alert.type]].join(" ").toLowerCase().includes(needle);
    }).sort((a, b) => {
      const severityOrder = { critical: 3, warning: 2, info: 1 } as const;
      return severityOrder[b.severity] - severityOrder[a.severity] || b.last_triggered_at.localeCompare(a.last_triggered_at);
    });
  }, [alerts, focus, query, severity, status]);

  const counts = {
    critical: alerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved").length,
    warning: alerts.filter((alert) => alert.severity === "warning" && alert.status !== "resolved").length,
    acknowledged: alerts.filter((alert) => alert.status === "acknowledged").length,
    open: alerts.filter((alert) => alert.status === "open").length,
  };
  const unresolved = alerts.filter((alert) => alert.status !== "resolved").length;

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
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Alert action failed.");
      await reload();
      setNotice(actionName === "evaluate" ? "Automation checks completed and the queue is up to date." : actionName === "acknowledge" ? "Alert acknowledged. It now has an owner." : "Alert resolved. It will return automatically if the underlying condition reappears.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Alert action failed.");
    } finally {
      setEvaluating(false);
      setBusyId(null);
    }
  }

  function reset() {
    setQuery("");
    setSeverity("all");
    setStatus("all");
    setFocus("all");
  }

  const emptyState = unresolved === 0 ? (
    <OpsEmptyState
      kind="healthy"
      icon={<CheckCircle2 size={18}/>}
      title="All clear ✓"
      description="No active exceptions require attention. KCPL will surface new operational risk here when a rule is triggered."
      action={<OpsButton variant="secondary" size="sm" onClick={() => action("evaluate")} disabled={evaluating}>{evaluating ? "Checking…" : "Check now"}</OpsButton>}
    />
  ) : (
    <OpsEmptyState
      kind="search"
      icon={<CheckCircle2 size={18}/>}
      title="No alerts match this view"
      description="There is active work elsewhere in the queue, but nothing matches the current filters."
      action={<OpsButton variant="secondary" size="sm" onClick={reset}>Show all alerts</OpsButton>}
    />
  );

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Attention desk"
        title="Tasks & alerts"
        description="One operational inbox for exceptions, overdue work, customs risk, quote follow-up and finance escalation. Acknowledge when someone owns it; resolve when the underlying problem is actually handled."
        meta={<><span>{roleLabel}</span><span>Automation-backed queue</span><span>{unresolved} unresolved</span></>}
        actions={<><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations home</Link><OpsButton variant="primary" onClick={() => action("evaluate")} disabled={evaluating}><RefreshCw size={13} className={evaluating ? "animate-spin" : ""}/>{evaluating ? "Checking…" : "Check now"}</OpsButton></>}
      />

      <OpsStatStrip>
        <OpsStat label="Open" value={counts.open} icon={<BellRing size={13}/>} active={focus === "open"} onClick={() => setFocus(focus === "open" ? "all" : "open")}/>
        <OpsStat label="Critical" value={counts.critical} icon={<ShieldAlert size={13}/>} tone={counts.critical ? "danger" : "neutral"} active={focus === "critical"} onClick={() => setFocus(focus === "critical" ? "all" : "critical")}/>
        <OpsStat label="Warnings" value={counts.warning} icon={<AlertTriangle size={13}/>} tone={counts.warning ? "warning" : "neutral"} active={focus === "warning"} onClick={() => setFocus(focus === "warning" ? "all" : "warning")}/>
        <OpsStat label="Acknowledged" value={counts.acknowledged} icon={<Check size={13}/>} tone="info" active={focus === "acknowledged"} onClick={() => setFocus(focus === "acknowledged" ? "all" : "acknowledged")}/>
      </OpsStatStrip>

      <div className="ops-content ops-stack">
        {notice ? <OpsNotice tone={notice.toLowerCase().includes("failed") || notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

        <OpsSurface eyebrow="Operational inbox" title="What needs attention" description={`${visible.length} alerts match this view. The most severe and most recently triggered items stay at the top.`} flush>
          <div className="ops-toolbar">
            <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search alert, shipment, customer, branch or owner"/>
            <select className="ops-select" value={severity} onChange={(event) => setSeverity(event.target.value as "all" | AutomationAlertSeverity)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select>
            <select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as "all" | AutomationAlertStatus)}><option value="all">All states</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select>
            <OpsButton variant="ghost" size="sm" onClick={reset}>Reset</OpsButton>
          </div>

          {visible.length ? (
            <div className="divide-y divide-[#eee7e1]">
              {visible.map((alert) => {
                const busy = busyId === alert.id;
                return (
                  <article key={alert.id} className="group grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[8px_minmax(0,1fr)_auto] lg:items-start">
                    <span className={`hidden h-full min-h-16 w-1.5 rounded-full lg:block ${alert.severity === "critical" ? "bg-[#ae434a]" : alert.severity === "warning" ? "bg-[#d29a4b]" : "bg-[#3f7295]"}`} aria-hidden="true"/>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5"><OpsBadge tone={severityTone(alert.severity)} dot>{alert.severity}</OpsBadge><OpsBadge>{automationAlertTypeLabels[alert.type]}</OpsBadge>{alert.status === "acknowledged" ? <OpsBadge tone="success">Acknowledged</OpsBadge> : alert.status === "resolved" ? <OpsBadge tone="neutral">Resolved</OpsBadge> : null}{alert.escalated_at ? <OpsBadge tone="danger">Escalated</OpsBadge> : null}</div>
                      <h3 className="mt-2.5 text-[13px] font-[720] tracking-[-.018em] text-[#342f2b]">{alert.title}</h3>
                      <p className="mt-1 max-w-[920px] text-[11px] leading-5 text-[#706963]">{alert.detail}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-[#8d867f]"><span>{alert.branch || "No branch"}</span><span>{alert.assigned_to_name || alert.assigned_to_email || "Unassigned"}</span><span>{automationAlertTypeLabels[alert.type]}</span><span>Triggered {dateTime(alert.first_triggered_at)}</span>{alert.parent_reference ? <span>Parent <OpsMono>{alert.parent_reference}</OpsMono></span> : null}<span>Record <OpsMono>{alert.entity_id}</OpsMono></span></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end"><Link href={alert.action_path} className="ops-button" data-variant="primary" data-size="sm">Open record</Link>{alert.status === "open" ? <OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => action("acknowledge", alert.id)}>{busy ? "Working…" : "Acknowledge"}</OpsButton> : null}{alert.status !== "resolved" ? <OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => action("resolve", alert.id)}><CheckCircle2 size={12}/>{busy ? "Working…" : "Resolve"}</OpsButton> : null}</div>
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
