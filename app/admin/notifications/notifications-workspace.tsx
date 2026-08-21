"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  notificationCategories,
  notificationCategoryLabels,
  type NotificationCategory,
  type NotificationPreferences,
  type OperationsNotification,
} from "./notification-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";

type NotificationResponse = {
  notifications: OperationsNotification[];
  unread_count: number;
  preferences: NotificationPreferences;
  email_configured: boolean;
};

type StateFilter = "all" | "unread" | "read" | "resolved";
type SeverityFilter = "all" | OperationsNotification["severity"];

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function severityTone(severity: OperationsNotification["severity"]): "info" | "warning" | "danger" {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
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
      setData(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Notification history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 30_000);
    function focus() { void load(); }
    window.addEventListener("focus", focus);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("focus", focus); };
  }, [load]);

  const notifications = data?.notifications ?? [];
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

  const counts = useMemo(() => ({
    unread: notifications.filter((item) => !item.read_at && !item.resolved).length,
    critical: notifications.filter((item) => item.severity === "critical" && !item.resolved).length,
    warning: notifications.filter((item) => item.severity === "warning" && !item.resolved).length,
    resolved: notifications.filter((item) => item.resolved).length,
  }), [notifications]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Notification action failed.");
  }

  async function openNotification(item: OperationsNotification) {
    if (!item.read_at) {
      try { await post({ action: "mark_read", notificationId: item.id }); } catch { /* The operational destination is still useful if receipt tracking fails. */ }
    }
    router.push(item.action_path || "/admin/alerts");
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await post({ action: "mark_all_read" });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Notifications could not be marked as read.");
    } finally {
      setBusy(false);
    }
  }

  return <OpsPage>
    <OpsPageHeader eyebrow="Operations inbox" title="Notification Centre" description="The complete in-app notification history for your staff identity and branch access. Assignment notices and automation alerts stay searchable after they fall out of the topbar preview." meta={<><span>{notifications.length} retained notifications</span><span>Auto-refreshes every 30 seconds</span></>} actions={<><OpsButton variant="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={12} className={loading ? "animate-spin" : ""}/>Refresh</OpsButton>{counts.unread ? <OpsButton variant="primary" onClick={() => void markAllRead()} disabled={busy}><CheckCheck size={12}/>{busy ? "Updating…" : "Mark all read"}</OpsButton> : null}</>}/>

    <OpsStatStrip>
      <OpsStat label="Unread" value={counts.unread} tone={counts.unread ? "accent" : "neutral"} active={state === "unread"} onClick={() => setState(state === "unread" ? "all" : "unread")}/>
      <OpsStat label="Critical" value={counts.critical} tone={counts.critical ? "danger" : "neutral"} active={severity === "critical"} onClick={() => setSeverity(severity === "critical" ? "all" : "critical")}/>
      <OpsStat label="Warnings" value={counts.warning} tone={counts.warning ? "warning" : "neutral"} active={severity === "warning"} onClick={() => setSeverity(severity === "warning" ? "all" : "warning")}/>
      <OpsStat label="Resolved" value={counts.resolved} tone="success" active={state === "resolved"} onClick={() => setState(state === "resolved" ? "all" : "resolved")}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
      <OpsSurface eyebrow="History" title="Your operational notifications" description={`${filtered.length} of ${notifications.length} notifications shown.`} flush>
        <div className="ops-toolbar">
          <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notification, branch, reference or detail"/>
          <select className="ops-select" value={category} onChange={(event) => setCategory(event.target.value as "all" | NotificationCategory)}><option value="all">All categories</option>{notificationCategories.map((item) => <option key={item} value={item}>{notificationCategoryLabels[item]}</option>)}</select>
          <select className="ops-select" value={state} onChange={(event) => setState(event.target.value as StateFilter)}><option value="all">All states</option><option value="unread">Unread</option><option value="read">Read</option><option value="resolved">Resolved</option></select>
          <select className="ops-select" value={severity} onChange={(event) => setSeverity(event.target.value as SeverityFilter)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select>
          <OpsButton variant="ghost" size="sm" onClick={() => { setQuery(""); setCategory("all"); setState("all"); setSeverity("all"); }}>Reset</OpsButton>
        </div>
        {loading && !data ? <div className="p-8 text-center text-[10px] text-[#81776f]">Loading notification history…</div> : filtered.length ? <div>{filtered.map((item) => {
          const unread = !item.read_at && !item.resolved;
          return <button key={item.id} type="button" onClick={() => void openNotification(item)} className={`group flex w-full items-start gap-3 border-b border-[#eee7e1] px-4 py-4 text-left last:border-b-0 hover:bg-[#faf8f6] ${unread ? "bg-[#fffdfa]" : "bg-white"}`}>
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.severity === "critical" ? "bg-[#b65355]" : item.severity === "warning" ? "bg-[#c58a3f]" : "bg-[#6d8799]"} ${unread ? "opacity-100" : "opacity-40"}`}/>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2"><strong className={`text-[11px] ${unread ? "font-[760] text-[#443b35]" : "font-semibold text-[#665e57]"}`}>{item.title}</strong><OpsBadge tone={severityTone(item.severity)}>{item.severity}</OpsBadge>{item.resolved ? <OpsBadge tone="success">Resolved</OpsBadge> : unread ? <OpsBadge tone="accent">Unread</OpsBadge> : <OpsBadge>Read</OpsBadge>}</span>
              <span className="mt-1.5 block text-[10px] leading-5 text-[#81776f]">{item.detail}</span>
              <span className="mt-2 flex flex-wrap items-center gap-2 text-[8px] font-semibold text-[#9a9189]"><span>{notificationCategoryLabels[item.category]}</span>{item.branch ? <><span>·</span><span>{item.branch}</span></> : null}<span>·</span><span>{dateTime(item.created_at)}</span><span>·</span><OpsMono>{item.source_id}</OpsMono></span>
            </span>
            <ChevronRight size={13} className="mt-1 shrink-0 text-[#aaa29a] transition group-hover:translate-x-0.5"/>
          </button>;
        })}</div> : <OpsEmptyState kind={notifications.length ? "search" : "healthy"} icon={<Bell size={17}/>} title={notifications.length ? "No notifications match" : "No notifications yet"} description={notifications.length ? "Change the search or filters to widen the history." : "Assignment notices and freight automation alerts will appear here."}/>} 
      </OpsSurface>
    </div>
  </OpsPage>;
}
