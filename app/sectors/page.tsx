import { SectorsPage } from "../components/interior-pages";
import { createPageMetadata } from "../seo";
import { siteText } from "../site-i18n";
import "../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "sectors.meta_title"), description: siteText("en", "sectors.meta_description"), path: "/sectors" });

export default function Page() {
  return <SectorsPage locale="en"/>;
}
