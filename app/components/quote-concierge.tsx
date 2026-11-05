"use client";

import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { company } from "../company-data";
import { telHref } from "../contact-links";
import { captureQuoteAttribution } from "../quote-attribution";
import type { SiteLocale } from "../site-i18n";
import { requestChallengeToken, turnstileSiteKey } from "./turnstile-challenge";
import { trackAnalyticsEvent } from "./analytics";
import { quoteCopy } from "./quote-copy";
import type { QuoteValues } from "./quote-enquiry";

type Mode = "air" | "sea" | "road" | "unsure";

const modeOrder: Mode[] = ["sea", "air", "road", "unsure"];
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const neverChanges = () => () => {};

/* The query is read in the browser rather than on the server, so the page stays static
 * and the CDN can serve it while the server sleeps. A link with values remounts the form
 * once, on load, with them filled in. */
export function QuoteConcierge({ locale, title, intro }: { locale: SiteLocale; title: string; intro: string }) {
  const search = useSyncExternalStore(neverChanges, () => window.location.search, () => "");
  return <QuoteForm key={search} locale={locale} initial={Object.fromEntries(new URLSearchParams(search))} title={title} intro={intro}/>;
}

/* Two steps: the least that lets KCPL reply comes first, the rest second. */
function QuoteForm({
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
  const [mode, setMode] = useState<Mode>(modeOrder.includes(initial.mode as Mode) ? initial.mode as Mode : "sea");
  const [cargo, setCargo] = useState("");
  const [weight, setWeight] = useState(initial.weight ?? "");
  const [timing, setTiming] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState("");
  const successHeading = useRef<HTMLHeadingElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const modeLabels: Record<Mode, string> = { air: c.air, sea: c.sea, road: c.road, unsure: c.unsure };

  useEffect(() => {
    if (reference) successHeading.current?.focus();
  }, [reference]);

  useEffect(() => {
    if (step === 1) stepHeading.current?.focus();
  }, [step]);

  function firstStepError() {
    if (!origin.trim() || !destination.trim() || !validEmail.test(email.trim())) return c.invalid;
    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    // The first field needing attention gets the focus; aria-invalid marks the rest.
    const focusFirstInvalid = () => requestAnimationFrame(() => form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
    if (step === 0) {
      const message = firstStepError();
      setError(message);
      setChecked(Boolean(message));
      if (message) focusFirstInvalid();
      else setStep(1);
      return;
    }
    if (!name.trim() || firstStepError()) { setError(c.invalid); setChecked(true); focusFirstInvalid(); return; }
    setChecked(false);
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
          timing,
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

  return (
    <section className="quote">
      <div className="quote-side">
        <h1 className="page-title">{title}</h1>
        <p className="page-intro">{intro}</p>
        <p className="quote-promise">{c.replyTime}</p>
        <p className="quote-call">{c.orCall} <a href={telHref(company.phones[0])} data-analytics-event="call_tap">{company.phones[0]}</a></p>
      </div>

      {reference ? (
        <div className="quote-card">
          <CheckCircle size={32} aria-hidden="true"/>
          <h2 ref={successHeading} tabIndex={-1}>{c.received}</h2>
          <p>{c.receivedCopy} {c.replyTime}</p>
          <code>{reference}</code>
          <p>{c.packing}</p>
          <a href={`mailto:${company.email}?subject=${encodeURIComponent(`Quote ${reference}`)}`} className="text-link">{company.email}<ArrowRight size={15} weight="bold" aria-hidden="true"/></a>
        </div>
      ) : (
        <form className="quote-card" onSubmit={submit} noValidate aria-busy={submitting} onChange={() => { if (error) { setError(""); setChecked(false); } }}>
          <ol className="quote-steps" aria-label={c.stepProgress(step + 1, 2)}>
            <li aria-current={step === 0 ? "step" : undefined}><i aria-hidden="true"/>{c.route}</li>
            <li aria-current={step === 1 ? "step" : undefined}><i aria-hidden="true"/>{c.contact}</li>
          </ol>
          {step === 0 ? <>
            <h2>{c.routeTitle}</h2>
            <div className="quote-route">
              <label className="field"><span>{c.origin}</span><input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder={c.cityCountry} autoComplete="off" maxLength={120} enterKeyHint="next" aria-required="true" aria-invalid={checked && !origin.trim() ? true : undefined}/></label>
              <label className="field"><span>{c.destination}</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={c.cityCountry} autoComplete="off" maxLength={120} enterKeyHint="next" aria-required="true" aria-invalid={checked && !destination.trim() ? true : undefined}/></label>
            </div>
            <fieldset className="mode-field">
              <legend>{c.mode}</legend>
              <div>
                {modeOrder.map((value) => (
                  <label key={value}><input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)}/><span>{modeLabels[value]}</span></label>
                ))}
              </div>
            </fieldset>
            <label className="field"><span>{c.replyTo}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder={c.emailExample} maxLength={254} enterKeyHint="next" aria-required="true" aria-invalid={checked && !validEmail.test(email.trim()) ? true : undefined}/></label>
          </> : <>
            <h2 ref={stepHeading} tabIndex={-1}>{c.detailsTitle}</h2>
            <p className="quote-hint">{c.detailsCopy}</p>
            <div className="quote-fields">
              <label className="field"><span>{c.name}</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder={c.nameExample} maxLength={120} aria-required="true" aria-invalid={checked && !name.trim() ? true : undefined}/></label>
              <label className="field"><span>{c.company}</span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} autoComplete="organization" placeholder={c.companyExample} maxLength={160}/></label>
              <label className="field"><span>{c.phone}</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder={c.phoneExample} maxLength={80}/></label>
              <label className="field"><span>{c.timing}</span><input value={timing} onChange={(event) => setTiming(event.target.value)} placeholder={c.timingExample} maxLength={120}/></label>
              <label className="field"><span>{c.cargoType}</span><input value={cargo} onChange={(event) => setCargo(event.target.value)} placeholder={c.cargoExample} maxLength={160}/></label>
              <label className="field"><span>{c.weight} (kg)</span><input value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="0" inputMode="decimal" maxLength={40}/></label>
            </div>
            <p className="quote-summary"><b>{origin} <ArrowRight size={14} weight="bold" aria-label={c.destination}/> {destination}</b> · {modeLabels[mode]} · {email}</p>
          </>}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="quote-actions">
            {step === 1 ? <button type="button" className="text-link" onClick={() => { setError(""); setChecked(false); setStep(0); }}>{c.back}</button> : null}
            <button type="submit" className="btn" disabled={submitting}>{step === 0 ? c.next : submitting ? c.submitting : c.submit}<ArrowRight size={17} weight="bold" aria-hidden="true"/></button>
          </div>
          <p className="quote-hint">{c.privacy}</p>
        </form>
      )}
    </section>
  );
}
