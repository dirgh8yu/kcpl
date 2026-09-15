"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCheck, FileText, Link2, RefreshCw, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { notificationCategories, notificationCategoryLabels, type NotificationCategory, type NotificationPreferences, type OperationsNotification } from "./notification-data";
import { OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage } from "../operations-ui";

type NotificationResponse = { notifications: OperationsNotification[]; unread_count: number; preferences: NotificationPreferences; email_configured: boolean };

type TypeIconProps = { category: NotificationCategory; severity: OperationsNotification["severity"] };

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

function TypeIcon({ category, severity }: TypeIconProps) {
  const color = severity === "critical" ? "var(--admin-danger)" : severity === "warning" ? "var(--admin-warning)" : "var(--admin-info)";
  if (category === "documents") return <FileText size={14} style={{ color }}/>;
  if (category === "assignments") return <UserRound size={14} style={{ color }}/>;
  if (category === "quotes") return <Link2 size={14} style={{ color }}/>;
  return <AlertTriangle size={14} style={{ color }}/>;
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

export function NotificationsWorkspace() {
  const router = useRouter();
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [category, setCategory] = useState<"all" | NotificationCategory>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
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
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("focus", focus); };
  }, [load]);

  const notifications = useMemo(() => data?.notifications ?? [], [data?.notifications]);
  const unreadCount = notifications.filter((item) => !item.read_at && !item.resolved).length;
  const filtered = useMemo(() => notifications.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (unreadOnly && (item.read_at || item.resolved)) return false;
    return true;
  }), [category, notifications, unreadOnly]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Notification action failed.");
  }

  async function openNotification(item: OperationsNotification) {
    if (!item.read_at) {
      try { await post({ action: "mark_read", notificationId: item.id }); } catch { /* keep destination usable */ }
    }
    router.push(item.action_path || "/admin/alerts");
  }

  async function markAllRead() {
    setBusy(true);
    try { await post({ action: "mark_all_read" }); await load(); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Notifications could not be marked as read."); }
    finally { setBusy(false); }
  }

  return <OpsPage>
    <div style={{ padding: "var(--app-page-gap)", minHeight: "calc(100dvh - var(--app-toolbar-height))" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: "32px", letterSpacing: "-.02em" }}>Notifications</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--admin-muted)" }}>Activity log · {unreadCount} unread of {notifications.length} total</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <OpsButton variant="secondary" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={loading ? "app-refreshing" : ""}/>Refresh</OpsButton>
          {unreadCount > 0 ? <OpsButton variant="secondary" size="sm" onClick={() => void markAllRead()} disabled={busy}><CheckCheck size={13}/>{busy ? "Updating…" : "Mark all read"}</OpsButton> : null}
        </div>
      </header>

      {error ? <div style={{ marginBottom: 16 }}><OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice></div> : null}

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }} role="group" aria-label="Notification filters">
        <button type="button" style={chipStyle(category === "all")} onClick={() => setCategory("all")}>All</button>
        {notificationCategories.map((item) => <button key={item} type="button" style={chipStyle(category === item)} onClick={() => setCategory(item)}>{notificationCategoryLabels[item]}</button>)}
        <button type="button" style={{ ...chipStyle(unreadOnly), marginLeft: 8 }} onClick={() => setUnreadOnly((value) => !value)}>Unread only</button>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--admin-muted)" }}>{filtered.length}</span>
      </div>

      <section style={{ border: "1px solid var(--admin-line)", borderRadius: "var(--app-surface-radius)", background: "var(--admin-surface)", overflow: "hidden" }}>
        {loading && !data ? <OpsEmptyState icon={<Bell size={18}/>} title="Loading notifications" description="Retrieving retained operational signals."/> : filtered.length ? filtered.map((item, index) => {
          const unread = !item.read_at && !item.resolved;
          return <button key={item.id} type="button" onClick={() => void openNotification(item)} style={{ display: "flex", width: "100%", gap: 12, padding: "14px 16px", border: 0, borderBottom: index < filtered.length - 1 ? "1px solid var(--admin-line)" : "none", background: unread ? "var(--admin-canvas)" : "transparent", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }}>
            <div style={{ marginTop: 1 }}><TypeIcon category={item.category} severity={item.severity}/></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: unread ? 600 : 400, fontSize: 13.5 }}>{item.title}</span>
                {unread ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--admin-crimson)", flexShrink: 0 }}/>: null}
                <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 12, color: "var(--admin-muted)" }}>{ageLabel(item.created_at)}</span>
              </div>
              <div style={{ fontSize: 13, color: unread ? "var(--admin-ink)" : "var(--admin-muted)", lineHeight: 1.4 }}>{item.detail}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4, fontSize: 11.5, color: "var(--admin-faint)" }}><span>{notificationCategoryLabels[item.category]}</span><span>{item.branch || "No branch"}</span><OpsMono>{item.source_id}</OpsMono>{item.resolved ? <span>Resolved</span> : null}</div>
            </div>
            {unread ? <span style={{ alignSelf: "flex-start", marginTop: 2, fontSize: 12, color: "var(--admin-muted)" }}>Dismiss</span> : null}
          </button>;
        }) : <OpsEmptyState kind={notifications.length ? "search" : "healthy"} icon={<Bell size={18}/>} title="No notifications" description={notifications.length ? "Nothing matches the current filters." : "Assignment notices and automation alerts will appear here."}/>} 
      </section>

      <div style={{ marginTop: 16 }}><OpsNotice tone="neutral">{data?.email_configured ? "In-app and email notification channels are configured." : "In-app notification history is active. Email delivery is not configured in this deployment."}</OpsNotice></div>
    </div>
  </OpsPage>;
}
