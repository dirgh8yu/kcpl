import { SelectedWorkPage } from "../../components/selected-work-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "work.meta_title"), description: siteText("ne", "work.meta_description"), path: "/ne/work" });

export default function Page() { return <SelectedWorkPage locale="ne"/>; }
