import { ServicesPage } from "../../components/services-page";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "services.meta_title"), description: siteText("zh", "services.meta_description"), path: "/zh/services" });

export default function Page() {
  return <ServicesPage locale="zh"/>;
}
