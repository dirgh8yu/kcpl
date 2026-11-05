import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { services, type ServiceKey, type ServiceSlug } from "../services-data";
import { graph, serviceNode } from "../structured-data";
import { sitePath, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { ClosingBand } from "./closing-band";
import { ServiceList } from "./home-page";
import { Lined, MiniRoute, PageHead, Stop } from "./route-parts";
import { SiteShell } from "./site-chrome";
import { StructuredData } from "./structured-data";

export { services, type ServiceKey, type ServiceSlug } from "../services-data";

const text = (key: ServiceKey, part: string) => `svc.${key}.${part}` as SiteTextKey;

export function ServicesPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <SiteShell locale={locale} path="/services">
      <PageHead title={t("services.title")} intro={t("services.intro")}/>
      <Lined>
        <Stop title={t("home.capability_title")}><ServiceList locale={locale}/></Stop>
        <Stop title={t("services.cargo_title")} intro={t("services.cargo_copy")}>
          <Link href={sitePath(locale, "/sectors")} className="text-link">{t("services.sectors_title")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </Stop>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}

export function ServiceDetailPage({ locale, slug }: { locale: SiteLocale; slug: ServiceSlug }) {
  const t = siteTranslator(locale);
  const service = services.find((entry) => entry.slug === slug);
  if (!service) return null;
  const others = services.filter((entry) => entry.slug !== slug);
  return (
    <SiteShell locale={locale} path={`/services/${slug}`}>
      {/* The page describes one service; the node says the same thing to a
        * crawler and points back at the organisation that provides it. */}
      <StructuredData data={graph([serviceNode(locale, slug)])}/>
      <PageHead title={t(text(service.key, "title"))} intro={t(text(service.key, "summary"))}>
        <MiniRoute stops={t(text(service.key, "stops"))}/>
      </PageHead>
      <Lined>
        <Stop title={t("services.covers")}>
          <ul className="check-list">
            {["p1", "p2", "p3", "p4", "p5", "p6"].map((part) => <li key={part}>{t(text(service.key, part))}</li>)}
          </ul>
        </Stop>
        <Stop title={t("services.how_title")}><p className="prose">{t(text(service.key, "how"))}</p></Stop>
        <section className="stop stop-split">
          <div><h2 className="block-title">{t("services.lanes_title")}</h2><p>{t(text(service.key, "lanes"))}</p></div>
          <div><h2 className="block-title">{t("services.docs_title")}</h2><p>{t(text(service.key, "docs"))}</p></div>
        </section>
        <Stop title={t("services.questions_title")}>
          <dl className="qa">
            {[1, 2].map((number) => (
              <div key={number}><dt>{t(text(service.key, `q${number}`))}</dt><dd>{t(text(service.key, `a${number}`))}</dd></div>
            ))}
          </dl>
        </Stop>
        <Stop title={t("services.ask")} intro={t(text(service.key, "ask"))}>
          <Link href={sitePath(locale, "/quote")} className="btn" data-analytics-event="quote_tap">{t("home.cta_primary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
        </Stop>
        <Stop title={t("services.related")}>
          <ul className="link-list">
            {others.map((entry) => (
              <li key={entry.slug}><Link href={sitePath(locale, `/services/${entry.slug}`)}>{t(text(entry.key, "title"))}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            ))}
          </ul>
        </Stop>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}
