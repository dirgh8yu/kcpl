import { GuidesIndexPage } from "../../components/freight-guide-page";
import { guideIndex } from "../../guide-data";
import { createPageMetadata } from "../../seo";
import "../../site.css";

export const metadata = createPageMetadata({ title: guideIndex.en.title, description: guideIndex.en.description, path: "/guides" });

export default function Page() {
  return <GuidesIndexPage locale="en"/>;
}
