import { TermsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "terms.meta_title"), description: siteText("zh", "terms.meta_description"), path: "/zh/terms" });

export default function Page() {
  return <TermsPage locale="zh"/>;
}
