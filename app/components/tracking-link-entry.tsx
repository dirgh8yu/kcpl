"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { siteTranslator, type SiteLocale } from "../site-i18n";
import { trackingTokenFromInput } from "../tracking/tracking-link-input";

export function TrackingLinkEntry({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = trackingTokenFromInput(value);
    if (!token) {
      setError(t("track.link_invalid"));
      return;
    }
    setError("");
    router.push(`/t/${token}`);
  }

  return <div className="track-box">
    <form className="box-form" onSubmit={open} noValidate>
      <label>
        <span>{t("track.link_label")}</span>
        <input
          value={value}
          onChange={(event) => { setValue(event.target.value); if (error) setError(""); }}
          placeholder={t("track.link_placeholder")}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "track-link-error" : undefined}
        />
      </label>
      <button type="submit" className="btn">{t("track.link_action")}<ArrowUpRight size={17} weight="bold" aria-hidden="true"/></button>
    </form>
    {error ? <p id="track-link-error" className="form-error" role="alert">{error}</p> : null}
  </div>;
}
