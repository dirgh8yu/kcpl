"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, History, RefreshCw, ShieldAlert } from "lucide-react";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity, type AutomationAlertStatus } from "./alert-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage } from "../operations-ui";

type StatusFilter = "active" | "all" | AutomationAlertStatus;
type NoticeTone = "success" | "danger" | "warning";
type EvaluationResult = { active?: number; created?: number; updated?: number; resolved?: number; payable_alerts?: number; credit_holds?: number; credit_holds_authorized?: boolean };

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short" }).format(date)} NPT`;
}
function severityTone(value: AutomationAlertSeverity): "info" | "warning" | "danger" { return value === "critical" ? "danger" : value === "warning" ? "warning" : "info"; }
function statusTone(value: AutomationAlertStatus): "info" | "success" | "neutral" { return value === "open" ? "info" : value === "acknowledged" ? "success" : "neutral"; }

function Metric({ label, value, active, alert, onClick }: { label: string; value: number; active?: boolean; alert?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`min-h-[108px] border-b border-[var(--admin-line)] px-4 py-5 text-left transition-colors hover:bg-[var(--admin-surface-muted)] sm:border-b-0 sm:border-r sm:last:border-r-0 ${active ? "bg-[var(--admin-surface-muted)]" : ""}`}><span className="flex items-center justify-between text-[length:var(--app-label-size)] uppercase tracking-[0.07em] text-[var(--admin-muted)]"><span>{label}</span>{active ? <span className="h-2 w-2 bg-[var(--admin-crimson)]"/> : null}</span><strong className={`mt-4 block text-[32px] font-normal leading-none tracking-[-0.045em] ${alert && value ? "text-[var(--admin-crimson)]" : "text-[var(--admin-ink)]"}`}>{value}</strong></button>;
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

  const counts = useMemo(() => ({ active: alerts.filter((alert) => alert.status !== "resolved").length, open: alerts.filter((alert) => alert.status === "open").length, critical: alerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved").length, warning: alerts.filter((alert) => alert.severity === "warning" && alert.status !== "resolved").length, acknowledged: alerts.filter((alert) => alert.status === "acknowledged").length, resolved: alerts.filter((alert) => alert.status === "resolved").length }), [alerts]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const severityOrder = { critical: 3, warning: 2, info: 1 } as const;
    const stateOrder = { open: 2, acknowledged: 1, resolved: 0 } as const;
    return alerts.filter((alert) => {
      if (severity !== "all" && alert.severity !== severity) return false;
      if (status === "active" && alert.status === "resolved") return false;
      if (status !== "active" && status !== "all" && alert.status !== status) return false;
      if (!terms.length) return true;
      const haystack = [alert.title, alert.detail, alert.entity_id, alert.parent_reference ?? "", alert.branch ?? "", alert.assigned_to_name ?? "", alert.assigned_to_email ?? "", alert.acknowledged_by_name ?? "", alert.acknowledged_by_email ?? "", alert.resolved_by_name ?? "", alert.resolved_by_email ?? "", alert.status, alert.severity, automationAlertTypeLabels[alert.type]].join(" ").toLowerCase();
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
      await reload(); setNoticeTone("success");
      if (actionName === "evaluate") { const activeConditions = (data.result?.active ?? 0) + (data.result?.payable_alerts ?? 0); const holds = data.result?.credit_holds ?? 0; setNotice(`Checks complete. ${activeConditions} active automated condition${activeConditions === 1 ? "" : "s"}${holds ? `; ${holds} authorised credit hold${holds === 1 ? "" : "s"} applied` : ""}.`); }
      else if (actionName === "acknowledge") setNotice("Alert acknowledged. This records review, not ownership; the condition remains active until it is resolved.");
      else setNotice("Alert marked resolved. If the underlying condition still exists, the next automation check will reopen it.");
    } catch (error) { setNoticeTone("danger"); setNotice(error instanceof Error ? error.message : "Alert action failed."); }
    finally { setEvaluating(false); setBusyId(null); }
  }

  function reset() { setQuery(""); setSeverity("all"); setStatus("active"); }
  function showCritical() { const active = status === "active" && severity === "critical"; setStatus("active"); setSeverity(active ? "all" : "critical"); }
  function showWarnings() { const active = status === "active" && severity === "warning"; setStatus("active"); setSeverity(active ? "all" : "warning"); }

  const noFilters = !query.trim() && severity === "all";
  const emptyState = counts.active === 0 && status === "active" && noFilters ? <OpsEmptyState kind="healthy" icon={<CheckCircle2 size={18}/>} title="No active alerts" description="The operational queue is clear. Resolved history remains available without cluttering active work." action={counts.resolved ? <OpsButton variant="secondary" size="sm" onClick={() => setStatus("resolved")}>View resolved history</OpsButton> : <OpsButton variant="secondary" size="sm" onClick={() => action("evaluate")} disabled={evaluating}>{evaluating ? "Checking…" : "Check now"}</OpsButton>}/> : <OpsEmptyState kind="search" icon={<History size={18}/>} title={status === "resolved" ? "No resolved history yet" : "No alerts match this view"} description={status === "resolved" ? "Resolved and automatically cleared alerts will appear here as the system is used." : "Nothing matches the current search and filters."} action={<OpsButton variant="secondary" size="sm" onClick={reset}>Reset view</OpsButton>}/>;

  return <OpsPage><main className="min-h-[calc(100vh-64px)] bg-[var(--admin-canvas)] text-[var(--admin-ink)]"><div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
    <header className="grid gap-6 border-b border-[#101010] pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><div><p className="text-[length:var(--app-label-size)] uppercase tracking-[0.11em] text-[var(--admin-crimson)]">Operations · Attention desk</p><h1 className="mt-3 text-[clamp(36px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.04em]">Tasks & Alerts</h1><p className="mt-3 max-w-2xl text-[14px] leading-6 text-[var(--admin-muted)]">One exception ledger for overdue work, shipment risk, customs blockers and finance escalation. Acknowledge means reviewed; resolve only after the underlying condition is handled.</p><p className="mt-3 text-[length:var(--app-label-size)] uppercase tracking-[0.05em] text-[var(--admin-muted)]">{roleLabel} · Nepal time</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/command-centre" className="inline-flex h-10 items-center border border-[var(--admin-line-strong)] px-3 text-[12px] hover:border-[#101010] hover:bg-[var(--admin-surface-muted)]">Overview</Link><button type="button" onClick={() => action("evaluate")} disabled={evaluating} className="inline-flex h-10 items-center gap-2 border border-[var(--admin-crimson)] bg-[var(--admin-crimson)] px-4 text-[12px] font-medium text-white hover:border-[var(--admin-crimson-dark)] hover:bg-[var(--admin-crimson-dark)] disabled:opacity-50"><RefreshCw size={13} className={evaluating ? "animate-spin" : ""}/>{evaluating ? "Checking…" : "Check now"}</button></div></header>

    <section className="grid border-b border-[var(--admin-line)] sm:grid-cols-5"><Metric label="Active" value={counts.active} active={status === "active" && severity === "all"} onClick={() => { setStatus("active"); setSeverity("all"); }}/><Metric label="Critical" value={counts.critical} alert active={status === "active" && severity === "critical"} onClick={showCritical}/><Metric label="Warnings" value={counts.warning} alert active={status === "active" && severity === "warning"} onClick={showWarnings}/><Metric label="Acknowledged" value={counts.acknowledged} active={status === "acknowledged"} onClick={() => { setStatus(status === "acknowledged" ? "active" : "acknowledged"); setSeverity("all"); }}/><Metric label="Resolved" value={counts.resolved} active={status === "resolved"} onClick={() => { setStatus(status === "resolved" ? "active" : "resolved"); setSeverity("all"); }}/></section>

    {notice ? <div className="mt-5"><OpsNotice tone={noticeTone} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}
    <section className="mt-6 border-y border-[var(--admin-line)]">
      <div className="grid gap-3 border-b border-[#101010] py-4 md:grid-cols-[minmax(260px,1fr)_180px_180px_auto]"><label className="flex h-10 items-center border border-[var(--admin-line-strong)] bg-white px-3"><SearchIcon/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, owner, branch, exception…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--admin-muted)]"/></label><select className="ops-select" value={severity} onChange={(event) => setSeverity(event.target.value as "all" | AutomationAlertSeverity)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select><select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="active">Active alerts</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="all">All history</option></select><button type="button" onClick={reset} className="h-10 border border-[var(--admin-line-strong)] px-3 text-[12px] hover:border-[#101010] hover:bg-[var(--admin-surface-muted)]">Reset</button></div>
      <div className="hidden min-h-11 grid-cols-[92px_170px_minmax(260px,1fr)_190px_180px_auto] items-center gap-4 border-b border-[#101010] px-3 text-[length:var(--app-label-size)] uppercase tracking-[0.06em] text-[var(--admin-muted)] lg:grid"><span>Severity</span><span>Type / state</span><span>Issue</span><span>Ownership</span><span>Timing</span><span className="text-right">Actions</span></div>
      {visible.length ? <div>{visible.map((alert) => { const busy = busyId === alert.id; const resolved = alert.status === "resolved"; return <article key={alert.id} className={`relative grid gap-4 border-b border-[var(--admin-line)] px-3 py-4 last:border-b-0 lg:grid-cols-[92px_170px_minmax(260px,1fr)_190px_180px_auto] lg:items-start ${resolved ? "opacity-65" : "hover:bg-[var(--admin-surface-muted)]"}`}>{!resolved && alert.severity === "critical" ? <span className="absolute bottom-2 left-0 top-2 w-[2px] bg-[var(--admin-crimson)]"/> : null}<div><OpsBadge tone={severityTone(alert.severity)} dot>{alert.severity}</OpsBadge>{alert.escalated_at ? <div className="mt-2"><OpsBadge tone="danger">Escalated</OpsBadge></div> : null}</div><div><p className="text-[length:var(--app-label-size)] font-medium uppercase tracking-[0.04em] text-[var(--admin-muted)]">{automationAlertTypeLabels[alert.type]}</p><div className="mt-2"><OpsBadge tone={statusTone(alert.status)}>{alert.status}</OpsBadge></div></div><div className="min-w-0"><h2 className="text-[13px] font-medium tracking-[-0.015em]">{alert.title}</h2><p className="mt-1 text-[11px] leading-5 text-[#666660]">{alert.detail}</p><p className="mt-2 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Record <OpsMono>{alert.entity_id}</OpsMono>{alert.parent_reference ? <> · Parent <OpsMono>{alert.parent_reference}</OpsMono></> : null}</p></div><div className="text-[length:var(--app-label-size)] leading-5 text-[#666660]"><p>{alert.branch || "Branch not attached"}</p><p>{alert.assigned_to_name || alert.assigned_to_email || "No assigned owner"}</p></div><div className="text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]"><p>First {dateTime(alert.first_triggered_at)}</p><p className="mt-1">Last {dateTime(alert.last_triggered_at)}</p>{alert.acknowledged_at ? <p className="mt-1">Ack {dateTime(alert.acknowledged_at)}</p> : null}{alert.resolved_at ? <p className="mt-1">Resolved {dateTime(alert.resolved_at)}</p> : null}</div><div className="flex flex-wrap gap-2 lg:justify-end"><Link href={alert.action_path} className="ops-button" data-variant={resolved ? "secondary" : "primary"} data-size="sm">Open record</Link>{alert.status === "open" ? <OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => action("acknowledge", alert.id)}>{busy ? "Working…" : "Acknowledge"}</OpsButton> : null}{!resolved ? <OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => action("resolve", alert.id)}><CheckCircle2 size={12}/>{busy ? "Working…" : "Resolve"}</OpsButton> : null}</div></article>; })}</div> : <div className="py-12">{emptyState}</div>}
    </section>

    <div className="mt-5 border-l-2 border-[var(--admin-crimson)] bg-[var(--admin-surface-muted)] px-4 py-3 text-[11px] leading-5 text-[var(--admin-muted)]"><div className="flex items-start gap-2"><ShieldAlert size={14} className="mt-0.5 shrink-0 text-[var(--admin-crimson)]"/><p><strong className="font-medium text-[var(--admin-ink)]">Control rule:</strong> acknowledging an alert records review but does not transfer ownership. Resolving closes the current alert; if the condition persists, the next automation evaluation can reopen it.</p></div></div>
  </div></main></OpsPage>;
}

function SearchIcon() { return <span className="mr-2 text-[var(--admin-muted)]"><AlertTriangle size={13} aria-hidden="true"/></span>; }
