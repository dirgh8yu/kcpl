import { GuidesIndexPage } from "../../components/freight-guide-page";
import { guideIndex } from "../../guide-data";
import { createPageMetadata } from "../../seo";
import "../../site.css";

export const metadata = createPageMetadata({ title: guideIndex.hi.title, description: guideIndex.hi.description, path: "/hi/guides" });

export default function Page() {
  return <GuidesIndexPage locale="hi"/>;
}
