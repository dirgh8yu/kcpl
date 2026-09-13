"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronRight, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { notificationCategories, notificationCategoryLabels, type NotificationCategory, type NotificationPreferences, type OperationsNotification } from "./notification-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage } from "../operations-ui";

type NotificationResponse = { notifications: OperationsNotification[]; unread_count: number; preferences: NotificationPreferences; email_configured: boolean };
type StateFilter = "all" | "unread" | "read" | "resolved";
type SeverityFilter = "all" | OperationsNotification["severity"];

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}
function severityTone(severity: OperationsNotification["severity"]): "info" | "warning" | "danger" { return severity === "critical" ? "danger" : severity === "warning" ? "warning" : "info"; }

function Metric({ label, value, active, alert, onClick }: { label: string; value: number; active?: boolean; alert?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`min-h-[108px] border-b border-[#D6D6D0] px-4 py-5 text-left transition-colors hover:bg-[#EEEEE8] sm:border-b-0 sm:border-r sm:last:border-r-0 ${active ? "bg-[#EEEEE8]" : ""}`}><span className="flex items-center justify-between text-[10px] uppercase tracking-[0.07em] text-[#5B5B57]"><span>{label}</span>{active ? <span className="h-2 w-2 bg-[#DC143C]"/> : null}</span><strong className={`mt-4 block text-[32px] font-normal leading-none tracking-[-0.045em] ${alert && value ? "text-[#DC143C]" : "text-[#101010]"}`}>{value}</strong></button>;
}

export function NotificationsWorkspace() {
  const router = useRouter();
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | NotificationCategory>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const result = await response.json() as NotificationResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Notification history could not be loaded.");
      setData(result); setError("");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Notification history could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 30_000);
    function focus() { void load(); }
    window.addEventListener("focus", focus);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("focus", focus); };
  }, [load]);

  const notifications = useMemo(() => data?.notifications ?? [], [data?.notifications]);
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return notifications.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (severity !== "all" && item.severity !== severity) return false;
      if (state === "unread" && (item.read_at || item.resolved)) return false;
      if (state === "read" && (!item.read_at || item.resolved)) return false;
      if (state === "resolved" && !item.resolved) return false;
      if (!terms.length) return true;
      const haystack = [item.title, item.detail, item.branch ?? "", item.source_id, notificationCategoryLabels[item.category], item.severity].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [category, notifications, query, severity, state]);

  const counts = useMemo(() => ({ unread: notifications.filter((item) => !item.read_at && !item.resolved).length, critical: notifications.filter((item) => item.severity === "critical" && !item.resolved).length, warning: notifications.filter((item) => item.severity === "warning" && !item.resolved).length, resolved: notifications.filter((item) => item.resolved).length }), [notifications]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Notification action failed.");
  }
  async function openNotification(item: OperationsNotification) {
    if (!item.read_at) { try { await post({ action: "mark_read", notificationId: item.id }); } catch { /* destination remains usable */ } }
    router.push(item.action_path || "/admin/alerts");
  }
  async function markAllRead() {
    setBusy(true);
    try { await post({ action: "mark_all_read" }); await load(); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Notifications could not be marked as read."); }
    finally { setBusy(false); }
  }
  function reset() { setQuery(""); setCategory("all"); setState("all"); setSeverity("all"); }

  return <OpsPage><main className="min-h-[calc(100vh-64px)] bg-[#F6F6F3] text-[#101010]"><div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
    <header className="grid gap-6 border-b border-[#101010] pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><div><p className="text-[10px] uppercase tracking-[0.11em] text-[#DC143C]">Operations · Signal log</p><h1 className="mt-3 text-[clamp(36px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.04em]">Notification Centre</h1><p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#5B5B57]">Your retained operational signal history across assignments and automation alerts. Unread work stays visible without turning the page into a transient topbar feed.</p><p className="mt-3 text-[10px] uppercase tracking-[0.05em] text-[#8A8A84]">Auto-refresh · 30 seconds · Nepal time</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8] disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/>Refresh</button>{counts.unread ? <button type="button" onClick={() => void markAllRead()} disabled={busy} className="inline-flex h-10 items-center gap-2 border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white hover:border-[#B61032] hover:bg-[#B61032] disabled:opacity-50"><CheckCheck size={13}/>{busy ? "Updating…" : "Mark all read"}</button> : null}</div></header>

    <section className="grid border-b border-[#D6D6D0] sm:grid-cols-4"><Metric label="Unread" value={counts.unread} alert active={state === "unread"} onClick={() => setState(state === "unread" ? "all" : "unread")}/><Metric label="Critical" value={counts.critical} alert active={severity === "critical"} onClick={() => setSeverity(severity === "critical" ? "all" : "critical")}/><Metric label="Warnings" value={counts.warning} alert active={severity === "warning"} onClick={() => setSeverity(severity === "warning" ? "all" : "warning")}/><Metric label="Resolved" value={counts.resolved} active={state === "resolved"} onClick={() => setState(state === "resolved" ? "all" : "resolved")}/></section>

    {error ? <div className="mt-5"><OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice></div> : null}
    <section className="mt-6 border-y border-[#D6D6D0]">
      <div className="grid gap-3 border-b border-[#101010] py-4 lg:grid-cols-[minmax(260px,1fr)_190px_150px_160px_auto]"><label className="flex h-10 items-center border border-[#BDBDB6] bg-white px-3"><Search size={13} className="mr-2 text-[#777771]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notification, branch, reference or detail" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8A8A84]"/></label><select className="ops-select" value={category} onChange={(event) => setCategory(event.target.value as "all" | NotificationCategory)}><option value="all">All categories</option>{notificationCategories.map((item) => <option key={item} value={item}>{notificationCategoryLabels[item]}</option>)}</select><select className="ops-select" value={state} onChange={(event) => setState(event.target.value as StateFilter)}><option value="all">All states</option><option value="unread">Unread</option><option value="read">Read</option><option value="resolved">Resolved</option></select><select className="ops-select" value={severity} onChange={(event) => setSeverity(event.target.value as SeverityFilter)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select><button type="button" onClick={reset} className="h-10 border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Reset</button></div>

      <div className="hidden min-h-11 grid-cols-[110px_170px_minmax(260px,1fr)_180px_150px_24px] items-center gap-4 border-b border-[#101010] px-3 text-[10px] uppercase tracking-[0.06em] text-[#5B5B57] lg:grid"><span>State</span><span>Category</span><span>Signal</span><span>Branch / source</span><span>Time</span><span/></div>
      {loading && !data ? <div className="py-12 text-center text-[11px] text-[#777771]">Loading notification history…</div> : filtered.length ? <div>{filtered.map((item) => {
        const unread = !item.read_at && !item.resolved;
        return <button key={item.id} type="button" onClick={() => void openNotification(item)} className={`group relative grid w-full gap-3 border-b border-[#D6D6D0] px-3 py-4 text-left last:border-b-0 lg:grid-cols-[110px_170px_minmax(260px,1fr)_180px_150px_24px] lg:items-start ${unread ? "bg-white hover:bg-[#EEEEE8]" : "opacity-75 hover:bg-[#EEEEE8]"}`}>{unread ? <span className="absolute bottom-2 left-0 top-2 w-[2px] bg-[#DC143C]"/> : null}<div className="flex flex-wrap gap-1.5">{item.resolved ? <OpsBadge tone="success">Resolved</OpsBadge> : unread ? <OpsBadge tone="accent">Unread</OpsBadge> : <OpsBadge>Read</OpsBadge>}<OpsBadge tone={severityTone(item.severity)}>{item.severity}</OpsBadge></div><p className="text-[10px] font-medium uppercase tracking-[0.04em] text-[#5B5B57]">{notificationCategoryLabels[item.category]}</p><div className="min-w-0"><strong className={`block text-[13px] tracking-[-0.01em] ${unread ? "font-medium text-[#101010]" : "font-normal text-[#4F4F4A]"}`}>{item.title}</strong><p className="mt-1 text-[11px] leading-5 text-[#666660]">{item.detail}</p></div><div className="text-[10px] leading-5 text-[#666660]"><p>{item.branch || "No branch"}</p><p className="mt-1"><OpsMono>{item.source_id}</OpsMono></p></div><p className="text-[9px] leading-4 text-[#777771]">{dateTime(item.created_at)}</p><ChevronRight size={14} className="text-[#A0A09A] transition-transform group-hover:translate-x-0.5 group-hover:text-[#DC143C]"/></button>;
      })}</div> : <div className="py-12"><OpsEmptyState kind={notifications.length ? "search" : "healthy"} icon={<Bell size={17}/>} title={notifications.length ? "No notifications match" : "No notifications yet"} description={notifications.length ? "Change the search or filters to widen the history." : "Assignment notices and freight automation alerts will appear here."}/></div>}
    </section>

    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#101010] pt-4 text-[10px] uppercase tracking-[0.05em] text-[#777771]"><span>{filtered.length} of {notifications.length} retained signals shown</span><span>{data?.email_configured ? "Email channel configured" : "In-app channel active"}</span></div>
  </div></main></OpsPage>;
}
