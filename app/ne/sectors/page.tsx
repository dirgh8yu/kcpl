import { SectorsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "sectors.meta_title"), description: siteText("ne", "sectors.meta_description"), path: "/ne/sectors" });

export default function Page() {
  return <SectorsPage locale="ne"/>;
}
