"use client";

import { useState } from "react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../admin/operations-ui";
import { portalTranslator, type PortalLocale } from "../portal-i18n";
import type { TextNoticeSettings } from "../portal-text-notices";

/** SMS or WhatsApp: a number, and the customer's agreement to use it. */
export function PortalTextNoticesPanel({
  initial,
  channels,
  locale,
}: {
  initial: TextNoticeSettings;
  channels: { sms: boolean; whatsapp: boolean };
  locale: PortalLocale;
}) {
  const t = portalTranslator(locale);
  const [channel, setChannel] = useState<string>(initial.channel);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [consent, setConsent] = useState(initial.channel !== "none");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/portal/text-notices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, phone, consent }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "");
      setMessage({ tone: "success", text: t("text.saved") });
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error && error.message ? error.message : t("settings.save_failed") });
    } finally {
      setBusy(false);
    }
  }

  const options: Array<[string, string, boolean]> = [
    ["none", t("text.none"), true],
    ["sms", t("text.sms"), channels.sms],
    ["whatsapp", t("text.whatsapp"), channels.whatsapp],
  ];
  return (
    <OpsSurface eyebrow={t("text.eyebrow")} title={t("text.title")} description={t("text.description")}>
      <div className="portal-text-notices">
        <div role="radiogroup" className="portal-text-channels">
          {options.map(([value, label, available]) => (
            <label key={value} className="portal-pickup-check">
              <input type="radio" name="text-channel" value={value} checked={channel === value} disabled={!available || busy} onChange={() => setChannel(value)}/>
              {label}{available ? "" : ` · ${t("text.unavailable")}`}
            </label>
          ))}
        </div>
        {channel !== "none" ? (
          <>
            <OpsField label={t("text.phone")}>
              <input type="tel" inputMode="tel" autoComplete="tel" value={phone} placeholder="+977 98…" onChange={(event) => setPhone(event.target.value)}/>
            </OpsField>
            <label className="portal-pickup-check portal-text-consent">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/>
              <span>{t("text.consent")}</span>
            </label>
          </>
        ) : null}
        <div><OpsButton variant="primary" disabled={busy} onClick={save}>{t("text.save")}</OpsButton></div>
        {message ? <OpsNotice tone={message.tone}>{message.text}</OpsNotice> : null}
      </div>
    </OpsSurface>
  );
}
