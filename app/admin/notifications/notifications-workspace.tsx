"use client";

import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Bell, CheckCheck, Download, FileText, Link2, RefreshCw, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { shipmentStatusLabels, type ShipmentStatus } from "../../shipment-types";
import { notificationCategories, notificationCategoryLabels, type NotificationCategory, type NotificationPreferences, type OperationsNotification } from "./notification-data";
import { isRegisterTransition, nptDayStart as dayStart, sparklineBuckets } from "./transition-metrics";
import { csvRow } from "../management/csv-export-policy";
import {
  OpsButton,
  OpsEmptyState,
  OpsFilterSelect,
  OpsKpiRail,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsRailMetric,
  OpsRegisterToolbar,
  OpsScopeTabs,
  OpsSearch,
} from "../operations-ui";
import { useWorkspaceQuery } from "../use-workspace-query";

type NotificationResponse = { notifications: OperationsNotification[]; unread_count: number; preferences: NotificationPreferences; email_configured: boolean };
type StateFilter = "all" | "unread" | "read" | "resolved";
type SeverityFilter = "all" | OperationsNotification["severity"];
type ViewFilter = "all" | "transitions";
type TypeIconProps = { category: NotificationCategory; severity: OperationsNotification["severity"] };

/** Shared with the ops wallboard so every surface buckets "today" the same way. */
export { isRegisterTransition, nptDayStart as dayStart, sparklineBuckets } from "./transition-metrics";

function TypeIcon({ category, severity }: TypeIconProps) {
  const color = severity === "critical" ? "var(--admin-danger)" : severity === "warning" ? "var(--admin-warning)" : "var(--admin-info)";
  if (category === "documents") return <FileText size={14} strokeWidth={1.75} style={{ color }}/>;
  if (category === "assignments") return <UserRound size={14} strokeWidth={1.75} style={{ color }}/>;
  if (category === "quotes") return <Link2 size={14} strokeWidth={1.75} style={{ color }}/>;
  return <AlertTriangle size={14} strokeWidth={1.75} style={{ color }}/>;
}

/** Shift-handover export: the exact rows currently shown in the transitions
 * view, using the hardened cell policy shared with management exports so a
 * spreadsheet can never execute a cell. */
function exportTransitionsCsv(items: OperationsNotification[]) {
  const headers = ["Reference", "Status changed to", "Previous status", "Severity", "Occurred (NPT)", "Branch", "Link"];
  const rows = items.map((item) => {
    const ref = item.title.split(" → ")[0] ?? item.source_id;
    const stamp = new Date(item.created_at);
    return [
      ref,
      item.transition_to ? shipmentStatusLabels[item.transition_to as ShipmentStatus] ?? item.transition_to : "",
      item.transition_from ? shipmentStatusLabels[item.transition_from as ShipmentStatus] ?? item.transition_from : "",
      item.severity,
      Number.isNaN(stamp.getTime()) ? item.created_at : new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kathmandu", dateStyle: "short", timeStyle: "short" }).format(stamp),
      item.branch ?? "",
      `${window.location.origin}${item.action_path}`,
    ];
  });
  const csv = [headers, ...rows].map((row) => csvRow(row)).join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kcpl-transitions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

const STATE_TABS: Array<{ value: StateFilter; label: string }> = [
  { value: "all", label: "All states" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "resolved", label: "Resolved" },
];

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
  // Transitions tab: a dedicated view over today's register status history.
  const view: ViewFilter = params.get("view") === "transitions" ? "transitions" : "all";
  // The NPT day boundary anchors "today"; derived lazily inside the counts
  // memo so no impure Date.now call happens during render.
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

  // Opening the centre is the act of catching up: record every recent
  // danger/warning activity entry as seen so the inspector's live poll only
  // rings for alerts that appear after this visit. One quiet GET + POSTs for
  // genuinely unseen items; failures stay silent — the ring is best-effort.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/admin/activity-alerts", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json() as { ok?: boolean; items?: Array<{ reference: string; id: string }> };
          if (!response.ok || !data.ok || !data.items?.length) return;
          await Promise.allSettled(data.items.map((item) =>
            fetch("/api/admin/activity-alerts", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ reference: item.reference, activityId: item.id }),
            })));
        })
        .catch(() => { /* receipt backfill is best-effort */ });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const notifications = useMemo(() => data?.notifications ?? [], [data?.notifications]);
  const counts = useMemo(() => {
    const dayStartNow = dayStart(new Date().toISOString());
    return {
    unread: notifications.filter((item) => !item.read_at && !item.resolved).length,
    critical: notifications.filter((item) => item.severity === "critical" && !item.resolved).length,
    warning: notifications.filter((item) => item.severity === "warning" && !item.resolved).length,
    resolved: notifications.filter((item) => item.resolved).length,
    transitions: notifications.filter((item) => isRegisterTransition(item) && dayStart(item.created_at) >= dayStartNow).length,
    };
  }, [notifications]);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const dayStartNow = view === "transitions" ? dayStart(new Date().toISOString()) : null;
    return notifications.filter((item) => {
      if (view === "transitions" && !(isRegisterTransition(item) && dayStartNow !== null && dayStart(item.created_at) >= dayStartNow)) return false;
      if (category !== "all" && item.category !== category) return false;
      if (severity !== "all" && item.severity !== severity) return false;
      if (state === "unread" && (item.read_at || item.resolved)) return false;
      if (state === "read" && (!item.read_at || item.resolved)) return false;
      if (state === "resolved" && !item.resolved) return false;
      if (!terms.length) return true;
      const haystack = [item.title, item.detail, item.branch ?? "", item.source_id, notificationCategoryLabels[item.category], item.severity, item.resolved ? "resolved" : item.read_at ? "read" : "unread"].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [category, notifications, query, severity, state, view]);

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
    update({ q: null, category: null, state: null, severity: null, view: null });
  }

  const setCategory = (value: "all" | NotificationCategory) => update({ category: value === "all" ? null : value });
  const setState = (value: StateFilter) => update({ state: value === "all" ? null : value });
  const setSeverity = (value: SeverityFilter) => update({ severity: value === "all" ? null : value });
  const filtersActive = Boolean(query.trim()) || category !== "all" || state !== "all" || severity !== "all" || view !== "all";

  // 7-day transition volume, bucketed on NPT day boundaries. Recomputed only
  // when the feed changes; the clock read lives in the memo (same pattern as
  // the counts above) so render stays pure.
  const sparkline = useMemo(() => {
    const now = new Date();
    const buckets = sparklineBuckets(notifications, now);
    const todayStart = dayStart(now.toISOString());
    const dayMs = 86_400_000;
    const days = buckets.map((_, index) => new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "Asia/Kathmandu" }).format(new Date(todayStart - (6 - index) * dayMs)));
    return { buckets, days };
  }, [notifications]);
  const sparklineTotal = sparkline.buckets.reduce((sum, count) => sum + count, 0);
  const sparklineMax = Math.max(...sparkline.buckets, 1);

  return <OpsPage>
    <div className="notifications-workspace-page">
      <OpsPageHeader
        eyebrow="Operational control"
        title="Notifications"
        description={view === "transitions" ? `Register status history · ${counts.transitions} transition${counts.transitions === 1 ? "" : "s"} today (NPT)` : `Activity log · ${counts.unread} unread of ${notifications.length} total · auto-refresh every 30 seconds`}
        actions={(
          <>
            {view === "transitions" ? <OpsButton variant="secondary" size="sm" onClick={() => exportTransitionsCsv(filtered)} disabled={!filtered.length} title="Download today's transition history for shift handover"><Download size={13} strokeWidth={1.75}/>Export CSV</OpsButton> : null}
            <OpsButton variant="secondary" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={13} strokeWidth={1.75} className={loading ? "app-refreshing" : ""}/>Refresh</OpsButton>
            {counts.unread > 0 ? <OpsButton variant="secondary" size="sm" onClick={() => void markAllRead()} disabled={busy}><CheckCheck size={13} strokeWidth={1.75}/>{busy ? "Updating…" : "Mark all read"}</OpsButton> : null}
          </>
        )}
      />

      <div className="px-4 pt-3 md:px-6">
        <OpsKpiRail label="Notification summary">
          <OpsRailMetric label="Unread" value={counts.unread} tone="info" active={state === "unread"} onClick={() => setState(state === "unread" ? "all" : "unread")}/>
          <OpsRailMetric label="Critical" value={counts.critical} tone="danger" active={severity === "critical"} onClick={() => setSeverity(severity === "critical" ? "all" : "critical")} title="Critical severity, unresolved"/>
          <OpsRailMetric label="Warning" value={counts.warning} tone="warning" active={severity === "warning"} onClick={() => setSeverity(severity === "warning" ? "all" : "warning")} title="Warning severity, unresolved"/>
          <OpsRailMetric label="Today's transitions" value={counts.transitions} active={view === "transitions"} onClick={() => update({ view: view === "transitions" ? null : "transitions" })} title="Register status changes today (NPT)"/>
          <OpsRailMetric label="Resolved" value={counts.resolved} tone="success" active={state === "resolved"} onClick={() => setState(state === "resolved" ? "all" : "resolved")}/>
        </OpsKpiRail>
      </div>

      <div className="px-4 pb-8 md:px-6">
        {error ? <div className="mb-3"><OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice></div> : null}

        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => update({ q: event.target.value || null })} placeholder="Search notification, branch, reference…" aria-label="Search notifications"/>}
          actions={(
            <>
              <OpsFilterSelect label="Severity" value={severity} allLabel="All severities" options={[{ value: "critical", label: `Critical (${counts.critical})` }, { value: "warning", label: `Warning (${counts.warning})` }, { value: "info", label: "Info" }]} onChange={(value) => setSeverity(value as SeverityFilter)}/>
              {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{filtered.length} shown</span>
            </>
          )}
          tabs={(
            <div className="notifications-toolbar-tabs">
              <OpsScopeTabs label="Notification view" items={[{ value: "all", label: "All notifications" }, { value: "transitions", label: "Today’s transitions", count: counts.transitions }]} value={view} onChange={(value) => update({ view: value === "all" ? null : value })}/>
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <OpsScopeTabs label="Notification category filters" items={notificationCategories.map((item) => ({ value: item, label: notificationCategoryLabels[item] }))} value={category} onChange={(value) => setCategory(value as "all" | NotificationCategory)}/>
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <OpsScopeTabs label="Notification state filters" items={STATE_TABS.map((tab) => ({ value: tab.value, label: tab.label, count: tab.value === "unread" ? counts.unread : tab.value === "resolved" ? counts.resolved : undefined }))} value={state} onChange={(value) => setState(value as StateFilter)}/>
            </div>
          )}
        />

        <section className="notifications-sparkline" aria-label="Register transitions, last 7 days">
          <div className="notifications-sparkline-head">
            <Activity size={14} strokeWidth={1.75} aria-hidden="true"/>
            <strong>Register transitions</strong>
            <span>Last 7 days (NPT)</span>
            <span className="notifications-sparkline-total">{sparklineTotal}</span>
          </div>
          <div className="notifications-sparkline-bars" role="img" aria-label={`Transitions per day: ${sparkline.days.map((day, index) => `${day} ${sparkline.buckets[index]}`).join(", ")}`}>
            {sparkline.buckets.map((count, index) => (
              <div key={index} className="notifications-sparkline-col" data-today={index === 6 || undefined} title={`${count} transition${count === 1 ? "" : "s"} · ${sparkline.days[index]}`}>
                <div className="notifications-sparkline-track">
                  <div className="notifications-sparkline-bar" style={{ height: count ? `${Math.max(12, Math.round((count / sparklineMax) * 100))}%` : undefined }}/>
                </div>
                <span className="notifications-sparkline-day" aria-hidden="true">{sparkline.days[index]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ops-surface" aria-label="Notification history">
          {loading && !data ? <OpsEmptyState compact icon={<Bell size={16} strokeWidth={1.75} aria-hidden="true"/>} title="Loading notifications" description="Retrieving retained operational signals."/> : filtered.length ? filtered.map((item) => {
            const unread = !item.read_at && !item.resolved;
            return <button key={item.id} type="button" onClick={() => void openNotification(item)} className="notifications-row" data-unread={unread || undefined} data-severity={item.severity}>
              <span className="notifications-row-icon"><TypeIcon category={item.category} severity={item.severity}/></span>
              <span className="notifications-row-main">
                <span className="notifications-row-head">
                  <span className="notifications-row-title">{item.title}</span>
                  {unread ? <span className="notifications-row-unread" aria-label="Unread"/> : null}
                  <span className="notifications-row-age">{ageLabel(item.created_at)}</span>
                </span>
                <span className="notifications-row-detail" data-unread={unread || undefined}>{item.detail}</span>
                <span className="notifications-row-context"><span>{notificationCategoryLabels[item.category]}</span><span>{item.severity}</span><span>{item.branch || "No branch"}</span><OpsMono>{item.source_id}</OpsMono>{item.resolved ? <span>Resolved</span> : item.read_at ? <span>Read</span> : <span>Unread</span>}</span>
              </span>
            </button>;
          }) : <OpsEmptyState compact kind={notifications.length ? "search" : "healthy"} icon={<Bell size={16} strokeWidth={1.75} aria-hidden="true"/>} title={notifications.length ? "No notifications match" : "No notifications yet"} description={notifications.length ? "Change the search or filters to widen the retained history." : "Assignment notices and automation alerts will appear here."} action={filtersActive ? <OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton> : undefined}/>}
        </section>

        <div className="mt-4"><OpsNotice tone="neutral">{data?.email_configured ? "In-app and email notification channels are configured." : "In-app notification history is active. Email delivery is not configured in this deployment."}</OpsNotice></div>
      </div>
    </div>
  </OpsPage>;
}
