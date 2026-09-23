import { TrackPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "track.meta_title"), description: siteText("hi", "track.meta_description"), path: "/hi/track" });

export default function Page() {
  return <TrackPage locale="hi"/>;
}
