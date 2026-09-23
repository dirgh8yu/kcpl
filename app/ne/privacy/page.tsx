import { PrivacyPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "privacy.meta_title"), description: siteText("ne", "privacy.meta_description"), path: "/ne/privacy" });

export default function Page() {
  return <PrivacyPage locale="ne"/>;
}
