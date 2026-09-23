import { HomePage } from "../components/home-page";
import { createPageMetadata } from "../seo";
import { siteText } from "../site-i18n";
import "../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "home.meta_title"), description: siteText("hi", "home.meta_description"), path: "/hi" });

export default function Page() {
  return <HomePage locale="hi"/>;
}
