import { Container } from "../components/container";
import { PageShell } from "../components/page-shell";
import { QuoteEnquiry, QuoteValues } from "../components/quote-enquiry";
import { createPageMetadata } from "../seo";
export const metadata = createPageMetadata({ title: "Request a Freight Quote", description: "Share your route, freight mode, cargo weight, dimensions and handling details with Kapileshwor Cargo to begin planning an enquiry.", path: "/quote" });

export default async function QuotePage({ searchParams }: { searchParams: Promise<QuoteValues> }) {
  const query = await searchParams;
  return <PageShell eyebrow="Request a quote" title="Tell us where your cargo needs to go." intro="Share the route, measurements and handling details with the KCPL team to begin planning."><section className="quote-page-section"><Container><QuoteEnquiry initial={query}/></Container></section></PageShell>;
}
