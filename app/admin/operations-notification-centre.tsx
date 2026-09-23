"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Bell, Check, CheckCheck, ChevronDown, ChevronRight, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OpsButton } from "./operations-ui";
import {
  notificationCategoryLabels,
  type OperationsNotification,
} from "./notifications/notification-data";

type NotificationResponse = {
  notifications: OperationsNotification[];
  unread_count: number;
};

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(date);
}

function severityClasses(severity: OperationsNotification["severity"]) {
  if (severity === "critical") return "border-[var(--admin-danger)] bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]";
  if (severity === "warning") return "border-[var(--admin-warning)] bg-[var(--admin-warning-bg)] text-[var(--admin-warning)]";
  return "border-[var(--admin-info)] bg-[var(--admin-info-bg)] text-[var(--admin-info)]";
}

/** A live danger-activity alert raised by an operational poll (e.g. the
 * shipments inspector) in this session. It renders as a real notification
 * entry — category "activity", deep-linking to the exact activity item — until
 * the next feed load or dismissal. The feed's own alerts stay the source of
 * truth; this bridges the in-page poll without extra server writes. */
type LiveActivityAlert = OperationsNotification & { source: "direct" };

export function OperationsNotificationCentre() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ring, setRing] = useState(false);
  const [ringHint, setRingHint] = useState<string | null>(null);
  const [liveAlert, setLiveAlert] = useState<LiveActivityAlert | null>(null);
  // Expanded notification row: reveals the full detail, source line and in-panel
  // actions without leaving the overlay (accordion — one row at a time).
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const result = await response.json() as NotificationResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load notifications.");
      setData(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000);
    function focus() { void load(); }
    window.addEventListener("focus", focus);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("focus", focus); };
  }, [load]);

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); }
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  const recent = useMemo(() => {
    const base = data?.notifications.slice(0, 12) ?? [];
    if (!liveAlert) return base;
    return [liveAlert, ...base.filter((item) => item.id !== liveAlert.id)].slice(0, 12);
  }, [data, liveAlert]);
  const unread = (data?.unread_count ?? 0) + (liveAlert && !data?.notifications.some((item) => item.id === liveAlert.id) ? 1 : 0);

  // Operational surfaces (e.g. the shipments inspector's activity poll) fire
  // this event when they see danger-tone work; the bell pulses so the user
  // knows to look here. Purely presentational — no server writes.
  useEffect(() => {
    function ring(event: Event) {
      const detail = (event as CustomEvent<{ hint?: string; path?: string }>).detail;
      setRing(true);
      window.setTimeout(() => setRing(false), 6000);
      if (detail?.hint) setRingHint(detail.hint);
      if (detail?.path) {
        setLiveAlert({
          id: "live-activity:poll",
          source: "direct",
          source_id: "live-activity-poll",
          category: "activity",
          severity: "critical",
          title: "Live activity alert",
          detail: detail.hint ?? "A shipment logged critical operational activity.",
          action_path: detail.path,
          branch: null,
          created_at: new Date().toISOString(),
          resolved: false,
          read_at: null,
        });
      }
    }
    window.addEventListener("kcpl:activity-danger", ring);
    return () => window.removeEventListener("kcpl:activity-danger", ring);
  }, []);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Notification action failed.");
    return result;
  }

  async function openNotification(item: OperationsNotification) {
    if (item.id === "live-activity:poll") {
      // Session-local bridge entry: nothing to mark read server-side.
      setLiveAlert(null);
      setOpen(false);
      router.push(item.action_path || "/admin/alerts");
      return;
    }
    if (!item.read_at) {
      try { await post({ action: "mark_read", notificationId: item.id }); } catch { /* Navigation is still useful if read tracking fails. */ }
    }
    setOpen(false);
    router.push(item.action_path || "/admin/alerts");
    void load();
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await post({ action: "mark_all_read" });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not mark notifications as read.");
    } finally { setBusy(false); }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={ring ? `Operational alert: ${ringHint ?? "new danger activity"}` : undefined}
        onClick={() => { setOpen((current) => !current); setRing(false); if (!open) void load(); }}
        className={`app-icon-button app-notification-toggle ${ring ? "app-notification-ring" : ""}`}
        aria-label={ring ? `Operational alert: ${ringHint ?? "new danger activity"} — open notifications, ${unread} unread` : unread ? `Open notifications, ${unread} unread` : "Open notifications"}
        aria-expanded={open}
      >
        <Bell size={16} strokeWidth={1.75}/>
        {unread ? <span className="app-notification-count">{unread > 99 ? "99+" : unread}</span> : null}
      </button>

      {open ? <div className="app-notification-panel">
        <div className="flex items-center gap-3 border-b border-[var(--admin-line)] px-4 py-3.5">
          <div className="min-w-0 flex-1"><p className="text-[length:var(--app-font-size)] font-semibold text-[var(--admin-ink)]">Notifications</p><p className="mt-0.5 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{error ? "Could not refresh notifications" : !data ? "Loading notifications…" : unread ? `${unread} unread` : "You’re caught up"}</p></div>
          {unread ? <OpsButton size="sm" variant="ghost" disabled={busy} onClick={() => void markAllRead()}><CheckCheck size={13} strokeWidth={1.75}/>Mark all read</OpsButton> : null}
          <button
            type="button"
            onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent("kcpl:open-account-notifications")); }}
            className="app-icon-button"
            aria-haspopup="dialog"
            aria-label="Open notification settings"
            title="Notification settings live in your account panel"
          ><Settings2 size={14} strokeWidth={1.75}/></button>
          <button type="button" onClick={() => setOpen(false)} className="app-icon-button" aria-label="Close notifications"><X size={14} strokeWidth={1.75}/></button>
        </div>

        {error ? <div className="border-b border-[var(--admin-danger)] bg-[var(--admin-danger-bg)] px-4 py-2.5 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-danger)]">{error}</div> : null}

        <div className="max-h-[460px] overflow-y-auto">
          {recent.length ? recent.map((item) => {
            const unreadItem = !item.read_at && !item.resolved;
            const expanded = expandedId === item.id;
            return <div key={item.id} className={`border-b border-[var(--admin-line)] last:border-b-0 ${expanded ? "bg-[var(--admin-canvas)]" : ""}`}>
              <button type="button" onClick={() => setExpandedId(expanded ? null : item.id)} aria-expanded={expanded} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--admin-canvas)] ${expanded ? "" : unreadItem ? "bg-[var(--admin-surface)]" : "bg-[var(--admin-surface)]"}`}>
                <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border ${severityClasses(item.severity)} ${unreadItem ? "opacity-100" : "opacity-45"}`}/>
                <span className="min-w-0 flex-1"><span className="flex items-start gap-2"><strong className={`min-w-0 flex-1 text-[length:var(--app-label-size)] leading-4 ${unreadItem ? "font-semibold text-[var(--admin-ink)]" : "font-medium text-[var(--admin-muted)]"}`}>{item.title}</strong><small className="shrink-0 text-[length:var(--app-label-size)] font-medium text-[var(--admin-faint)]">{timeLabel(item.created_at)}</small></span><span className="mt-1 block line-clamp-2 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">{item.detail}</span><span className="mt-1.5 flex items-center gap-2 text-[length:var(--app-label-size)] font-medium text-[var(--admin-faint)]"><span>{notificationCategoryLabels[item.category]}</span>{item.branch ? <><span>·</span><span>{item.branch}</span></> : null}{item.resolved ? <><span>·</span><span className="text-[var(--admin-success)]">Resolved</span></> : null}</span></span>
                {expanded ? <ChevronDown size={13} strokeWidth={1.75} className="mt-1 shrink-0 text-[var(--admin-muted)]"/> : <ChevronRight size={13} strokeWidth={1.75} className="mt-1 shrink-0 text-[var(--admin-faint)]"/>}
              </button>
              {expanded ? <div className="border-t border-[var(--admin-line)] bg-[var(--admin-canvas)] px-4 py-2.5">
                <p className="m-0 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-ink)]">{item.detail || item.title}</p>
                <p className="m-0 mt-1 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-faint)]">{timeLabel(item.created_at)} · {item.source === "alert" ? "Automation alert" : item.source_type === "register-transition" ? "Register transition" : item.source === "direct" ? "Operational notice" : "KCPL system"}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={() => void openNotification(item)} className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[length:var(--app-label-size)] font-semibold text-[var(--admin-crimson)] hover:underline">Open <ArrowRight size={11} strokeWidth={2}/></button>
                  {!item.read_at && !item.resolved ? <button type="button" onClick={() => { void post({ action: "mark_read", notificationId: item.id }).then(load).catch(() => undefined); }} className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[length:var(--app-label-size)] font-medium text-[var(--admin-muted)] hover:text-[var(--admin-ink)] hover:underline"><Check size={11} strokeWidth={2}/>Mark read</button> : null}
                </div>
              </div> : null}
            </div>;
          }) : <div className="px-5 py-10 text-center"><Bell size={18} strokeWidth={1.75} className="mx-auto text-[var(--admin-faint)]"/><p className="mt-3 text-[length:var(--app-font-size)] font-semibold text-[var(--admin-ink)]">No notifications yet</p><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Operational assignments and alerts will appear here.</p></div>}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--admin-line)] bg-[var(--admin-canvas)] px-4 py-2.5"><span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Showing latest 12</span><OpsButton size="sm" variant="ghost" onClick={() => { setOpen(false); router.push("/admin/notifications"); }}>Open notification centre</OpsButton></div>
      </div> : null}
    </div>
  );
}
