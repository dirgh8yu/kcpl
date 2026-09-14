import type { Metadata } from "next";
import { Geist, Instrument_Serif, Inter, Manrope, Noto_Serif_Devanagari } from "next/font/google";
import { Suspense } from "react";
import { company } from "./company-data";
import { Analytics } from "./components/analytics";
import { MobileQuoteCta } from "./components/mobile-quote-cta";
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
import "./admin/operations-overview-refinement.css";
import "./admin/operations-overview-responsive.css";
import "./admin/operations-overview-interactive.css";
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

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: company.name,
  alternateName: company.shortName,
  url: siteUrl,
  logo: absoluteUrl("/images/brand/kcpl-gateway-k.svg"),
  foundingDate: String(company.founded),
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
  sameAs: ["https://kapileshworcargo.com.np"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${manrope.variable} ${inter.variable} ${instrumentSerif.variable} ${notoDevanagari.variable} antialiased`}>
        <StructuredData data={organizationSchema}/>
        {children}
        <MobileQuoteCta/>
        <Suspense fallback={null}><Analytics/></Suspense>
      </body>
    </html>
  );
}
