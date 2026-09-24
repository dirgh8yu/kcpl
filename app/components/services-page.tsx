import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { services, type ServiceKey, type ServiceSlug } from "../services-data";
import { graph, serviceNode } from "../structured-data";
import { sitePath, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
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
      <section className="section service-index reveal-group">
        {services.map((service) => (
          <Link key={service.slug} href={sitePath(locale, `/services/${service.slug}`)} className="service-row reveal">
            <div className="service-row-body">
              <h2 className="service-row-title">{t(text(service.key, "title"))}</h2>
              <p className="service-row-copy">{t(text(service.key, "summary"))}</p>
            </div>
            {/* Illustrative freight photography, not KCPL's own cargo, so it carries
              * no caption and is marked decorative. */}
            <figure className="service-figure"><Image src={service.image} alt="" width={480} height={320} sizes="(max-width: 700px) 100vw, 220px" className={`service-photo service-photo-${service.key}`}/></figure>
            <span className="service-row-arrow" aria-hidden="true"><ArrowRight size={20} weight="regular"/></span>
          </Link>
        ))}
      </section>
      <section className="section cargo-types">
        <h2 className="service-block-title">{t("services.cargo_title")}</h2>
        <p className="section-intro">{t("services.cargo_copy")}</p>
      </section>
      <section className="section section-cta">
        <h2 className="cta-title">{t("home.cta_title")}</h2>
        <p className="cta-copy">{t("home.cta_copy")}</p>
        <div className="hero-actions">
          <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.cta_primary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, "/contact")} className="button-ghost">{t("home.cta_secondary")}</Link>
        </div>
      </section>
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
      <section className="service-banner">
        <Image src={service.image} alt="" fill sizes="100vw" priority className={`service-banner-image service-photo-${service.key}`}/>
        <div className="service-banner-copy">
          <p className="eyebrow">{t("services.title")}</p>
          <h1 className="section-title">{t(text(service.key, "title"))}</h1>
          <p className="section-intro">{t(text(service.key, "summary"))}</p>
        </div>
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
          <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.cta_primary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
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
              <ArrowRight size={15} weight="bold" aria-hidden="true"/>
            </Link>
          ))}
        </div>
        <Link href={sitePath(locale, "/services")} className="section-link">{t("services.back")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
      </section>
    </SiteShell>
  );
}
