"use client";

import { Clock3, Gauge, MapPin, Navigation, Route, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";

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
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function GoogleRoadRoutePanel({
  initialOrigin = "",
  initialDestination = "",
  compact = false,
}: {
  initialOrigin?: string;
  initialDestination?: string;
  compact?: boolean;
}) {
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
    setEstimate(null);
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
        throw new Error(data.error || "Google road route could not be calculated.");
      }
      setEstimate(data.estimate);
      setPricingNote(data.pricing_note || "");
      setDisclaimer(data.disclaimer || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google road route could not be calculated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`border-b border-[#dfe3e8] bg-white ${compact ? "px-4 py-4 sm:px-6" : "px-4 py-5 sm:px-6 lg:px-8"}`}>
      <div className="mx-auto max-w-[1700px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#8a6c36]"><Route size={15}/><p className="text-[10px] font-black uppercase tracking-[.14em]">Google road route intelligence</p></div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[#737f89]">Calculate truck-road distance and transit time without leaving KCPL. Add border or branch stops one per line when the route must pass through them.</p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.08em] ${trafficAware ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{trafficAware ? "Live traffic · Pro" : "Standard · Essentials"}</span>
        </div>

        <form onSubmit={calculate} className={`mt-4 grid gap-3 ${compact ? "xl:grid-cols-[1fr_1fr_1fr_auto]" : "xl:grid-cols-[1fr_1fr_1fr_220px]"}`}>
          <label className="block"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8b949c]">Origin</span><div className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 focus-within:border-[#aa8748] focus-within:bg-white"><MapPin size={13} className="text-[#9b7a40]"/><input value={origin} onChange={(event) => setOrigin(event.target.value)} className="w-full bg-transparent text-xs outline-none" placeholder="e.g. Kolkata, India" required/></div></label>
          <label className="block"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8b949c]">Destination</span><div className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 focus-within:border-[#aa8748] focus-within:bg-white"><Navigation size={13} className="text-[#9b7a40]"/><input value={destination} onChange={(event) => setDestination(event.target.value)} className="w-full bg-transparent text-xs outline-none" placeholder="e.g. Kathmandu, Nepal" required/></div></label>
          <label className="block"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8b949c]">Via stops · optional</span><textarea rows={compact ? 1 : 2} value={via} onChange={(event) => setVia(event.target.value)} className={`mt-1 w-full resize-none rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 py-2 text-xs outline-none focus:border-[#aa8748] focus:bg-white ${compact ? "h-10" : "min-h-[62px]"}`} placeholder="Raxaul, India&#10;Birgunj, Nepal"/></label>
          <div className="flex items-end gap-2 xl:flex-col xl:items-stretch xl:justify-end">
            <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-[10px] font-semibold text-[#596773]"><input type="checkbox" checked={trafficAware} onChange={(event) => setTrafficAware(event.target.checked)} className="h-3.5 w-3.5 accent-[#10263f]"/><span>Use live traffic <span className="text-[#9a763b]">(Pro)</span></span></label>
            <button type="submit" disabled={loading} className="h-10 rounded-lg bg-[#10263f] px-5 text-[10px] font-black uppercase tracking-[.08em] text-white disabled:opacity-50">{loading ? "Calculating…" : "Calculate route"}</button>
          </div>
        </form>

        {error ? <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900"><TriangleAlert size={14} className="mt-0.5 shrink-0"/><span>{error}</span></div> : null}

        {estimate ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[#dfe3e8] bg-[#f8f9fa]">
            <div className="grid gap-px bg-[#dfe3e8] sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={<Route size={14}/>} label="Road distance" value={`${estimate.distance_km.toLocaleString("en-AU", { maximumFractionDigits: 1 })} km`} />
              <Metric icon={<Clock3 size={14}/>} label={estimate.traffic_aware ? "Traffic-aware drive" : "Estimated drive"} value={durationText(estimate.duration_seconds)} />
              <Metric icon={<Navigation size={14}/>} label="Indicative arrival" value={arrivalText(estimate.estimated_arrival_at)} small />
              <Metric icon={<Gauge size={14}/>} label="Traffic delay" value={estimate.traffic_aware ? durationText(estimate.traffic_delay_seconds) : "Not requested"} />
            </div>
            <div className="bg-white px-4 py-3 text-[10px] leading-5 text-[#77828c]">
              <div className="flex flex-wrap items-center justify-between gap-2"><p><strong className="text-[#40515f]">{estimate.origin}</strong>{estimate.waypoints.map((item) => <span key={item}> → <strong className="text-[#40515f]">{item}</strong></span>)} → <strong className="text-[#40515f]">{estimate.destination}</strong></p><span>{pricingNote}</span></div>
              {estimate.route_description ? <p className="mt-1">Google route: {estimate.route_description}</p> : null}
              {estimate.warnings.length ? <p className="mt-1 text-amber-800">{estimate.warnings.join(" · ")}</p> : null}
              {disclaimer ? <p className="mt-1 text-[#919aa2]">{disclaimer}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ icon, label, value, small = false }: { icon: React.ReactNode; label: string; value: string; small?: boolean }) {
  return <div className="bg-white p-4"><div className="flex items-center gap-2 text-[#8b949c]">{icon}<span className="text-[9px] font-bold uppercase tracking-[.1em]">{label}</span></div><p className={`mt-1.5 font-black text-[#10263f] ${small ? "text-sm" : "text-xl"}`}>{value}</p></div>;
}
