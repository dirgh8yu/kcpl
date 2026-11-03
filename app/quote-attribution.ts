/*
 * First-party quote attribution.
 *
 * This is not analytics: nothing here is sent to a third party and no cookie
 * is set. It records the marketing context that brought a visitor to the form
 * alongside the quote itself, so KCPL can connect a calculator or campaign to
 * the enquiries and revenue that followed. Query-string values are allowlisted
 * and bounded; free text, email addresses and search terms never enter the
 * record.
 */

export const quoteAttributionKeys = ["source", "medium", "campaign", "content", "term", "tool"] as const;
export type QuoteAttributionKey = (typeof quoteAttributionKeys)[number];

export const quoteToolValues = ["duty-estimate", "storage-charges", "volume-weight"] as const;

export type QuoteAttribution = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  tool: string | null;
  referrer_host: string | null;
  landing_path: string;
};

const limits: Record<QuoteAttributionKey, number> = {
  source: 80,
  medium: 80,
  campaign: 120,
  content: 120,
  term: 120,
  tool: 40,
};

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function safePath(value: unknown) {
  const path = clean(value, 180).split(/[?#]/, 1)[0];
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/quote";
  return path.replace(/\/{2,}/g, "/");
}

function hostOnly(value: unknown) {
  const raw = clean(value, 400);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().slice(0, 120) || null;
  } catch {
    return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(raw) ? raw.toLowerCase().slice(0, 120) : null;
  }
}

/** Values a landing page can pass to the quote form. Unknown keys are ignored. */
export function captureQuoteAttribution(input: {
  search: string;
  referrer?: string;
  pathname?: string;
}): QuoteAttribution {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
  } catch {
    params = new URLSearchParams();
  }
  const pick = (key: QuoteAttributionKey) => clean(params.get(`utm_${key}`) ?? params.get(key), limits[key]) || null;
  const toolValue = pick("tool");
  const tool = toolValue && (quoteToolValues as readonly string[]).includes(toolValue) ? toolValue : null;
  const source = pick("source") || hostOnly(input.referrer) || "direct";
  return {
    source: source.slice(0, limits.source),
    medium: pick("medium"),
    campaign: pick("campaign"),
    content: pick("content"),
    term: pick("term"),
    tool,
    referrer_host: hostOnly(input.referrer),
    landing_path: safePath(input.pathname),
  };
}

/**
 * Server-side allowlist. A browser can send anything; only the same bounded
 * fields the landing page can produce survive this function.
 */
export function sanitizeQuoteAttribution(value: unknown): QuoteAttribution | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const source = clean(raw.source, limits.source);
  if (!source) return null;
  const toolValue = clean(raw.tool, limits.tool);
  return {
    source,
    medium: clean(raw.medium, limits.medium) || null,
    campaign: clean(raw.campaign, limits.campaign) || null,
    content: clean(raw.content, limits.content) || null,
    term: clean(raw.term, limits.term) || null,
    tool: toolValue && (quoteToolValues as readonly string[]).includes(toolValue) ? toolValue : null,
    referrer_host: hostOnly(raw.referrer_host),
    landing_path: safePath(raw.landing_path),
  };
}

export function quoteAttributionLabel(attribution: Pick<QuoteAttribution, "source" | "medium" | "campaign"> | null | undefined) {
  if (!attribution) return "Direct / unattributed";
  const parts = [attribution.source, attribution.medium, attribution.campaign].filter(Boolean);
  return parts.join(" · ") || "Direct / unattributed";
}

export type QuoteFunnelStage = "enquiry" | "quoted" | "won" | "lost" | "open";

export function quoteFunnelStage(status: unknown): QuoteFunnelStage {
  if (status === "won") return "won";
  if (status === "lost" || status === "cancelled") return "lost";
  if (status === "quoted" || status === "sent" || status === "accepted") return "quoted";
  if (status === "new" || status === "open" || status === "assigned" || status === "in_progress") return "enquiry";
  return "open";
}

export function quoteAttributionGroupKey(attribution: QuoteAttribution | null | undefined) {
  if (!attribution) return "direct";
  return [attribution.source || "direct", attribution.medium || "none", attribution.campaign || "none", attribution.tool || "none"].join("|");
}
