"use client";

import { Activity, Mail } from "lucide-react";
import { OpsButton } from "../operations-ui";
import {
  notificationCategories,
  notificationCategoryLabels,
  notificationEmailModeLabels,
  notificationEmailModes,
  transitionDeskLabels,
  transitionDesks,
  type NotificationPreferences,
  type TransitionDesk,
} from "./notification-data";

const transitionDeskHints: Record<TransitionDesk, string> = {
  register: "Every register status change",
  customs: "Shipments entering or leaving customs clearance",
  delivery: "Shipments going out for delivery or completing",
};

/** The single editor for KCPL notification preferences (email mode, category
 * mutes, transition-desk subscriptions). Embedded by the bell overlay's
 * settings view and the account panel's Notifications tab. Hosts own the
 * transport: the draft arrives as controlled state and `onSave` does the POST,
 * so this component never fetches and the form can never drift between hosts. */
export function NotificationPreferencesEditor({ draft, onChange, emailConfigured, busy, onSave }: {
  draft: NotificationPreferences;
  onChange: (next: NotificationPreferences) => void;
  emailConfigured: boolean;
  busy: boolean;
  onSave: () => void;
}) {
  return <>
    <div className="flex items-start gap-2.5"><Mail size={14} strokeWidth={1.75} className="mt-0.5 text-[var(--admin-crimson)]"/><div className="min-w-0 flex-1"><p className="text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">Delivery preferences</p><p className="mt-1 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Choose when KCPL should email you in addition to in-app notifications.</p></div></div>
    <select className="mt-3 h-10 w-full rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2.5 text-[length:var(--app-font-size)] font-medium text-[var(--admin-ink)]" value={draft.email_mode} onChange={(event) => onChange({ ...draft, email_mode: event.target.value as NotificationPreferences["email_mode"] })}>
      {notificationEmailModes.map((mode) => <option key={mode} value={mode}>{notificationEmailModeLabels[mode]}</option>)}
    </select>
    <div className="mt-3 grid grid-cols-2 gap-2">{notificationCategories.map((category) => <label key={category} className="flex items-center gap-2 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2.5 py-2 text-[length:var(--app-label-size)] font-medium text-[var(--admin-ink)]"><input type="checkbox" checked={draft.categories[category]} onChange={(event) => onChange({ ...draft, categories: { ...draft.categories, [category]: event.target.checked } })}/>{notificationCategoryLabels[category]}</label>)}</div>
    <div className="mt-4 flex items-start gap-2.5"><Activity size={14} strokeWidth={1.75} className="mt-0.5 text-[var(--admin-crimson)]"/><div className="min-w-0 flex-1"><p className="text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">Transition subscriptions</p><p className="mt-1 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Choose which workspaces send you live register status-change alerts. Unsubscribed desks stop both the bell ring and their notification history.</p></div></div>
    <div className="mt-3 grid grid-cols-3 gap-2">{transitionDesks.map((desk) => <label key={desk} className="flex items-center gap-2 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] px-2.5 py-2 text-[length:var(--app-label-size)] font-medium text-[var(--admin-ink)]" title={transitionDeskHints[desk]}><input type="checkbox" checked={draft.transition_desks[desk]} onChange={(event) => onChange({ ...draft, transition_desks: { ...draft.transition_desks, [desk]: event.target.checked } })}/>{transitionDeskLabels[desk]}</label>)}</div>
    <div className="mt-3 flex items-center justify-between gap-3"><span className={`text-[length:var(--app-label-size)] font-medium ${emailConfigured ? "text-[var(--admin-success)]" : "text-[var(--admin-warning)]"}`}>{emailConfigured ? "SendGrid connected" : "SendGrid not configured"}</span><OpsButton size="sm" variant="primary" disabled={busy} onClick={onSave}>{busy ? "Saving…" : "Save preferences"}</OpsButton></div>
  </>;
}
