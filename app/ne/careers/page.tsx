import { CareersPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "careers.meta_title"), description: siteText("ne", "careers.meta_description"), path: "/ne/careers" });

export default function Page() { return <CareersPage locale="ne"/>; }
