import { ServicesPage } from "../../components/services-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "services.meta_title"), description: siteText("hi", "services.meta_description"), path: "/hi/services" });

export default function Page() {
  return <ServicesPage locale="hi"/>;
}
