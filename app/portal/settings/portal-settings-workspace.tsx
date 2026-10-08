"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import {
  OpsDetailGrid,
  OpsDetailItem,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsSurface,
} from "../../admin/operations-ui";
import {
  portalNotificationTopicHint,
  portalNotificationTopicLabel,
  portalNotificationTopics,
  type PortalNotificationPreferences,
  type PortalNotificationTopic,
} from "../portal-notifications";
import {
  portalLocaleLabels,
  portalLocales,
  portalTranslator,
  type PortalLocale,
} from "../portal-i18n";
import type { PortalRole } from "../portal-access-policy";
import type { PortalTeamMember } from "../portal-accounts.server";
import { PortalPushControl } from "../portal-push-control";
import { PortalTeamPanel } from "./portal-team-panel";

export function PortalSettingsWorkspace({
  email,
  role,
  initialPreferences,
  topics,
  team,
  locale,
  pushPublicKey,
  textNotices,
}: {
  email: string;
  role: PortalRole;
  initialPreferences: PortalNotificationPreferences;
  /** The topics this login is offered; invoices only with finance access. */
  topics?: readonly PortalNotificationTopic[];
  /** Null for anyone who is not an account owner. */
  team: PortalTeamMember[] | null;
  locale: PortalLocale;
  /** Empty when KCPL has not configured VAPID keys, which hides the control. */
  pushPublicKey: string;
  /** SMS / WhatsApp: rendered by the page, which reads the account's setting. */
  textNotices?: React.ReactNode;
}) {
  const t = portalTranslator(locale);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function changeLanguage(next: PortalLocale) {
    if (next === locale || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/portal/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || t("settings.language_failed"));
      // A full reload rather than a refresh: the language is read on the
      // server for every surface, including the chrome around this page.
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.language_failed"));
      setBusy(false);
    }
  }

  async function save(next: PortalNotificationPreferences) {
    const previous = preferences;
    setPreferences(next);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/portal/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || t("settings.save_failed"));
      setNotice(t("settings.saved"));
    } catch (reason) {
      // Put the switch back where it was: a toggle that stays flipped after a
      // failed save is a lie about what KCPL will send.
      setPreferences(previous);
      setError(reason instanceof Error ? reason.message : t("settings.save_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsPage>
      <OpsPageHeader title={t("settings.title")}/>
      <div className="ops-content">
        <div className="ops-stack portal-stack">
          {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
          {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

          <OpsSurface title={t("settings.language")}>
            <div className="portal-language-choice" role="group" aria-label={t("settings.language")}>
              <Languages size={16} strokeWidth={1.75} aria-hidden="true"/>
              {portalLocales.map((option) => (
                <button
                  key={option}
                  type="button"
                  lang={option}
                  data-active={option === locale ? "true" : undefined}
                  aria-pressed={option === locale}
                  disabled={busy}
                  onClick={() => void changeLanguage(option)}
                >
                  {portalLocaleLabels[option]}
                </button>
              ))}
            </div>
          </OpsSurface>

          <OpsSurface title={t("settings.email_title")}>
            <ul className="portal-toggle-list">
              {(topics ?? portalNotificationTopics).map((topic) => (
                <li key={topic}>
                  {/* The topic's own name labels its checkbox, and the whole
                      row toggles it; an "On" beside a ticked box only repeats
                      the tick. */}
                  <label className="portal-toggle-main" htmlFor={`topic-${topic}`}>
                    <strong id={`topic-${topic}-label`}>{portalNotificationTopicLabel(topic, locale)}</strong>
                    <span id={`topic-${topic}-hint`}>{portalNotificationTopicHint(topic, locale)}</span>
                  </label>
                  <label className="portal-toggle" htmlFor={`topic-${topic}`}>
                    <input
                      id={`topic-${topic}`}
                      type="checkbox"
                      aria-labelledby={`topic-${topic}-label`}
                      aria-describedby={`topic-${topic}-hint`}
                      checked={preferences[topic]}
                      disabled={busy}
                      onChange={(event) => void save({ ...preferences, [topic]: event.target.checked })}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </OpsSurface>

          {pushPublicKey ? <PortalPushControl publicKey={pushPublicKey} locale={locale}/> : null}

          {textNotices}

          {team ? <PortalTeamPanel initialTeam={team} currentEmail={email} locale={locale}/> : null}

          {/* An owner sees their own row, and its access, in the team list.
              Anyone else is told what this login can do and who changes it;
              the name and email are already in the header. */}
          {team ? null : (
            <OpsSurface title={t("settings.login_title")}>
              <OpsDetailGrid columns={3}>
                <OpsDetailItem label={t("settings.access_level")}>{t(`role.${role}`)}</OpsDetailItem>
              </OpsDetailGrid>
              <p className="portal-footnote">{t("settings.provisioning_note")}</p>
            </OpsSurface>
          )}
        </div>
      </div>
    </OpsPage>
  );
}
