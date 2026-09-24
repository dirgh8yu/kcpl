import { AwardsPage } from "../../components/showcase-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "awards.meta_title"), description: siteText("zh", "awards.meta_description"), path: "/zh/awards" });

export default function Page() { return <AwardsPage locale="zh" />; }
