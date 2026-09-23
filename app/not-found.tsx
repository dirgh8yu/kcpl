import Link from "next/link";
import { SiteShell } from "./components/site-chrome";
import "./site.css";

export default function NotFound() {
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
