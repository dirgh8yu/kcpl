import type { ReactNode } from "react";
import { SiteDocument, baseMetadata, baseViewport } from "../site-document";

/*
 * Root layout for the Chinese site. Chinese text is set in the reader's own
 * system font (PingFang on Apple, Noto Sans CJK on Android, Microsoft YaHei on
 * Windows): a downloaded Noto Sans SC cost every Chinese page about a megabyte
 * of font slices in three weights, on the slowest connections the site serves,
 * for glyphs every device that reads Chinese already has. Latin text stays in
 * the brand face.
 */
export const metadata = baseMetadata;
export const viewport = baseViewport;

export default function ChineseLayout({ children }: { children: ReactNode }) {
  return <SiteDocument locale="zh">{children}</SiteDocument>;
}
