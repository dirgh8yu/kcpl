import { NetworkPage } from "../../components/network-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "network.meta_title"), description: siteText("en", "network.meta_description"), path: "/network" });

export default function Page() {
  return <NetworkPage locale="en"/>;
}
