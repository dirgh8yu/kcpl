import { QuoteEnquiry, QuoteValues } from "../../components/quote-enquiry";
import { SiteShell } from "../../components/site-chrome";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("hi", "quote.meta_title"), description: siteText("hi", "quote.meta_description"), path: "/hi/quote" });

export default async function QuotePage({ searchParams }: { searchParams: Promise<QuoteValues> }) {
  const query = await searchParams;
  return (
    <SiteShell locale="hi" path="/quote">
      <section className="section page-head">
        <h1 className="section-title">{siteText("hi", "quote.title")}</h1>
        <p className="section-intro">{siteText("hi", "quote.intro")}</p>
      </section>
      <section className="section quote-section"><QuoteEnquiry initial={query} locale="hi"/></section>
    </SiteShell>
  );
}
