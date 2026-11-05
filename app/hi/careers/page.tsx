import { CareersPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "careers.meta_title"), description: siteText("hi", "careers.meta_description"), path: "/hi/careers" });

export default function Page() { return <CareersPage locale="hi"/>; }
