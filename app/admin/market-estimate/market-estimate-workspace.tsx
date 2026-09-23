"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Calculator, Copy, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { quoteCurrencies, type QuoteCurrency } from "../admin-data";
import { OpsButton, OpsFact, OpsFacts, OpsField, OpsInlineAlert, OpsInspectorNote, OpsNotice, OpsSurface } from "../operations-ui";

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

const inputClass = "ops-input";

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
  const listboxId = `market-estimate-${label.toLowerCase()}-suggestions`;

  useEffect(() => {
    const query = value.trim();
    if (!open || query.length < 2) return;

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
    setSearching(false);
    setOpen(false);
  }

  return (
    <div className="market-location ops-form-wide">
      <OpsField label={label}>
        <span className="market-location-input">
          <MapPin size={14} strokeWidth={1.75} aria-hidden="true"/>
          <input
            required
            autoComplete="off"
            role="combobox"
            aria-controls={listboxId}
            aria-expanded={open && value.trim().length >= 2}
            aria-autocomplete="list"
            className={inputClass}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setSuggestions([]);
              setSearching(false);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 160)}
            placeholder={placeholder}
          />
        </span>
      </OpsField>

      {open && value.trim().length >= 2 ? (
        <div id={listboxId} role="listbox" className="market-suggest">
          {searching && combined.length === 0 ? <p className="market-suggest-status">Searching locations…</p> : null}
          {!searching && combined.length === 0 ? <div className="market-suggest-status"><strong>No dropdown match yet.</strong> Try city + country, or enter a 3-letter IATA airport code / 5-character UN/LOCODE directly.</div> : null}
          {combined.map((suggestion) => (
            <button
              key={`${suggestion.kind}:${suggestion.value}`}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
              className="market-suggest-option"
            >
              <strong>{suggestion.label}</strong>
              <span>{suggestion.kind}{suggestion.detail ? ` · ${suggestion.detail}` : ""}</span>
            </button>
          ))}
          <p className="market-suggest-foot">Global place suggestions © OpenStreetMap contributors, served via Photon. Airport and seaport codes are accepted directly by Freightos.</p>
        </div>
      ) : null}
    </div>
  );
}

export function MarketEstimateWorkspace() {
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

  return <div className="market-estimate">
    <OpsSurface density="compact" title="Freight benchmark" description="Use the same route and cargo details you are considering for the KCPL quotation.">
      <form onSubmit={calculate}>
        <div className="ops-form-grid">
          <LocationAutocomplete label="Origin" value={form.origin} onChange={(origin) => setForm((current) => ({ ...current, origin }))} placeholder="Start typing Kathmandu, KTM, CNSHA…"/>
          <LocationAutocomplete label="Destination" value={form.destination} onChange={(destination) => setForm((current) => ({ ...current, destination }))} placeholder="Start typing Melbourne, MEL, USLAX…"/>
        </div>
        <p className="ops-inspector-hint market-hint">Select a dropdown location whenever possible. Freightos also accepts exact 3-letter IATA airport codes and 5-character UN/LOCODE seaport codes.</p>

        <div className="ops-form-grid market-cargo">
          <OpsField label="Mode"><select className={inputClass} value={form.mode} onChange={(event) => setMode(event.target.value as EstimateMode)}>{modes.map((mode) => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></OpsField>
          <OpsField label="Load type"><select className={inputClass} value={form.loadType} onChange={(event) => setForm({ ...form, loadType: event.target.value as LoadType })}>{relevantLoadTypes.map((item) => <option key={item} value={item}>{loadTypeLabels[item]}</option>)}</select></OpsField>
          <OpsField label="Quantity"><input min="1" max="99" step="1" type="number" className={inputClass} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })}/></OpsField>
          <OpsField label="Estimate currency"><select className={inputClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as QuoteCurrency })}>{quoteCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField>
          <OpsField label="Weight per unit"><span className="market-unit-input"><input required={!containerMode} min="0.01" step="0.01" type="number" className={inputClass} value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} placeholder="0"/><select className={inputClass} value={form.weightUnit} onChange={(event) => setForm({ ...form, weightUnit: event.target.value })} aria-label="Weight unit"><option value="kg">kg</option><option value="lb">lb</option><option value="ton">ton</option></select></span></OpsField>
          <OpsField label="Dimension unit"><select className={inputClass} value={form.dimensionUnit} onChange={(event) => setForm({ ...form, dimensionUnit: event.target.value })}><option value="cm">cm</option><option value="m">m</option><option value="inch">inch</option></select></OpsField>
          <OpsField label="Length"><input required={!containerMode} min="0.01" step="0.01" type="number" className={inputClass} value={form.length} onChange={(event) => setForm({ ...form, length: event.target.value })} placeholder={containerMode ? "Optional" : "Required"}/></OpsField>
          <OpsField label="Width"><input required={!containerMode} min="0.01" step="0.01" type="number" className={inputClass} value={form.width} onChange={(event) => setForm({ ...form, width: event.target.value })} placeholder={containerMode ? "Optional" : "Required"}/></OpsField>
          <OpsField label="Height"><input required={!containerMode} min="0.01" step="0.01" type="number" className={inputClass} value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })} placeholder={containerMode ? "Optional" : "Required"}/></OpsField>
        </div>
        {!containerMode ? <p className="ops-inspector-hint market-hint">Freightos requires weight plus length, width and height for boxes, crates and pallets.</p> : null}

        <div className="ops-form-actions market-actions">
          <OpsButton type="submit" variant="primary" size="sm" disabled={busy}><Calculator size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Checking external market…" : "Get external estimate"}</OpsButton>
        </div>
      </form>
    </OpsSurface>

    <aside className="market-result">
      {error ? <div role="alert"><OpsNotice tone="danger"><strong>Estimate unavailable.</strong> {error}</OpsNotice></div> : null}
      {notice ? <OpsInlineAlert tone="success" icon={<Copy size={14} strokeWidth={1.75} aria-hidden="true"/>}>{notice}</OpsInlineAlert> : null}

      {estimate ? <OpsSurface density="compact" title={<span className="market-route">{estimate.origin} → {estimate.destination}</span>} description={<>{estimate.mode} · {estimate.load_type} × {estimate.quantity}</>}>
        <p className="market-range-label">Estimated freight range</p>
        <p className="plan-result">{money(estimate.min, estimate.currency)} – {money(estimate.max, estimate.currency)}</p>
        <OpsFacts>
          <OpsFact label="Midpoint">{money(estimate.midpoint, estimate.currency)}</OpsFact>
          <OpsFact label="Transit">{estimate.transit_min !== null && estimate.transit_max !== null ? `${estimate.transit_min}–${estimate.transit_max} ${estimate.transit_unit}` : "Not returned"}</OpsFact>
          {estimate.num_quotes !== null ? <OpsFact label="Quotes">{`${estimate.num_quotes} marketplace quote${estimate.num_quotes === 1 ? "" : "s"}`}</OpsFact> : null}
          <OpsFact label="Fetched">{fetchedLabel(estimate.fetched_at)}</OpsFact>
          <OpsFact label="Source">{estimate.source}</OpsFact>
        </OpsFacts>
        <div className="plan-subform"><OpsInspectorNote tone="warning" icon={<ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Advisory benchmark">{estimate.disclaimer}</OpsInspectorNote></div>
        <div className="ops-inspector-actions plan-section-actions">
          <OpsButton type="button" variant="secondary" size="sm" onClick={copyMidpoint}><Copy size={14} strokeWidth={1.75} aria-hidden="true"/>Copy midpoint</OpsButton>
          <a href={estimate.attribution_url} target="_blank" rel="noreferrer" className="ops-button" data-variant="ghost" data-size="sm">Powered by Freightos<ExternalLink size={14} strokeWidth={1.75} aria-hidden="true"/></a>
        </div>
      </OpsSurface> : <OpsSurface density="compact" title="Benchmark before you quote">
        <p className="ops-inspector-hint">Check the external range, compare it with KCPL partner and vendor rates, then price the customer from the real expected buy cost plus KCPL margin. A market estimate should never silently become the final quote.</p>
      </OpsSurface>}
    </aside>
  </div>;
}
