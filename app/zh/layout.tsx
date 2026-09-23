import { Noto_Sans_SC } from "next/font/google";
import type { ReactNode } from "react";
import { SiteDocument, baseMetadata, baseViewport } from "../site-document";

/*
 * Root layout for the Chinese site. Noto Sans SC ships 303 unicode-range
 * @font-face rules -- 272KB of CSS -- so it is declared here rather than in the
 * shared document, where it landed on every English and Nepali page and on the
 * whole operations console.
 */
const notoSansSC = Noto_Sans_SC({ variable: "--font-sc", subsets: ["latin"], weight: ["400", "500", "700"], preload: false });

export const metadata = baseMetadata;
export const viewport = baseViewport;

export default function ChineseLayout({ children }: { children: ReactNode }) {
  return <SiteDocument locale="zh" className={notoSansSC.variable}>{children}</SiteDocument>;
}
