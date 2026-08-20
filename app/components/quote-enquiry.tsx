"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Mail, MapPin, Ruler, Scale } from "lucide-react";
import { company } from "../company-data";
import { trackAnalyticsEvent } from "./analytics";

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

export function QuoteEnquiry({ initial }: { initial: QuoteValues }) {
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

  const setField = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (submitState.status !== "idle" && submitState.status !== "submitting") setSubmitState({ status: "idle" });
  };

  const dimensions = [values.length, values.width, values.height].some(Boolean)
    ? `${values.length || "—"} × ${values.width || "—"} × ${values.height || "—"} ${values.dimensionUnit}`
    : "Not provided";
  const weight = values.weight ? `${values.weight} ${values.weightUnit}` : "Not provided";

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

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json() as { ok?: boolean; reference?: string; error?: string };
      if (!response.ok || !result.ok || !result.reference) {
        throw new Error(result.error || "The enquiry could not be submitted.");
      }

      setSubmitState({ status: "success", reference: result.reference });
      trackAnalyticsEvent("quote_submitted");
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error ? error.message : "The enquiry could not be submitted.",
      });
      trackAnalyticsEvent("quote_submission_failed");
    }
  }

  return <form className="quote-enquiry" onSubmit={submitEnquiry}>
    <div className="quote-enquiry-main">
      <div className="quote-enquiry-intro"><span>01</span><div><p className="eyebrow text-rhododendron">Route & cargo</p><h2>Build the enquiry.</h2><p>Add the practical details KCPL needs to begin reviewing the movement.</p></div></div>

      <fieldset className="quote-form-section" disabled={submitState.status === "submitting"}>
        <legend><MapPin size={18}/><span>Route</span></legend>
        <div className="quote-form-grid quote-form-grid-route">
          <label><span>Origin</span><input value={values.origin} onChange={(event) => setField("origin", event.target.value)} placeholder="City, country" autoComplete="address-level2" maxLength={120} required/></label>
          <label><span>Destination</span><input value={values.destination} onChange={(event) => setField("destination", event.target.value)} placeholder="City, country" autoComplete="address-level2" maxLength={120} required/></label>
          <label><span>Freight mode</span><select value={values.mode} onChange={(event) => setField("mode", event.target.value)} required><option value="">Select mode</option><option value="air">Air freight</option><option value="sea">Sea freight</option><option value="road">Road freight</option><option value="unsure">Not sure yet</option></select></label>
        </div>
      </fieldset>

      <fieldset className="quote-form-section" disabled={submitState.status === "submitting"}>
        <legend><Scale size={18}/><span>Cargo profile</span></legend>
        <div className="quote-form-grid quote-form-grid-cargo">
          <label className="quote-field-wide"><span>Cargo type</span><input value={values.cargoType} onChange={(event) => setField("cargoType", event.target.value)} placeholder="e.g. machinery, cartons, personal effects" maxLength={160}/></label>
          <label><span>Weight</span><div className="quote-form-compound"><input value={values.weight} onChange={(event) => setField("weight", event.target.value)} type="number" min="0" step="any" inputMode="decimal" placeholder="0"/><select value={values.weightUnit} onChange={(event) => setField("weightUnit", event.target.value)} aria-label="Weight unit"><option value="kg">kg</option><option value="tonnes">tonnes</option><option value="lb">lb</option></select></div></label>
          <div className="quote-field-dimensions"><span>Dimensions</span><div><label><span className="sr-only">Length</span><input value={values.length} onChange={(event) => setField("length", event.target.value)} type="number" min="0" step="any" inputMode="decimal" placeholder="L"/></label><i>×</i><label><span className="sr-only">Width</span><input value={values.width} onChange={(event) => setField("width", event.target.value)} type="number" min="0" step="any" inputMode="decimal" placeholder="W"/></label><i>×</i><label><span className="sr-only">Height</span><input value={values.height} onChange={(event) => setField("height", event.target.value)} type="number" min="0" step="any" inputMode="decimal" placeholder="H"/></label><select value={values.dimensionUnit} onChange={(event) => setField("dimensionUnit", event.target.value)} aria-label="Dimension unit"><option value="cm">cm</option><option value="m">m</option><option value="in">in</option></select></div></div>
          <label><span>Preferred timing</span><input value={values.timing} onChange={(event) => setField("timing", event.target.value)} placeholder="Date or timeframe" maxLength={120}/></label>
          <label className="quote-field-wide"><span>Special handling or notes</span><textarea value={values.requirements} onChange={(event) => setField("requirements", event.target.value)} rows={4} placeholder="Handling requirements, packaging notes, or other relevant details" maxLength={3000}/></label>
        </div>
      </fieldset>

      <fieldset className="quote-form-section" disabled={submitState.status === "submitting"}>
        <legend><Ruler size={18}/><span>Your details</span></legend>
        <div className="quote-form-grid quote-form-grid-contact">
          <label><span>Name</span><input value={values.contactName} onChange={(event) => setField("contactName", event.target.value)} autoComplete="name" placeholder="Your name" maxLength={120} required/></label>
          <label><span>Email</span><input value={values.contactEmail} onChange={(event) => setField("contactEmail", event.target.value)} type="email" autoComplete="email" placeholder="you@company.com" maxLength={254} required/></label>
          <label><span>Company</span><input value={values.companyName} onChange={(event) => setField("companyName", event.target.value)} autoComplete="organization" placeholder="Company name" maxLength={160}/></label>
          <label><span>Phone</span><input value={values.phone} onChange={(event) => setField("phone", event.target.value)} autoComplete="tel" placeholder="Contact number" maxLength={80}/></label>
          <label className="sr-only" aria-hidden="true"><span>Website</span><input value={values.website} onChange={(event) => setField("website", event.target.value)} tabIndex={-1} autoComplete="off"/></label>
        </div>
      </fieldset>
    </div>

    <aside className="quote-email-panel">
      <div className="quote-email-panel-index">02 / Submit</div>
      {submitState.status === "success" ? <CheckCircle2 size={30} strokeWidth={1.5}/> : <Mail size={28} strokeWidth={1.25}/>} 
      <h2>{submitState.status === "success" ? "Enquiry received." : "Send to KCPL."}</h2>
      <p>{submitState.status === "success" ? "KCPL has received your freight enquiry. Keep the reference below for follow-up." : "Your route, cargo and contact details will be securely submitted to KCPL for review."}</p>
      <div className="quote-email-summary">
        <span><small>Route</small><strong>{values.origin || "Origin"} <i>→</i> {values.destination || "Destination"}</strong></span>
        <span><small>Weight</small><strong>{weight}</strong></span>
        <span><small>Dimensions</small><strong>{dimensions}</strong></span>
        {submitState.status === "success" && <span><small>KCPL reference</small><strong>{submitState.reference}</strong></span>}
      </div>
      {submitState.status !== "success" && <button type="submit" disabled={submitState.status === "submitting"}>{submitState.status === "submitting" ? "Submitting…" : "Submit quote request"} <ArrowUpRight size={18}/></button>}
      {submitState.status === "success" && <p className="quote-email-handoff" role="status" aria-live="polite">Quote request {submitState.reference} has been stored for KCPL review.</p>}
      {submitState.status === "error" && <p className="quote-email-handoff" role="alert">{submitState.message} You can still <a href={mailtoHref}>send the same details by email</a>.</p>}
      <small className="quote-email-note">KCPL will use the information you submit only to review and respond to this freight enquiry.</small>
      <a href={`mailto:${company.email}`} className="quote-email-address">{company.email}</a>
    </aside>
  </form>;
}
