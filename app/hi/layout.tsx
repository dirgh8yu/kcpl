import type { ReactNode } from "react";
import { SiteDocument, baseMetadata, baseViewport } from "../site-document";

/* Root layout for the Hindi site: its own <html lang> rather than the English
 * one every locale used to inherit. */
export const metadata = baseMetadata;
export const viewport = baseViewport;

export default function HindiLayout({ children }: { children: ReactNode }) {
  return <SiteDocument locale="hi">{children}</SiteDocument>;
}
