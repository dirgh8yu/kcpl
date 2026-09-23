import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Mono, Instrument_Serif, Inter, Manrope, Noto_Sans_Devanagari, Noto_Serif_Devanagari } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { Analytics } from "./components/analytics";
import { StructuredData } from "./components/structured-data";
import { siteName, siteUrl, socialImage } from "./seo";
import { graph, organizationNode, websiteNode } from "./structured-data";
import { siteLocaleTags, type SiteLocale } from "./site-i18n";
import "./globals.css";

/*
 * The one <html>/<body> the whole application renders. Next allows a root
 * layout per top-level segment and only the segment knows its language, so each
 * one calls this rather than copying the document out.
 */

// Only the two faces the public site paints its first screen with are
// preloaded. The rest are declared so the CSS variables resolve, and the
// browser fetches each one when a glyph on the page actually calls for it:
// preloading all of them put ~400KB of fonts in front of the LCP image.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], preload: false });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], preload: false });
// Public brand and marketing retain Manrope; the KCPL staff product uses Inter through its scoped typography contract.
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", preload: false });
const notoDevanagari = Noto_Serif_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], weight: ["400", "600"], preload: false });
// The identity file records Noto Sans Devanagari for Nepali, so the public site sets
// Nepali in the sans to match the Manrope wordmark rather than the portal's serif.
// The public site sets all metadata, labels and navigation in mono: on an
// operational board those are readings, not prose.
const plexMono = IBM_Plex_Mono({ variable: "--font-mono-tech", subsets: ["latin"], weight: ["400", "500", "600"] });
const notoDevanagariSans = Noto_Sans_Devanagari({ variable: "--font-devanagari-sans", subsets: ["devanagari"], weight: ["400", "600", "700"], preload: false });

const fontVariables = [geist, manrope, inter, instrumentSerif, notoDevanagari, notoDevanagariSans, plexMono].map((font) => font.variable).join(" ");

const defaultTitle = "Kapileshwor Cargo | Freight & Logistics in Nepal";
const defaultDescription = "KCPL coordinates import, export and cross-border freight through Nepal's logistics gateways and international counterpart network.";

/** The metadata every root layout starts from; a locale re-exports it and each
 * page overrides title, description and canonical through createPageMetadata. */
export const baseMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: defaultTitle, template: "%s | Kapileshwor Cargo" },
  description: defaultDescription,
  applicationName: siteName,
  alternates: { canonical: siteUrl },
  /* Safari ignores an SVG apple-touch-icon and Android wants a raster too, so
   * the vector stays the primary icon and PNGs cover what cannot read it. */
  icons: {
    icon: [
      { url: "/images/brand/kcpl-gateway-k.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/images/brand/kcpl-gateway-k.svg",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  openGraph: { type: "website", siteName, title: defaultTitle, description: defaultDescription, url: siteUrl, images: [socialImage] },
  twitter: { card: "summary_large_image", title: defaultTitle, description: defaultDescription, images: [socialImage.url] },
};

export const baseViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/* Identity and site nodes ride on every page; the page-specific nodes -- the
 * breadcrumb, the service -- are emitted by the public shell and the service
 * route, which know which page they are. */
const siteGraph = graph([organizationNode, websiteNode(defaultDescription)]);

/**
 * `lang` is the document's own language. The staff product is English-only and
 * passes nothing; a locale segment passes its own tag, which is the whole
 * reason the roots are split.
 */
export function SiteDocument({ locale = "en", className, children }: { locale?: SiteLocale; className?: string; children: ReactNode }) {
  return (
    <html lang={siteLocaleTags[locale]}>
      <body className={`${fontVariables} ${className ?? ""} antialiased`.replace(/\s+/g, " ").trim()}>
        <StructuredData data={siteGraph}/>
        {children}
        <Suspense fallback={null}><Analytics/></Suspense>
      </body>
    </html>
  );
}
