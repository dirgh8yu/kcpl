import type { Metadata } from "next";
import { NotFoundPage } from "./components/not-found-page";
import { SiteDocument } from "./site-document";
import "./site.css";

export const metadata: Metadata = { title: "Page not found | Kapileshwor Cargo", description: "This address does not match a page on the Kapileshwor Cargo site. The freight guides, services and quote form are one click away.", robots: { index: false, follow: true } };

/*
 * A URL that matches no segment at all has no root layout to fall into -- that
 * is the trade for one root layout per language -- so this one renders the
 * document itself. Without it an unknown address drops to Next's unstyled
 * default instead of KCPL's 404.
 */
export default function NotFound() {
  return (
    <SiteDocument>
      <NotFoundPage/>
    </SiteDocument>
  );
}
