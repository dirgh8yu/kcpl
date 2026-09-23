import { NetworkPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "network.meta_title"), description: siteText("ne", "network.meta_description"), path: "/ne/network" });

export default function Page() {
  return <NetworkPage locale="ne"/>;
}
