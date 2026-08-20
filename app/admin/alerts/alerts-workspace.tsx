"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BellRing, Check, CheckCircle2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { automationAlertTypeLabels, type AutomationAlert, type AutomationAlertSeverity } from "./alert-data";

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function severityClass(value: AutomationAlertSeverity) {
  if (value === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (value === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-sky-200 bg-sky-50 text-sky-700";
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
      const response = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: actionName, alertId }),
      });
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

  return (
    <main className="min-h-screen bg-[#f3f0e7] text-[#10263f]">
      <header className="bg-[#091624] px-5 py-6 text-white lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <Link href="/admin/command-centre" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10"><ArrowLeft size={16}/></Link>
            <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Automation</p><h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Alerts & Escalations</h1><p className="mt-2 text-xs text-white/45">Live operational inbox · {roleLabel}</p></div>
          </div>
          <button disabled={busy} onClick={() => action("evaluate")} className="flex items-center gap-2 rounded-xl bg-[#d4ad62] px-4 py-3 text-[10px] font-black uppercase tracking-[.1em] text-[#10263f] disabled:opacity-50"><RefreshCw size={13}/>{busy ? "Checking…" : "Run checks now"}</button>
        </div>
      </header>

      <section className="bg-[#10263f] px-5 pb-6 text-white lg:px-8">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Open" value={counts.open} icon={<BellRing size={15}/>} />
          <Metric label="Critical" value={counts.critical} icon={<ShieldAlert size={15}/>} danger={counts.critical > 0} />
          <Metric label="Warnings" value={counts.warning} icon={<AlertTriangle size={15}/>} warning={counts.warning > 0} />
          <Metric label="Acknowledged" value={counts.acknowledged} icon={<Check size={15}/>} />
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] p-5 lg:p-8">
        {notice ? <div className="mb-5 rounded-2xl border border-[#d4ad62]/30 bg-[#fff8e8] px-4 py-3 text-sm font-bold text-[#6d5427]">{notice}</div> : null}
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3"><Search size={14} className="text-black/30"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent py-3 text-sm outline-none" placeholder="Search alert, customer, shipment, staff…"/></label>
          <select value={severity} onChange={(event) => setSeverity(event.target.value as "all" | AutomationAlertSeverity)} className="rounded-xl border border-black/10 bg-white px-3 py-3 text-xs font-bold outline-none"><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 p-6"><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#b78a3e]">Action queue</p><h2 className="mt-1 text-xl font-black">{visible.length} active alerts</h2><p className="mt-1 text-xs text-black/45">Acknowledging means someone owns the issue. Resolving closes it, but the engine will reopen it if the underlying condition still exists.</p></div>
          <div className="divide-y divide-black/10">
            {visible.length ? visible.map((alert) => <article key={alert.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] ${severityClass(alert.severity)}`}>{alert.severity}</span><span className="rounded-full bg-[#f3f0e7] px-2.5 py-1 text-[9px] font-black">{automationAlertTypeLabels[alert.type]}</span>{alert.status === "acknowledged" ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">Acknowledged</span> : null}</div>
                  <h3 className="mt-3 text-base font-black">{alert.title}</h3><p className="mt-1 text-xs leading-5 text-black/50">{alert.detail}</p>
                  <p className="mt-3 text-[10px] font-bold text-black/35">{alert.branch ? `${alert.branch} · ` : ""}{alert.assigned_to_name || alert.assigned_to_email || "Unassigned"} · triggered {dateTime(alert.first_triggered_at)}{alert.escalated_at ? ` · escalated ${dateTime(alert.escalated_at)}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2"><Link href={alert.action_path} className="rounded-xl bg-[#10263f] px-4 py-2.5 text-[10px] font-black text-white">Open record</Link>{alert.status === "open" ? <button disabled={busy} onClick={() => action("acknowledge", alert.id)} className="rounded-xl border border-black/10 px-4 py-2.5 text-[10px] font-black">Acknowledge</button> : null}<button disabled={busy} onClick={() => action("resolve", alert.id)} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[10px] font-black text-emerald-700"><CheckCircle2 size={12}/>Resolve</button></div>
              </div>
            </article>) : <div className="p-12 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={28}/><h3 className="mt-3 text-base font-black">No active alerts</h3><p className="mt-1 text-xs text-black/40">The automation engine has nothing requiring action right now.</p></div>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, icon, danger = false, warning = false }: { label: string; value: number; icon: React.ReactNode; danger?: boolean; warning?: boolean }) {
  const style = danger ? "border-rose-300/30 bg-rose-400/10 text-rose-100" : warning ? "border-amber-300/30 bg-amber-400/10 text-amber-100" : "border-white/10 bg-white/[.035] text-white";
  return <div className={`rounded-2xl border p-4 ${style}`}><div className="flex items-center gap-2 opacity-55">{icon}<span className="text-[8px] font-black uppercase tracking-[.12em]">{label}</span></div><p className="mt-2 text-2xl font-black">{value}</p></div>;
}
