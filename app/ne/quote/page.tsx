import { QuoteEnquiry, QuoteValues } from "../../components/quote-enquiry";
import { SiteShell } from "../../components/site-chrome";
import { createPageMetadata } from "../../seo";
import { siteText } from "../../site-i18n";
import "../../site.css";

export const metadata = createPageMetadata({ title: siteText("ne", "quote.meta_title"), description: siteText("ne", "quote.meta_description"), path: "/ne/quote" });

export default async function QuotePage({ searchParams }: { searchParams: Promise<QuoteValues> }) {
  const query = await searchParams;
  return (
    <SiteShell locale="ne" path="/quote">
      <section className="section page-head">
        <h1 className="section-title">{siteText("ne", "quote.title")}</h1>
        <p className="section-intro">{siteText("ne", "quote.intro")}</p>
      </section>
      <section className="section quote-section"><QuoteEnquiry initial={query} locale="ne"/></section>
    </SiteShell>
  );
}
