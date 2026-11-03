"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { company } from "../company-data";
import { captureQuoteAttribution } from "../quote-attribution";
import type { SiteLocale } from "../site-i18n";
import { requestChallengeToken, turnstileSiteKey } from "./turnstile-challenge";
import { trackAnalyticsEvent } from "./analytics";
import { quoteCopy } from "./quote-copy";
import type { QuoteValues } from "./quote-enquiry";

type Mode = "air" | "sea" | "road" | "unsure";

const modeOrder: Mode[] = ["air", "sea", "road", "unsure"];

export function QuoteConcierge({
  locale,
  initial,
  title,
  intro,
}: {
  locale: SiteLocale;
  initial: QuoteValues;
  title: string;
  intro: string;
}) {
  const c = quoteCopy[locale];
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState(initial.origin ?? "");
  const [destination, setDestination] = useState(initial.destination ?? "");
  const [mode, setMode] = useState<Mode | "">((initial.mode as Mode) || "");
  const [cargo, setCargo] = useState("");
  const [weight, setWeight] = useState(initial.weight ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState("");
  const successHeading = useRef<HTMLHeadingElement>(null);
  const modeLabels: Record<Mode, string> = { air: c.air, sea: c.sea, road: c.road, unsure: c.unsure };

  useEffect(() => {
    if (reference) successHeading.current?.focus();
  }, [reference]);

  function validate(stepIndex: number) {
    if (stepIndex === 0 && (!origin.trim() || !destination.trim())) return c.invalid;
    if (stepIndex === 1 && !mode) return c.chooseMode;
    if (stepIndex === 3) {
      if (!name.trim() || !email.trim()) return c.invalid;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return c.invalid;
    }
    return "";
  }

  function next() {
    const message = validate(step);
    if (message) { setError(message); return; }
    setError("");
    if (step < 3) setStep((value) => value + 1);
  }

  function back() {
    setError("");
    setStep((value) => Math.max(0, value - 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) { next(); return; }
    const message = validate(3);
    if (message) { setError(message); return; }
    if (submitting) return;
    setSubmitting(true);
    setError("");
    let failure = c.error;
    try {
      const siteKey = turnstileSiteKey();
      const challengeToken = siteKey ? await requestChallengeToken(siteKey) : "";
      const attribution = captureQuoteAttribution({
        search: window.location.search,
        referrer: document.referrer,
        pathname: window.location.pathname,
      });
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          mode,
          cargoType: cargo,
          weight,
          weightUnit: "kg",
          timing: "",
          requirements: "",
          contactName: name,
          contactEmail: email,
          companyName,
          phone,
          website: "",
          challengeToken,
          attribution,
        }),
      });
      const result = await response.json() as { ok?: boolean; reference?: string; error?: string };
      if (!response.ok || !result.ok || !result.reference) {
        failure = locale === "en" ? result.error || c.error
          : response.status === 503 ? c.unavailable
          : response.status === 429 ? c.rateLimited
          : response.status === 403 ? c.verification
          : response.status === 400 ? c.invalid : c.error;
        throw new Error(failure);
      }
      setReference(result.reference);
      trackAnalyticsEvent("quote_submitted");
    } catch (reason) {
      setError(reason instanceof Error && locale === "en" ? reason.message : failure);
      trackAnalyticsEvent("quote_submission_failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return <section className="quote-concierge">
      <div className="quote-concierge-media">
        <Image src="/images/unsplash/ship-dusk.jpg" alt="" fill priority sizes="(max-width: 980px) 100vw, 44vw" className="quote-concierge-image"/>
        <div className="quote-concierge-scrim"/>
        <div className="quote-concierge-media-inner">
          <span className="quote-concierge-kicker">{company.shortName} · {c.review}</span>
          <h1 className="quote-concierge-title">{title}</h1>
          <p className="quote-concierge-intro">{intro}</p>
        </div>
        <div className="quote-concierge-meta"><span>Kathmandu</span><span>Birgunj</span><span>Kolkata</span></div>
      </div>
      <div className="quote-concierge-panel">
        <div className="quote-concierge-card quote-concierge-success">
          <CheckCircle size={32} weight="light" aria-hidden="true"/>
          <h2 ref={successHeading} tabIndex={-1}>{c.received}</h2>
          <p>{c.receivedCopy}</p>
          <code>{reference}</code>
          <p className="quote-concierge-note">{c.success(reference)}</p>
          <a href={`mailto:${company.email}?subject=${encodeURIComponent(`Quote ${reference}`)}`} className="quote-concierge-link">{company.email} <ArrowRight size={15} aria-hidden="true"/></a>
        </div>
      </div>
    </section>;
  }

  return <section className="quote-concierge">
    <div className="quote-concierge-media">
      <Image src="/images/unsplash/ship-dusk.jpg" alt="" fill priority sizes="(max-width: 980px) 100vw, 44vw" className="quote-concierge-image"/>
      <div className="quote-concierge-scrim"/>
      <div className="quote-concierge-media-inner">
        <span className="quote-concierge-kicker">{company.shortName} · {c.review}</span>
        <h1 className="quote-concierge-title">{title}</h1>
        <p className="quote-concierge-intro">{intro}</p>
      </div>
      <div className="quote-concierge-meta"><span>Kathmandu</span><span>Birgunj</span><span>Kolkata</span></div>
    </div>
    <div className="quote-concierge-panel">
      <form className="quote-concierge-card" onSubmit={submit} noValidate aria-busy={submitting} onChange={() => { if (error) setError(""); }}>
        <div className="quote-concierge-progress">
          <span>{c.stepProgress(step + 1, 4)}</span>
          <span>{c.review}</span>
        </div>
        <div className="quote-concierge-progress-bar"><i style={{ width: `${((step + 1) / 4) * 100}%` }}/></div>
        {error ? <p className="quote-concierge-error" role="alert">{error}</p> : null}

        <div className={`quote-concierge-step${step === 0 ? " is-active" : ""}`} aria-hidden={step !== 0}>
          <h2>{c.route}</h2>
          <p>{c.cityCountry}</p>
          <div className="quote-concierge-grid">
            <label><span>{c.origin}</span><input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder={c.cityCountry} autoComplete="address-level2" maxLength={120}/></label>
            <label><span>{c.destination}</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={c.cityCountry} autoComplete="address-level2" maxLength={120}/></label>
          </div>
        </div>

        <div className={`quote-concierge-step${step === 1 ? " is-active" : ""}`} aria-hidden={step !== 1}>
          <h2>{c.mode}</h2>
          <p>{c.chooseMode}</p>
          <div className="quote-concierge-modes">
            {modeOrder.map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setError(""); }}>{modeLabels[value]}<small>{value === "air" ? "Fastest" : value === "sea" ? "Gateway routing" : value === "road" ? "Cross-border" : "Help me choose"}</small></button>)}
          </div>
        </div>

        <div className={`quote-concierge-step${step === 2 ? " is-active" : ""}`} aria-hidden={step !== 2}>
          <h2>{c.cargo}</h2>
          <p>{c.available}</p>
          <div className="quote-concierge-grid">
            <label><span>{c.cargoType}</span><input value={cargo} onChange={(event) => setCargo(event.target.value)} placeholder={c.cargoExample} maxLength={160}/></label>
            <label><span>{c.weight}</span><input value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="0" inputMode="decimal"/></label>
          </div>
        </div>

        <div className={`quote-concierge-step${step === 3 ? " is-active" : ""}`} aria-hidden={step !== 3}>
          <h2>{c.contact}</h2>
          <p>{c.contactRequired}</p>
          <div className="quote-concierge-grid">
            <label><span>{c.name}</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder={c.nameExample} maxLength={120}/></label>
            <label><span>{c.email}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder={c.emailExample} maxLength={254}/></label>
            <label><span>{c.company}</span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} autoComplete="organization" placeholder={c.companyExample} maxLength={160}/></label>
            <label><span>{c.phone}</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder={c.phoneExample} maxLength={80}/></label>
          </div>
          <div className="quote-concierge-summary">
            <div><span>{c.route}</span><strong>{origin || c.notSet} → {destination || c.notSet}</strong></div>
            <div><span>{c.mode}</span><strong>{mode ? modeLabels[mode] : c.notSet}</strong></div>
            <div><span>{c.cargo}</span><strong>{cargo || c.notSpecified}{weight ? ` · ${weight} kg` : ""}</strong></div>
          </div>
        </div>

        <div className="quote-concierge-actions">
          <button type="button" className="quote-concierge-back" onClick={back} hidden={step === 0}>{c.back}</button>
          {step < 3
            ? <button type="button" className="quote-concierge-next" onClick={next}>{c.next}<ArrowRight size={16} aria-hidden="true"/></button>
            : <button type="submit" className="quote-concierge-next" disabled={submitting}>{submitting ? c.submitting : c.submit}<ArrowRight size={16} aria-hidden="true"/></button>}
        </div>
        <p className="quote-concierge-note">{c.privacy}</p>
      </form>
    </div>
  </section>;
}
