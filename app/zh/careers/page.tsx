import { CareersPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "careers.meta_title"), description: siteText("zh", "careers.meta_description"), path: "/zh/careers" });

export default function Page() { return <CareersPage locale="zh"/>; }
