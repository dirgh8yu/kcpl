import { ServicesPage } from "../../components/services-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "services.meta_title"), description: siteText("ne", "services.meta_description"), path: "/ne/services" });

export default function Page() {
  return <ServicesPage locale="ne"/>;
}
