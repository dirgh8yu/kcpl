"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCheck, FileText, Link2, RefreshCw, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { notificationCategories, notificationCategoryLabels, type NotificationCategory, type NotificationPreferences, type OperationsNotification } from "./notification-data";
import { OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsSearch, OpsStat, OpsStatStrip } from "../operations-ui";
import { useWorkspaceQuery } from "../use-workspace-query";

type NotificationResponse = { notifications: OperationsNotification[]; unread_count: number; preferences: NotificationPreferences; email_configured: boolean };
type StateFilter = "all" | "unread" | "read" | "resolved";
type SeverityFilter = "all" | OperationsNotification["severity"];
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

const selectStyle: React.CSSProperties = {
  minHeight: "var(--app-control-height)",
  padding: "0 30px 0 10px",
  border: "1px solid var(--admin-line)",
  borderRadius: "var(--app-radius)",
  background: "var(--admin-surface)",
  color: "var(--admin-ink)",
  font: "inherit",
  fontSize: 13,
};

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
  const { params, update } = useWorkspaceQuery();
  const query = params.get("q") ?? "";
  const categoryValue = params.get("category");
  const category: "all" | NotificationCategory = notificationCategories.includes(categoryValue as NotificationCategory) ? categoryValue as NotificationCategory : "all";
  const stateValue = params.get("state");
  const state: StateFilter = stateValue === "unread" || stateValue === "read" || stateValue === "resolved" ? stateValue : "all";
  const severityValue = params.get("severity");
  const severity: SeverityFilter = severityValue === "critical" || severityValue === "warning" || severityValue === "info" ? severityValue : "all";
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
  const counts = useMemo(() => ({
    unread: notifications.filter((item) => !item.read_at && !item.resolved).length,
    critical: notifications.filter((item) => item.severity === "critical" && !item.resolved).length,
    warning: notifications.filter((item) => item.severity === "warning" && !item.resolved).length,
    resolved: notifications.filter((item) => item.resolved).length,
  }), [notifications]);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return notifications.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (severity !== "all" && item.severity !== severity) return false;
      if (state === "unread" && (item.read_at || item.resolved)) return false;
      if (state === "read" && (!item.read_at || item.resolved)) return false;
      if (state === "resolved" && !item.resolved) return false;
      if (!terms.length) return true;
      const haystack = [item.title, item.detail, item.branch ?? "", item.source_id, notificationCategoryLabels[item.category], item.severity, item.resolved ? "resolved" : item.read_at ? "read" : "unread"].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [category, notifications, query, severity, state]);

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

  function reset() {
    update({ q: null, category: null, state: null, severity: null });
  }

  const setCategory = (value: "all" | NotificationCategory) => update({ category: value === "all" ? null : value });
  const setState = (value: StateFilter) => update({ state: value === "all" ? null : value });
  const setSeverity = (value: SeverityFilter) => update({ severity: value === "all" ? null : value });
  const filtersActive = Boolean(query.trim()) || category !== "all" || state !== "all" || severity !== "all";

  return <OpsPage>
    <div className="notifications-workspace-page">
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: "32px", letterSpacing: "-.02em" }}>Notifications</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--admin-muted)" }}>Activity log · {counts.unread} unread of {notifications.length} total · auto-refresh every 30 seconds</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <OpsButton variant="secondary" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={loading ? "app-refreshing" : ""}/>Refresh</OpsButton>
          {counts.unread > 0 ? <OpsButton variant="secondary" size="sm" onClick={() => void markAllRead()} disabled={busy}><CheckCheck size={13}/>{busy ? "Updating…" : "Mark all read"}</OpsButton> : null}
        </div>
      </header>

      {error ? <div style={{ marginBottom: 16 }}><OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice></div> : null}

      <OpsStatStrip className="notifications-stat-strip">
        <OpsStat label="Unread" value={counts.unread} detail="Needs attention" tone={counts.unread ? "warning" : "success"} active={state === "unread"} onClick={() => setState("unread")} />
        <OpsStat label="Critical" value={counts.critical} detail="Unread or unresolved" tone={counts.critical ? "danger" : "success"} active={severity === "critical"} onClick={() => setSeverity("critical")} />
        <OpsStat label="Warnings" value={counts.warning} detail="Operational follow-up" tone={counts.warning ? "warning" : "neutral"} active={severity === "warning"} onClick={() => setSeverity("warning")} />
        <OpsStat label="Resolved" value={counts.resolved} detail="Retained history" tone="neutral" active={state === "resolved"} onClick={() => setState("resolved")} />
      </OpsStatStrip>

      <div className="notifications-workspace-toolbar">
        <OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null })} placeholder="Search notification, branch, reference…" aria-label="Search notifications"/>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Notification category filters">
          <button type="button" style={chipStyle(category === "all")} onClick={() => setCategory("all")}>All categories</button>
          {notificationCategories.map((item) => <button key={item} type="button" style={chipStyle(category === item)} onClick={() => setCategory(item)}>{notificationCategoryLabels[item]}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Notification state filters">
          <button type="button" style={chipStyle(state === "all")} onClick={() => setState("all")}>All states</button>
          <button type="button" style={chipStyle(state === "unread")} onClick={() => setState("unread")}>Unread {counts.unread}</button>
          <button type="button" style={chipStyle(state === "read")} onClick={() => setState("read")}>Read</button>
          <button type="button" style={chipStyle(state === "resolved")} onClick={() => setState("resolved")}>Resolved {counts.resolved}</button>
        </div>
        <select value={severity} onChange={(event) => setSeverity(event.target.value as SeverityFilter)} aria-label="Filter by notification severity" style={selectStyle}><option value="all">All severities</option><option value="critical">Critical ({counts.critical})</option><option value="warning">Warning ({counts.warning})</option><option value="info">Info</option></select>
        {filtersActive ? <OpsButton size="sm" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--admin-muted)" }}>{filtered.length} shown</span>
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4, fontSize: 11.5, color: "var(--admin-faint)" }}><span>{notificationCategoryLabels[item.category]}</span><span>{item.severity}</span><span>{item.branch || "No branch"}</span><OpsMono>{item.source_id}</OpsMono>{item.resolved ? <span>Resolved</span> : item.read_at ? <span>Read</span> : <span>Unread</span>}</div>
            </div>
          </button>;
        }) : <OpsEmptyState kind={notifications.length ? "search" : "healthy"} icon={<Bell size={18}/>} title={notifications.length ? "No notifications match" : "No notifications yet"} description={notifications.length ? "Change the search or filters to widen the retained history." : "Assignment notices and automation alerts will appear here."} action={filtersActive ? <OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton> : undefined}/>} 
      </section>

      <div style={{ marginTop: 16 }}><OpsNotice tone="neutral">{data?.email_configured ? "In-app and email notification channels are configured." : "In-app notification history is active. Email delivery is not configured in this deployment."}</OpsNotice></div>
    </div>
  </OpsPage>;
}