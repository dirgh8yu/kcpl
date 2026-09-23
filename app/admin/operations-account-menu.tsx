"use client";

import { useRouter } from "next/navigation";
import { Building2, CircleUserRound, Gauge, KeyRound, LogOut, RefreshCw, ShieldCheck, UserRoundCog, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OpsButton } from "./operations-ui";
import { NotificationPreferencesEditor } from "./notifications/notification-preferences-editor";
import { type NotificationPreferences } from "./notifications/notification-data";
import { displayDensityLabels, displayDensities, displayMotionLabels, displayMotions, type DisplayPreferences } from "./notifications/display-preferences";

export type AccountTab = "identity" | "notifications" | "display" | "session";

type AccountProfile = {
  uid: string;
  name: string;
  email: string;
  job_title: string | null;
  role: string;
  role_label: string;
  branch_scope: "all" | "selected";
  branches: string[];
  can_access_all_branches: boolean;
};

type AccountResponse = { ok: true; profile: AccountProfile };

type NotificationSettingsResponse = {
  preferences: NotificationPreferences;
  email_configured: boolean;
};

const densityHints: Record<DisplayPreferences["density"], string> = {
  comfortable: "Standard row heights and spacing",
  compact: "Tighter rows — more records on screen",
};

const motionHints: Record<DisplayPreferences["motion"], string> = {
  full: "Standard transitions and motion",
  reduced: "Minimal motion, applied across KCPL",
};

/** Account panel embedded on the shell's profile button — the settings surface
 * for the signed-in operator, organised as tabs so future settings have a home
 * instead of one growing scroll: Identity (role and branch scope, directory
 * controlled), Notifications (the shared delivery-preferences editor), Display
 * (per-staff density and motion, persisted) and Session (refresh and sign-out).
 * Fully controlled by the shell: it owns `open` and the active tab, so the
 * profile button always opens on Identity while the bell's settings icon
 * deep-links straight to Notifications. Read-only on authority fields: staff
 * mutations stay in the management-only People & Branches workspace. */
export function OperationsAccountMenu({ userName, isManagement, signOutPath, open, tab, onTabChange, onClose, triggerRef }: {
  userName: string;
  isManagement: boolean;
  signOutPath: string;
  open: boolean;
  tab: AccountTab;
  onTabChange: (tab: AccountTab) => void;
  onClose: () => void;
  /** The profile button that toggles this panel: clicks on it are the
   * trigger's own toggle, not an outside dismissal. */
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<NotificationSettingsResponse | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<NotificationPreferences | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [display, setDisplay] = useState<DisplayPreferences | null>(null);
  const [displayBusy, setDisplayBusy] = useState(false);
  const [displayError, setDisplayError] = useState("");
  const [displayNotice, setDisplayNotice] = useState<"" | "saved" | "reset">("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/profile", { cache: "no-store" });
      const result = await response.json() as AccountResponse & { error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not load your profile.");
      setProfile(result.profile);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Notification settings load once, on the tab's first activation — the panel
  // never fetches them for an operator who only checks their identity or signs out.
  const loadSettings = useCallback(async () => {
    setSettingsBusy(true);
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const result = await response.json() as NotificationSettingsResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load notification settings.");
      setSettings({ preferences: result.preferences, email_configured: result.email_configured });
      setSettingsDraft((current) => current ?? result.preferences);
      setSettingsError("");
    } catch (loadError) {
      setSettingsError(loadError instanceof Error ? loadError.message : "Could not load notification settings.");
    } finally {
      setSettingsBusy(false);
    }
  }, []);

  const loadDisplay = useCallback(async () => {
    setDisplayBusy(true);
    try {
      const response = await fetch("/api/admin/display-preferences", { cache: "no-store" });
      const result = await response.json() as { ok: true; preferences: DisplayPreferences } & { error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not load display settings.");
      setDisplay(result.preferences);
      setDisplayError("");
    } catch (loadError) {
      setDisplayError(loadError instanceof Error ? loadError.message : "Could not load display settings.");
    } finally {
      setDisplayBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // The loader's first state change is its own busy flag, set before an
    // await; the cascade this rule guards against needs a render-triggering
    // value, which a busy flag is not.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open || tab !== "notifications" || settings) return;
    // The loader's first state change is its own busy flag, set before an
    // await; the cascade this rule guards against needs a render-triggering
    // value, which a busy flag is not.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSettings();
  }, [open, tab, settings, loadSettings]);

  useEffect(() => {
    if (!open || tab !== "display" || display) return;
    // The loader's first state change is its own busy flag, set before an
    // await; the cascade this rule guards against needs a render-triggering
    // value, which a busy flag is not.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDisplay();
  }, [open, tab, display, loadDisplay]);

  useEffect(() => {
    if (!open) return;
    function outside(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || triggerRef?.current?.contains(target)) return;
      onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open, onClose, triggerRef]);

  async function savePreferences() {
    if (!settingsDraft) return;
    setSettingsBusy(true);
    setSettingsSaved(false);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save_preferences", emailMode: settingsDraft.email_mode, categories: settingsDraft.categories, transitionDesks: settingsDraft.transition_desks }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save notification preferences.");
      setSettingsError("");
      setSettingsSaved(true);
      window.setTimeout(() => setSettingsSaved(false), 4000);
    } catch (saveError) {
      setSettingsError(saveError instanceof Error ? saveError.message : "Could not save notification preferences.");
    } finally {
      setSettingsBusy(false);
    }
  }

  // Display choices save immediately on selection — no extra button. The
  // response carries the persisted value; only then do we broadcast
  // `kcpl:display-preferences-changed`, which the layout bootstrap applies to
  // the route root so the change is felt without a reload. A failure reverts
  // the radio to the last persisted state and surfaces the error.
  async function saveDisplay(next: DisplayPreferences) {
    const previous = display;
    setDisplay(next);
    setDisplayBusy(true);
    setDisplayNotice("");
    try {
      const response = await fetch("/api/admin/display-preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ density: next.density, motion: next.motion }),
      });
      const result = await response.json() as { ok?: boolean; preferences?: DisplayPreferences; error?: string };
      if (!response.ok || !result.ok || !result.preferences) throw new Error(result.error || "Could not save display settings.");
      setDisplay(result.preferences);
      setDisplayError("");
      setDisplayNotice("saved");
      window.setTimeout(() => setDisplayNotice(""), 4000);
      window.dispatchEvent(new CustomEvent("kcpl:display-preferences-changed", { detail: { preferences: result.preferences } }));
    } catch (saveError) {
      setDisplayError(saveError instanceof Error ? saveError.message : "Could not save display settings.");
      if (previous) setDisplay(previous);
    } finally {
      setDisplayBusy(false);
    }
  }

  // Reset deletes the stored doc; the server answers with the defaults, the
  // radios and the route root follow, and the operator is back to the
  // never-customised state on every device.
  async function resetDisplay() {
    setDisplayBusy(true);
    setDisplayNotice("");
    try {
      const response = await fetch("/api/admin/display-preferences", { method: "DELETE" });
      const result = await response.json() as { ok?: boolean; preferences?: DisplayPreferences; error?: string };
      if (!response.ok || !result.ok || !result.preferences) throw new Error(result.error || "Could not reset display settings.");
      setDisplay(result.preferences);
      setDisplayError("");
      setDisplayNotice("reset");
      window.setTimeout(() => setDisplayNotice(""), 4000);
      window.dispatchEvent(new CustomEvent("kcpl:display-preferences-changed", { detail: { preferences: result.preferences } }));
    } catch (resetError) {
      setDisplayError(resetError instanceof Error ? resetError.message : "Could not reset display settings.");
    } finally {
      setDisplayBusy(false);
    }
  }

  // Roving tabindex across the tab list: arrow keys move, Home/End jump.
  function onTabListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const order: AccountTab[] = ["identity", "notifications", "display", "session"];
    const index = order.indexOf(tab);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % order.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + order.length) % order.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = order.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onTabChange(order[next]);
  }

  if (!open) return null;

  const displayName = profile?.name ?? userName;

  return (
    <div ref={rootRef} className="app-account-panel" role="dialog" aria-label="Account and settings">
      <div className="flex items-start gap-3 border-b border-[var(--admin-line)] px-4 py-3.5">
        <span className="app-avatar" aria-hidden="true">{initialsOf(displayName)}</span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[length:var(--app-font-size)] font-semibold text-[var(--admin-ink)]">{displayName}</p>
          <p className="m-0 truncate text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{profile ? (profile.job_title ? `${profile.job_title} · ${profile.role_label}` : profile.role_label) : isManagement ? "Management" : "KCPL staff"}</p>
        </div>
      </div>

      {error ? <div className="border-b border-[var(--admin-danger)] bg-[var(--admin-danger-bg)] px-4 py-2.5 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-danger)]">{error}</div> : null}

      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- a
        * tablist is not itself a tab stop: the tabs carry the roving tabindex
        * and this handler sees their keys by bubbling. Making the container
        * focusable would add a stop the ARIA pattern says should not exist. */}
      <div role="tablist" aria-label="Settings sections" onKeyDown={onTabListKeyDown} className="app-account-tabs flex items-center gap-1 border-b border-[var(--admin-line)] px-2 py-1.5">
        {/* Four fixed tabs, spelled out so the tab↔panel wiring stays greppable.
         * Roving tabindex: only the active tab is in the tab order; the
         * tablist's keydown handler moves focus and selection together. */}
        <button type="button" role="tab" id="account-tab-identity" aria-selected={tab === "identity"} aria-controls="account-panel-identity" tabIndex={tab === "identity" ? 0 : -1} onClick={() => onTabChange("identity")} className="app-account-tab">Identity</button>
        <button type="button" role="tab" id="account-tab-notifications" aria-selected={tab === "notifications"} aria-controls="account-panel-notifications" tabIndex={tab === "notifications" ? 0 : -1} onClick={() => onTabChange("notifications")} className="app-account-tab">Notifications</button>
        <button type="button" role="tab" id="account-tab-display" aria-selected={tab === "display"} aria-controls="account-panel-display" tabIndex={tab === "display" ? 0 : -1} onClick={() => onTabChange("display")} className="app-account-tab">Display</button>
        <button type="button" role="tab" id="account-tab-session" aria-selected={tab === "session"} aria-controls="account-panel-session" tabIndex={tab === "session" ? 0 : -1} onClick={() => onTabChange("session")} className="app-account-tab">Session</button>
      </div>

      <div className="max-h-[min(440px,calc(100dvh-200px))] overflow-y-auto">
        <div role="tabpanel" id="account-panel-identity" aria-labelledby="account-tab-identity" hidden={tab !== "identity"} className="px-4 py-3">
          <p className="m-0 mb-2 flex items-center gap-2 text-[length:var(--app-text-xs)] font-semibold uppercase tracking-[.04em] text-[var(--admin-faint)]"><CircleUserRound size={13} strokeWidth={1.75} aria-hidden="true"/>Identity &amp; access</p>
          <dl className="m-0 grid gap-2">
            <div className="min-w-0"><dt className="m-0 text-[length:var(--app-label-size)] font-medium text-[var(--admin-faint)]">Email</dt><dd className="m-0 truncate text-[length:var(--app-label-size)] font-medium text-[var(--admin-ink)]">{loading && !profile ? "Loading…" : profile?.email ?? "—"}</dd></div>
            <div className="min-w-0"><dt className="m-0 text-[length:var(--app-label-size)] font-medium text-[var(--admin-faint)]">Role</dt><dd className="m-0 flex items-center gap-1.5 text-[length:var(--app-label-size)] font-medium text-[var(--admin-ink)]"><ShieldCheck size={12} strokeWidth={1.75} className="shrink-0 text-[var(--admin-success)]" aria-hidden="true"/>{profile?.role_label ?? "—"}</dd></div>
            <div className="min-w-0"><dt className="m-0 text-[length:var(--app-label-size)] font-medium text-[var(--admin-faint)]">Branch scope</dt><dd className="m-0 text-[length:var(--app-label-size)] font-medium text-[var(--admin-ink)]">{profile ? (profile.can_access_all_branches ? "All branches" : profile.branches.join(", ") || "—") : "—"}</dd></div>
          </dl>
          <p className="m-0 mt-2.5 flex items-start gap-1.5 text-[length:var(--app-text-xs)] leading-4 text-[var(--admin-faint)]"><Building2 size={12} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>Role and branch scope are managed by KCPL management in People &amp; Branches.</p>
          {profile?.role === "management" ? <OpsButton size="sm" variant="secondary" className="mt-2.5" onClick={() => { onClose(); router.push("/admin/staff"); }}><UserRoundCog size={13} strokeWidth={1.75}/>Manage people &amp; branches</OpsButton> : null}
        </div>

        <div role="tabpanel" id="account-panel-notifications" aria-labelledby="account-tab-notifications" hidden={tab !== "notifications"} className="px-4 py-3">
          {settingsError ? <div className="mb-2.5 rounded-[var(--app-radius)] border border-[var(--admin-danger)] bg-[var(--admin-danger-bg)] px-2.5 py-2 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-danger)]">{settingsError}</div> : null}
          {settingsDraft ? <NotificationPreferencesEditor draft={settingsDraft} onChange={setSettingsDraft} emailConfigured={settings?.email_configured ?? false} busy={settingsBusy} onSave={() => void savePreferences()}/>
            : <p className="m-0 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">{settingsError ? "Notification settings could not be loaded." : "Loading notification settings…"}</p>}
          {settingsSaved ? <p className="m-0 mt-2 text-[length:var(--app-label-size)] font-medium text-[var(--admin-success)]" role="status">Preferences saved.</p> : null}
        </div>

        <div role="tabpanel" id="account-panel-display" aria-labelledby="account-tab-display" hidden={tab !== "display"} className="px-4 py-3">
          <p className="m-0 mb-2 flex items-center gap-2 text-[length:var(--app-text-xs)] font-semibold uppercase tracking-[.04em] text-[var(--admin-faint)]"><Gauge size={13} strokeWidth={1.75} aria-hidden="true"/>Display</p>
          <p className="m-0 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Choose how dense the workspace feels and how much motion KCPL uses. Saved to your KCPL account and applied across the app.</p>
          {displayError ? <div className="mt-2.5 rounded-[var(--app-radius)] border border-[var(--admin-danger)] bg-[var(--admin-danger-bg)] px-2.5 py-2 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-danger)]">{displayError}</div> : null}
          {display ? <>
            <div role="radiogroup" aria-label="Density" className="mt-3 grid gap-2">
              {displayDensities.map((density) => (
                <label key={density} className={`flex items-start gap-2 rounded-[var(--app-radius)] border px-2.5 py-2 text-[length:var(--app-label-size)] ${display.density === density ? "border-[var(--admin-crimson)] bg-[var(--admin-surface)] font-semibold text-[var(--admin-ink)]" : "border-[var(--admin-line)] bg-[var(--admin-surface)] font-medium text-[var(--admin-ink)]"}`}>
                  <input type="radio" name="account-display-density" value={density} checked={display.density === density} disabled={displayBusy} onChange={() => void saveDisplay({ ...display, density })}/>
                  <span className="min-w-0">{displayDensityLabels[density]}<span className="mt-0.5 block font-normal text-[var(--admin-faint)]">{densityHints[density]}</span></span>
                </label>
              ))}
            </div>
            <div role="radiogroup" aria-label="Motion" className="mt-3 grid gap-2">
              {displayMotions.map((motion) => (
                <label key={motion} className={`flex items-start gap-2 rounded-[var(--app-radius)] border px-2.5 py-2 text-[length:var(--app-label-size)] ${display.motion === motion ? "border-[var(--admin-crimson)] bg-[var(--admin-surface)] font-semibold text-[var(--admin-ink)]" : "border-[var(--admin-line)] bg-[var(--admin-surface)] font-medium text-[var(--admin-ink)]"}`}>
                  <input type="radio" name="account-display-motion" value={motion} checked={display.motion === motion} disabled={displayBusy} onChange={() => void saveDisplay({ ...display, motion })}/>
                  <span className="min-w-0">{displayMotionLabels[motion]}<span className="mt-0.5 block font-normal text-[var(--admin-faint)]">{motionHints[motion]}</span></span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="m-0 text-[length:var(--app-text-xs)] leading-4 text-[var(--admin-faint)]" role="status">{displayNotice === "saved" ? "Display preferences saved." : displayNotice === "reset" ? "Display preferences reset." : displayBusy ? "Saving…" : "Choices apply immediately."}</p>
              <OpsButton size="sm" variant="ghost" disabled={displayBusy || (display.density === "comfortable" && display.motion === "full")} onClick={() => void resetDisplay()}>Reset to defaults</OpsButton>
            </div>
          </> : <p className="m-0 mt-2 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">{displayError ? "Display settings could not be loaded." : "Loading display settings…"}</p>}
        </div>

        <div role="tabpanel" id="account-panel-session" aria-labelledby="account-tab-session" hidden={tab !== "session"} className="px-4 py-3">
          <p className="m-0 mb-2 flex items-center gap-2 text-[length:var(--app-text-xs)] font-semibold uppercase tracking-[.04em] text-[var(--admin-faint)]"><KeyRound size={13} strokeWidth={1.75} aria-hidden="true"/>Session</p>
          <p className="m-0 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">You are signed in with a secure KCPL session. Sessions end automatically after 12 hours, or when you sign out.</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <OpsButton size="sm" variant="secondary" onClick={() => { onClose(); router.refresh(); }}><RefreshCw size={13} strokeWidth={1.75}/>Refresh workspace data</OpsButton>
            <a className="ops-button" href={signOutPath}>Sign out<LogOut size={13} strokeWidth={1.75}/></a>
          </div>
          <p className="m-0 mt-3 flex items-start gap-1.5 text-[length:var(--app-text-xs)] leading-4 text-[var(--admin-faint)]"><Users size={12} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>Need a hand? KCPL management can adjust your access from People &amp; Branches.</p>
        </div>
      </div>
    </div>
  );
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";
}
