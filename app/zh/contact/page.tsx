import { ContactPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "contact.meta_title"), description: siteText("zh", "contact.meta_description"), path: "/zh/contact" });

export default function Page() {
  return <ContactPage locale="zh"/>;
}
