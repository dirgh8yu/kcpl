import { NotFoundPage } from "./components/not-found-page";
import { SiteDocument } from "./site-document";
import "./site.css";

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
