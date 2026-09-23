import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";

/** The quote-or-contact band that closes most interior pages. It lives on its
 * own so the network page can use it without importing the rest of the interior
 * pages, and with them the map. */
export function ClosingBand({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <section className="section section-cta">
      <h2 className="cta-title">{t("home.cta_title")}</h2>
      <p className="cta-copy">{t("home.cta_copy")}</p>
      <div className="hero-actions">
        <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.cta_primary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
        <Link href={sitePath(locale, "/contact")} className="button-ghost">{t("home.cta_secondary")}</Link>
      </div>
    </section>
  );
}
