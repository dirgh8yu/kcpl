import { SelectedWorkPage } from "../../components/selected-work-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "work.meta_title"), description: siteText("hi", "work.meta_description"), path: "/hi/work" });

export default function Page() { return <SelectedWorkPage locale="hi"/>; }
