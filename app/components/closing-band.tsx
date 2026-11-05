import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { company } from "../company-data";
import { telHref } from "../contact-links";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";

/** The crimson band every page ends on: one job, the quote. */
export function ClosingBand({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <section className="end-band">
      <h2 className="end-band-title">{t("home.cta_title")}</h2>
      <div className="end-band-actions">
        <Link href={sitePath(locale, "/quote")} className="btn btn-white" data-analytics-event="quote_tap">{t("home.cta_primary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
        <a href={telHref(company.phones[0])} data-analytics-event="call_tap">{t("chrome.or_call")} {company.phones[0]}</a>
      </div>
    </section>
  );
}
