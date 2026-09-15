"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { notificationCategories, notificationCategoryLabels, type NotificationCategory, type NotificationPreferences, type OperationsNotification } from "./notification-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface, OpsTableWrap, OpsToolbar } from "../operations-ui";

type NotificationResponse = { notifications: OperationsNotification[]; unread_count: number; preferences: NotificationPreferences; email_configured: boolean };
type StateFilter = "all" | "unread" | "read" | "resolved";
type SeverityFilter = "all" | OperationsNotification["severity"];

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function severityTone(severity: OperationsNotification["severity"]): "info" | "warning" | "danger" {
  return severity === "critical" ? "danger" : severity === "warning" ? "warning" : "info";
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
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
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

  const counts = useMemo(() => ({
    unread: notifications.filter((item) => !item.read_at && !item.resolved).length,
    critical: notifications.filter((item) => item.severity === "critical" && !item.resolved).length,
    warning: notifications.filter((item) => item.severity === "warning" && !item.resolved).length,
    resolved: notifications.filter((item) => item.resolved).length,
  }), [notifications]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Notification action failed.");
  }

  async function openNotification(item: OperationsNotification) {
    if (!item.read_at) {
      try { await post({ action: "mark_read", notificationId: item.id }); } catch { /* destination remains usable */ }
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

  function reset() {
    setQuery("");
    setCategory("all");
    setState("all");
    setSeverity("all");
  }

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Operations · Signal log"
      title="Notification Centre"
      description="Retained operational signals across assignments and automation alerts. Unread work stays visible without turning the application shell into a transient feed."
      meta={<><span>Auto-refresh every 30 seconds</span><span>Nepal time</span><span>{filtered.length} of {notifications.length} shown</span></>}
      actions={<><OpsButton variant="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "app-refreshing" : ""}/>Refresh</OpsButton>{counts.unread ? <OpsButton variant="primary" onClick={() => void markAllRead()} disabled={busy}><CheckCheck size={14}/>{busy ? "Updating…" : "Mark all read"}</OpsButton> : null}</>}
    />

    <OpsStatStrip>
      <OpsStat label="Unread" value={counts.unread} tone={counts.unread ? "accent" : "neutral"} active={state === "unread"} onClick={() => setState(state === "unread" ? "all" : "unread")}/>
      <OpsStat label="Critical" value={counts.critical} tone={counts.critical ? "danger" : "neutral"} active={severity === "critical"} onClick={() => setSeverity(severity === "critical" ? "all" : "critical")}/>
      <OpsStat label="Warnings" value={counts.warning} tone={counts.warning ? "warning" : "neutral"} active={severity === "warning"} onClick={() => setSeverity(severity === "warning" ? "all" : "warning")}/>
      <OpsStat label="Resolved" value={counts.resolved} active={state === "resolved"} onClick={() => setState(state === "resolved" ? "all" : "resolved")}/>
    </OpsStatStrip>

    <div className="ops-content-wide grid gap-4">
      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

      <OpsSurface title="Signal history" description={data?.email_configured ? "In-app and configured email signals are retained here with their source record." : "In-app signals are active. Email delivery is not configured in this deployment."} flush>
        <div className="px-4 sm:px-5">
          <OpsToolbar>
            <OpsSearch className="flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notification, branch, reference or detail"/>
            <select className="ops-select" value={category} onChange={(event) => setCategory(event.target.value as "all" | NotificationCategory)} aria-label="Filter by notification category">
              <option value="all">All categories</option>{notificationCategories.map((item) => <option key={item} value={item}>{notificationCategoryLabels[item]}</option>)}
            </select>
            <select className="ops-select" value={state} onChange={(event) => setState(event.target.value as StateFilter)} aria-label="Filter by notification state">
              <option value="all">All states</option><option value="unread">Unread</option><option value="read">Read</option><option value="resolved">Resolved</option>
            </select>
            <select className="ops-select" value={severity} onChange={(event) => setSeverity(event.target.value as SeverityFilter)} aria-label="Filter by severity">
              <option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option>
            </select>
            <OpsButton variant="secondary" onClick={reset}>Reset</OpsButton>
          </OpsToolbar>
        </div>

        {loading && !data ? <div className="p-5"><OpsEmptyState icon={<Bell size={18}/>} title="Loading notification history" description="Retrieving the retained signal log and current unread state."/></div> : filtered.length ? <OpsTableWrap>
          <table className="ops-table">
            <thead><tr><th>State</th><th>Category</th><th>Signal</th><th>Branch / source</th><th>Time</th><th>Action</th></tr></thead>
            <tbody>{filtered.map((item) => {
              const unread = !item.read_at && !item.resolved;
              return <tr key={item.id} data-selected={unread ? "true" : undefined}>
                <td><div className="flex flex-wrap gap-1"><OpsBadge tone={item.resolved ? "success" : unread ? "accent" : "neutral"}>{item.resolved ? "Resolved" : unread ? "Unread" : "Read"}</OpsBadge><OpsBadge tone={severityTone(item.severity)}>{item.severity}</OpsBadge></div></td>
                <td>{notificationCategoryLabels[item.category]}</td>
                <td><div className="max-w-xl"><strong className="block">{item.title}</strong><span className="mt-1 block text-sm text-[var(--admin-muted)]">{item.detail}</span></div></td>
                <td><span className="block">{item.branch || "No branch"}</span><span className="mt-1 block text-xs text-[var(--admin-faint)]"><OpsMono>{item.source_id}</OpsMono></span></td>
                <td className="text-xs text-[var(--admin-muted)]">{dateTime(item.created_at)}</td>
                <td className="text-right"><OpsButton size="sm" variant={unread ? "primary" : "secondary"} onClick={() => void openNotification(item)}>Open</OpsButton></td>
              </tr>;
            })}</tbody>
          </table>
        </OpsTableWrap> : <div className="p-5"><OpsEmptyState kind={notifications.length ? "search" : "healthy"} icon={<Bell size={18}/>} title={notifications.length ? "No notifications match" : "No notifications yet"} description={notifications.length ? "Change the search or filters to widen the retained history." : "Assignment notices and freight automation alerts will appear here."} action={notifications.length ? <OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton> : undefined}/></div>}
      </OpsSurface>
    </div>
  </OpsPage>;
}
