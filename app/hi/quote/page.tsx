import { QuoteConcierge } from "../../components/quote-concierge";
import { SiteShell } from "../../components/site-chrome";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "quote.meta_title"), description: siteText("hi", "quote.meta_description"), path: "/hi/quote" });

export default function QuotePage() {
  return (
    <SiteShell locale="hi" path="/quote">
      <QuoteConcierge locale="hi" title={siteText("hi", "quote.title")} intro={siteText("hi", "quote.intro")}/>
    </SiteShell>
  );
}
