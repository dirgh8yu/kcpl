import { company } from "./company-data.ts";

// The owner confirmed Ramesh's review of these seven English guides only; a new
// guide shows no reviewer until the owner confirms its review too.
export const reviewedGuideSlugs: readonly string[] = ["importing-to-nepal", "exporting-from-nepal", "customs-clearance-in-nepal", "sea-freight-through-india", "air-freight-to-kathmandu", "hs-codes-and-import-duty", "free-time-and-demurrage"];

// These are actual editorial dates, never build dates. Translations await review.
export const guideReview = {
  reviewer: company.managingDirector,
  role: "Managing Director",
  organization: company.name,
  reviewedAt: "2026-11-06",
  labels: { author: "By", reviewer: "Reviewed by", reviewedAt: "Last reviewed" },
} as const;
