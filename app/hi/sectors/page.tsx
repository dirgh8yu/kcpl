import { SectorsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "sectors.meta_title"), description: siteText("hi", "sectors.meta_description"), path: "/hi/sectors" });

export default function Page() {
  return <SectorsPage locale="hi"/>;
}
