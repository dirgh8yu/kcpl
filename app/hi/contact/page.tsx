import { ContactPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "contact.meta_title"), description: siteText("hi", "contact.meta_description"), path: "/hi/contact" });

export default function Page() {
  return <ContactPage locale="hi"/>;
}
