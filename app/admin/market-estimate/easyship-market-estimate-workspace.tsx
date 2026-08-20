"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Calculator, Clock3, ExternalLink, MapPin, PackageSearch, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { quoteCurrencies, type QuoteCurrency } from "../admin-data";

type LocationValue = {
  label: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

type LocationSuggestion = LocationValue & {
  value: string;
  kind: string;
  detail: string;
};

type EasyshipRate = {
  courier_service_id: string;
  courier_name: string;
  courier_logo_url: string;
  currency: string;
  total_charge: number | null;
  shipment_charge: number | null;
  shipment_charge_total: number | null;
  min_delivery_time: number | null;
  max_delivery_time: number | null;
  cost_rank: number | null;
  delivery_time_rank: number | null;
  value_for_money_rank: number | null;
  easyship_rating: number | null;
  tracking_rating: number | null;
  description: string;
};

type EasyshipResult = {
  environment: "sandbox" | "production";
  fetched_at: string;
  origin: string;
  destination: string;
  quantity: number;
  total_weight_kg: number;
  rates: EasyshipRate[];
  disclaimer: string;
};

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dfe3e8] bg-[#fafbfb] px-3 text-sm text-[#10263f] outline-none transition focus:border-[#aa8748] focus:bg-white";

function money(value: number | null, currency: string) {
  if (value === null) return "Not returned";
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function fetchedLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function deliveryLabel(rate: EasyshipRate) {
  if (rate.min_delivery_time === null && rate.max_delivery_time === null) return "Not returned";
  if (rate.min_delivery_time !== null && rate.max_delivery_time !== null) return `${rate.min_delivery_time}–${rate.max_delivery_time} working days`;
  const value = rate.min_delivery_time ?? rate.max_delivery_time;
  return `${value} working days`;
}

function LocationAutocomplete({ label, value, onChange }: { label: string; value: LocationValue; onChange: (value: LocationValue) => void }) {
  const [query, setQuery] = useState(value.label);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const listboxId = `easyship-${label.toLowerCase()}-suggestions`;

  useEffect(() => {
    const search = query.trim();
    if (!open || search.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/admin/market-estimate/easyship/locations?q=${encodeURIComponent(search)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json() as { ok?: boolean; suggestions?: LocationSuggestion[] };
        setSuggestions(response.ok && data.ok && Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 320);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  function choose(suggestion: LocationSuggestion) {
    const next: LocationValue = {
      label: suggestion.label,
      line1: suggestion.line1,
      city: suggestion.city,
      state: suggestion.state,
      postalCode: suggestion.postalCode,
      countryCode: suggestion.countryCode,
    };
    setQuery(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    onChange(next);
  }

  return <div className="relative md:col-span-2">
    <label className="block">
      <span className="text-[11px] font-semibold text-[#5f6973]">{label}</span>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-[22px] z-10 text-[#9aa3ab]" size={15}/>
        <input
          required
          autoComplete="off"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={open && query.trim().length >= 2}
          aria-autocomplete="list"
          className={`${inputClass} pl-9`}
          value={query}
          onChange={(event) => {
            const labelValue = event.target.value;
            setQuery(labelValue);
            setSuggestions([]);
            setOpen(true);
            onChange({ label: labelValue, line1: "", city: "", state: "", postalCode: "", countryCode: "" });
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          placeholder="Start typing a city or address…"
        />
      </div>
    </label>
    {open && query.trim().length >= 2 ? <div id={listboxId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-[#d9dee3] bg-white p-1.5 shadow-[0_18px_45px_rgba(16,38,63,.18)]">
      {searching && suggestions.length === 0 ? <p className="px-3 py-3 text-xs text-[#7d8790]">Searching locations…</p> : null}
      {!searching && suggestions.length === 0 ? <div className="px-3 py-3"><p className="text-xs font-bold text-[#42505e]">No match yet.</p><p className="mt-1 text-[10px] leading-4 text-[#8a949d]">Type a city, suburb, street or fuller address. Select a result so Easyship receives a country code and city.</p></div> : null}
      {suggestions.map((suggestion) => <button
        key={`${suggestion.countryCode}:${suggestion.value}:${suggestion.postalCode}`}
        type="button"
        role="option"
        aria-selected={false}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(suggestion)}
        className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#f3f5f6]"
      >
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#eef1f3] text-[#87672f]"><MapPin size={13}/></span>
        <span className="min-w-0"><strong className="block truncate text-xs text-[#10263f]">{suggestion.label}</strong><span className="mt-0.5 block truncate text-[10px] text-[#7e8992]">{suggestion.kind}{suggestion.detail ? ` · ${suggestion.detail}` : ""}</span></span>
      </button>)}
      <div className="border-t border-[#edf0f2] px-3 py-2 text-[9px] leading-4 text-[#9aa2a9]">Global place suggestions © OpenStreetMap contributors, served via Photon.</div>
    </div> : null}
  </div>;
}

export function EasyshipMarketEstimateWorkspace({ roleLabel }: { roleLabel: string }) {
  const [origin, setOrigin] = useState<LocationValue>({ label: "Kathmandu, Bagmati, Nepal", line1: "Kathmandu", city: "Kathmandu", state: "Bagmati", postalCode: "44600", countryCode: "NP" });
  const [destination, setDestination] = useState<LocationValue>({ label: "", line1: "", city: "", state: "", postalCode: "", countryCode: "" });
  const [form, setForm] = useState({ quantity: "1", weight: "1", length: "20", width: "20", height: "20", declaredValue: "10", currency: "USD" as QuoteCurrency });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EasyshipResult | null>(null);

  const cheapest = useMemo(() => result?.rates[0] ?? null, [result]);
  const fastest = useMemo(() => result?.rates.reduce<EasyshipRate | null>((best, rate) => {
    const candidate = rate.min_delivery_time ?? rate.max_delivery_time;
    if (candidate === null) return best;
    if (!best) return rate;
    const current = best.min_delivery_time ?? best.max_delivery_time;
    return current === null || candidate < current ? rate : best;
  }, null) ?? null, [result]);
  const bestValue = useMemo(() => result?.rates.find((rate) => rate.value_for_money_rank === 1) ?? result?.rates[0] ?? null, [result]);

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (!origin.countryCode || !destination.countryCode) throw new Error("Select both locations from the dropdown before requesting rates.");
      if (!origin.postalCode || !destination.postalCode) throw new Error("Enter postal codes for both locations. Easyship requires postal codes for Nepal and Australia and many other countries.");
      const response = await fetch("/api/admin/market-estimate/easyship", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          quantity: Number(form.quantity),
          weight: Number(form.weight),
          length: Number(form.length),
          width: Number(form.width),
          height: Number(form.height),
          declaredValue: Number(form.declaredValue),
          currency: form.currency,
        }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; environment?: "sandbox" | "production"; fetched_at?: string; origin?: string; destination?: string; quantity?: number; total_weight_kg?: number; rates?: EasyshipRate[]; disclaimer?: string };
      if (!response.ok || !data.ok || !data.rates) throw new Error(data.error || "Easyship returned no rates.");
      setResult({
        environment: data.environment ?? "production",
        fetched_at: data.fetched_at ?? new Date().toISOString(),
        origin: data.origin ?? origin.label,
        destination: data.destination ?? destination.label,
        quantity: data.quantity ?? Number(form.quantity),
        total_weight_kg: data.total_weight_kg ?? Number(form.weight) * Number(form.quantity),
        rates: data.rates,
        disclaimer: data.disclaimer ?? "External courier rate reference only.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Easyship rate request failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
    <header className="border-b border-[#dfe3e8] bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9a763b]">KCPL Commercial Intelligence</p><h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Live Courier Rates</h1><p className="mt-2 max-w-3xl text-xs leading-5 text-[#68747f]">Compare live Easyship courier options before KCPL prepares an express or parcel quotation. Identical requests are cached for 10 minutes to reduce paid API calls.</p></div>
        <span className="rounded-full border border-[#dfe3e8] bg-[#f8f9fa] px-3 py-2 text-[10px] font-black uppercase tracking-[.08em] text-[#68747f]">{roleLabel}</span>
      </div>
    </header>

    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl border border-[#dfe3e8] bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#10263f] text-white"><PackageSearch size={18}/></span><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#9a763b]">Easyship Rates API</p><h2 className="mt-1 text-xl font-black">Parcel details</h2><p className="mt-1 text-xs leading-5 text-[#7a858f]">Select structured locations, enter postal codes and parcel measurements, then request current courier rates.</p></div></div>
        <form onSubmit={calculate} className="grid gap-4 md:grid-cols-4">
          <LocationAutocomplete label="Origin" value={origin} onChange={setOrigin}/>
          <LocationAutocomplete label="Destination" value={destination} onChange={setDestination}/>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Origin postcode</span><input required className={inputClass} value={origin.postalCode} onChange={(event) => setOrigin((current) => ({ ...current, postalCode: event.target.value }))} placeholder="44600"/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Destination postcode</span><input required className={inputClass} value={destination.postalCode} onChange={(event) => setDestination((current) => ({ ...current, postalCode: event.target.value }))} placeholder="3000"/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Parcel quantity</span><input required min="1" max="50" step="1" type="number" className={inputClass} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Weight per parcel (kg)</span><input required min="0.01" step="0.01" type="number" className={inputClass} value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Length (cm)</span><input required min="0.1" step="0.1" type="number" className={inputClass} value={form.length} onChange={(event) => setForm({ ...form, length: event.target.value })}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Width (cm)</span><input required min="0.1" step="0.1" type="number" className={inputClass} value={form.width} onChange={(event) => setForm({ ...form, width: event.target.value })}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Height (cm)</span><input required min="0.1" step="0.1" type="number" className={inputClass} value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Declared value per parcel</span><input required min="1" step="0.01" type="number" className={inputClass} value={form.declaredValue} onChange={(event) => setForm({ ...form, declaredValue: event.target.value })}/></label>
          <label><span className="text-[11px] font-semibold text-[#5f6973]">Declared currency</span><select className={inputClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as QuoteCurrency })}>{quoteCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
          <div className="flex items-end"><button disabled={busy} type="submit" className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#10263f] px-4 text-sm font-black text-white transition hover:bg-[#173650] disabled:opacity-50"><Calculator size={16}/>{busy ? "Checking Easyship…" : "Get live rates"}</button></div>
        </form>
      </section>

      {error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800"><div className="flex items-start gap-3"><TriangleAlert size={18} className="mt-0.5 shrink-0"/><div><p className="text-sm font-black">Rates unavailable</p><p className="mt-1 text-xs leading-5">{error}</p></div></div></div> : null}

      {result ? <div className="mt-5 space-y-5">
        <section className="grid gap-3 md:grid-cols-3">
          <SummaryCard eyebrow="Cheapest" rate={cheapest}/><SummaryCard eyebrow="Fastest" rate={fastest}/><SummaryCard eyebrow="Best value" rate={bestValue}/>
        </section>
        <section className="overflow-hidden rounded-2xl border border-[#dfe3e8] bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 bg-[#0a1828] p-5 text-white"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#d4ad62]">Easyship results</p><h2 className="mt-1 text-xl font-black">{result.origin} → {result.destination}</h2><p className="mt-2 text-xs text-white/55">{result.quantity} parcel{result.quantity === 1 ? "" : "s"} · {result.total_weight_kg.toFixed(2)} kg total</p></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.1em] ${result.environment === "production" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/15 text-amber-200"}`}>{result.environment}</span></div>
          <div className="divide-y divide-[#edf0f2]">
            {result.rates.map((rate, index) => <div key={`${rate.courier_service_id}:${rate.courier_name}:${index}`} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_180px_180px] md:items-center">
              <div><div className="flex items-center gap-2"><strong className="text-sm text-[#10263f]">{rate.courier_name}</strong>{rate.value_for_money_rank === 1 ? <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7e5] px-2 py-1 text-[9px] font-black uppercase tracking-[.08em] text-[#856328]"><Sparkles size={10}/>Best value</span> : null}</div>{rate.description ? <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#7a858f]">{rate.description}</p> : null}<p className="mt-2 text-[10px] text-[#929ba3]">Easyship rating {rate.easyship_rating ?? "–"} · Tracking {rate.tracking_rating ?? "–"}</p></div>
              <div><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#929ba3]">Delivery</p><p className="mt-1 text-sm font-black">{deliveryLabel(rate)}</p></div>
              <div className="md:text-right"><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#929ba3]">Total rate</p><p className="mt-1 text-lg font-black tracking-[-.02em]">{money(rate.total_charge, rate.currency)}</p></div>
            </div>)}
          </div>
          <div className="border-t border-[#edf0f2] p-5 text-[10px] leading-5 text-[#7f8992]"><div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900"><ShieldCheck size={15} className="mt-0.5 shrink-0"/><span>{result.disclaimer}</span></div><p className="mt-3 flex items-center gap-1.5"><Clock3 size={12}/>Fetched {fetchedLabel(result.fetched_at)}</p><a href="https://www.easyship.com" target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-black text-[#80612e] underline underline-offset-4">Powered by Easyship <ExternalLink size={11}/></a></div>
        </section>
      </div> : null}
    </div>
  </main>;
}

function SummaryCard({ eyebrow, rate }: { eyebrow: string; rate: EasyshipRate | null }) {
  return <div className="rounded-2xl border border-[#dfe3e8] bg-white p-4 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#9a763b]">{eyebrow}</p>{rate ? <><p className="mt-2 truncate text-sm font-black text-[#10263f]">{rate.courier_name}</p><p className="mt-1 text-xl font-black">{money(rate.total_charge, rate.currency)}</p><p className="mt-1 text-[10px] text-[#7f8992]">{deliveryLabel(rate)}</p></> : <p className="mt-2 text-xs text-[#8a949d]">Not returned</p>}</div>;
}
