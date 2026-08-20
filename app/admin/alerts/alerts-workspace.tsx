"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BellRing, Check, CheckCircle2, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import {
  OpsButton,
  OpsEmptyState,
  OpsFilterBar,
  OpsMetric,
  OpsMetricStrip,
  OpsPageHeader,
  OpsPanel,
  OpsStatusBadge,
} from "../operations-ui";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity } from "./alert-data";

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function severityTone(value: AutomationAlertSeverity): "danger" | "warning" | "info" {
  return value === "critical" ? "danger" : value === "warning" ? "warning" : "info";
}

export function AlertsWorkspace({ initialAlerts, roleLabel }: { initialAlerts: AutomationAlert[]; roleLabel: string }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<"all" | AutomationAlertSeverity>("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return alerts.filter((alert) => {
      if (severity !== "all" && alert.severity !== severity) return false;
      if (!needle) return true;
      return [alert.title, alert.detail, alert.entity_id, alert.branch ?? "", alert.assigned_to_name ?? "", alert.assigned_to_email ?? "", automationAlertTypeLabels[alert.type]].join(" ").toLowerCase().includes(needle);
    });
  }, [alerts, query, severity]);

  const counts = {
    critical: alerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved").length,
    warning: alerts.filter((alert) => alert.severity === "warning" && alert.status !== "resolved").length,
    acknowledged: alerts.filter((alert) => alert.status === "acknowledged").length,
    open: alerts.filter((alert) => alert.status === "open").length,
  };
  const filtersActive = severity !== "all" || Boolean(query.trim());

  async function reload() {
    const response = await fetch("/api/admin/alerts", { cache: "no-store" });
    const data = await response.json() as { alerts?: AutomationAlert[]; error?: string };
    if (!response.ok || !data.alerts) throw new Error(data.error || "Could not reload alerts.");
    setAlerts(data.alerts);
  }

  async function action(actionName: "evaluate" | "acknowledge" | "resolve", alertId?: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: actionName, alertId }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Alert action failed.");
      await reload();
      setNotice(actionName === "evaluate" ? "Automation checks completed." : actionName === "acknowledge" ? "Alert acknowledged." : "Alert resolved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Alert action failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main>
    <OpsPageHeader
      eyebrow="Operations"
      title="Alerts"
      description="Operational exceptions and escalations in one action queue. Acknowledge ownership, resolve completed issues, or run the existing automation checks on demand."
      breadcrumbs={[{ label: "Operations", href: "/admin/command-centre" }, { label: "Alerts" }]}
      meta={<>Live operational inbox · {roleLabel}</>}
      actions={<OpsButton tone="primary" disabled={busy} onClick={() => void action("evaluate")}><RefreshCw size={13} className={busy ? "animate-spin" : ""}/>{busy ? "Checking…" : "Run checks"}</OpsButton>}
    />

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={4}>
        <OpsMetric label="Open" value={counts.open} icon={<BellRing size={13}/>} />
        <OpsMetric label="Critical" value={counts.critical} icon={<ShieldAlert size={13}/>} tone={counts.critical ? "danger" : "neutral"}/>
        <OpsMetric label="Warnings" value={counts.warning} icon={<AlertTriangle size={13}/>} tone={counts.warning ? "warning" : "neutral"}/>
        <OpsMetric label="Acknowledged" value={counts.acknowledged} icon={<Check size={13}/>} />
      </OpsMetricStrip>

      {notice ? <div className="flex items-center justify-between gap-3 rounded-lg border border-[#dde2f2] bg-[#f5f6fb] px-3.5 py-2.5 text-[11px] text-[#59657b]"><span>{notice}</span><button type="button" onClick={() => setNotice("")} className="grid h-6 w-6 place-items-center rounded-md hover:bg-white" aria-label="Dismiss notice"><X size={12}/></button></div> : null}

      <OpsPanel title="Action queue" eyebrow="Automation" description="Acknowledging assigns human ownership. Resolving closes the current alert, but the engine can reopen it if the underlying condition persists." action={<span className="text-[10px] text-[#90979e]">{visible.length} shown</span>}>
        <div className="border-b border-[#eceef0] p-3"><OpsFilterBar reset={filtersActive ? <button type="button" onClick={() => { setQuery(""); setSeverity("all"); }} className="inline-flex items-center gap-1 font-medium text-[#5968bb] hover:underline"><X size={11}/>Clear</button> : null}><label className="ops-search-field flex-1 lg:max-w-[520px]"><Search size={13} className="text-[#8e959c]"/><span className="sr-only">Search alerts</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search alert, customer, shipment or staff"/></label><label className="ops-filter-control"><ShieldAlert size={13}/><span className="sr-only">Severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value as "all" | AutomationAlertSeverity)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select></label></OpsFilterBar></div>

        {visible.length ? <div className="divide-y divide-[#eceef0]">{visible.map((alert) => <article key={alert.id} className="px-4 py-4 hover:bg-[#fafbfc] sm:px-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><OpsStatusBadge tone={severityTone(alert.severity)}>{alert.severity}</OpsStatusBadge><OpsStatusBadge>{automationAlertTypeLabels[alert.type]}</OpsStatusBadge>{alert.status === "acknowledged" ? <OpsStatusBadge tone="success">Acknowledged</OpsStatusBadge> : null}</div><h3 className="mt-2.5 text-[13px] font-semibold text-[#353c43]">{alert.title}</h3><p className="mt-1 max-w-4xl text-[11px] leading-5 text-[#707982]">{alert.detail}</p><div className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-[#959ca3]"><span>{alert.branch || "No branch"}</span><span>·</span><span>{alert.assigned_to_name || alert.assigned_to_email || "Unassigned"}</span><span>·</span><span>Triggered {dateTime(alert.first_triggered_at)}</span>{alert.escalated_at ? <><span>·</span><span>Escalated {dateTime(alert.escalated_at)}</span></> : null}</div></div><div className="flex shrink-0 flex-wrap items-center gap-1.5"><OpsButton href={alert.action_path}>Open record</OpsButton>{alert.status === "open" ? <OpsButton disabled={busy} onClick={() => void action("acknowledge", alert.id)}>Acknowledge</OpsButton> : null}<OpsButton disabled={busy} onClick={() => void action("resolve", alert.id)}><CheckCircle2 size={12}/>Resolve</OpsButton></div></div></article>)}</div> : <OpsEmptyState title="No active alerts" detail="The automation engine has nothing requiring action in this view."/>}
      </OpsPanel>
    </div>
  </main>;
}
