import { Noto_Sans_SC } from "next/font/google";
import type { ReactNode } from "react";

/*
 * Noto Sans SC ships 303 unicode-range @font-face rules -- 272KB of CSS before a
 * single glyph is downloaded. Declaring it in the root layout put that on every
 * English and Nepali page and on the whole operations console. It belongs to the
 * seventeen Chinese pages, so it is declared here.
 */
const notoSansSC = Noto_Sans_SC({ variable: "--font-sc", subsets: ["latin"], weight: ["400", "500", "700"], preload: false });

/* display:contents so the wrapper carries the variable without becoming a box
 * in the layout the pages below it expect. */
export default function ChineseLayout({ children }: { children: ReactNode }) {
  return <div className={`${notoSansSC.variable} site-script-host`}>{children}</div>;
}
