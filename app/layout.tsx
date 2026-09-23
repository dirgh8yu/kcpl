import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Mono, Instrument_Serif, Inter, Manrope, Noto_Sans_Devanagari, Noto_Serif_Devanagari } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "./components/analytics";
import { StructuredData } from "./components/structured-data";
import { siteName, siteUrl, socialImage } from "./seo";
import { graph, organizationNode, websiteNode } from "./structured-data";
import "./globals.css";

// Only the two faces the public site paints its first screen with are
// preloaded. The rest are declared so the CSS variables resolve, and the
// browser fetches each one when a glyph on the page actually calls for it:
// preloading all ten put ~400KB of fonts -- Chinese and Devanagari included --
// in front of the LCP image on every English page.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  preload: false,
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
});

// Public brand and marketing retain Manrope; the KCPL staff product uses Inter through its scoped typography contract.
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", preload: false });
const notoDevanagari = Noto_Serif_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], weight: ["400", "600"], preload: false });
// The identity file records Noto Sans Devanagari for Nepali, so the public site sets
// Nepali in the sans to match the Manrope wordmark rather than the portal's serif.
// The public site sets all metadata, labels and navigation in mono: on an
// operational board those are readings, not prose.
const plexMono = IBM_Plex_Mono({ variable: "--font-mono-tech", subsets: ["latin"], weight: ["400", "500", "600"] });
const notoDevanagariSans = Noto_Sans_Devanagari({ variable: "--font-devanagari-sans", subsets: ["devanagari"], weight: ["400", "600", "700"], preload: false });

const defaultTitle = "Kapileshwor Cargo | Freight & Logistics in Nepal";
const defaultDescription = "KCPL coordinates import, export and cross-border freight through Nepal's logistics gateways and international counterpart network.";

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/* Identity and site nodes ride on every page; the page-specific nodes -- the
 * breadcrumb, the service -- are emitted by the public shell and the service
 * route, which know which page they are. */
const siteGraph = graph([organizationNode, websiteNode(defaultDescription)]);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${manrope.variable} ${inter.variable} ${instrumentSerif.variable} ${notoDevanagari.variable} ${notoDevanagariSans.variable} ${plexMono.variable} antialiased`}>
        <StructuredData data={siteGraph}/>
        {children}
        <Suspense fallback={null}><Analytics/></Suspense>
      </body>
    </html>
  );
}
