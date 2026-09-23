import { TrackPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "track.meta_title"), description: siteText("ne", "track.meta_description"), path: "/ne/track" });

export default function Page() {
  return <TrackPage locale="ne"/>;
}
