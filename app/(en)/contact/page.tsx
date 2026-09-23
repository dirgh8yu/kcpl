import { ContactPage } from "../../components/interior-pages";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "contact.meta_title"), description: siteText("en", "contact.meta_description"), path: "/contact" });

export default function Page() {
  return <ContactPage locale="en"/>;
}
