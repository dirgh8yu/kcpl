"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { quoteCopy } from "./quote-copy";

type Mode = "sea" | "air" | "road" | "unsure";

export function HomeRoutePlanner({ locale, variant = "bar" }: { locale: SiteLocale; variant?: "bar" | "panel" }) {
  const t = siteTranslator(locale);
  const c = quoteCopy[locale];
  const [origin, setOrigin] = useState("Shanghai, China");
  const [destination, setDestination] = useState("Kathmandu, Nepal");
  const [mode, setMode] = useState<Mode>("sea");
  const modes: Array<[Mode, string]> = [["sea", c.sea], ["air", c.air], ["road", c.road], ["unsure", c.unsure]];
  const href = useMemo(() => {
    const query = new URLSearchParams({ origin, destination, mode });
    return `${sitePath(locale, "/quote")}?${query.toString()}`;
  }, [destination, locale, mode, origin]);

  if (variant === "bar") {
    return <div className="home-index-planner">
      <label><span>{c.origin}</span><input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder={c.cityCountry} autoComplete="address-level2" maxLength={120}/></label>
      <label><span>{c.destination}</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={c.cityCountry} autoComplete="address-level2" maxLength={120}/></label>
      <label><span>{c.mode}</span><select value={mode} onChange={(event) => setMode(event.target.value as Mode)} aria-label={c.mode}>{modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <a href={href}>{t("home.plan_cta")}<ArrowRight size={16} weight="bold" aria-hidden="true"/></a>
    </div>;
  }

  return <div className="home-index-panel">
    <div className="home-index-panel-head"><h2>{t("home.plan_title")}</h2><span>{c.route}</span></div>
    <div className="home-index-panel-fields">
      <label><span>{c.origin}</span><input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder={c.cityCountry} autoComplete="address-level2" maxLength={120}/></label>
      <label><span>{c.destination}</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={c.cityCountry} autoComplete="address-level2" maxLength={120}/></label>
    </div>
    <div className="home-index-panel-mode">
      <span>{c.mode}</span>
      <div>{modes.map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div>
    </div>
    <div className="home-index-panel-summary"><span>{c.route}</span><strong>{origin || c.notSet} → {destination || c.notSet}</strong><em>{modes.find(([value]) => value === mode)?.[1]}</em></div>
    <a className="home-index-panel-cta" href={href}>{t("home.plan_cta")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></a>
    <p className="home-index-panel-note">{t("home.plan_note")}</p>
  </div>;
}
