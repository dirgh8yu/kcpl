import { laneSlugs, type LaneSlug } from "./lane-data.ts";

/*
 * Which corridor pages a blog note should point at.
 *
 * The blog is the site's largest body of indexed English text and it never
 * linked the lane pages, so the corridors had one inbound link from the nav and
 * nothing from prose. A note earns a corridor link by naming that corridor —
 * Kolkata, Birgunj, Raxaul, the ICD, Haldia, Tibet, Kerung, Rasuwagadhi,
 * Tatopani — or by being about the service that runs it.
 *
 * Two rules keep it honest:
 *  - only a lane the note actually discusses, or the lane of the service it is
 *    filed under, so an air-freight note does not point at a sea corridor;
 *  - at most two, in the lane set's own order, so the block stays a pointer
 *    rather than a link farm.
 *
 * A note that fits neither rule gets no block; 28 of the 108 notes are air,
 * delivery, warehousing or general, and pointing them at a corridor would
 * misdescribe them.
 */

type LaneSource = {
  title: string;
  description: string;
  intro: string;
  related: { service: { href: string } };
};

const keywordLanes: { slug: LaneSlug; pattern: RegExp }[] = [
  { slug: "nepal-to-tibet", pattern: /tibet|lhasa|kerung|rasuwagadhi|tatopani|himalayan crossing|\bchina\b/i },
  { slug: "kolkata-to-birgunj", pattern: /kolkata|birgunj|raxaul|\bicd\b/i },
  { slug: "haldia-to-kathmandu", pattern: /haldia|visakhapatnam|paradip|indian gateway/i },
];

const serviceLanes: Record<string, LaneSlug[]> = {
  "/services/ocean-freight": ["haldia-to-kathmandu"],
  "/services/customs-clearance": ["kolkata-to-birgunj"],
  "/services/road-freight": ["kolkata-to-birgunj", "nepal-to-tibet"],
  "/services/project-cargo": ["nepal-to-tibet"],
};

export function laneLinksForPost(post: LaneSource): LaneSlug[] {
  const text = `${post.title} ${post.description} ${post.intro}`;
  const named = keywordLanes.filter((entry) => entry.pattern.test(text)).map((entry) => entry.slug);
  const candidates = new Set<LaneSlug>([...named, ...(serviceLanes[post.related.service.href] ?? [])]);
  return laneSlugs.filter((slug) => candidates.has(slug)).slice(0, 2);
}
