import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";

/** The quote-or-contact band that closes the home page and most interior
 * pages. It lives on its own so the network page can use it without importing
 * the rest of the interior pages, and with them the map. */
export function ClosingBand({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <section className="section section-cta">
      <h2 className="cta-title">{t("home.cta_title")}</h2>
      <p className="cta-copy">{t("home.cta_copy")}</p>
      <div className="intro-actions">
        <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.cta_primary")}</Link>
        <Link href={sitePath(locale, "/contact")} className="text-link">{t("home.cta_secondary")}<CaretRight size={13} weight="bold" aria-hidden="true"/></Link>
      </div>
    </section>
  );
}
