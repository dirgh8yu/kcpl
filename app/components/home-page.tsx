import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { affiliations } from "../company-data";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { SiteShell } from "./site-chrome";

/* Places are records, not copy: the same spellings appear on the documents, so
 * they are not translated and not re-ordered per language. */
const origins = ["Shanghai", "Ningbo", "Qingdao", "Shekou", "Hong Kong", "Bangkok", "Port Klang", "Singapore"];
const gateways = ["Kolkata", "Visakhapatnam", "Haldia", "Raxaul", "Birgunj"];
const destinations = ["United States", "Canada", "United Kingdom", "Germany", "Netherlands", "Australia", "South Korea", "Brazil"];

export function HomePage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const capabilities = [
    { title: t("home.cap_1_title"), copy: t("home.cap_1_copy") },
    { title: t("home.cap_2_title"), copy: t("home.cap_2_copy") },
    { title: t("home.cap_3_title"), copy: t("home.cap_3_copy") },
    { title: t("home.cap_4_title"), copy: t("home.cap_4_copy") },
  ];
  const rail = [
    { value: t("company.established_short"), detail: t("company.established_where") },
    { value: t("home.credibility_award"), detail: t("home.credibility_award_detail") },
    { value: t("home.credibility_member_detail"), detail: t("home.credibility_member") },
  ];
  const credibility = [
    { label: t("home.credibility_storage"), detail: t("home.credibility_storage_detail") },
    { label: t("home.credibility_projects"), detail: t("home.credibility_projects_detail") },
  ];

  return (
    <SiteShell locale={locale} path="/">
      {/* 1. The photograph runs full bleed and the copy plate breaks its lower
        * edge, so the page opens like a publication rather than a banner. The
        * image is illustrative of Nepal, not KCPL cargo, so it stays
        * uncaptioned and decorative. */}
      <section className="hero">
        <Image src="/images/himalayan-hero.jpg" alt="" fill sizes="100vw" priority className="hero-image"/>
      </section>
      <div className="hero-plate">
        <h1 className="hero-title">{t("home.hero_title")}</h1>
        <p className="hero-intro">{t("home.hero_intro")}</p>
        <div className="hero-actions">
          <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.hero_cta")}<ArrowRight size={17} strokeWidth={1.75} aria-hidden="true"/></Link>
          <Link href={sitePath(locale, "/services")} className="section-link">{t("home.hero_secondary")}<ArrowRight size={15} strokeWidth={1.75} aria-hidden="true"/></Link>
        </div>
      </div>
      {/* The trust strip sits under the hero, never inside it. */}
      <div className="hero-rail">
        {rail.map((item) => (
          <span key={item.value} className="hero-rail-item"><span className="hero-rail-value">{item.value}</span>{item.detail}</span>
        ))}
      </div>

      {/* 2. Sticky headline against a divided list. No cards, no equal columns. */}
      <section className="section section-capability">
        <div className="capability-layout">
          <div className="capability-aside">
            <h2 className="section-title">{t("home.capability_title")}</h2>
            <p className="section-intro">{t("home.capability_intro")}</p>
            <Link href={sitePath(locale, "/services")} className="section-link">{t("home.capability_link")}<ArrowRight size={15} strokeWidth={1.75} aria-hidden="true"/></Link>
          </div>
          <dl className="capability-list reveal-group">
            {capabilities.map((item) => (
              <div key={item.title} className="capability-item reveal">
                <dt className="capability-title">{item.title}</dt>
                <dd className="capability-copy">{item.copy}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 3. Corridors as a directional band: origins, gateway, inland. The photographs
        * carry the two halves of a landlocked movement. */}
      <section className="section section-corridor">
        <h2 className="section-title corridor-heading">{t("home.corridor_title")}</h2>
        <p className="section-intro">{t("home.corridor_intro")}</p>
        <div className="corridor-band">
          <article className="corridor-leg">
            <figure className="corridor-figure"><Image src="/images/ocean-freight.jpg" alt="" width={900} height={600} sizes="(max-width: 900px) 100vw, 50vw" className="corridor-photo"/></figure>
            <h3 className="corridor-title">{t("home.corridor_in_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_in_copy")}</p>
            <p className="corridor-label">{t("home.corridor_origins")}</p>
            <ul className="corridor-tags">{origins.map((place) => <li key={place} className="corridor-tag">{place}</li>)}</ul>
            <p className="corridor-label">{t("home.corridor_gateways")}</p>
            <ul className="corridor-tags">{gateways.map((place) => <li key={place} className="corridor-tag">{place}</li>)}</ul>
          </article>
          <article className="corridor-leg">
            <figure className="corridor-figure"><Image src="/images/nepal-road-freight.jpg" alt="" width={900} height={600} sizes="(max-width: 900px) 100vw, 50vw" className="corridor-photo"/></figure>
            <h3 className="corridor-title">{t("home.corridor_out_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_out_copy")}</p>
            <p className="corridor-label">{t("home.corridor_destinations")}</p>
            <ul className="corridor-tags">{destinations.map((place) => <li key={place} className="corridor-tag">{place}</li>)}</ul>
          </article>
        </div>
        <Link href={sitePath(locale, "/network")} className="section-link">{t("home.corridor_link")}<ArrowRight size={15} strokeWidth={1.75} aria-hidden="true"/></Link>
      </section>

      {/* 4. Evidence: one case carries the weight, two support it. Not three equal cards. */}
      <section className="section section-proof">
        <div className="section-head">
          <p className="eyebrow">{t("home.proof_eyebrow")}</p>
          <h2 className="section-title">{t("home.proof_title")}</h2>
          <p className="section-intro">{t("home.proof_intro")}</p>
        </div>
        <article className="proof-lead">
          <figure className="proof-figure"><Image src="/images/services/specialist-project-cargo.jpg" alt="" width={1200} height={800} sizes="(max-width: 1080px) 100vw, 55vw" className="proof-photo"/></figure>
          <div>
            <p className="proof-kicker">{t("home.proof_1_kicker")}</p>
            <h3 className="proof-lead-title">{t("home.proof_1_title")}</h3>
            <p className="proof-copy">{t("home.proof_1_copy")}</p>
          </div>
        </article>
        <div className="proof-more reveal-group">
          <article className="reveal">
            <p className="proof-kicker">{t("home.proof_2_kicker")}</p>
            <h3 className="proof-title">{t("home.proof_2_title")}</h3>
            <p className="proof-copy">{t("home.proof_2_copy")}</p>
          </article>
          <article className="reveal">
            <p className="proof-kicker">{t("home.proof_3_kicker")}</p>
            <h3 className="proof-title">{t("home.proof_3_title")}</h3>
            <p className="proof-copy">{t("home.proof_3_copy")}</p>
          </article>
        </div>
        <Link href={sitePath(locale, "/sectors")} className="section-link">{t("home.proof_link")}<ArrowRight size={15} strokeWidth={1.75} aria-hidden="true"/></Link>
      </section>

      {/* 5. Credibility: claims a buyer can verify, each one named. */}
      <section className="section section-credibility">
        <div className="credibility-layout">
          <div className="credibility-copy">
            <h2 className="section-title">{t("home.credibility_title")}</h2>
            <p className="section-intro">{t("home.credibility_copy")}</p>
            <ul className="credibility-marks">
              {affiliations.filter((mark) => mark.name !== "JCtrans").map((mark) => (
                <li key={mark.name} className="credibility-mark">
                  <Image src={mark.image} alt={mark.detail} width={mark.width} height={mark.height} className="credibility-mark-image"/>
                </li>
              ))}
            </ul>
          </div>
          <dl className="credibility-facts">
            {credibility.map((fact) => (
              <div key={fact.label} className="credibility-fact">
                <dt className="credibility-label">{fact.label}</dt>
                <dd className="credibility-detail">{fact.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 6. Closing band, dark, matching the footer beneath it. */}
      <section className="section section-cta">
        <h2 className="cta-title">{t("home.cta_title")}</h2>
        <p className="cta-copy">{t("home.cta_copy")}</p>
        <div className="hero-actions">
          <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.cta_primary")}<ArrowRight size={17} strokeWidth={1.75} aria-hidden="true"/></Link>
          <Link href={sitePath(locale, "/contact")} className="button-ghost">{t("home.cta_secondary")}</Link>
        </div>
      </section>
    </SiteShell>
  );
}
