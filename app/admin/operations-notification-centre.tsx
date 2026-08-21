"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronRight, Mail, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  notificationCategories,
  notificationCategoryLabels,
  notificationEmailModeLabels,
  notificationEmailModes,
  type NotificationPreferences,
  type OperationsNotification,
} from "./notifications/notification-data";

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

function severityClasses(severity: OperationsNotification["severity"]) {
  if (severity === "critical") return "bg-[#fff0f0] text-[#a44547] border-[#efcccc]";
  if (severity === "warning") return "bg-[#fff7e8] text-[#8b6328] border-[#ecd8b6]";
  return "bg-[#eef3f7] text-[#597083] border-[#d8e1e8]";
}

export function OperationsNotificationCentre() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
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
    const interval = window.setInterval(() => void load(), 30_000);
    function focus() { void load(); }
    window.addEventListener("focus", focus);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("focus", focus); };
  }, [load]);

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSettingsOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); setSettingsOpen(false); }
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, []);

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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((current) => !current); setSettingsOpen(false); if (!open) void load(); }}
        className="relative grid h-9 w-9 place-items-center rounded-[9px] text-[#777069] hover:bg-white hover:text-[#3f3935]"
        aria-label={unread ? `Open notifications, ${unread} unread` : "Open notifications"}
        aria-expanded={open}
      >
        <Bell size={14}/>
        {unread ? <span className="absolute right-0.5 top-0.5 grid min-h-[15px] min-w-[15px] place-items-center rounded-full bg-[#d85f50] px-1 text-[8px] font-black leading-none text-white ring-2 ring-[#f8f7f5]">{unread > 99 ? "99+" : unread}</span> : null}
      </button>

      {open ? <div className="absolute right-0 top-11 z-[80] w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-[14px] border border-[#dcd6d0] bg-white shadow-[0_24px_70px_rgba(54,43,34,.18)]">
        <div className="flex items-center gap-3 border-b border-[#eee8e2] px-4 py-3.5">
          <div className="min-w-0 flex-1"><p className="text-[12px] font-[760] text-[#403a35]">Notifications</p><p className="mt-0.5 text-[9px] text-[#918981]">{unread ? `${unread} unread` : "You’re caught up"}</p></div>
          {unread ? <button type="button" disabled={busy} onClick={() => void markAllRead()} className="flex items-center gap-1.5 rounded-[7px] px-2 py-1.5 text-[9px] font-bold text-[#786f68] hover:bg-[#f7f4f1] disabled:opacity-50"><CheckCheck size={12}/>Mark all read</button> : null}
          <button type="button" onClick={() => setSettingsOpen((current) => !current)} className={`grid h-7 w-7 place-items-center rounded-[7px] ${settingsOpen ? "bg-[#f5e7e2] text-[#b65e4a]" : "text-[#8b837c] hover:bg-[#f7f4f1]"}`} aria-label="Notification preferences"><Settings2 size={12}/></button>
          <button type="button" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-[7px] text-[#938b84] hover:bg-[#f7f4f1]" aria-label="Close notifications"><X size={12}/></button>
        </div>

        {settingsOpen && draft ? <div className="border-b border-[#eee8e2] bg-[#faf8f6] p-4">
          <div className="flex items-start gap-2.5"><Mail size={13} className="mt-0.5 text-[#b7624e]"/><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-[#554d47]">Delivery preferences</p><p className="mt-1 text-[9px] leading-4 text-[#8c837b]">Choose when KCPL should email you in addition to in-app notifications.</p></div></div>
          <select className="mt-3 h-9 w-full rounded-[8px] border border-[#ddd6cf] bg-white px-2.5 text-[10px] font-semibold text-[#57504a]" value={draft.email_mode} onChange={(event) => setDraft({ ...draft, email_mode: event.target.value as NotificationPreferences["email_mode"] })}>
            {notificationEmailModes.map((mode) => <option key={mode} value={mode}>{notificationEmailModeLabels[mode]}</option>)}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-2">{notificationCategories.map((category) => <label key={category} className="flex items-center gap-2 rounded-[8px] border border-[#e5dfda] bg-white px-2.5 py-2 text-[9px] font-semibold text-[#655d56]"><input type="checkbox" checked={draft.categories[category]} onChange={(event) => setDraft({ ...draft, categories: { ...draft.categories, [category]: event.target.checked } })}/>{notificationCategoryLabels[category]}</label>)}</div>
          <div className="mt-3 flex items-center justify-between gap-3"><span className={`text-[8px] font-bold ${data?.email_configured ? "text-[#62806b]" : "text-[#a56b45]"}`}>{data?.email_configured ? "SendGrid connected" : "SendGrid not configured"}</span><button type="button" disabled={busy} onClick={() => void savePreferences()} className="rounded-[8px] bg-[#df7159] px-3 py-2 text-[9px] font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save preferences"}</button></div>
        </div> : null}

        {error ? <div className="border-b border-[#f0d6d3] bg-[#fff5f4] px-4 py-2.5 text-[9px] leading-4 text-[#99564e]">{error}</div> : null}

        <div className="max-h-[460px] overflow-y-auto">
          {recent.length ? recent.map((item) => {
            const unreadItem = !item.read_at && !item.resolved;
            return <button key={item.id} type="button" onClick={() => void openNotification(item)} className={`flex w-full items-start gap-3 border-b border-[#f0ebe6] px-4 py-3 text-left last:border-b-0 hover:bg-[#faf8f6] ${unreadItem ? "bg-[#fffdfb]" : "bg-white"}`}>
              <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border ${severityClasses(item.severity)} ${unreadItem ? "opacity-100" : "opacity-45"}`}/>
              <span className="min-w-0 flex-1"><span className="flex items-start gap-2"><strong className={`min-w-0 flex-1 text-[10px] leading-4 ${unreadItem ? "font-[760] text-[#453e39]" : "font-semibold text-[#6e665f]"}`}>{item.title}</strong><small className="shrink-0 text-[8px] font-semibold text-[#aaa098]">{timeLabel(item.created_at)}</small></span><span className="mt-1 block line-clamp-2 text-[9px] leading-4 text-[#8a8179]">{item.detail}</span><span className="mt-1.5 flex items-center gap-2 text-[8px] font-bold text-[#a09992]"><span>{notificationCategoryLabels[item.category]}</span>{item.branch ? <><span>·</span><span>{item.branch}</span></> : null}{item.resolved ? <><span>·</span><span className="text-[#728878]">Resolved</span></> : null}</span></span>
              <ChevronRight size={12} className="mt-1 shrink-0 text-[#aaa29a]"/>
            </button>;
          }) : <div className="px-5 py-10 text-center"><Bell size={18} className="mx-auto text-[#b4aaa2]"/><p className="mt-3 text-[10px] font-bold text-[#625a54]">No notifications yet</p><p className="mt-1 text-[9px] text-[#948b83]">Operational assignments and alerts will appear here.</p></div>}
        </div>

        <div className="flex items-center justify-between border-t border-[#eee8e2] bg-[#faf8f6] px-4 py-2.5"><span className="text-[8px] text-[#9b928a]">Auto-refreshes every 30 seconds</span><button type="button" onClick={() => { setOpen(false); router.push("/admin/alerts"); }} className="text-[9px] font-bold text-[#b65e4a]">Open Tasks & alerts</button></div>
      </div> : null}
    </div>
  );
}