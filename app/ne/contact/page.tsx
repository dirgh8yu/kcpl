import { ContactPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "contact.meta_title"), description: siteText("ne", "contact.meta_description"), path: "/ne/contact" });

export default function Page() {
  return <ContactPage locale="ne"/>;
}
