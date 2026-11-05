import { CareersPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "careers.meta_title"), description: siteText("en", "careers.meta_description"), path: "/careers" });

export default function Page() { return <CareersPage locale="en"/>; }
