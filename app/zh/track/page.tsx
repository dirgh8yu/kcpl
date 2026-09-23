import { TrackPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "track.meta_title"), description: siteText("zh", "track.meta_description"), path: "/zh/track" });

export default function Page() {
  return <TrackPage locale="zh"/>;
}
