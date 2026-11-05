import Link from "next/link";
import { PageHead } from "./route-parts";
import { SiteShell } from "./site-chrome";

/** The 404 body, shared by the English group's not-found and the top-level one
 * that catches URLs matching no segment at all. */
export function NotFoundPage() {
  return (
    <SiteShell locale="en" path="/">
      <PageHead title="This page is not available." intro="The address may be incorrect, or the page may no longer exist.">
        <div className="not-found-actions">
          <Link href="/" className="btn">Return home</Link>
          <Link href="/quote" className="text-link">Request a quote</Link>
        </div>
      </PageHead>
    </SiteShell>
  );
}
