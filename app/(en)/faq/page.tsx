import { FaqPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "faq.meta_title"), description: siteText("en", "faq.meta_description"), path: "/faq" });

export default function Page() { return <FaqPage locale="en"/>; }
