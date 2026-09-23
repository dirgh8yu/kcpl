import { PrivacyPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "privacy.meta_title"), description: siteText("zh", "privacy.meta_description"), path: "/zh/privacy" });

export default function Page() {
  return <PrivacyPage locale="zh"/>;
}
