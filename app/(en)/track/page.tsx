import { TrackPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "track.meta_title"), description: siteText("en", "track.meta_description"), path: "/track" });

export default function Page() {
  return <TrackPage locale="en"/>;
}
