import { PrivacyPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "privacy.meta_title"), description: siteText("hi", "privacy.meta_description"), path: "/hi/privacy" });

export default function Page() {
  return <PrivacyPage locale="hi"/>;
}
