import { QuoteConcierge } from "../../components/quote-concierge";
import { SiteShell } from "../../components/site-chrome";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "quote.meta_title"), description: siteText("ne", "quote.meta_description"), path: "/ne/quote" });

export default function QuotePage() {
  return (
    <SiteShell locale="ne" path="/quote">
      <QuoteConcierge locale="ne" title={siteText("ne", "quote.title")} intro={siteText("ne", "quote.intro")}/>
    </SiteShell>
  );
}
