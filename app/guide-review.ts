import { company } from "./company-data.ts";

// The owner confirmed Ramesh's review of all seven expanded English guides.
// These are actual editorial dates, never build dates. Translations await review.
export const guideReview = {
  reviewer: company.managingDirector,
  role: "Managing Director",
  organization: company.name,
  reviewedAt: "2026-11-06",
  labels: { author: "By", reviewer: "Reviewed by", reviewedAt: "Last reviewed" },
} as const;
