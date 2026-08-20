"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, Calculator, Clock3, Copy, ExternalLink, KeyRound, MapPin, PackageSearch, ShieldCheck, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";

const modes = ["air", "LCL", "FCL", "LTL", "FTL"] as const;
type EstimateMode = (typeof modes)[number];
type LoadType = "boxes" | "crate" | "pallets" | "container20" | "container40" | "container40HC";
type LocationType = "CITY" | "PORT" | "AIRPORT";

type LocationSuggestion = {
  value: string;
  label: string;
  kind: string;
  detail: string;
  providerId: string;
  locationType: LocationType;
  shortName: string;
};

type Estimate = {
  provider: string;
  source: string;
  mode: string;
  min: number;
  max: number;
  midpoint: number;
  latest: number;
  change: number | null;
  currency: string;
  period_from: string;
  period_to: string;
  fetched_at: string;
  origin: string;
  destination: string;
  origin_code: string;
  destination_code: string;
  load_type: string;
  quantity: number;
  disclaimer: string;
  attribution_url: string;
};

const modeLabels: Record<EstimateMode, string> = {
  air: "Air freight",
  LCL: "Sea LCL",
  FCL: "Sea FCL",
  LTL: "Road LTL",
  FTL: "Road FTL",
};

const loadTypeLabels: Record<LoadType, string> = {
  boxes: "Boxes",
  crate: "Crate",
  pallets: "Pallets",
  container20: "20' Standard",
  container40: "40' Standard",
  container40HC: "40' High Cube",
};

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-sm text-[#10263f] outline-none transition focus:border-[#aa8748] focus:bg-white";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("en-AU")}`;
  }
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function fetchedLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function LocationAutocomplete({
  label,
  value,
  mode,
  selection,
  onChange,
  onSelect,
  onConfigurationIssue,
}: {
  label: string;
  value: string;
  mode: EstimateMode;
  selection: LocationSuggestion | null;
  onChange: (value: string) => void;
  onSelect: (value: LocationSuggestion) => void;
  onConfigurationIssue: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searchError, setSearchError] = useState("");
  const listboxId = `searates-${label.toLowerCase()}-suggestions`;

  useEffect(() => {
    const query = value.trim();
    if (!open || query.length < 2 || selection) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const response = await fetch(`/api/admin/market-estimate/searates/locations?q=${encodeURIComponent(query)}&mode=${encodeURIComponent(mode)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json() as { ok?: boolean; configured?: boolean; suggestions?: LocationSuggestion[]; error?: string };
        if (data.configured === false) {
          onConfigurationIssue(data.error || "SeaRates API key is not configured yet.");
          setSuggestions([]);
          return;
        }
        if (!response.ok || !data.ok) {
          setSearchError(data.error || "SeaRates locations could not be loaded.");
          setSuggestions([]);
          return;
        }
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchError("SeaRates locations could not be loaded.");
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mode, onConfigurationIssue, open, selection, value]);

  function choose(suggestion: LocationSuggestion) {
    onSelect(suggestion);
    setSuggestions([]);
    setSearchError("");
    setSearching(false);
    setOpen(false);
  }

  return (
    <div className="relative md:col-span-1 xl:col-span-2">
      <label className="block">
        <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#5f6973]">
          <span>{label}</span>
          {selection ? <span className="text-[9px] font-black uppercase tracking-[.08em] text-emerald-700">SeaRates matched</span> : null}
        </span>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-[22px] z-10 text-[#9aa3ab]" size={15}/>
          <input
            required
            autoComplete="off"
            role="combobox"
            aria-controls={listboxId}
            aria-expanded={open && !selection && value.trim().length >= 2}
            aria-autocomplete="list"
            className={`${inputClass} pl-9`}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setSuggestions([]);
              setSearchError("");
              setSearching(false);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 160)}
            placeholder={mode === "air" ? "Search airport or city…" : mode === "FCL" || mode === "LCL" ? "Search port or city…" : "Search city…"}
          />
        </div>
      </label>

      {selection ? <p className="mt-1.5 text-[10px] text-[#77828c]">{selection.kind}{selection.shortName ? ` · ${selection.shortName}` : ""} · provider-valid location</p> : null}

      {open && !selection && value.trim().length >= 2 ? (
        <div id={listboxId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-[#d9dee3] bg-white p-1.5 shadow-[0_18px_45px_rgba(16,38,63,.18)]">
          {searching ? <p className="px-3 py-3 text-xs text-[#7d8790]">Searching SeaRates locations…</p> : null}
          {!searching && searchError ? <p className="px-3 py-3 text-xs leading-5 text-rose-700">{searchError}</p> : null}
          {!searching && !searchError && suggestions.length === 0 ? <div className="px-3 py-3"><p className="text-xs font-bold text-[#42505e]">No provider match yet.</p><p className="mt-1 text-[10px] leading-4 text-[#8a949d]">Keep typing a port, airport or city. Select a result before requesting the benchmark.</p></div> : null}
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.locationType}:${suggestion.providerId}`}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#f3f5f6]"
            >
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#eef1f3] text-[#87672f]"><MapPin size={13}/></span>
              <span className="min-w-0">
                <strong className="block text-xs text-[#10263f]">{suggestion.label}</strong>
                <span className="mt-0.5 block text-[10px] text-[#7e8992]">{suggestion.kind}{suggestion.detail ? ` · ${suggestion.detail}` : ""}</span>
              </span>
            </button>
          ))}
          <div className="border-t border-[#edf0f2] px-3 py-2 text-[9px] leading-4 text-[#9aa2a9]">Locations supplied directly by the SeaRates Freight Index dictionary.</div>
        </div>
      ) : null}
    </div>
  );
}

export function SeaRatesMarketEstimateWorkspace({ roleLabel }: { roleLabel: string }) {
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    mode: "air" as EstimateMode,
    loadType: "boxes" as LoadType,
    quantity: "1",
    weight: "100",
    weightUnit: "kg",
    length: "",
    width: "",
    height: "",
    dimensionUnit: "cm",
  });
  const [originSelection, setOriginSelection] = useState<LocationSuggestion | null>(null);
  const [destinationSelection, setDestinationSelection] = useState<LocationSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configurationError, setConfigurationError] = useState("");
  const [notice, setNotice] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  const containerMode = form.mode === "FCL";
  const relevantLoadTypes = useMemo<LoadType[]>(() => containerMode
    ? ["container20", "container40", "container40HC"]
    : ["boxes", "crate", "pallets"], [containerMode]);

  function changeMode(mode: EstimateMode) {
    const loadType: LoadType = mode === "FCL"
      ? (form.loadType.startsWith("container") ? form.loadType : "container20") as LoadType
      : (form.loadType.startsWith("container") ? "boxes" : form.loadType) as LoadType;
    setForm((current) => ({ ...current, mode, loadType }));
    setOriginSelection(null);
    setDestinationSelection(null);
    setEstimate(null);
    setError("");
  }

  function changeLocation(which: "origin" | "destination", value: string) {
    setForm((current) => ({ ...current, [which]: value }));
    if (which === "origin") setOriginSelection(null);
    else setDestinationSelection(null);
    setEstimate(null);
    setError("");
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setEstimate(null);

    if (!originSelection || !destinationSelection) {
      setError("Select both Origin and Destination from the SeaRates dropdown before requesting a benchmark.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/market-estimate/searates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity || 1),
          weight: form.weight ? Number(form.weight) : null,
          length: form.length ? Number(form.length) : null,
          width: form.width ? Number(form.width) : null,
          height: form.height ? Number(form.height) : null,
          originLocationId: originSelection.providerId,
          originLocationType: originSelection.locationType,
          originLocationCode: originSelection.shortName,
          destinationLocationId: destinationSelection.providerId,
          destinationLocationType: destinationSelection.locationType,
          destinationLocationCode: destinationSelection.shortName,
        }),
      });
      const data = await response.json() as { ok?: boolean; configured?: boolean; estimate?: Estimate; error?: string };
      if (data.configured === false) setConfigurationError(data.error || "SeaRates API key is not configured yet.");
      if (!response.ok || !data.estimate) throw new Error(data.error || "SeaRates did not return a market benchmark.");
      setConfigurationError("");
      setEstimate(data.estimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The SeaRates market benchmark could not be retrieved.");
    } finally {
      setBusy(false);
    }
  }

  async function copyBenchmark() {
    if (!estimate) return;
    const text = `${estimate.currency} ${estimate.midpoint.toFixed(2)}`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`Copied average benchmark ${text}.`);
    } catch {
      setNotice(`Average benchmark: ${text}`);
    }
  }

  const changeIsPositive = (estimate?.change ?? 0) >= 0;

  return <main className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
    <header className="border-b border-[#dfe3e8] bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9a763b]">KCPL Commercial Intelligence</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-.045em]">SeaRates Market Benchmark</h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#68747f]">Authenticated freight-market index data for commercial benchmarking. It is independent market intelligence, not a binding carrier quotation or an automatic KCPL selling price.</p>
        </div>
        <div className="flex items-center gap-2"><span className="rounded-full border border-[#dfe3e8] bg-[#f8f9fa] px-3 py-2 text-[10px] font-black uppercase tracking-[.08em] text-[#68747f]">{roleLabel}</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[.08em] text-emerald-700">Authenticated API</span></div>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1500px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-8">
      <section className="rounded-2xl border border-[#dfe3e8] bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#10263f] text-white"><PackageSearch size={18}/></span>
          <div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#9a763b]">SeaRates Freight Index API</p><h2 className="mt-1 text-xl font-black">Market benchmark inputs</h2><p className="mt-1 text-xs leading-5 text-[#7a858f]">Choose locations from SeaRates itself, then compare its market index with KCPL partner/vendor buy rates.</p></div>
        </div>

        <form onSubmit={calculate} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LocationAutocomplete label="Origin" value={form.origin} mode={form.mode} selection={originSelection} onChange={(value) => changeLocation("origin", value)} onSelect={(selection) => { setOriginSelection(selection); setForm((current) => ({ ...current, origin: selection.value })); }} onConfigurationIssue={setConfigurationError}/>
          <LocationAutocomplete label="Destination" value={form.destination} mode={form.mode} selection={destinationSelection} onChange={(value) => changeLocation("destination", value)} onSelect={(selection) => { setDestinationSelection(selection); setForm((current) => ({ ...current, destination: selection.value })); }} onConfigurationIssue={setConfigurationError}/>

          <label><span className="text-[11px] font-semibold text-[#5f6973]">Mode</span><select className={inputClass} value={form.mode} onChange={(event) => changeMode(event.target.value as EstimateMode)}>{modes.map((mode) => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Transport unit</span><select className={inputClass} value={form.loadType} onChange={(event) => setForm((current) => ({ ...current, loadType: event.target.value as LoadType }))}>{relevantLoadTypes.map((item) => <option key={item} value={item}>{loadTypeLabels[item]}</option>)}</select></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Quantity</span><input min="1" max="99" step="1" type="number" className={inputClass} value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}/></label>
          <div><span className="text-[11px] font-semibold text-[#5f6973]">Provider currency</span><div className={`${inputClass} flex items-center font-bold`}>USD</div></div>

          <label><span className="text-[11px] font-semibold text-[#5f6973]">Cargo weight <span className="font-normal text-[#9aa2a9]">(context)</span></span><div className="flex gap-2"><input min="0.01" step="0.01" type="number" className={inputClass} value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} placeholder="Optional"/><select className={`${inputClass} max-w-24`} value={form.weightUnit} onChange={(event) => setForm((current) => ({ ...current, weightUnit: event.target.value }))}><option value="kg">kg</option><option value="lb">lb</option><option value="ton">ton</option></select></div></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Dimension unit <span className="font-normal text-[#9aa2a9]">(context)</span></span><select className={inputClass} value={form.dimensionUnit} onChange={(event) => setForm((current) => ({ ...current, dimensionUnit: event.target.value }))}><option value="cm">cm</option><option value="m">m</option><option value="inch">inch</option></select></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Length <span className="font-normal text-[#9aa2a9]">(optional)</span></span><input min="0.01" step="0.01" type="number" className={inputClass} value={form.length} onChange={(event) => setForm((current) => ({ ...current, length: event.target.value }))}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Width <span className="font-normal text-[#9aa2a9]">(optional)</span></span><input min="0.01" step="0.01" type="number" className={inputClass} value={form.width} onChange={(event) => setForm((current) => ({ ...current, width: event.target.value }))}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Height <span className="font-normal text-[#9aa2a9]">(optional)</span></span><input min="0.01" step="0.01" type="number" className={inputClass} value={form.height} onChange={(event) => setForm((current) => ({ ...current, height: event.target.value }))}/></label>

          <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-[#e4e7ea] bg-[#f8f9fa] px-4 py-3 text-[10px] leading-5 text-[#6f7a84]">The Freight Index is a lane/mode market benchmark. Cargo weight and dimensions are stored as context for KCPL staff but do not turn the index into an exact shipment quote. Exact carrier pricing will come from a rate API / KCPL partner rate card.</div>

          <div className="md:col-span-2 xl:col-span-4"><button disabled={busy || Boolean(configurationError)} type="submit" className="flex h-11 items-center gap-2 rounded-lg bg-[#10263f] px-5 text-sm font-black text-white transition hover:bg-[#173650] disabled:cursor-not-allowed disabled:opacity-50"><Calculator size={16}/>{busy ? "Checking SeaRates…" : "Get SeaRates benchmark"}</button></div>
        </form>
      </section>

      <aside className="space-y-4">
        {configurationError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900"><div className="flex items-start gap-3"><KeyRound size={18} className="mt-0.5 shrink-0"/><div><p className="text-sm font-black">SeaRates API key required</p><p className="mt-1 text-xs leading-5">{configurationError}</p><p className="mt-3 text-[10px] leading-5 text-amber-800">The credential stays server-side. Nothing is exposed to the browser.</p></div></div></div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800"><div className="flex items-start gap-3"><TriangleAlert size={18} className="mt-0.5 shrink-0"/><div><p className="text-sm font-black">Benchmark unavailable</p><p className="mt-1 text-xs leading-5">{error}</p></div></div></div> : null}
        {notice ? <div className="rounded-xl border border-[#d9c28f] bg-[#fff8e8] px-4 py-3 text-xs font-bold text-[#76591f]">{notice}</div> : null}

        {estimate ? <section className="overflow-hidden rounded-2xl border border-[#dfe3e8] bg-white shadow-sm">
          <div className="bg-[#0a1828] p-5 text-white"><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#d4ad62]">SeaRates market intelligence</p><h2 className="mt-1 text-xl font-black">{estimate.origin} → {estimate.destination}</h2><p className="mt-2 text-xs text-white/55">{modeLabels[estimate.mode as EstimateMode] ?? estimate.mode} · {estimate.origin_code || "origin"} → {estimate.destination_code || "destination"}</p></div>
          <div className="space-y-5 p-5">
            <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#89939c]">30-day market index range</p><p className="mt-1 text-2xl font-black tracking-[-.03em]">{money(estimate.min, estimate.currency)} – {money(estimate.max, estimate.currency)}</p><p className="mt-1 text-xs text-[#7a858f]">Average benchmark {money(estimate.midpoint, estimate.currency)}</p></div>
            <div className="grid grid-cols-2 gap-3"><Mini label="Latest index" value={money(estimate.latest, estimate.currency)}/><Mini label="Average" value={money(estimate.midpoint, estimate.currency)}/><Mini label="Period" value={`${dateLabel(estimate.period_from)} – ${dateLabel(estimate.period_to)}`}/><Mini label="Change" value={estimate.change === null ? "Not returned" : `${estimate.change > 0 ? "+" : ""}${estimate.change.toFixed(1)}%`} icon={estimate.change === null ? <Activity size={13}/> : changeIsPositive ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}/></div>
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900"><ShieldCheck size={15} className="mt-0.5 shrink-0"/><span>{estimate.disclaimer}</span></div>
            <button type="button" onClick={copyBenchmark} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#f8f9fa] text-xs font-black hover:bg-white"><Copy size={14}/>Copy average benchmark</button>
            <div className="border-t border-[#edf0f2] pt-4 text-[10px] leading-5 text-[#88929a]"><p className="flex items-center gap-1.5"><Clock3 size={12}/>Fetched {fetchedLabel(estimate.fetched_at)}</p><p className="mt-1">Source: {estimate.source}</p><a href={estimate.attribution_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-black text-[#80612e] underline underline-offset-4">SeaRates Freight Index <ExternalLink size={11}/></a></div>
          </div>
        </section> : !configurationError ? <section className="rounded-2xl border border-dashed border-[#cfd5da] bg-white p-6"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#9a763b]">How KCPL should use it</p><h2 className="mt-2 text-lg font-black">Benchmark the market, then price the job.</h2><p className="mt-2 text-xs leading-6 text-[#6f7a84]">Use SeaRates to understand the market lane, compare that with KCPL’s actual partner/vendor rate, then build the customer quotation using expected buy cost and KCPL margin.</p></section> : null}
      </aside>
    </div>
  </main>;
}

function Mini({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="rounded-xl border border-[#e4e7ea] bg-[#f8f9fa] p-3"><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#929ba3]">{label}</p><p className="mt-1.5 flex items-center gap-1.5 text-sm font-black text-[#10263f]">{icon}{value}</p></div>;
}
