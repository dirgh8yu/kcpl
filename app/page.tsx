import { HomePage } from "./components/home-page";
import { createPageMetadata } from "./seo";
import { siteText } from "./site-i18n";
import "./site.css";

export const metadata = createPageMetadata({ title: siteText("en", "home.meta_title"), description: siteText("en", "home.meta_description"), path: "/" });

export default function Page() {
  return <HomePage locale="en"/>;
}
