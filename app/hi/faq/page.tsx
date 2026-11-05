import { FaqPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "faq.meta_title"), description: siteText("hi", "faq.meta_description"), path: "/hi/faq" });

export default function Page() { return <FaqPage locale="hi"/>; }
