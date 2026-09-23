import { AboutPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "about.meta_title"), description: siteText("ne", "about.meta_description"), path: "/ne/about" });

export default function Page() {
  return <AboutPage locale="ne"/>;
}
