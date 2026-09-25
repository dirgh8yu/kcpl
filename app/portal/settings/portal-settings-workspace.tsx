"use client";

import { useState } from "react";
import { BellRing, Languages, Mail, ShieldCheck } from "lucide-react";
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
  customerName,
  role,
  initialPreferences,
  topics,
  emailConfigured,
  team,
  locale,
  pushPublicKey,
  textNotices,
}: {
  email: string;
  customerName: string;
  role: PortalRole;
  initialPreferences: PortalNotificationPreferences;
  /** The topics this login is offered; invoices only with finance access. */
  topics?: readonly PortalNotificationTopic[];
  emailConfigured: boolean;
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
      <OpsPageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />
      <div className="ops-content">
        <div className="ops-stack portal-stack">
          {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
          {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

          {!emailConfigured ? (
            <OpsNotice tone="warning">{t("settings.email_unconfigured")}</OpsNotice>
          ) : null}

          <OpsSurface
            eyebrow={t("settings.language")}
            title={t("settings.language")}
            description={t("settings.language_hint")}
          >
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

          <OpsSurface
            eyebrow={t("settings.email_eyebrow")}
            title={t("settings.email_title")}
            description={t("settings.email_description")}
          >
            <ul className="portal-toggle-list">
              {(topics ?? portalNotificationTopics).map((topic) => (
                <li key={topic}>
                  <span className="portal-toggle-main">
                    <strong>{portalNotificationTopicLabel(topic, locale)}</strong>
                    <span>{portalNotificationTopicHint(topic, locale)}</span>
                  </span>
                  <label className="portal-toggle" htmlFor={`topic-${topic}`}>
                    <input
                      id={`topic-${topic}`}
                      type="checkbox"
                      checked={preferences[topic]}
                      disabled={busy}
                      onChange={(event) => void save({ ...preferences, [topic]: event.target.checked })}
                    />
                    <span>{preferences[topic] ? t("settings.on") : t("settings.off")}</span>
                  </label>
                </li>
              ))}
            </ul>
          </OpsSurface>

          {pushPublicKey ? <PortalPushControl publicKey={pushPublicKey} locale={locale}/> : null}

          {textNotices}

          {team ? <PortalTeamPanel initialTeam={team} currentEmail={email} locale={locale}/> : null}

          <OpsSurface eyebrow={t("settings.login_eyebrow")} title={t("settings.login_title")}>
            <OpsDetailGrid columns={3}>
              <OpsDetailItem label={t("settings.signed_in_as")}>{email}</OpsDetailItem>
              <OpsDetailItem label={t("settings.account")}>{customerName}</OpsDetailItem>
              <OpsDetailItem label={t("settings.access_level")}>{t(`role.${role}`)}</OpsDetailItem>
            </OpsDetailGrid>
            <p className="portal-footnote">
              <ShieldCheck size={14} aria-hidden="true"/> {t("settings.provisioning_note")}
            </p>
          </OpsSurface>

          <p className="portal-footnote">
            <Mail size={14} aria-hidden="true"/> {t("settings.footnote_email")}
            <BellRing size={14} aria-hidden="true"/> {t("settings.footnote_topics")}
          </p>
        </div>
      </div>
    </OpsPage>
  );
}
