export const NRB_FOREX_API_URL = "https://www.nrb.org.np/api/forex/v1/rates";

export type NrbForexRate = {
  currency: string;
  name: string;
  unit: number;
  buy: number;
  sell: number;
  buy_per_unit: number;
  sell_per_unit: number;
  midpoint_per_unit: number;
};

export type NrbForexSnapshot = {
  provider: "Nepal Rastra Bank";
  source: "NRB Forex API v1";
  date: string;
  published_on: string | null;
  modified_on: string | null;
  fetched_at: string;
  rates: NrbForexRate[];
};

type NrbApiRate = {
  currency?: { unit?: number | string; name?: string; ISO3?: string; iso3?: string };
  buy?: number | string;
  sell?: number | string;
};

type NrbApiPayload = {
  date?: string;
  published_on?: string;
  modified_on?: string;
  rates?: NrbApiRate[];
};

type NrbApiResponse = {
  status?: { code?: number | string };
  data?: { payload?: NrbApiPayload[] | null };
};

function isoDateInKathmandu(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function daysBefore(dateText: string, days: number) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRate(rate: NrbApiRate): NrbForexRate | null {
  const currency = (rate.currency?.iso3 ?? rate.currency?.ISO3 ?? "").trim().toUpperCase();
  const name = rate.currency?.name?.trim() ?? currency;
  const unit = numberValue(rate.currency?.unit);
  const buy = numberValue(rate.buy);
  const sell = numberValue(rate.sell);
  if (!currency || !unit || unit <= 0 || buy === null || sell === null || buy < 0 || sell < 0) return null;
  const buyPerUnit = buy / unit;
  const sellPerUnit = sell / unit;
  return {
    currency,
    name,
    unit,
    buy,
    sell,
    buy_per_unit: buyPerUnit,
    sell_per_unit: sellPerUnit,
    midpoint_per_unit: (buyPerUnit + sellPerUnit) / 2,
  };
}

export async function getNrbForexSnapshot(): Promise<NrbForexSnapshot> {
  const today = isoDateInKathmandu();
  const from = daysBefore(today, 7);
  const params = new URLSearchParams({ page: "1", per_page: "10", from, to: today });
  const response = await fetch(`${NRB_FOREX_API_URL}?${params.toString()}`, {
    headers: {
      accept: "application/json",
      "user-agent": "KCPL-Operations/1.0",
    },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`NRB Forex API returned HTTP ${response.status}.`);

  const body = await response.json() as NrbApiResponse;
  if (Number(body.status?.code) !== 200 || !Array.isArray(body.data?.payload)) {
    throw new Error("NRB Forex API returned an unexpected response.");
  }

  const latest = [...body.data.payload]
    .filter((item) => typeof item.date === "string" && Array.isArray(item.rates))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  if (!latest?.date || !latest.rates) throw new Error("NRB Forex API did not return a published rate set.");

  const rates = latest.rates.map(normalizeRate).filter((rate): rate is NrbForexRate => Boolean(rate));
  if (!rates.length) throw new Error("NRB Forex API returned no usable rates.");

  return {
    provider: "Nepal Rastra Bank",
    source: "NRB Forex API v1",
    date: latest.date,
    published_on: latest.published_on ?? null,
    modified_on: latest.modified_on ?? null,
    fetched_at: new Date().toISOString(),
    rates,
  };
}

export function findNrbRate(snapshot: NrbForexSnapshot, currency: string) {
  return snapshot.rates.find((rate) => rate.currency === currency.trim().toUpperCase()) ?? null;
}

export function convertForeignToNpr(amount: number, rate: NrbForexRate, side: "buy" | "sell" | "midpoint" = "midpoint") {
  const perUnit = side === "buy" ? rate.buy_per_unit : side === "sell" ? rate.sell_per_unit : rate.midpoint_per_unit;
  return amount * perUnit;
}
