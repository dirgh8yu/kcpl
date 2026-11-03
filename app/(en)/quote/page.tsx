import type { QuoteValues } from "../../components/quote-enquiry";
import { QuoteConcierge } from "../../components/quote-concierge";
import { SiteShell } from "../../components/site-chrome";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("en", "quote.meta_title"), description: siteText("en", "quote.meta_description"), path: "/quote" });

export default async function QuotePage({ searchParams }: { searchParams: Promise<QuoteValues> }) {
  const query = await searchParams;
  return (
    <SiteShell locale="en" path="/quote">
      <QuoteConcierge locale="en" initial={query} title={siteText("en", "quote.title")} intro={siteText("en", "quote.intro")}/>
    </SiteShell>
  );
}
