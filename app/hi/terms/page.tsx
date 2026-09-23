import { TermsPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "terms.meta_title"), description: siteText("hi", "terms.meta_description"), path: "/hi/terms" });

export default function Page() {
  return <TermsPage locale="hi"/>;
}
