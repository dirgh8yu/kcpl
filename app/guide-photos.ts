import type { GuideSlug } from "./guide-data";

/* Only photographs with a recorded source and no other company's branding.
 * Kept out of the page component so the sitemap and the article schema can read
 * the same mapping without importing React. */
export const guidePhotos: Record<GuideSlug, { src: string; position?: string }> = {
  "importing-to-nepal": { src: "/images/unsplash/ghat-tunnel.jpg" },
  "exporting-from-nepal": { src: "/images/unsplash/warp-threads.jpg" },
  "customs-clearance-in-nepal": { src: "/images/unsplash/container-marks.jpg", position: "35% 40%" },
  "sea-freight-through-india": { src: "/images/unsplash/port-sunset.jpg" },
  "air-freight-to-kathmandu": { src: "/images/unsplash/airport-dollies.jpg" },
  "hs-codes-and-import-duty": { src: "/images/unsplash/tariff-ledger.jpg" },
  "free-time-and-demurrage": { src: "/images/unsplash/container-yard.jpg", position: "30% 50%" },
  "cargo-from-china-to-nepal": { src: "/images/unsplash/nepal-road.jpg" },
  "cargo-from-india-to-nepal": { src: "/images/unsplash/howrah-bridge.jpg" },
};
