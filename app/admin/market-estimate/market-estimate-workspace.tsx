"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Calculator, Clock3, Copy, ExternalLink, MapPin, PackageSearch, Route, ShieldCheck, TriangleAlert } from "lucide-react";
import { quoteCurrencies, type QuoteCurrency } from "../admin-data";

const modes = ["air", "LCL", "FCL", "LTL", "FTL", "express"] as const;
type EstimateMode = (typeof modes)[number];
type LoadType = "boxes" | "crate" | "pallets" | "container20" | "container40" | "container40HC";

type Estimate = {
  provider: string;
  source: string;
  mode: string;
  min: number;
  max: number;
  midpoint: number;
  currency: string;
  transit_min: number | null;
  transit_max: number | null;
  transit_unit: string;
  num_quotes: number | null;
  fetched_at: string;
  origin: string;
  destination: string;
  load_type: string;
  quantity: number;
  disclaimer: string;
  attribution_url: string;
};

type LocationSuggestion = {
  value: string;
  label: string;
  kind: string;
  detail: string;
};

const modeLabels: Record<EstimateMode, string> = {
  air: "Air freight",
  LCL: "Sea LCL",
  FCL: "Sea FCL",
  LTL: "Road LTL",
  FTL: "Road FTL",
  express: "Express / courier",
};

const loadTypeLabels: Record<LoadType, string> = {
  boxes: "Boxes",
  crate: "Crate",
  pallets: "Pallets",
  container20: "20' container",
  container40: "40' container",
  container40HC: "40' high-cube",
};

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-sm text-[#10263f] outline-none transition focus:border-[#aa8748] focus:bg-white";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("en-AU")}`;
  }
}

function fetchedLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function directCodeSuggestions(value: string): LocationSuggestion[] {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  const suggestions: LocationSuggestion[] = [];
  if (/^[A-Z]{3}$/.test(normalized)) {
    suggestions.push({
      value: normalized,
      label: normalized,
      kind: "IATA airport code",
      detail: "Freightos accepts 3-letter airport codes",
    });
  }
  if (/^[A-Z]{2}[A-Z0-9]{3}$/.test(normalized)) {
    suggestions.push({
      value: normalized,
      label: normalized,
      kind: "UN/LOCODE",
      detail: "Freightos accepts 5-character seaport codes",
    });
  }
  return suggestions;
}

function LocationAutocomplete({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);

  useEffect(() => {
    const query = value.trim();
    if (!open || query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/admin/market-estimate/locations?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json() as { ok?: boolean; suggestions?: LocationSuggestion[] };
        if (!response.ok || !data.ok) {
          setSuggestions([]);
          return;
        }
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, value]);

  const combined = useMemo(() => {
    const direct = directCodeSuggestions(value);
    const seen = new Set(direct.map((item) => item.value.toLowerCase()));
    return [...direct, ...suggestions.filter((item) => {
      const key = item.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })].slice(0, 9);
  }, [suggestions, value]);

  function choose(suggestion: LocationSuggestion) {
    onChange(suggestion.value);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative md:col-span-1 xl:col-span-2">
      <label className="block">
        <span className="text-[11px] font-semibold text-[#5f6973]">{label}</span>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-[22px] z-10 text-[#9aa3ab]" size={15}/>
          <input
            required
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            className={`${inputClass} pl-9`}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 160)}
            placeholder={placeholder}
          />
        </div>
      </label>

      {open && value.trim().length >= 2 ? (
        <div role="listbox" className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-[#d9dee3] bg-white p-1.5 shadow-[0_18px_45px_rgba(16,38,63,.18)]">
          {searching && combined.length === 0 ? <p className="px-3 py-3 text-xs text-[#7d8790]">Searching locations…</p> : null}
          {!searching && combined.length === 0 ? <div className="px-3 py-3"><p className="text-xs font-bold text-[#42505e]">No dropdown match yet.</p><p className="mt-1 text-[10px] leading-4 text-[#8a949d]">Try city + country, or enter a 3-letter IATA airport code / 5-character UN/LOCODE directly.</p></div> : null}
          {combined.map((suggestion) => (
            <button
              key={`${suggestion.kind}:${suggestion.value}`}
              type="button"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#f3f5f6]"
            >
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#eef1f3] text-[#87672f]"><MapPin size={13}/></span>
              <span className="min-w-0">
                <strong className="block truncate text-xs text-[#10263f]">{suggestion.label}</strong>
                <span className="mt-0.5 block truncate text-[10px] text-[#7e8992]">{suggestion.kind}{suggestion.detail ? ` · ${suggestion.detail}` : ""}</span>
              </span>
            </button>
          ))}
          <div className="border-t border-[#edf0f2] px-3 py-2 text-[9px] leading-4 text-[#9aa2a9]">
            Global place suggestions © OpenStreetMap contributors, served via Photon. Airport and seaport codes are accepted directly by Freightos.
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MarketEstimateWorkspace({ roleLabel }: { roleLabel: string }) {
  const [form, setForm] = useState({
    origin: "Kathmandu, Nepal",
    destination: "",
    mode: "air" as EstimateMode,
    loadType: "boxes" as LoadType,
    quantity: "1",
    weight: "",
    weightUnit: "kg",
    length: "",
    width: "",
    height: "",
    dimensionUnit: "cm",
    currency: "USD" as QuoteCurrency,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  const containerMode = form.mode === "FCL";
  const relevantLoadTypes = useMemo<LoadType[]>(() => containerMode
    ? ["container20", "container40", "container40HC"]
    : ["boxes", "crate", "pallets"], [containerMode]);

  function setMode(mode: EstimateMode) {
    const loadType: LoadType = mode === "FCL"
      ? (form.loadType.startsWith("container") ? form.loadType : "container20") as LoadType
      : (form.loadType.startsWith("container") ? "boxes" : form.loadType) as LoadType;
    setForm((current) => ({ ...current, mode, loadType }));
    setEstimate(null);
    setError("");
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setEstimate(null);
    try {
      const response = await fetch("/api/admin/market-estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity || 1),
          weight: form.weight ? Number(form.weight) : null,
          length: form.length ? Number(form.length) : null,
          width: form.width ? Number(form.width) : null,
          height: form.height ? Number(form.height) : null,
        }),
      });
      const data = await response.json() as { ok?: boolean; estimate?: Estimate; error?: string };
      if (!response.ok || !data.estimate) throw new Error(data.error || "No market estimate was available.");
      setEstimate(data.estimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The market estimate could not be retrieved.");
    } finally {
      setBusy(false);
    }
  }

  async function copyMidpoint() {
    if (!estimate) return;
    const text = `${estimate.currency} ${estimate.midpoint.toFixed(2)}`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`Copied ${text}.`);
    } catch {
      setNotice(`Reference midpoint: ${text}`);
    }
  }

  return <main className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
    <header className="border-b border-[#dfe3e8] bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9a763b]">KCPL Commercial Intelligence</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-.045em]">External Market Estimate</h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#68747f]">Pull an independent freight price and transit-time range before KCPL prepares its own customer offer. External estimates are reference data, never an automatic selling price.</p>
        </div>
        <span className="rounded-full border border-[#dfe3e8] bg-[#f8f9fa] px-3 py-2 text-[10px] font-black uppercase tracking-[.08em] text-[#68747f]">{roleLabel}</span>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1500px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-8">
      <section className="rounded-2xl border border-[#dfe3e8] bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#10263f] text-white"><PackageSearch size={18}/></span>
          <div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#9a763b]">Live provider request</p><h2 className="mt-1 text-xl font-black">Shipment inputs</h2><p className="mt-1 text-xs leading-5 text-[#7a858f]">Use the same route and cargo details you are considering for the KCPL quotation.</p></div>
        </div>

        <form onSubmit={calculate} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LocationAutocomplete label="Origin" value={form.origin} onChange={(origin) => setForm((current) => ({ ...current, origin }))} placeholder="Start typing Kathmandu, KTM, CNSHA…"/>
          <LocationAutocomplete label="Destination" value={form.destination} onChange={(destination) => setForm((current) => ({ ...current, destination }))} placeholder="Start typing Melbourne, MEL, USLAX…"/>
          <p className="md:col-span-2 xl:col-span-4 -mt-1 text-[10px] leading-5 text-[#7a858f]">Select a dropdown location whenever possible. Freightos also accepts exact 3-letter IATA airport codes and 5-character UN/LOCODE seaport codes.</p>

          <label><span className="text-[11px] font-semibold text-[#5f6973]">Mode</span><select className={inputClass} value={form.mode} onChange={(event) => setMode(event.target.value as EstimateMode)}>{modes.map((mode) => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Load type</span><select className={inputClass} value={form.loadType} onChange={(event) => setForm({ ...form, loadType: event.target.value as LoadType })}>{relevantLoadTypes.map((item) => <option key={item} value={item}>{loadTypeLabels[item]}</option>)}</select></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Quantity</span><input min="1" max="99" step="1" type="number" className={inputClass} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Estimate currency</span><select className={inputClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as QuoteCurrency })}>{quoteCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>

          <label><span className="text-[11px] font-semibold text-[#5f6973]">Weight per unit</span><div className="flex gap-2"><input required={!containerMode} min="0.01" step="0.01" type="number" className={inputClass} value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} placeholder="0"/><select className={`${inputClass} max-w-24`} value={form.weightUnit} onChange={(event) => setForm({ ...form, weightUnit: event.target.value })}><option value="kg">kg</option><option value="lb">lb</option><option value="ton">ton</option></select></div></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Dimension unit</span><select className={inputClass} value={form.dimensionUnit} onChange={(event) => setForm({ ...form, dimensionUnit: event.target.value })}><option value="cm">cm</option><option value="m">m</option><option value="inch">inch</option></select></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Length</span><input required={!containerMode} min="0.01" step="0.01" type="number" className={inputClass} value={form.length} onChange={(event) => setForm({ ...form, length: event.target.value })} placeholder={containerMode ? "Optional" : "Required"}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Width</span><input required={!containerMode} min="0.01" step="0.01" type="number" className={inputClass} value={form.width} onChange={(event) => setForm({ ...form, width: event.target.value })} placeholder={containerMode ? "Optional" : "Required"}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Height</span><input required={!containerMode} min="0.01" step="0.01" type="number" className={inputClass} value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })} placeholder={containerMode ? "Optional" : "Required"}/></label>

          {!containerMode ? <p className="md:col-span-2 xl:col-span-4 text-[10px] leading-5 text-[#7a858f]">Freightos requires weight plus length, width and height for boxes, crates and pallets.</p> : null}

          <div className="md:col-span-2 xl:col-span-4">
            <button disabled={busy} type="submit" className="flex h-11 items-center gap-2 rounded-lg bg-[#10263f] px-5 text-sm font-black text-white transition hover:bg-[#173650] disabled:opacity-50"><Calculator size={16}/>{busy ? "Checking external market…" : "Get external estimate"}</button>
          </div>
        </form>
      </section>

      <aside className="space-y-4">
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800"><div className="flex items-start gap-3"><TriangleAlert size={18} className="mt-0.5 shrink-0"/><div><p className="text-sm font-black">Estimate unavailable</p><p className="mt-1 text-xs leading-5">{error}</p></div></div></div> : null}
        {notice ? <div className="rounded-xl border border-[#d9c28f] bg-[#fff8e8] px-4 py-3 text-xs font-bold text-[#76591f]">{notice}</div> : null}

        {estimate ? <section className="overflow-hidden rounded-2xl border border-[#dfe3e8] bg-white shadow-sm">
          <div className="bg-[#0a1828] p-5 text-white">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#d4ad62]">External benchmark</p><h2 className="mt-1 text-xl font-black">{estimate.origin} → {estimate.destination}</h2></div><Route size={20} className="text-[#d4ad62]"/></div>
            <p className="mt-3 text-xs text-white/55">{estimate.mode} · {estimate.load_type} × {estimate.quantity}</p>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.12em] text-[#89939c]">Estimated freight range</p>
              <p className="mt-1 text-2xl font-black tracking-[-.03em]">{money(estimate.min, estimate.currency)} – {money(estimate.max, estimate.currency)}</p>
              <p className="mt-1 text-xs text-[#7a858f]">Reference midpoint {money(estimate.midpoint, estimate.currency)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Midpoint" value={money(estimate.midpoint, estimate.currency)}/>
              <Mini label="Transit" value={estimate.transit_min !== null && estimate.transit_max !== null ? `${estimate.transit_min}–${estimate.transit_max} ${estimate.transit_unit}` : "Not returned"}/>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900"><ShieldCheck size={15} className="mt-0.5 shrink-0"/><span>{estimate.disclaimer}</span></div>
            <button type="button" onClick={copyMidpoint} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#f8f9fa] text-xs font-black hover:bg-white"><Copy size={14}/>Copy midpoint</button>
            <div className="border-t border-[#edf0f2] pt-4 text-[10px] leading-5 text-[#88929a]">
              <p className="flex items-center gap-1.5"><Clock3 size={12}/>Fetched {fetchedLabel(estimate.fetched_at)}</p>
              <p className="mt-1">{estimate.num_quotes !== null ? `${estimate.num_quotes} marketplace quote${estimate.num_quotes === 1 ? "" : "s"} represented · ` : ""}Source: {estimate.source}</p>
              <a href={estimate.attribution_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-black text-[#80612e] underline underline-offset-4">Powered by Freightos <ExternalLink size={11}/></a>
            </div>
          </div>
        </section> : <section className="rounded-2xl border border-dashed border-[#cfd5da] bg-white p-6"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#9a763b]">How to use this</p><h2 className="mt-2 text-lg font-black">Benchmark before you quote.</h2><p className="mt-2 text-xs leading-6 text-[#6f7a84]">Check the external range, compare it with KCPL partner/vendor rates, then price the customer using the real expected buy cost plus the margin KCPL wants. A market estimate should never silently become the final quote.</p></section>}
      </aside>
    </div>
  </main>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e4e7ea] bg-[#f8f9fa] p-3"><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#929ba3]">{label}</p><p className="mt-1.5 text-sm font-black text-[#10263f]">{value}</p></div>;
}
