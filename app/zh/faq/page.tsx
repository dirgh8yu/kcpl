import { FaqPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "faq.meta_title"), description: siteText("zh", "faq.meta_description"), path: "/zh/faq" });

export default function Page() { return <FaqPage locale="zh"/>; }
