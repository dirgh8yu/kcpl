import { GuidesIndexPage } from "../../components/freight-guide-page";
import { guideIndex } from "../../guide-data";
import { createPageMetadata } from "../../seo";
import "../../site.css";

export const metadata = createPageMetadata({ title: guideIndex.ne.title, description: guideIndex.ne.description, path: "/ne/guides" });

export default function Page() {
  return <GuidesIndexPage locale="ne"/>;
}
