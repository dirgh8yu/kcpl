import Link from "next/link";
import { SiteShell } from "./site-chrome";

/** The 404 body, shared by the English group's not-found and the top-level one
 * that catches URLs matching no segment at all. */
export function NotFoundPage() {
  return (
    <SiteShell locale="en" path="/">
      <section className="section page-head">
        <h1 className="section-title">This page is not available.</h1>
        <p className="section-intro">The address may be incorrect, or the page may no longer exist.</p>
        <Link href="/quote" className="section-link contact-action">Request a quote</Link>
      </section>
    </SiteShell>
  );
}
