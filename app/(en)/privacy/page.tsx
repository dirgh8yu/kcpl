import { PrivacyPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "privacy.meta_title"), description: siteText("en", "privacy.meta_description"), path: "/privacy" });

export default function Page() {
  return <PrivacyPage locale="en"/>;
}
