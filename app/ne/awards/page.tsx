import { AwardsPage } from "../../components/showcase-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "awards.meta_title"), description: siteText("ne", "awards.meta_description"), path: "/ne/awards" });

export default function Page() { return <AwardsPage locale="ne" />; }
