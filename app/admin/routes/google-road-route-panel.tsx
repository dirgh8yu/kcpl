"use client";

import { Clock3, Gauge, MapPin, Navigation, Route } from "lucide-react";
import { FormEvent, useState } from "react";
import { OpsButton, OpsErrorState, OpsMetric, OpsMetricStrip, OpsPanel, OpsStatusBadge } from "../operations-ui";

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
    <OpsPanel
      title="Road distance & ETA"
      eyebrow="Google Routes reference"
      description="Calculate indicative truck-road distance and transit time. Add required branch or border stops one per line."
      action={<OpsStatusBadge tone={trafficAware ? "accent" : "success"}>{trafficAware ? "Live traffic · Pro" : "Standard · Essentials"}</OpsStatusBadge>}
    >
      <form onSubmit={calculate} className={`grid gap-3 p-3.5 ${compact ? "xl:grid-cols-[1fr_1fr_1fr_auto]" : "xl:grid-cols-[1fr_1fr_1fr_220px]"}`}>
        <label className="block"><span className="text-[10px] font-medium text-[#69717a]">Origin</span><div className="ops-search-field mt-1.5 w-full"><MapPin size={13} className="text-[#7f89b3]"/><input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Kolkata, India" required/></div></label>
        <label className="block"><span className="text-[10px] font-medium text-[#69717a]">Destination</span><div className="ops-search-field mt-1.5 w-full"><Navigation size={13} className="text-[#7f89b3]"/><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Kathmandu, Nepal" required/></div></label>
        <label className="block"><span className="text-[10px] font-medium text-[#69717a]">Via stops <span className="text-[#a0a6ac]">optional</span></span><textarea rows={compact ? 1 : 2} value={via} onChange={(event) => setVia(event.target.value)} className={`mt-1.5 w-full resize-none px-3 py-2 ${compact ? "h-[34px]" : "min-h-[64px]"}`} placeholder="Raxaul, India&#10;Birgunj, Nepal"/></label>
        <div className="flex items-end gap-2 xl:flex-col xl:items-stretch xl:justify-end"><label className="flex min-h-[34px] flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[#dfe2e6] bg-[#fbfbfb] px-3 text-[10px] font-medium text-[#616a73]"><input type="checkbox" checked={trafficAware} onChange={(event) => setTrafficAware(event.target.checked)} className="h-3.5 w-3.5 accent-[#5367d9]"/><span>Use live traffic <span className="text-[#7f88b3]">Pro</span></span></label><OpsButton tone="primary" type="submit" disabled={loading}>{loading ? "Calculating…" : "Calculate route"}</OpsButton></div>
      </form>

      {error ? <OpsErrorState tone="warning" title="Road route estimate unavailable" detail="Existing KCPL shipment and quotation data is unaffected. Check the locations and retry when the route service is available." action={<OpsButton onClick={() => void calculate()} disabled={loading}>Retry</OpsButton>}/> : null}

      {estimate ? <div className="border-t border-[#eceef0]">
        <OpsMetricStrip columns={4}>
          <OpsMetric icon={<Route size={13}/>} label="Road distance" value={`${estimate.distance_km.toLocaleString("en-AU", { maximumFractionDigits: 1 })} km`} />
          <OpsMetric icon={<Clock3 size={13}/>} label={estimate.traffic_aware ? "Traffic-aware drive" : "Estimated drive"} value={durationText(estimate.duration_seconds)} />
          <OpsMetric icon={<Navigation size={13}/>} label="Indicative arrival" value={<span className="text-[14px]">{arrivalText(estimate.estimated_arrival_at)}</span>} />
          <OpsMetric icon={<Gauge size={13}/>} label="Traffic delay" value={<span className="text-[14px]">{estimate.traffic_aware ? durationText(estimate.traffic_delay_seconds) : "Not requested"}</span>} />
        </OpsMetricStrip>
        <div className="grid gap-2 px-3.5 py-3 text-[10px] leading-5 text-[#7d858d] lg:grid-cols-[minmax(0,1fr)_auto]"><div><p><strong className="font-medium text-[#4b535b]">{estimate.origin}</strong>{estimate.waypoints.map((item) => <span key={item}> → <strong className="font-medium text-[#4b535b]">{item}</strong></span>)} → <strong className="font-medium text-[#4b535b]">{estimate.destination}</strong></p>{estimate.route_description ? <p className="mt-0.5">Route: {estimate.route_description}</p> : null}{estimate.warnings.length ? <p className="mt-0.5 text-[#8b6938]">{estimate.warnings.join(" · ")}</p> : null}{disclaimer ? <p className="mt-0.5 text-[#9299a0]">{disclaimer}</p> : null}</div><div className="text-right text-[#939aa1]"><p>{pricingNote}</p><p className="mt-0.5">Requested {requestedText(estimate.requested_at)}</p></div></div>
      </div> : null}
    </OpsPanel>
  );
}
