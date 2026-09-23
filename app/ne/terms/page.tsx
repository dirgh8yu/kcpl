import { TermsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "terms.meta_title"), description: siteText("ne", "terms.meta_description"), path: "/ne/terms" });

export default function Page() {
  return <TermsPage locale="ne"/>;
}
