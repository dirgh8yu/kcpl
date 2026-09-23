import { AboutPage } from "../components/interior-pages";
import { createPageMetadata } from "../seo";
import { siteText } from "../site-i18n";
import "../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "about.meta_title"), description: siteText("en", "about.meta_description"), path: "/about" });

export default function Page() {
  return <AboutPage locale="en"/>;
}
