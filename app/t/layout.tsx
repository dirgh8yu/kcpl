import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteDocument, baseMetadata, baseViewport } from "../site-document";
import "./tracking.css";

/*
 * Shared shipment tracking (/t/<token>): a page for someone without a KCPL
 * login, opened from a link a customer chose to share. Its own root, so it
 * carries neither the public site's chrome nor the staff product's bundle.
 */
export const metadata: Metadata = {
  ...baseMetadata,
  title: "Shipment tracking",
  // A private link: never listed, never followed, never cached by a search engine.
  robots: { index: false, follow: false, nocache: true },
  alternates: undefined,
  openGraph: undefined,
};

export const viewport = baseViewport;

export default function TrackingLayout({ children }: { children: ReactNode }) {
  return <SiteDocument>{children}</SiteDocument>;
}
