"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { requestChallengeToken, turnstileSiteKey } from "./turnstile-challenge";
import { ArrowUpRight, CheckCircle, Envelope, MapPin, Ruler, Scales } from "@phosphor-icons/react/dist/ssr";
import { company } from "../company-data";
import type { SiteLocale } from "../site-i18n";
import { trackAnalyticsEvent } from "./analytics";
import { quoteCopy } from "./quote-copy";

export type QuoteValues = {
  origin?: string;
  destination?: string;
  mode?: string;
  weight?: string;
  weightUnit?: string;
  length?: string;
  width?: string;
  height?: string;
  dimensionUnit?: string;
};

const modeLabels: Record<string, string> = {
  air: "Air freight",
  sea: "Sea freight",
  road: "Road freight",
  unsure: "Not sure yet",
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; reference: string }
  | { status: "error"; message: string };

export function QuoteEnquiry({ initial, locale = "en" }: { initial: QuoteValues; locale?: SiteLocale }) {
  const c = quoteCopy[locale];
  const [values, setValues] = useState({
    origin: initial.origin ?? "",
    destination: initial.destination ?? "",
    mode: initial.mode ?? "",
    weight: initial.weight ?? "",
    weightUnit: initial.weightUnit ?? "kg",
    length: initial.length ?? "",
    width: initial.width ?? "",
    height: initial.height ?? "",
    dimensionUnit: initial.dimensionUnit ?? "cm",
    cargoType: "",
    timing: "",
    requirements: "",
    contactName: "",
    contactEmail: "",
    companyName: "",
    phone: "",
    website: "",
  });
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const confirmationHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (submitState.status === "success") confirmationHeading.current?.focus();
  }, [submitState.status]);

  const setField = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (submitState.status !== "idle" && submitState.status !== "submitting") setSubmitState({ status: "idle" });
  };

  const dimensions = [values.length, values.width, values.height].some(Boolean)
    ? `${values.length || "—"} × ${values.width || "—"} × ${values.height || "—"} ${values.dimensionUnit}`
    : c.notProvided;
  const weight = values.weight ? `${values.weight} ${values.weightUnit}` : c.notProvided;
  const essentialCount = [values.origin, values.destination, values.mode, values.contactName, values.contactEmail]
    .filter((value) => value.trim()).length;

  const mailtoHref = useMemo(() => {
    const subjectRoute = values.origin && values.destination ? `: ${values.origin} to ${values.destination}` : "";
    const subject = encodeURIComponent(`Freight quote enquiry${subjectRoute}`);
    const body = encodeURIComponent([
      "Hello KCPL,",
      "",
      "I would like to request a freight quote.",
      "",
      "ROUTE",
      `Origin: ${values.origin || "Not provided"}`,
      `Destination: ${values.destination || "Not provided"}`,
      `Freight mode: ${values.mode ? modeLabels[values.mode] ?? values.mode : "Not selected"}`,
      "",
      "CARGO",
      `Cargo type: ${values.cargoType || "Not provided"}`,
      `Weight: ${weight}`,
      `Dimensions (L × W × H): ${dimensions}`,
      `Preferred timing: ${values.timing || "Not provided"}`,
      `Special handling / notes: ${values.requirements || "None provided"}`,
      "",
      "CONTACT",
      `Name: ${values.contactName || "Not provided"}`,
      `Email: ${values.contactEmail || "Not provided"}`,
      `Company: ${values.companyName || "Not provided"}`,
      `Phone: ${values.phone || "Not provided"}`,
      "",
      "Thank you.",
    ].join("\n"));
    return `mailto:${company.email}?subject=${subject}&body=${body}`;
  }, [dimensions, values, weight]);

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState.status === "submitting") return;
    setSubmitState({ status: "submitting" });
    let failureMessage = c.error;

    try {
      // Only when a site key is configured; otherwise this is a no-op and the
      // page never contacts the challenge provider.
      const siteKey = turnstileSiteKey();
      const challengeToken = siteKey ? await requestChallengeToken(siteKey) : "";

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, challengeToken }),
      });
      const result = await response.json() as { ok?: boolean; reference?: string; error?: string };
      if (!response.ok || !result.ok || !result.reference) {
        failureMessage = locale === "en" ? result.error || c.error
          : response.status === 503 ? c.unavailable
          : response.status === 429 ? c.rateLimited
          : response.status === 403 ? c.verification
          : response.status === 400 ? c.invalid : c.error;
        throw new Error(failureMessage);
      }

      setSubmitState({ status: "success", reference: result.reference });
      trackAnalyticsEvent("quote_submitted");
    } catch (error) {
      setSubmitState({
        status: "error",
        message: locale === "en" && error instanceof Error ? error.message : failureMessage,
      });
      trackAnalyticsEvent("quote_submission_failed");
    }
  }

  return <form className="quote-enquiry" onSubmit={submitEnquiry} aria-busy={submitState.status === "submitting"}>
    <div className="quote-progress">
      <div><span>{c.essentials}</span><strong>{c.progress(essentialCount)}</strong></div>
      <progress max={5} value={essentialCount} aria-label={c.essentials}/>
    </div>
    <div className="quote-enquiry-main">
      <fieldset className="quote-form-section" disabled={submitState.status === "submitting"}>
        <legend><MapPin size={18}/><span>{c.route}</span><small>{c.required}</small></legend>
        <div className="quote-form-grid quote-form-grid-route">
          <label><span>{c.origin}</span><input value={values.origin} onChange={(event) => setField("origin", event.target.value)} placeholder={c.cityCountry} autoComplete="address-level2" maxLength={120} required/></label>
          <label><span>{c.destination}</span><input value={values.destination} onChange={(event) => setField("destination", event.target.value)} placeholder={c.cityCountry} autoComplete="address-level2" maxLength={120} required/></label>
          <label><span>{c.mode}</span><select value={values.mode} onChange={(event) => setField("mode", event.target.value)} required><option value="">{c.selectMode}</option><option value="air">{c.air}</option><option value="sea">{c.sea}</option><option value="road">{c.road}</option><option value="unsure">{c.unsure}</option></select></label>
        </div>
      </fieldset>

      <fieldset className="quote-form-section" disabled={submitState.status === "submitting"}>
        <legend><Scales size={18}/><span>{c.cargo}</span><small>{c.available}</small></legend>
        <a className="quote-skip" href="#quote-contact">{c.skipCargo}</a>
        <div className="quote-form-grid quote-form-grid-cargo">
          <label className="quote-field-wide"><span>{c.cargoType}</span><input value={values.cargoType} onChange={(event) => setField("cargoType", event.target.value)} placeholder={c.cargoExample} maxLength={160}/></label>
          <label><span>{c.weight}</span><div className="quote-form-compound"><input value={values.weight} onChange={(event) => setField("weight", event.target.value)} type="number" min="0" step="any" inputMode="decimal" placeholder="0"/><select value={values.weightUnit} onChange={(event) => setField("weightUnit", event.target.value)} aria-label={c.weight}><option value="kg">kg</option><option value="tonnes">tonnes</option><option value="lb">lb</option></select></div></label>
          <div className="quote-field-dimensions"><span>{c.dimensions}</span><div><label><span className="sr-only">{c.length}</span><input value={values.length} onChange={(event) => setField("length", event.target.value)} type="number" min="0" step="any" inputMode="decimal" placeholder="L"/></label><i>×</i><label><span className="sr-only">{c.width}</span><input value={values.width} onChange={(event) => setField("width", event.target.value)} type="number" min="0" step="any" inputMode="decimal" placeholder="W"/></label><i>×</i><label><span className="sr-only">{c.height}</span><input value={values.height} onChange={(event) => setField("height", event.target.value)} type="number" min="0" step="any" inputMode="decimal" placeholder="H"/></label><select value={values.dimensionUnit} onChange={(event) => setField("dimensionUnit", event.target.value)} aria-label={c.dimensions}><option value="cm">cm</option><option value="m">m</option><option value="in">in</option></select></div></div>
          <label><span>{c.timing}</span><input value={values.timing} onChange={(event) => setField("timing", event.target.value)} placeholder={c.timingExample} maxLength={120}/></label>
          <label className="quote-field-wide"><span>{c.notes}</span><textarea value={values.requirements} onChange={(event) => setField("requirements", event.target.value)} rows={4} placeholder={c.notesExample} maxLength={3000}/></label>
        </div>
      </fieldset>

      <fieldset id="quote-contact" className="quote-form-section" disabled={submitState.status === "submitting"}>
        <legend><Ruler size={18}/><span>{c.contact}</span><small>{c.contactRequired}</small></legend>
        <div className="quote-form-grid quote-form-grid-contact">
          <label><span>{c.name}</span><input value={values.contactName} onChange={(event) => setField("contactName", event.target.value)} autoComplete="name" placeholder={c.nameExample} maxLength={120} required/></label>
          <label><span>{c.email}</span><input value={values.contactEmail} onChange={(event) => setField("contactEmail", event.target.value)} type="email" autoComplete="email" placeholder={c.emailExample} maxLength={254} required/></label>
          <label><span>{c.company}</span><input value={values.companyName} onChange={(event) => setField("companyName", event.target.value)} autoComplete="organization" placeholder={c.companyExample} maxLength={160}/></label>
          <label><span>{c.phone}</span><input value={values.phone} onChange={(event) => setField("phone", event.target.value)} type="tel" autoComplete="tel" placeholder={c.phoneExample} maxLength={80}/></label>
          <label className="sr-only" aria-hidden="true"><span>Website</span><input value={values.website} onChange={(event) => setField("website", event.target.value)} tabIndex={-1} autoComplete="off"/></label>
        </div>
      </fieldset>
    </div>

    <aside className="quote-email-panel">
      <div className="quote-email-panel-index">{c.review}</div>
      {submitState.status === "success" ? <CheckCircle size={30} strokeWidth={1.5}/> : <Envelope size={28} strokeWidth={1.25}/>} 
      <h2 ref={confirmationHeading} tabIndex={submitState.status === "success" ? -1 : undefined}>{submitState.status === "success" ? c.received : c.sendTo}</h2>
      <p>{submitState.status === "success" ? c.receivedCopy : c.reviewCopy}</p>
      <div className="quote-email-summary">
        <span><small>{c.route}</small><strong>{values.origin || c.origin} <i>→</i> {values.destination || c.destination}</strong></span>
        <span><small>{c.weight}</small><strong>{weight}</strong></span>
        <span><small>{c.dimensions}</small><strong>{dimensions}</strong></span>
        {submitState.status === "success" && <span><small>{c.reference}</small><strong>{submitState.reference}</strong></span>}
      </div>
      {submitState.status !== "success" && <button type="submit" disabled={submitState.status === "submitting"}>{submitState.status === "submitting" ? c.submitting : c.submit} <ArrowUpRight size={18}/></button>}
      {submitState.status === "success" && <p className="quote-email-handoff" role="status" aria-live="polite">{c.success(submitState.reference)}</p>}
      {submitState.status === "error" && <p className="quote-email-handoff" role="alert">{submitState.message} {c.emailFallback} <a href={mailtoHref}>{c.emailAction}</a>.</p>}
      <small className="quote-email-note">{c.privacy}</small>
      <a href={`mailto:${company.email}`} className="quote-email-address">{company.email}</a>
    </aside>
  </form>;
}
