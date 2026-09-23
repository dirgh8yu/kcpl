import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { affiliations } from "../company-data";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { SiteShell } from "./site-chrome";
import { ClientRail } from "./client-rail";
import { CapacityCount } from "./capacity-count";

/* Places are records, not copy: the same spellings appear on the documents, so
 * they are not translated and not re-ordered per language. */
const origins = ["Shanghai", "Ningbo", "Qingdao", "Shekou", "Hong Kong", "Bangkok", "Port Klang", "Singapore"];
const gateways = ["Kolkata", "Visakhapatnam", "Haldia", "Raxaul", "Birgunj"];
const destinations = ["United States", "Canada", "United Kingdom", "Germany", "Netherlands", "Australia", "South Korea", "Brazil"];

export function HomePage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const capabilities = [
    { title: t("home.cap_1_title"), copy: t("home.cap_1_copy"), href: "/services" },
    { title: t("home.cap_2_title"), copy: t("home.cap_2_copy"), href: "/services/customs-clearance" },
    { title: t("home.cap_3_title"), copy: t("home.cap_3_copy"), href: "/services/project-cargo" },
    { title: t("home.cap_4_title"), copy: t("home.cap_4_copy"), href: "/services/delivery" },
  ];
  const rail = [
    { value: t("stats.clients_value"), detail: t("stats.clients_label") },
    { value: t("stats.projects_value"), detail: t("stats.projects_label") },
  ];
  const credibility = [
    { label: t("company.established_short"), detail: t("company.established_where") },
    { label: t("home.credibility_award"), detail: t("home.credibility_award_detail") },
    { label: t("home.credibility_member"), detail: t("home.credibility_member_detail") },
    { label: t("home.credibility_projects"), detail: t("home.credibility_projects_detail") },
  ];

  return (
    <SiteShell locale={locale} path="/">
      <section className="hero">
        <Image src="/images/unsplash/ship-dusk.jpg" alt="" fill sizes="100vw" priority className="hero-image"/>
        <div className="hero-plate">
          <p className="hero-overline">Kapileshwor Cargo · Kathmandu, Nepal</p>
          <h1 className="hero-title">{t("home.hero_title")}</h1>
          <p className="hero-intro">{t("home.hero_intro")}</p>
          <div className="hero-actions">
            <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.hero_cta")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
            <Link href={sitePath(locale, "/services")} className="button-ghost">{t("home.hero_secondary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          </div>
        </div>
        <div className="hero-rail">
          {rail.map((item) => (
            <span key={item.detail} className="hero-rail-item"><span className="hero-rail-value">{item.value}</span>{item.detail}</span>
          ))}
        </div>
      </section>
      <ClientRail locale={locale}/>

      <section className="section section-capability">
        <div className="capability-layout">
          <div className="capability-aside">
            <h2 className="section-title reveal">{t("home.capability_title")}</h2>
            <p className="section-intro reveal">{t("home.capability_intro")}</p>
            <Link href={sitePath(locale, "/services")} className="section-link">{t("home.capability_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
            <figure className="capability-figure reveal"><Image src="/images/unsplash/air-cargo.jpg" alt="" width={1800} height={1200} sizes="(max-width: 1024px) 100vw, 44vw" className="capability-photo"/></figure>
          </div>
          <dl className="capability-list reveal-group">
            {capabilities.map((item) => (
              <div key={item.title} className="capability-item reveal">
                <dt className="capability-title"><Link href={sitePath(locale, item.href)}>{item.title}<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true"/></Link></dt>
                <dd className="capability-copy">{item.copy}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section section-corridor">
        <h2 className="section-title corridor-heading">{t("home.corridor_title")}</h2>
        <p className="section-intro">{t("home.corridor_intro")}</p>
        <div className="corridor-band">
          <article className="corridor-leg">
            <figure className="corridor-figure"><Image src="/images/unsplash/ship-aerial.jpg" alt="" width={900} height={600} sizes="(max-width: 900px) 100vw, 50vw" className="corridor-photo"/></figure>
            <h3 className="corridor-title">{t("home.corridor_in_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_in_copy")}</p>
            <p className="corridor-label">{t("home.corridor_origins")}</p>
            <ul className="corridor-tags">{origins.map((place) => <li key={place} className="corridor-tag">{place}</li>)}</ul>
            <p className="corridor-label">{t("home.corridor_gateways")}</p>
            <ul className="corridor-tags">{gateways.map((place) => <li key={place} className="corridor-tag">{place}</li>)}</ul>
          </article>
          <article className="corridor-leg">
            <figure className="corridor-figure"><Image src="/images/unsplash/nepal-road.jpg" alt="" width={900} height={600} sizes="(max-width: 900px) 100vw, 50vw" className="corridor-photo"/></figure>
            <h3 className="corridor-title">{t("home.corridor_out_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_out_copy")}</p>
            <p className="corridor-label">{t("home.corridor_destinations")}</p>
            <ul className="corridor-tags">{destinations.map((place) => <li key={place} className="corridor-tag">{place}</li>)}</ul>
          </article>
        </div>
        <Link href={sitePath(locale, "/network")} className="section-link">{t("home.corridor_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
      </section>

      <section className="section section-proof">
        <div className="section-head">
          <p className="eyebrow">{t("home.proof_eyebrow")}</p>
          <h2 className="section-title reveal">{t("home.proof_title")}</h2>
          <p className="section-intro">{t("home.proof_intro")}</p>
        </div>
        <article className="proof-lead">
          <figure className="proof-figure"><Image src="/images/unsplash/port-aerial.jpg" alt="" width={1200} height={800} sizes="(max-width: 1080px) 100vw, 55vw" className="proof-photo"/></figure>
          <div>
            <p className="proof-kicker">{t("home.proof_1_kicker")}</p>
            <h3 className="proof-lead-title">{t("home.proof_1_title")}</h3>
            <p className="proof-copy">{t("home.proof_1_copy")}</p>
            <p className="proof-meta">{t("home.proof_1_meta")}</p>
          </div>
        </article>
        <div className="proof-more reveal-group">
          <article className="proof-support reveal">
            <p className="proof-kicker">{t("home.proof_2_kicker")}</p>
            <h3 className="proof-title">{t("home.proof_2_title")}</h3>
            <p className="proof-copy">{t("home.proof_2_copy")}</p>
            <p className="proof-meta">{t("home.proof_2_meta")}</p>
          </article>
          <article className="proof-support reveal">
            <p className="proof-kicker">{t("home.proof_3_kicker")}</p>
            <h3 className="proof-title">{t("home.proof_3_title")}</h3>
            <p className="proof-copy">{t("home.proof_3_copy")}</p>
            <p className="proof-meta">{t("home.proof_3_meta")}</p>
          </article>
        </div>
        <Link href={sitePath(locale, "/sectors")} className="section-link">{t("home.proof_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
      </section>

      <section className="section section-credibility">
        <div className="credibility-layout">
          <div className="credibility-copy">
            <h2 className="section-title reveal">{t("home.credibility_title")}</h2>
            <p className="section-intro">{t("home.credibility_copy")}</p>
            <ul className="credibility-marks">
              {affiliations.filter((mark) => mark.name !== "JCtrans").map((mark) => (
                <li key={mark.name} className="credibility-mark">
                  <Image src={mark.image} alt={mark.detail} width={mark.width} height={mark.height} className="credibility-mark-image"/>
                </li>
              ))}
            </ul>
          </div>
          <div className="credibility-capacity reveal">
            <p className="credibility-label">{t("home.credibility_storage")}</p>
            <div className="capacity-metric"><CapacityCount value={1000} locale={locale}/><span>{t("home.storage_air_label")}</span></div>
            <div className="capacity-metric"><CapacityCount value={6000} locale={locale}/><span>{t("home.storage_road_label")}</span></div>
          </div>
        </div>
        <dl className="credibility-facts reveal-group">
          {credibility.map((fact) => (
            <div key={fact.label} className="credibility-fact reveal">
              <dt className="credibility-label">{fact.label}</dt>
              <dd className="credibility-detail">{fact.detail}</dd>
            </div>
          ))}
        </dl>
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
