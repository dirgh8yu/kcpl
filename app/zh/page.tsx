import { HomePage } from "../components/home-page";
import { createPageMetadata } from "../seo";
import { siteText } from "../site-i18n";
import "../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "home.meta_title"), description: siteText("zh", "home.meta_description"), path: "/zh" });

export default function Page() {
  return <HomePage locale="zh"/>;
}
