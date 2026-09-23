import { AboutPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "about.meta_title"), description: siteText("zh", "about.meta_description"), path: "/zh/about" });

export default function Page() {
  return <AboutPage locale="zh"/>;
}
