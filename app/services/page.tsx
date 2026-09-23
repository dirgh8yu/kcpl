import { ServicesPage } from "../components/services-page";
import { createPageMetadata } from "../seo";
import { siteText } from "../site-i18n";
import "../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "services.meta_title"), description: siteText("en", "services.meta_description"), path: "/services" });

export default function Page() {
  return <ServicesPage locale="en"/>;
}
