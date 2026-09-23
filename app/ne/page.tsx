import { HomePage } from "../components/home-page";
import { createPageMetadata } from "../seo";
import { siteText } from "../site-i18n";
import "../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "home.meta_title"), description: siteText("ne", "home.meta_description"), path: "/ne" });

export default function Page() {
  return <HomePage locale="ne"/>;
}
