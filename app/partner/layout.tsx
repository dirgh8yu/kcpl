import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "../product.css";
import type { ReactNode } from "react";
import { SiteDocument, baseMetadata } from "../site-document";
import { productViewport } from "../product-viewport";

const partnerFont = Geist({ subsets: ["latin"], display: "swap", variable: "--font-portal-geist" });

export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: "KCPL Partner Portal", template: "%s · KCPL Partner Portal" },
  robots: { index: false, follow: false },
};

export const viewport = productViewport;

/** The partner portal renders on the customer portal's foundation: the same tokens and Ops primitives, its own chrome. */
export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <SiteDocument>
      <div className={`${partnerFont.className} ${partnerFont.variable} kcpl-admin-route kcpl-portal-route`}>{children}</div>
    </SiteDocument>
  );
}
