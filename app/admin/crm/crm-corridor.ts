import { laneFor, laneSlugs, type LaneSlug } from "../../lane-data.ts";
import { quoteCorridor } from "../../quote-corridor.ts";

/*
 * What a quote hands to the customer record when it converts.
 *
 * The quote keeps the words the visitor typed plus the lane slug; the customer
 * keeps the corridor and the source that produced it, so win rate per corridor
 * can be read from customer data instead of being recomputed from quotes that
 * may later be pruned. Older quotes predate the stored slug on the customer, so
 * the attribution path is the fallback, and both resolve to the English lane
 * copy the same way the quote record does.
 */

export type CrmCorridor = {
  laneSlug: string | null;
  laneOrigin: string | null;
  laneDestination: string | null;
  enquirySource: string | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function customerCorridorFromQuote(data: Record<string, unknown>): CrmCorridor {
  const attribution = record(data.attribution);
  const stored = text(data.lane_slug);
  const slug = laneSlugs.includes(stored as LaneSlug)
    ? stored as LaneSlug
    : quoteCorridor(text(attribution?.lane_path)).lane_slug;
  const enquirySource = text(attribution?.source) || null;
  if (!slug) return { laneSlug: null, laneOrigin: null, laneDestination: null, enquirySource };
  const lane = laneFor("en", slug as LaneSlug);
  return {
    laneSlug: slug,
    laneOrigin: text(data.lane_origin) || lane.origin,
    laneDestination: text(data.lane_destination) || lane.destination,
    enquirySource: enquirySource ?? "lane",
  };
}
