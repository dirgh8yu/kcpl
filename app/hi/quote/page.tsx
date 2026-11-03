import type { QuoteValues } from "../../components/quote-enquiry";
import { QuoteConcierge } from "../../components/quote-concierge";
import { SiteShell } from "../../components/site-chrome";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "quote.meta_title"), description: siteText("hi", "quote.meta_description"), path: "/hi/quote" });

export default async function QuotePage({ searchParams }: { searchParams: Promise<QuoteValues> }) {
  const query = await searchParams;
  return (
    <SiteShell locale="hi" path="/quote">
      <QuoteConcierge locale="hi" initial={query} title={siteText("hi", "quote.title")} intro={siteText("hi", "quote.intro")}/>
    </SiteShell>
  );
}
