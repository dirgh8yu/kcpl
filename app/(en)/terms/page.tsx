import { TermsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "terms.meta_title"), description: siteText("en", "terms.meta_description"), path: "/terms" });

export default function Page() {
  return <TermsPage locale="en"/>;
}
