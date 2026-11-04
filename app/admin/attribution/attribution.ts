import {
  quoteAttributionGroupKey,
  quoteAttributionLabel,
  quoteFunnelStage,
  sanitizeQuoteAttribution,
  type QuoteAttribution,
} from "../../quote-attribution.ts";

export type AttributionInvoice = {
  quote_reference?: string | null;
  currency?: string | null;
  status?: string | null;
  total?: number | null;
  amount_paid?: number | null;
};

export type AttributionRow = {
  key: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  tool: string | null;
  enquiries: number;
  quoted: number;
  won: number;
  lost: number;
  open: number;
  values: Record<string, number>;
  invoiced: Record<string, number>;
  collected: Record<string, number>;
};

export type AttributionReport = {
  rows: AttributionRow[];
  total: number;
  won: number;
  quoted: number;
  valued: Record<string, number>;
  invoiced: Record<string, number>;
  collected: Record<string, number>;
  unattributed: number;
};

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function quoteAttribution(data: Record<string, unknown>): QuoteAttribution | null {
  const saved = sanitizeQuoteAttribution(data.attribution);
  if (saved) return saved;
  const source = text(data.source);
  if (source === "customer_portal" || source === "customer_app") {
    return {
      source: source === "customer_app" ? "KCPL app" : "Customer portal",
      medium: "authenticated",
      campaign: null,
      content: null,
      term: null,
      tool: null,
      referrer_host: null,
      landing_path: source === "customer_app" ? "/app/requests" : "/portal/requests",
    };
  }
  return null;
}

/**
 * Deterministic rollup of quote records into lead-source performance. Reads
 * only the allowlisted attribution block and the commercial outcome fields;
 * customer names and contact details never enter the report.
 */
export function buildAttributionReport(
  records: Array<{ data: Record<string, unknown> }>,
  invoices: AttributionInvoice[] = [],
): AttributionReport {
  const groups = new Map<string, AttributionRow>();
  const quoteGroups = new Map<string, string>();
  const valued: Record<string, number> = {};
  const invoiced: Record<string, number> = {};
  const collected: Record<string, number> = {};
  let won = 0;
  let quoted = 0;
  let unattributed = 0;

  for (const record of records) {
    const data = record.data;
    const attribution = quoteAttribution(data);
    if (!attribution) unattributed += 1;
    const key = quoteAttributionGroupKey(attribution);
    const reference = text(data.reference).trim().toUpperCase();
    if (reference) quoteGroups.set(reference, key);
    const row = groups.get(key) ?? {
      key,
      source: attribution?.source ?? "direct",
      medium: attribution?.medium ?? null,
      campaign: attribution?.campaign ?? null,
      tool: attribution?.tool ?? null,
      enquiries: 0,
      quoted: 0,
      won: 0,
      lost: 0,
      open: 0,
      values: {},
      invoiced: {},
      collected: {},
    };
    row.enquiries += 1;
    const stage = quoteFunnelStage(data.status);
    if (stage === "quoted" || stage === "won") row.quoted += 1;
    if (stage === "won") row.won += 1;
    if (stage === "lost") row.lost += 1;
    if (stage === "enquiry" || stage === "open") row.open += 1;
    if (stage === "quoted" || stage === "won") {
      const currency = text(data.quote_currency).toUpperCase() || "USD";
      const amount = numberValue(data.quoted_amount);
      if (amount > 0) {
        row.values[currency] = (row.values[currency] ?? 0) + amount;
        valued[currency] = (valued[currency] ?? 0) + amount;
      }
      quoted += 1;
    }
    if (stage === "won") won += 1;
    groups.set(key, row);
  }

  // Realized money is read from the invoice's own ledger, never re-derived
  // from a quote. A cancelled or unissued invoice contributes nothing.
  for (const invoice of invoices) {
    const quoteReference = text(invoice.quote_reference).trim().toUpperCase();
    if (!quoteReference) continue;
    if (invoice.status === "draft" || invoice.status === "void" || invoice.status === "cancelled") continue;
    const key = quoteGroups.get(quoteReference);
    const row = key ? groups.get(key) : null;
    if (!row) continue;
    const currency = text(invoice.currency).toUpperCase() || "USD";
    const charged = numberValue(invoice.total);
    const paid = numberValue(invoice.amount_paid);
    row.invoiced[currency] = (row.invoiced[currency] ?? 0) + charged;
    row.collected[currency] = (row.collected[currency] ?? 0) + paid;
    invoiced[currency] = (invoiced[currency] ?? 0) + charged;
    collected[currency] = (collected[currency] ?? 0) + paid;
  }

  const rows = [...groups.values()].sort((a, b) => b.enquiries - a.enquiries || b.won - a.won || quoteAttributionLabel(a).localeCompare(quoteAttributionLabel(b)));
  return { rows, total: records.length, won, quoted, valued, invoiced, collected, unattributed };
}
