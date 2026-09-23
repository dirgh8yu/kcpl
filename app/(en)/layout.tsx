import type { ReactNode } from "react";
import { SiteDocument, baseMetadata, baseViewport } from "../site-document";

/* Root layout for the English site. Next takes one root layout per top-level
 * segment, which is how each language gets its own <html lang>. */
export const metadata = baseMetadata;
export const viewport = baseViewport;

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <SiteDocument>{children}</SiteDocument>;
}
