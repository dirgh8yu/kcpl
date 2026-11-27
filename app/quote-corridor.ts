import { laneFor, laneSlugs, type LaneSlug } from "./lane-data.ts";
import { lanePagePath } from "./quote-attribution.ts";

/*
 * The corridor an enquiry came from, in English, kept beside the words the
 * visitor actually typed.
 *
 * A Nepali reader submits काठमाडौं → ल्हासा; a Chinese reader submits 加德满都 →
 * 拉萨. Both are the same corridor, and a staff filter for "Kathmandu" has to
 * find them. The lane slug is the key; the two city names come from the English
 * lane copy, so they cannot drift from the page that produced the enquiry.
 *
 * The lane index carries no corridor of its own: a reader who reached the form
 * from /lanes has not named one, so the slug and the cities stay null rather
 * than being guessed.
 */

export type QuoteCorridor = {
  lane_slug: string | null;
  lane_origin: string | null;
  lane_destination: string | null;
};

const empty: QuoteCorridor = { lane_slug: null, lane_origin: null, lane_destination: null };

export function quoteCorridor(lanePath: string | null | undefined): QuoteCorridor {
  const path = lanePagePath(lanePath);
  const slug = path?.split("/").pop() ?? "";
  if (!slug || !laneSlugs.includes(slug as LaneSlug)) return empty;
  const canonical = laneFor("en", slug as LaneSlug);
  return { lane_slug: slug, lane_origin: canonical.origin, lane_destination: canonical.destination };
}
