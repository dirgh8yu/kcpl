export type VerifiedCaseStudy = {
  title: string;
  summary: string;
  serviceHref: string;
  published: true;
};

// Publish only company-approved shipment examples. No verified case studies
// have been supplied, so this collection intentionally renders nothing.
export const verifiedCaseStudies: VerifiedCaseStudy[] = [];
