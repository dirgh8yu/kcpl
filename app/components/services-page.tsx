import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { services, type ServiceKey, type ServiceSlug } from "../services-data";
import { servicePhotos } from "../site-photos";
import { graph, serviceNode } from "../structured-data";
import { sitePath, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { ClosingBand } from "./closing-band";
import { SiteShell } from "./site-chrome";
import { StructuredData } from "./structured-data";

export { services, type ServiceKey, type ServiceSlug } from "../services-data";

const text = (key: ServiceKey, part: string) => `svc.${key}.${part}` as SiteTextKey;

export function ServicesPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <SiteShell locale={locale} path="/services">
      <section className="section page-head services-overview-head">
        <h1 className="section-title">{t("services.title")}</h1>
        <p className="section-intro">{t("services.intro")}</p>
      </section>
      {/* Tiles, as on the home page: the first service across the width, the
        * other six in pairs, each with its own photograph (illustrative, so
        * decorative). The whole tile is the link. */}
      <section className="tiles service-tiles">
        <div className="tile-grid">
          {services.map((service, index) => (
            <article key={service.slug} className={`tile ${index === 0 ? "tile-dark tile-wide" : "tile-light"}`}>
              <div className="tile-text">
                <h2 className="tile-title"><Link href={sitePath(locale, `/services/${service.slug}`)} className="tile-cover">{t(text(service.key, "title"))}</Link></h2>
                <p className="tile-copy">{t(text(service.key, "summary"))}</p>
                <span className="text-link" aria-hidden="true">{t("chrome.learn_more")}<CaretRight size={13} weight="bold"/></span>
              </div>
              <figure className="tile-figure">
                <Image
                  src={servicePhotos[service.key]}
                  alt=""
                  placeholder="blur"
                  sizes={index === 0 ? "(max-width: 760px) 100vw, 60vw" : "(max-width: 760px) 100vw, 50vw"}
                  className={`service-photo-${service.key}`}
                />
              </figure>
            </article>
          ))}
        </div>
      </section>
      <section className="tiles">
        <header className="tiles-head">
          <h2 className="section-title">{t("services.cargo_title")}</h2>
          <p className="section-intro">{t("services.cargo_copy")}</p>
        </header>
      </section>
      <ClosingBand locale={locale}/>
    </SiteShell>
  );
}

export function ServiceDetailPage({ locale, slug }: { locale: SiteLocale; slug: ServiceSlug }) {
  const t = siteTranslator(locale);
  const service = services.find((entry) => entry.slug === slug);
  if (!service) return null;
  const others = services.filter((entry) => entry.slug !== slug).slice(0, 3);
  return (
    <SiteShell locale={locale} path={`/services/${slug}`}>
      {/* The page describes one service; the node says the same thing to a
        * crawler and points back at the organisation that provides it. */}
      <StructuredData data={graph([serviceNode(locale, slug)])}/>
      <section className="intro intro-page">
        <p className="eyebrow"><Link href={sitePath(locale, "/services")}>{t("services.title")}</Link></p>
        <h1 className="hero-title">{t(text(service.key, "title"))}</h1>
        <p className="intro-copy">{t(text(service.key, "summary"))}</p>
        <div className="intro-actions">
          <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.cta_primary")}</Link>
        </div>
        <figure className="intro-figure">
          <Image src={servicePhotos[service.key]} alt="" priority placeholder="blur" sizes="(max-width: 1440px) 100vw, 1440px" className={`service-photo-${service.key}`}/>
        </figure>
      </section>
      <section className="section service-detail">
        <div className="service-detail-main">
          <h2 className="service-block-title">{t("services.covers")}</h2>
          <ul className="service-points">
            {["p1", "p2", "p3", "p4", "p5", "p6"].map((part) => <li key={part} className="service-point">{t(text(service.key, part))}</li>)}
          </ul>
        </div>
        <aside className="service-detail-aside">
          <h2 className="service-block-title">{t("services.ask")}</h2>
          <p className="service-ask">{t(text(service.key, "ask"))}</p>
          <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.cta_primary")}</Link>
        </aside>
      </section>
      {/* Depth the summary cannot carry: how the work actually runs, then the
        * corridors and the paperwork side by side. Deliberately not three equal
        * cards -- the prose block leads and the pair supports it. */}
      <section className="section service-expanded">
        <h2 className="service-block-title">{t("services.how_title")}</h2>
        <p className="service-prose">{t(text(service.key, "how"))}</p>
      </section>
      <section className="section network-notes service-notes">
        <article className="network-note">
          <h2 className="service-block-title">{t("services.lanes_title")}</h2>
          <p className="section-intro">{t(text(service.key, "lanes"))}</p>
        </article>
        <article className="network-note">
          <h2 className="service-block-title">{t("services.docs_title")}</h2>
          <p className="section-intro">{t(text(service.key, "docs"))}</p>
        </article>
      </section>
      <section className="section service-questions" aria-labelledby="service-questions-title">
        <h2 id="service-questions-title" className="service-block-title">{t("services.questions_title")}</h2>
        <dl className="service-question-list">
          {[1, 2].map((number) => (
            <div className="service-question" key={number}>
              <dt>{t(text(service.key, `q${number}`))}</dt>
              <dd>{t(text(service.key, `a${number}`))}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="section service-related">
        <h2 className="service-block-title">{t("services.related")}</h2>
        <div className="service-related-grid">
          {others.map((entry) => (
            <Link key={entry.slug} href={sitePath(locale, `/services/${entry.slug}`)} className="service-related-link">
              <span className="service-related-name">{t(text(entry.key, "title"))}</span>
              <CaretRight size={15} weight="bold" aria-hidden="true"/>
            </Link>
          ))}
        </div>
        <Link href={sitePath(locale, "/services")} className="section-link">{t("services.back")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
      </section>
    </SiteShell>
  );
}
