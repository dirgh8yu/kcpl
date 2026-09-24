import { AwardsPage } from "../../components/showcase-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "awards.meta_title"), description: siteText("en", "awards.meta_description"), path: "/awards" });

export default function Page() { return <AwardsPage locale="en" />; }
