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
  /** The page the form was on — /quote, /ne/quote and so on. */
  landing_path: string;
  /**
   * The lane page that handed the reader to the form, when there was one, so an
   * enquiry from /ne/lanes/nepal-to-tibet is distinguishable from one that
   * started on /services, /guides or a bare /quote visit. Null everywhere else.
   */
  lane_path: string | null;
};

type AttributionIdentity = Pick<QuoteAttribution, "source" | "medium" | "campaign"> & { lane_path?: string | null };

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
  return Array.from(value.normalize("NFKC"))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim()
    .slice(0, max);
}

function safePath(value: unknown) {
  const path = clean(value, 180).split(/[?#]/, 1)[0];
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/quote";
  return path.replace(/\/{2,}/g, "/");
}

/**
 * A lane page path in any of the four locales, normalised, or null. Structural
 * rather than a slug list, so this module stays free of the lane copy and keeps
 * its cost on the client where the form reads it.
 */
export function lanePagePath(value: unknown): string | null {
  const path = clean(value, 180).split(/[?#]/, 1)[0].toLowerCase();
  // The lane index counts too: a reader who sent the enquiry from /lanes has
  // not named a corridor, but the page still produced the enquiry.
  const match = /^\/(?:(ne|hi|zh)\/)?lanes(?:\/([a-z0-9-]{1,64}))?\/?$/.exec(path);
  if (!match) return null;
  return `${match[1] ? `/${match[1]}` : ""}/lanes${match[2] ? `/${match[2]}` : ""}`;
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
    lane_path: lanePagePath(params.get("from")),
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
    lane_path: lanePagePath(raw.lane_path),
  };
}

export function quoteAttributionLabel(attribution: AttributionIdentity | null | undefined) {
  if (!attribution) return "Direct / unattributed";
  // A lane row names the corridor too, because "lane" alone is not a lead
  // source anyone can act on.
  const parts = [attribution.source, attribution.medium, attribution.campaign, attribution.lane_path].filter(Boolean);
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
  // A lane path extends the key so each corridor is its own row; every other
  // enquiry keeps the existing four-part key.
  const key = [attribution.source || "direct", attribution.medium || "none", attribution.campaign || "none", attribution.tool || "none"];
  return [...key, ...(attribution.lane_path ? [attribution.lane_path] : [])].join("|");
}
