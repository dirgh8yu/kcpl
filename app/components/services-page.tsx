import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { sitePath, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { SiteShell } from "./site-chrome";

/* One service list drives the overview, the seven detail pages and the routing,
 * so a service cannot exist in the navigation and be missing as a page. */
export const services = [
  { slug: "air-freight", key: "air", image: "/images/unsplash/air-cargo.jpg" },
  { slug: "ocean-freight", key: "ocean", image: "/images/unsplash/ship-dusk.jpg" },
  { slug: "road-freight", key: "road", image: "/images/unsplash/nepal-road.jpg" },
  { slug: "customs-clearance", key: "customs", image: "/images/services/specialist-cargo.jpg" },
  { slug: "project-cargo", key: "project", image: "/images/services/specialist-project-cargo.jpg" },
  { slug: "warehousing", key: "warehouse", image: "/images/services/warehousing.jpg" },
  { slug: "delivery", key: "delivery", image: "/images/services/door-to-door.jpg" },
] as const;

export type ServiceKey = (typeof services)[number]["key"];
export type ServiceSlug = (typeof services)[number]["slug"];

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
        {services.map((service, index) => (
          <Link key={service.slug} href={sitePath(locale, `/services/${service.slug}`)} className="service-row reveal">
            <span className="service-row-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
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
