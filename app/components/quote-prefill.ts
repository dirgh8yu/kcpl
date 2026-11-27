/*
 * The route a quote link hands to the form.
 *
 * Kept apart from the component so the rule is testable: a lane page passes
 * origin, destination and mode, and the form repeats them back to the reader
 * and to a screen reader. A bare /quote, or a link missing one of the two
 * cities, has no corridor to announce.
 */

export const quoteModes = ["air", "sea", "road", "unsure"] as const;
export type QuoteMode = (typeof quoteModes)[number];

export type PrefillInput = { origin?: string; destination?: string; mode?: string };

export type PrefilledRoute = { origin: string; destination: string; mode: QuoteMode };

export function quotePrefillRoute(initial: PrefillInput): PrefilledRoute | null {
  const origin = (initial.origin ?? "").trim();
  const destination = (initial.destination ?? "").trim();
  if (!origin || !destination) return null;
  const mode = quoteModes.includes((initial.mode ?? "") as QuoteMode) ? initial.mode as QuoteMode : "unsure";
  return { origin, destination, mode };
}
