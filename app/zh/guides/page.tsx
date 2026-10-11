import { GuidesIndexPage } from "../../components/freight-guide-page";
import { guideIndex } from "../../guide-data";
import { createPageMetadata } from "../../seo";
import "../../site.css";

export const metadata = createPageMetadata({ title: guideIndex.zh.title, description: guideIndex.zh.description, path: "/zh/guides" });

export default function Page() {
  return <GuidesIndexPage locale="zh"/>;
}
