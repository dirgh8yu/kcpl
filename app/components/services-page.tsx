import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { guides, type GuideSlug } from "../guide-data";
import { serviceDepth } from "../content-depth";
import { services, type ServiceKey, type ServiceSlug } from "../services-data";
import { graph, serviceNode } from "../structured-data";
import { sitePath, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { tools, type ToolSlug } from "../tool-data";
import { Breadcrumbs } from "./breadcrumbs";
import { ClosingBand } from "./closing-band";
import { ContentDepth } from "./content-depth";
import { ServiceList } from "./home-page";
import { Lined, MiniRoute, PageHead, Plate, QaList, Stop } from "./route-parts";
import { SiteShell } from "./site-chrome";
import { StructuredData } from "./structured-data";

export { services, type ServiceKey, type ServiceSlug } from "../services-data";

const text = (key: ServiceKey, part: string) => `svc.${key}.${part}` as SiteTextKey;

/* Only photographs with a recorded source and no other company's branding. */
const servicePhotos: Record<ServiceSlug, { src: string; position?: string }> = {
  "air-freight": { src: "/images/unsplash/air-pallets.jpg", position: "70% 100%" },
  "ocean-freight": { src: "/images/unsplash/ship-terminal.jpg", position: "30% 50%" },
  "road-freight": { src: "/images/unsplash/ghat-trucks.jpg", position: "100% 70%" },
  "customs-clearance": { src: "/images/unsplash/container-plate.jpg", position: "20% 50%" },
  "project-cargo": { src: "/images/unsplash/heavy-lift.jpg" },
  warehousing: { src: "/images/unsplash/warehouse-racks.jpg" },
  delivery: { src: "/images/unsplash/clipboard-sign.jpg" },
};

/* The guides link to the services, and this links back, so a reader and a crawler
 * can reach the deeper pages from the page they arrived on. */
const serviceResources: Record<ServiceSlug, { guides: GuideSlug[]; tool: ToolSlug }> = {
  "air-freight": { guides: ["air-freight-to-kathmandu", "exporting-from-nepal"], tool: "volume-weight" },
  "ocean-freight": { guides: ["sea-freight-through-india", "free-time-and-demurrage"], tool: "storage-charges" },
  "road-freight": { guides: ["importing-to-nepal", "sea-freight-through-india"], tool: "volume-weight" },
  "customs-clearance": { guides: ["customs-clearance-in-nepal", "hs-codes-and-import-duty"], tool: "duty-estimate" },
  "project-cargo": { guides: ["importing-to-nepal", "customs-clearance-in-nepal"], tool: "volume-weight" },
  warehousing: { guides: ["free-time-and-demurrage", "importing-to-nepal"], tool: "storage-charges" },
  delivery: { guides: ["importing-to-nepal", "exporting-from-nepal"], tool: "volume-weight" },
};

export function ServicesPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <SiteShell locale={locale} path="/services">
      <PageHead title={t("services.title")} intro={t("services.intro")} breadcrumb={<Breadcrumbs locale={locale} path="/services"/>}/>
      <Lined reveal>
        <Stop title={t("home.capability_title")}><ServiceList locale={locale}/></Stop>
        <section className="stop sector">
          <div>
            <h2 className="stop-title">{t("services.cargo_title")}</h2>
            <p className="stop-intro">{t("services.cargo_copy")}</p>
            <div className="page-actions">
              <Link href={sitePath(locale, "/sectors")} className="text-link">{t("services.sectors_title")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
              <Link href={sitePath(locale, "/guides")} className="text-link">{t("chrome.resources")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
              <Link href={sitePath(locale, "/network")} className="text-link">{t("home.corridor_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
            </div>
          </div>
          <Plate src="/images/unsplash/port-aerial.jpg"/>
        </section>
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
      <PageHead
        title={t(text(service.key, "title"))}
        intro={t(text(service.key, "summary"))}
        breadcrumb={<Breadcrumbs locale={locale} path={`/services/${slug}`}/>}
      >
        <MiniRoute stops={t(text(service.key, "stops"))}/>
      </PageHead>
      <Lined reveal>
        <Stop title={t("services.covers")}>
          <ul className="check-list">
            {["p1", "p2", "p3", "p4", "p5", "p6"].map((part) => <li key={part}>{t(text(service.key, part))}</li>)}
          </ul>
        </Stop>
        <section className="stop sector">
          <div>
            <h2 className="stop-title">{t("services.how_title")}</h2>
            <p className="prose">{t(text(service.key, "how"))}</p>
          </div>
          <Plate {...servicePhotos[slug]}/>
        </section>
        <section className="stop stop-split">
          <div><h2 className="block-title">{t("services.lanes_title")}</h2><p>{t(text(service.key, "lanes"))}</p></div>
          <div><h2 className="block-title">{t("services.docs_title")}</h2><p>{t(text(service.key, "docs"))}</p></div>
        </section>
        {locale === "en" ? <ContentDepth content={serviceDepth[slug]}/> : null}
        <Stop title={t("services.questions_title")}>
          <QaList items={[1, 2].map((number) => ({ question: t(text(service.key, `q${number}`)), answer: t(text(service.key, `a${number}`)) }))}/>
        </Stop>
        <Stop title={t("services.ask")} intro={t(text(service.key, "ask"))}>
          <Link href={sitePath(locale, "/quote")} className="btn" data-analytics-event="quote_tap">{t("home.cta_primary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
        </Stop>
        <Stop title={t("chrome.resources")}>
          <ul className="link-list">
            {serviceResources[slug].guides.map((guide) => (
              <li key={guide}><Link href={sitePath(locale, `/guides/${guide}`)}>{guides[locale][guide].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            ))}
            <li><Link href={sitePath(locale, `/tools/${serviceResources[slug].tool}`)}>{tools[locale][serviceResources[slug].tool].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
          </ul>
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
