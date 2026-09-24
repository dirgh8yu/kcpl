import { SelectedWorkPage } from "../../components/selected-work-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "work.meta_title"), description: siteText("zh", "work.meta_description"), path: "/zh/work" });

export default function Page() { return <SelectedWorkPage locale="zh"/>; }
