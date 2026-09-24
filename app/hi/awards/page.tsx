import { AwardsPage } from "../../components/showcase-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "awards.meta_title"), description: siteText("hi", "awards.meta_description"), path: "/hi/awards" });

export default function Page() { return <AwardsPage locale="hi" />; }
