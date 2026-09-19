"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronRight, Mail, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OpsButton, OpsEmptyState, OpsPopover } from "./operations-ui";
import {
  notificationCategories,
  notificationCategoryLabels,
  notificationEmailModeLabels,
  notificationEmailModes,
  type NotificationPreferences,
  type OperationsNotification,
} from "./notifications/notification-data";

import { NotificationIcon } from "./notifications/notification-icon";

type NotificationResponse = {
  notifications: OperationsNotification[];
  unread_count: number;
  preferences: NotificationPreferences;
  email_configured: boolean;
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

export function OperationsNotificationCentre() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const result = await response.json() as NotificationResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load notifications.");
      setData(result);
      setDraft((current) => current ?? result.preferences);
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


  const recent = useMemo(() => data?.notifications.slice(0, 12) ?? [], [data]);
  const unread = data?.unread_count ?? 0;

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
    if (!item.read_at) {
      try { await post({ action: "mark_read", notificationId: item.id }); } catch { /* Navigation is still useful if read tracking fails. */ }
    }
    setOpen(false);
    setSettingsOpen(false);
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

  async function savePreferences() {
    if (!draft) return;
    setBusy(true);
    try {
      await post({ action: "save_preferences", emailMode: draft.email_mode, categories: draft.categories });
      await load();
      setSettingsOpen(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not save notification preferences.");
    } finally { setBusy(false); }
  }

  return (
    <OpsPopover.Root open={open} onOpenChange={(value) => { setOpen(value); setSettingsOpen(false); if (value) void load(); }}>
      <OpsPopover.Trigger asChild>
      <button
        type="button"
        className="app-icon-button app-notification-toggle"
        aria-label={unread ? `Open notifications, ${unread} unread` : "Open notifications"}
        aria-expanded={open}
      >
        <Bell size={16} strokeWidth={1.75}/>
        {unread ? <span className="app-notification-count">{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      </OpsPopover.Trigger>

      <OpsPopover.Content align="end" sideOffset={10} collisionPadding={12} className="app-notification-panel" aria-label="Notifications">
        <div className="flex items-center gap-3 border-b border-[var(--admin-line)] px-4 py-3.5">
          <div className="min-w-0 flex-1"><p className="text-[length:var(--app-font-size)] font-semibold text-[var(--admin-ink)]">Notifications</p><p className="mt-0.5 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{error ? "Could not refresh notifications" : !data ? "Loading notifications…" : unread ? `${unread} unread` : "You’re caught up"}</p></div>
          {unread ? <OpsButton size="sm" variant="ghost" disabled={busy} onClick={() => void markAllRead()}><CheckCheck size={13} strokeWidth={1.75}/>Mark all read</OpsButton> : null}
          <button type="button" onClick={() => setSettingsOpen((current) => !current)} aria-expanded={settingsOpen} className={`app-icon-button ${settingsOpen ? "bg-[var(--admin-surface-muted)] text-[var(--admin-crimson)]" : ""}`} aria-label="Notification preferences"><Settings2 size={14} strokeWidth={1.75}/></button>
          <button type="button" onClick={() => setOpen(false)} className="app-icon-button" aria-label="Close notifications"><X size={14} strokeWidth={1.75}/></button>
        </div>

        {settingsOpen && draft ? <div className="border-b border-[var(--admin-line)] bg-[var(--admin-canvas)] p-4">
          <div className="flex items-start gap-2.5"><Mail size={14} strokeWidth={1.75} className="mt-0.5 text-[var(--admin-crimson)]"/><div className="min-w-0 flex-1"><p className="text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">Delivery preferences</p><p className="mt-1 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Choose when KCPL should email you in addition to in-app notifications.</p></div></div>
          <select aria-label="Email notification delivery" className="mt-3 h-10 w-full rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2.5 text-[length:var(--app-font-size)] font-medium text-[var(--admin-ink)]" value={draft.email_mode} onChange={(event) => setDraft({ ...draft, email_mode: event.target.value as NotificationPreferences["email_mode"] })}>
            {notificationEmailModes.map((mode) => <option key={mode} value={mode}>{notificationEmailModeLabels[mode]}</option>)}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-2">{notificationCategories.map((category) => <label key={category} className="flex items-center gap-2 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2.5 py-2 text-[length:var(--app-label-size)] font-medium text-[var(--admin-ink)]"><input type="checkbox" checked={draft.categories[category]} onChange={(event) => setDraft({ ...draft, categories: { ...draft.categories, [category]: event.target.checked } })}/>{notificationCategoryLabels[category]}</label>)}</div>
          <div className="mt-3 flex items-center justify-between gap-3"><span className={`text-[length:var(--app-label-size)] font-medium ${data?.email_configured ? "text-[var(--admin-success)]" : "text-[var(--admin-warning)]"}`}>{data?.email_configured ? "Email delivery connected" : "Email delivery not configured"}</span><OpsButton size="sm" variant="primary" disabled={busy} onClick={() => void savePreferences()}>{busy ? "Saving…" : "Save preferences"}</OpsButton></div>
        </div> : null}

        {error ? <div className="border-b border-[var(--admin-danger)] bg-[var(--admin-danger-bg)] px-4 py-2.5 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-danger)]">{error}</div> : null}

        <div className="max-h-[460px] overflow-y-auto">
          {recent.length ? recent.map((item) => {
            const unreadItem = !item.read_at && !item.resolved;
            return <button key={item.id} type="button" onClick={() => void openNotification(item)} className={`flex w-full items-start gap-3 border-b border-[var(--admin-line)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--admin-canvas)] ${unreadItem ? "bg-[var(--admin-surface-soft)]" : "bg-[var(--admin-surface)]"}`}>
              <NotificationIcon category={item.category} severity={item.severity} resolved={item.resolved}/>
              <span className="min-w-0 flex-1"><span className="flex items-start gap-2"><strong className={`min-w-0 flex-1 text-[length:var(--app-label-size)] leading-4 ${unreadItem ? "font-semibold text-[var(--admin-ink)]" : "font-medium text-[var(--admin-muted)]"}`}>{item.title}</strong><small className="shrink-0 text-[length:var(--app-label-size)] font-medium text-[var(--admin-faint)]">{timeLabel(item.created_at)}</small></span><span className="mt-1 block line-clamp-2 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">{item.detail}</span><span className="mt-1.5 flex items-center gap-2 text-[length:var(--app-label-size)] font-medium text-[var(--admin-faint)]"><span>{notificationCategoryLabels[item.category]}</span>{unreadItem ? <span className="app-unread-label">Unread</span> : null}{item.branch ? <><span>·</span><span>{item.branch}</span></> : null}{item.resolved ? <><span>·</span><span className="text-[var(--admin-success)]">Resolved</span></> : null}</span></span>
              <ChevronRight size={13} strokeWidth={1.75} className="mt-1 shrink-0 text-[var(--admin-faint)]"/>
            </button>;
          }) : <OpsEmptyState compact icon={<Bell size={20}/>} title={error ? "Notifications unavailable" : !data ? "Loading notifications…" : "You’re all caught up"} description={error ? "Try again to retrieve your latest activity." : !data ? "Retrieving your activity." : "Assignments and updates will appear here."} action={error ? <OpsButton size="sm" onClick={() => void load()}>Try again</OpsButton> : undefined}/>}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--admin-line)] bg-[var(--admin-canvas)] px-4 py-2.5"><span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{data ? `${recent.length} recent update${recent.length === 1 ? "" : "s"}` : "Activity"}</span><OpsButton size="sm" variant="ghost" onClick={() => { setOpen(false); router.push("/admin/notifications"); }}>Open notification centre</OpsButton></div>
      </OpsPopover.Content>
    </OpsPopover.Root>
  );
}
