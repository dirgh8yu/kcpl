import type { QuoteValues } from "../../components/quote-enquiry";
import { QuoteConcierge } from "../../components/quote-concierge";
import { SiteShell } from "../../components/site-chrome";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "quote.meta_title"), description: siteText("ne", "quote.meta_description"), path: "/ne/quote" });

export default async function QuotePage({ searchParams }: { searchParams: Promise<QuoteValues> }) {
  const query = await searchParams;
  return (
    <SiteShell locale="ne" path="/quote">
      <QuoteConcierge locale="ne" initial={query} title={siteText("ne", "quote.title")} intro={siteText("ne", "quote.intro")}/>
    </SiteShell>
  );
}
