import { FaqPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "faq.meta_title"), description: siteText("ne", "faq.meta_description"), path: "/ne/faq" });

export default function Page() { return <FaqPage locale="ne"/>; }
