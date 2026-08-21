import type { Metadata } from "next";
import { Instrument_Serif, Manrope, Noto_Serif_Devanagari } from "next/font/google";
import { Suspense } from "react";
import { company } from "./company-data";
import { Analytics } from "./components/analytics";
import { MobileQuoteCta } from "./components/mobile-quote-cta";
import { StructuredData } from "./components/structured-data";
import { OperationsGlobalSearch } from "./admin/operations-global-search";
import { absoluteUrl, siteName, siteUrl, socialImage } from "./seo";
import "./globals.css";
import "./admin/operations-theme.css";
import "./admin/operations-polish.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});
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
  icons: { icon: "/images/brand/kcpl-logo-mark.png", shortcut: "/images/brand/kcpl-logo-mark.png", apple: "/images/brand/kcpl-logo-mark.png" },
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
  logo: absoluteUrl("/images/brand/kcpl-logo-mark.png"),
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
      <body className={`${manrope.variable} ${instrumentSerif.variable} ${notoDevanagari.variable} antialiased`}>
        <StructuredData data={organizationSchema} />
        {children}
        <OperationsGlobalSearch />
        <MobileQuoteCta />
        <Suspense fallback={null}><Analytics /></Suspense>
      </body>
    </html>
  );
}
