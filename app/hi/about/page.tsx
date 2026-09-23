import { AboutPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "about.meta_title"), description: siteText("hi", "about.meta_description"), path: "/hi/about" });

export default function Page() {
  return <AboutPage locale="hi"/>;
}
