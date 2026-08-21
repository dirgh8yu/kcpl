"use client";

import { ArrowRightLeft, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { OpsButton, OpsErrorState, OpsPanel, OpsStatusBadge } from "../operations-ui";

type Rate = {
  currency: string;
  name: string;
  unit: number;
  buy: number;
  sell: number;
  buy_per_unit: number;
  sell_per_unit: number;
  midpoint_per_unit: number;
};

type Snapshot = {
  provider: string;
  source: string;
  date: string;
  fetched_at: string;
  rates: Rate[];
};

type ApiResult = {
  ok?: boolean;
  snapshot?: Snapshot;
  disclaimer?: string;
  error?: string;
};

type NrbApiRate = {
  currency?: { iso3?: string; ISO3?: string; name?: string; unit?: number | string };
  buy?: number | string;
  sell?: number | string;
};

type NrbPayload = { date?: string; rates?: NrbApiRate[] };
type NrbResponse = { status?: { code?: number | string }; data?: { payload?: NrbPayload[] | null } };

const featuredCurrencies = ["USD", "INR", "CNY", "EUR", "AUD"];
const NRB_FOREX_URL = "https://www.nrb.org.np/api/forex/v1/rates";
const NRB_DISCLAIMER = "NRB reference rates only. Commercial banks and actual settlement rates may differ.";
const FRIENDLY_ERROR = "Reference rates are temporarily unavailable. Existing KCPL data is unaffected.";

function npr(value: number) {
  return new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 2 }).format(value);
}

function rateNumber(value: number) {
  return new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function kathmanduDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysBefore(dateText: string, days: number) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function fetchedLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function normalizeDirectRate(item: NrbApiRate): Rate | null {
  const currency = (item.currency?.iso3 || item.currency?.ISO3 || "").trim().toUpperCase();
  const unit = numberValue(item.currency?.unit);
  const buy = numberValue(item.buy);
  const sell = numberValue(item.sell);
  if (!currency || !unit || unit <= 0 || buy === null || sell === null || buy < 0 || sell < 0) return null;
  const buyPerUnit = buy / unit;
  const sellPerUnit = sell / unit;
  return { currency, name: item.currency?.name?.trim() || currency, unit, buy, sell, buy_per_unit: buyPerUnit, sell_per_unit: sellPerUnit, midpoint_per_unit: (buyPerUnit + sellPerUnit) / 2 };
}

async function requestDirectFromNrb() {
  const today = kathmanduDate();
  const params = new URLSearchParams({ page: "1", per_page: "10", from: daysBefore(today, 7), to: today });
  const response = await fetch(`${NRB_FOREX_URL}?${params.toString()}`, { cache: "no-store", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`NRB direct request returned HTTP ${response.status}.`);

  const body = await response.json() as NrbResponse;
  if (Number(body.status?.code) !== 200 || !Array.isArray(body.data?.payload)) throw new Error("NRB direct request returned an unexpected response.");
  const latest = [...body.data.payload].filter((item) => typeof item.date === "string" && Array.isArray(item.rates)).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  if (!latest?.date || !latest.rates) throw new Error("NRB direct request returned no published rate set.");

  const supported = new Set<string>(crmCurrencies.filter((item) => item !== "NPR"));
  const rates = latest.rates.map(normalizeDirectRate).filter((rate): rate is Rate => rate !== null && supported.has(rate.currency));
  if (!rates.length) throw new Error("NRB direct request returned no usable KCPL currencies.");

  return {
    snapshot: { provider: "Nepal Rastra Bank", source: "NRB Forex API v1 · direct fallback", date: latest.date, fetched_at: new Date().toISOString(), rates } satisfies Snapshot,
    disclaimer: `${NRB_DISCLAIMER} Loaded directly from NRB because the KCPL server-side request was unavailable.`,
  };
}

async function requestForex() {
  try {
    const response = await fetch("/api/admin/forex", { cache: "no-store" });
    const data = await response.json() as ApiResult;
    if (!response.ok || !data.ok || !data.snapshot) throw new Error(data.error || "KCPL server-side NRB request failed.");
    return { snapshot: data.snapshot, disclaimer: data.disclaimer || NRB_DISCLAIMER };
  } catch (serverError) {
    try {
      return await requestDirectFromNrb();
    } catch (directError) {
      console.warn("NRB reference rate retrieval failed", { serverError, directError });
      throw new Error(FRIENDLY_ERROR);
    }
  }
}

export function ForexReferencePanel({ compact = false }: { compact?: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CrmCurrency>("USD");
  const [amount, setAmount] = useState("1000");

  useEffect(() => {
    let active = true;
    void requestForex()
      .then((data) => {
        if (!active) return;
        setSnapshot(data.snapshot);
        setDisclaimer(data.disclaimer);
      })
      .catch(() => {
        if (!active) return;
        setError(FRIENDLY_ERROR);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await requestForex();
      setSnapshot(data.snapshot);
      setDisclaimer(data.disclaimer);
    } catch {
      setError(FRIENDLY_ERROR);
    } finally {
      setLoading(false);
    }
  }

  const rate = useMemo(() => snapshot?.rates.find((item) => item.currency === currency) ?? null, [currency, snapshot]);
  const numericAmount = Number(amount);
  const midpointNpr = rate && Number.isFinite(numericAmount) && numericAmount >= 0 ? numericAmount * rate.midpoint_per_unit : null;
  const supportedCurrencies = crmCurrencies.filter((item) => item !== "NPR" && snapshot?.rates.some((rateItem) => rateItem.currency === item));
  const featured = featuredCurrencies.map((code) => snapshot?.rates.find((item) => item.currency === code)).filter((item): item is Rate => Boolean(item));

  return (
    <OpsPanel
      title="Nepal Rastra Bank reference rates"
      eyebrow="Forex reference"
      description="Official reference rates normalised to NPR per one foreign-currency unit. These rates are informational and never overwrite historical transaction rates."
      action={<div className="flex items-center gap-2">{snapshot ? <OpsStatusBadge tone="info">Rate date {snapshot.date}</OpsStatusBadge> : null}<OpsButton tone="ghost" onClick={() => void refresh()} disabled={loading}><RefreshCw size={12} className={loading ? "animate-spin" : ""}/><span className={compact ? "sr-only" : ""}>Refresh</span></OpsButton></div>}
    >
      {error ? <OpsErrorState tone="warning" title="Reference rates are temporarily unavailable" detail="Existing KCPL data is unaffected. Retry when the Nepal Rastra Bank service is available." action={<OpsButton onClick={() => void refresh()} disabled={loading}>Retry</OpsButton>}/> : null}

      {loading && !snapshot ? <div className="grid gap-px bg-[#eceef0] sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="bg-white p-3"><div className="h-3 w-10 animate-pulse rounded bg-[#eceef0]"/><div className="mt-3 h-4 w-24 animate-pulse rounded bg-[#eceef0]"/><div className="mt-2 h-2.5 w-32 animate-pulse rounded bg-[#f0f1f2]"/></div>)}</div> : null}

      {snapshot ? <>
        <div className={`grid gap-px bg-[#eceef0] ${compact ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-3 lg:grid-cols-5"}`}>
          {featured.map((item) => <div key={item.currency} className="bg-white px-3.5 py-3"><div className="flex items-center justify-between gap-2"><strong className="text-[11px] font-semibold text-[#353c43]">{item.currency}</strong><span className="text-[9px] text-[#9aa0a7]">unit {item.unit}</span></div><p className="mt-1.5 text-[15px] font-semibold tracking-[-.025em] text-[#23282e]">{rateNumber(item.midpoint_per_unit)} <span className="text-[10px] font-medium text-[#7f8790]">NPR</span></p><p className="mt-1 text-[9px] text-[#91989f]">Buy {rateNumber(item.buy_per_unit)} · Sell {rateNumber(item.sell_per_unit)}</p></div>)}
        </div>

        <div className="grid gap-4 border-t border-[#eceef0] p-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-end">
          <div><div className="flex items-center gap-2 text-[10px] font-medium text-[#737b84]"><ArrowRightLeft size={12}/>Indicative converter</div><div className="mt-2 flex flex-wrap items-center gap-2"><select className="h-9 min-w-[100px] px-2.5" value={currency} onChange={(event) => setCurrency(event.target.value as CrmCurrency)}>{supportedCurrencies.map((item) => <option key={item}>{item}</option>)}</select><input min="0" step="0.01" type="number" className="h-9 min-w-[150px] flex-1 px-3" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount"/><span className="text-[11px] text-[#8a929a]">≈</span><strong className="text-[15px] font-semibold tracking-[-.02em] text-[#2d3339]">{midpointNpr === null ? "—" : npr(midpointNpr)}</strong></div></div>
          <div className="text-[9px] leading-4 text-[#8b9299]"><p><strong className="font-medium text-[#626b74]">Source:</strong> {snapshot.provider} · {snapshot.source}</p><p className="mt-1"><strong className="font-medium text-[#626b74]">Fetched:</strong> {fetchedLabel(snapshot.fetched_at)}</p>{disclaimer ? <p className="mt-1">{disclaimer}</p> : null}</div>
        </div>
      </> : null}
    </OpsPanel>
  );
}
