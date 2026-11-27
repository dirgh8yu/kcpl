import type { QuoteSummary } from "./admin-data";

/*
 * The corridor filter for the enquiry inbox.
 *
 * The desk reads the lead-source rollup and then has to open the enquiries
 * behind one row; that means filtering by the same lane slug the rollup counts,
 * not by a substring of a city name. Kept apart from the dashboard so the rule
 * can be tested without a browser.
 */

export const anyCorridor = "all";

type CorridorRow = Pick<QuoteSummary, "lane_slug">;

/** The corridors present in this inbox, in page order, once each. */
export function corridorOptions(quotes: CorridorRow[]): string[] {
  const slugs = quotes.map((quote) => quote.lane_slug).filter((slug): slug is string => Boolean(slug));
  return [...new Set(slugs)].sort();
}

/** The enquiries from one corridor, or all of them when the filter is "all". */
export function filterQuotesByCorridor<T extends CorridorRow>(quotes: T[], slug: string): T[] {
  if (!slug || slug === anyCorridor) return quotes;
  return quotes.filter((quote) => quote.lane_slug === slug);
}
