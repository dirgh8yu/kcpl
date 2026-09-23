import { SectorsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "sectors.meta_title"), description: siteText("zh", "sectors.meta_description"), path: "/zh/sectors" });

export default function Page() {
  return <SectorsPage locale="zh"/>;
}
