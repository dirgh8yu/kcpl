import { QuoteConcierge } from "../../components/quote-concierge";
import { SiteShell } from "../../components/site-chrome";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "quote.meta_title"), description: siteText("zh", "quote.meta_description"), path: "/zh/quote" });

export default function QuotePage() {
  return (
    <SiteShell locale="zh" path="/quote">
      <QuoteConcierge locale="zh" title={siteText("zh", "quote.title")} intro={siteText("zh", "quote.intro")}/>
    </SiteShell>
  );
}
