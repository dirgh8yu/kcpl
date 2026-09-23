"use client";

import { Navigation } from "lucide-react";
import { FormEvent, useState } from "react";
import { OpsBadge, OpsButton, OpsErrorState, OpsKpiRail, OpsRailMetric, OpsSurface } from "../operations-ui";
import { GooglePlaceInput } from "./google-place-input";

type Estimate = {
  provider: string;
  origin: string;
  destination: string;
  waypoints: string[];
  distance_meters: number;
  distance_km: number;
  duration_seconds: number;
  static_duration_seconds: number;
  traffic_delay_seconds: number;
  estimated_arrival_at: string;
  traffic_aware: boolean;
  route_description: string | null;
  warnings: string[];
  requested_at: string;
};

type ApiResponse = {
  ok?: boolean;
  estimate?: Estimate;
  pricing_note?: string;
  disclaimer?: string;
  needs_configuration?: boolean;
  error?: string;
};

const FRIENDLY_ERROR = "Road route estimates are temporarily unavailable. Existing KCPL shipment and quotation data is unaffected.";

function durationText(seconds: number) {
  const roundedMinutes = Math.max(0, Math.round(seconds / 60));
  const days = Math.floor(roundedMinutes / 1440);
  const hours = Math.floor((roundedMinutes % 1440) / 60);
  const minutes = roundedMinutes % 60;
  const parts = [] as string[];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || !parts.length) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function arrivalText(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function requestedText(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function GoogleRoadRoutePanel({ initialOrigin = "", initialDestination = "", compact = false }: { initialOrigin?: string; initialDestination?: string; compact?: boolean }) {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [via, setVia] = useState("");
  const [trafficAware, setTrafficAware] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [pricingNote, setPricingNote] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function calculate(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const waypoints = via.split("\n").map((item) => item.trim()).filter(Boolean);
      const response = await fetch("/api/admin/routes/estimate", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ origin, destination, waypoints, trafficAware }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.estimate) {
        console.warn("Google route estimate request failed", { status: response.status, needsConfiguration: data.needs_configuration, error: data.error });
        throw new Error(FRIENDLY_ERROR);
      }
      setEstimate(data.estimate);
      setPricingNote(data.pricing_note || "");
      setDisclaimer(data.disclaimer || "");
    } catch (err) {
      console.warn("Google route estimate unavailable", err);
      setError(FRIENDLY_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OpsSurface
      density="compact"
      title="Road distance & ETA"
      description="Indicative truck-road distance and transit time from Google Routes. Start typing to use Google Maps location suggestions."
      action={<OpsBadge tone={trafficAware ? "info" : "neutral"}>{trafficAware ? "Live traffic · Pro" : "Standard · Essentials"}</OpsBadge>}
    >
      <form onSubmit={calculate} className="route-form" data-compact={compact || undefined}>
        <GooglePlaceInput label="Origin" value={origin} onChange={setOrigin} placeholder="Kolkata, India" required />
        <GooglePlaceInput label="Destination" value={destination} onChange={setDestination} placeholder="Kathmandu, Nepal" icon={<Navigation size={14} strokeWidth={1.75} aria-hidden="true"/>} required />
        <label className="ops-field route-via"><span className="ops-field-label">Via stops <span className="route-optional">optional</span></span><textarea rows={1} value={via} onChange={(event) => setVia(event.target.value)} placeholder="Raxaul, India&#10;Birgunj, Nepal"/></label>
        <div className="route-form-actions">
          <label className="route-traffic"><input type="checkbox" checked={trafficAware} onChange={(event) => setTrafficAware(event.target.checked)}/><span>Use live traffic <span className="route-optional">Pro</span></span></label>
          <OpsButton variant="primary" size="sm" type="submit" disabled={loading}>{loading ? "Calculating…" : "Calculate route"}</OpsButton>
        </div>
      </form>

      {error ? <div className="plan-subform"><OpsErrorState tone="warning" title="Road route estimate unavailable" detail="Existing KCPL shipment and quotation data is unaffected. Check the locations and retry when the route service is available." action={<OpsButton size="sm" onClick={() => void calculate()} disabled={loading}>Retry</OpsButton>}/></div> : null}

      {estimate ? <div className="route-result">
        <OpsKpiRail label="Road route estimate">
          <OpsRailMetric label="Road distance" value={`${estimate.distance_km.toLocaleString("en-AU", { maximumFractionDigits: 1 })} km`}/>
          <OpsRailMetric label={estimate.traffic_aware ? "Traffic-aware drive" : "Estimated drive"} value={durationText(estimate.duration_seconds)}/>
          <OpsRailMetric label="Indicative arrival" value={arrivalText(estimate.estimated_arrival_at)}/>
          <OpsRailMetric label="Traffic delay" value={estimate.traffic_aware ? durationText(estimate.traffic_delay_seconds) : "Not requested"}/>
        </OpsKpiRail>
        <div className="route-result-meta">
          <div>
            <p><strong>{estimate.origin}</strong>{estimate.waypoints.map((item) => <span key={item}> → <strong>{item}</strong></span>)} → <strong>{estimate.destination}</strong></p>
            {estimate.route_description ? <p>Route: {estimate.route_description}</p> : null}
            {estimate.warnings.length ? <p className="route-warning">{estimate.warnings.join(" · ")}</p> : null}
            {disclaimer ? <p className="route-faint">{disclaimer}</p> : null}
          </div>
          <div className="route-result-side"><p>{pricingNote}</p><p>Requested {requestedText(estimate.requested_at)}</p></div>
        </div>
      </div> : null}
    </OpsSurface>
  );
}
