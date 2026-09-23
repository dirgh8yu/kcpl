import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Mono, Instrument_Serif, Inter, Manrope, Noto_Sans_Devanagari, Noto_Sans_SC, Noto_Serif_Devanagari } from "next/font/google";
import { Suspense } from "react";
import { company } from "./company-data";
import { Analytics } from "./components/analytics";
import { StructuredData } from "./components/structured-data";
import { absoluteUrl, siteName, siteUrl, socialImage } from "./seo";
import "./globals.css";
import "./admin/operations-theme.css";
import "./admin/operations-polish.css";
import "./admin/operations-hotfix.css";
import "./admin/operations-v4-compat.css";
import "./brand-system.css";
import "./admin/operations-editorial.css";
import "./admin/operations-mobile.css";
import "./admin/operations-action-hierarchy.css";
import "./admin/operations-detail-refinement.css";
import "./admin/commercial-v4-compat.css";
import "./admin/commercial-detail-refinement.css";
import "./admin/admin-design-system.css";
import "./admin/shipment-detail-v2.css";
import "./admin/admin-typography.css";
import "./admin/shipment-detail-hierarchy.css";
import "./admin/operations-system.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Public brand and marketing retain Manrope; the KCPL staff product uses Inter through its scoped typography contract.
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400" });
const notoDevanagari = Noto_Serif_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], weight: ["400", "600"] });
// The identity file records Noto Sans Devanagari for Nepali, so the public site sets
// Nepali in the sans to match the Manrope wordmark rather than the portal's serif.
// The public site sets all metadata, labels and navigation in mono: on an
// operational board those are readings, not prose.
const plexMono = IBM_Plex_Mono({ variable: "--font-mono-tech", subsets: ["latin"], weight: ["400", "500", "600"] });
const notoSansSC = Noto_Sans_SC({ variable: "--font-sc", subsets: ["latin"], weight: ["400", "500", "700"] });
const notoDevanagariSans = Noto_Sans_Devanagari({ variable: "--font-devanagari-sans", subsets: ["devanagari"], weight: ["400", "600", "700"] });

const defaultTitle = "Kapileshwor Cargo | Freight & Logistics in Nepal";
const defaultDescription = "KCPL coordinates import, export and cross-border freight through Nepal's logistics gateways and international counterpart network.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: defaultTitle, template: "%s | Kapileshwor Cargo" },
  description: defaultDescription,
  applicationName: siteName,
  alternates: { canonical: siteUrl },
  icons: { icon: "/images/brand/kcpl-gateway-k.svg", shortcut: "/images/brand/kcpl-gateway-k.svg", apple: "/images/brand/kcpl-gateway-k.svg" },
  openGraph: { type: "website", siteName, title: defaultTitle, description: defaultDescription, url: siteUrl, images: [socialImage] },
  twitter: { card: "summary_large_image", title: defaultTitle, description: defaultDescription, images: [socialImage.url] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: company.name,
  alternateName: company.shortName,
  url: siteUrl,
  description: defaultDescription,
  logo: absoluteUrl("/images/brand/kcpl-gateway-k.svg"),
  foundingDate: String(company.founded),
  areaServed: { "@type": "Country", name: "Nepal" },
  email: company.email,
  telephone: company.phones[0],
  address: {
    "@type": "PostalAddress",
    streetAddress: "Pragatipath Finance Complex, 2nd Floor, Mhepi Road, Sorakhutte",
    addressLocality: "Kathmandu",
    addressCountry: "NP",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: company.phones[0],
    email: company.email,
  },
  employee: {
    "@type": "Person",
    name: company.managingDirector,
    jobTitle: "Managing Director",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${manrope.variable} ${inter.variable} ${instrumentSerif.variable} ${notoDevanagari.variable} ${notoDevanagariSans.variable} ${plexMono.variable} ${notoSansSC.variable} antialiased`}>
        <StructuredData data={organizationSchema}/>
        {children}
        <Suspense fallback={null}><Analytics/></Suspense>
      </body>
    </html>
  );
}
