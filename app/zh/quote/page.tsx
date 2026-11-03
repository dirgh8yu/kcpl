import type { QuoteValues } from "../../components/quote-enquiry";
import { QuoteConcierge } from "../../components/quote-concierge";
import { SiteShell } from "../../components/site-chrome";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("zh", "quote.meta_title"), description: siteText("zh", "quote.meta_description"), path: "/zh/quote" });

export default async function QuotePage({ searchParams }: { searchParams: Promise<QuoteValues> }) {
  const query = await searchParams;
  return (
    <SiteShell locale="zh" path="/quote">
      <QuoteConcierge locale="zh" initial={query} title={siteText("zh", "quote.title")} intro={siteText("zh", "quote.intro")}/>
    </SiteShell>
  );
}
