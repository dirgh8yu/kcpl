import { NetworkPage } from "../../components/network-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "network.meta_title"), description: siteText("hi", "network.meta_description"), path: "/hi/network" });

export default function Page() {
  return <NetworkPage locale="hi"/>;
}
