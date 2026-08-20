"use client";

import { ArrowRightLeft, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";

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

type NrbPayload = {
  date?: string;
  rates?: NrbApiRate[];
};

type NrbResponse = {
  status?: { code?: number | string };
  data?: { payload?: NrbPayload[] | null };
};

const featuredCurrencies = ["USD", "INR", "CNY", "EUR", "AUD"];
const NRB_FOREX_URL = "https://www.nrb.org.np/api/forex/v1/rates";
const NRB_DISCLAIMER = "NRB reference rates only. Commercial banks and actual settlement rates may differ.";

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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysBefore(dateText: string, days: number) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function normalizeDirectRate(item: NrbApiRate): Rate | null {
  const currency = (item.currency?.iso3 || item.currency?.ISO3 || "").trim().toUpperCase();
  const unit = numberValue(item.currency?.unit);
  const buy = numberValue(item.buy);
  const sell = numberValue(item.sell);
  if (!currency || !unit || unit <= 0 || buy === null || sell === null || buy < 0 || sell < 0) return null;
  const buyPerUnit = buy / unit;
  const sellPerUnit = sell / unit;
  return {
    currency,
    name: item.currency?.name?.trim() || currency,
    unit,
    buy,
    sell,
    buy_per_unit: buyPerUnit,
    sell_per_unit: sellPerUnit,
    midpoint_per_unit: (buyPerUnit + sellPerUnit) / 2,
  };
}

async function requestDirectFromNrb() {
  const today = kathmanduDate();
  const params = new URLSearchParams({ page: "1", per_page: "10", from: daysBefore(today, 7), to: today });
  const response = await fetch(`${NRB_FOREX_URL}?${params.toString()}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`NRB direct request returned HTTP ${response.status}.`);

  const body = await response.json() as NrbResponse;
  if (Number(body.status?.code) !== 200 || !Array.isArray(body.data?.payload)) {
    throw new Error("NRB direct request returned an unexpected response.");
  }

  const latest = [...body.data.payload]
    .filter((item) => typeof item.date === "string" && Array.isArray(item.rates))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  if (!latest?.date || !latest.rates) throw new Error("NRB direct request returned no published rate set.");

  const supported = new Set(crmCurrencies.filter((item) => item !== "NPR"));
  const rates = latest.rates
    .map(normalizeDirectRate)
    .filter((rate): rate is Rate => Boolean(rate) && supported.has(rate.currency as CrmCurrency));
  if (!rates.length) throw new Error("NRB direct request returned no usable KCPL currencies.");

  return {
    snapshot: {
      provider: "Nepal Rastra Bank",
      source: "NRB Forex API v1 · direct fallback",
      date: latest.date,
      fetched_at: new Date().toISOString(),
      rates,
    } satisfies Snapshot,
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
      const serverMessage = serverError instanceof Error ? serverError.message : "KCPL server-side NRB request failed.";
      const directMessage = directError instanceof Error ? directError.message : "Direct NRB request failed.";
      throw new Error(`${serverMessage} Browser fallback also failed: ${directMessage}`);
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
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "NRB reference rates could not be loaded.");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "NRB reference rates could not be loaded.");
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
    <section className={`border-b border-[#dfe3e8] bg-[#fbfaf6] ${compact ? "px-4 py-3 sm:px-6" : "px-4 py-4 sm:px-6 lg:px-8"}`}>
      <div className="mx-auto max-w-[1700px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><ArrowRightLeft size={14} className="text-[#9a763b]"/><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#9a763b]">NRB reference forex</p></div>
            <p className="mt-1 text-xs text-[#69747d]">Official Nepal Rastra Bank reference rates, normalised to NPR per 1 foreign-currency unit.</p>
          </div>
          <div className="flex items-center gap-2">
            {snapshot ? <span className="rounded-full border border-[#dfe3e8] bg-white px-3 py-1.5 text-[10px] font-bold text-[#69747d]">Rate date {snapshot.date}</span> : null}
            <button type="button" onClick={() => void refresh()} disabled={loading} className="grid h-8 w-8 place-items-center rounded-lg border border-[#dfe3e8] bg-white text-[#66717b] disabled:opacity-50" aria-label="Refresh NRB forex rates"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/></button>
          </div>
        </div>

        {error ? <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"><TriangleAlert size={14} className="mt-0.5 shrink-0"/><span>{error}</span></div> : null}

        {snapshot ? <div className={`mt-3 grid gap-3 ${compact ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-[minmax(0,1fr)_430px]"}`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {featured.map((item) => <div key={item.currency} className="rounded-xl border border-[#e1e5e8] bg-white px-3 py-2.5"><div className="flex items-center justify-between gap-2"><strong className="text-xs text-[#10263f]">{item.currency}</strong><span className="text-[9px] text-[#929aa2]">unit {item.unit}</span></div><p className="mt-1 text-sm font-black text-[#10263f]">{rateNumber(item.midpoint_per_unit)} NPR</p><p className="mt-1 text-[9px] text-[#8a949d]">Buy {rateNumber(item.buy_per_unit)} · Sell {rateNumber(item.sell_per_unit)}</p></div>)}
          </div>

          <div className="rounded-xl border border-[#d8c393] bg-[#fffaf0] p-3">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
              <select className="h-9 rounded-lg border border-[#dfd3b9] bg-white px-2 text-xs font-bold" value={currency} onChange={(event) => setCurrency(event.target.value as CrmCurrency)}>{supportedCurrencies.map((item) => <option key={item}>{item}</option>)}</select>
              <input min="0" step="0.01" type="number" className="h-9 min-w-0 rounded-lg border border-[#dfd3b9] bg-white px-3 text-xs outline-none" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount"/>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#9a763b]">Indicative NPR midpoint</p><p className="mt-0.5 text-lg font-black text-[#10263f]">{midpointNpr === null ? "—" : npr(midpointNpr)}</p></div>{rate ? <p className="text-right text-[9px] leading-4 text-[#81745d]">1 {currency} ≈ {rateNumber(rate.midpoint_per_unit)} NPR<br/>Buy {rateNumber(rate.buy_per_unit)} · Sell {rateNumber(rate.sell_per_unit)}</p> : null}</div>
          </div>
        </div> : loading ? <div className="mt-3 h-16 animate-pulse rounded-xl bg-[#eef0f1]"/> : null}

        {snapshot && disclaimer ? <p className="mt-2 text-[9px] leading-4 text-[#8b949b]">{disclaimer} Historical invoices should retain the rate actually used at the time of the transaction.</p> : null}
      </div>
    </section>
  );
}
