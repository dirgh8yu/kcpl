import { NetworkPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "network.meta_title"), description: siteText("zh", "network.meta_description"), path: "/zh/network" });

export default function Page() {
  return <NetworkPage locale="zh"/>;
}
