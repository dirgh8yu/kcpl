import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { affiliations } from "../company-data";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { SiteShell } from "./site-chrome";

/* Places are records, not copy: the same spellings appear on the documents, so
 * they are not translated and not re-ordered per language. */
const gateways = ["Kolkata", "Visakhapatnam", "Haldia", "Raxaul", "Birgunj"];
const origins = ["Shanghai", "Ningbo", "Qingdao", "Shekou", "Hong Kong", "Bangkok", "Port Klang", "Singapore"];
const destinations = ["United States", "Canada", "United Kingdom", "Germany", "Netherlands", "Australia", "South Korea", "Brazil"];

export function HomePage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const capabilities = [
    { title: t("home.cap_1_title"), copy: t("home.cap_1_copy") },
    { title: t("home.cap_2_title"), copy: t("home.cap_2_copy") },
    { title: t("home.cap_3_title"), copy: t("home.cap_3_copy") },
    { title: t("home.cap_4_title"), copy: t("home.cap_4_copy") },
  ];
  const proof = [
    { kicker: t("home.proof_1_kicker"), title: t("home.proof_1_title"), copy: t("home.proof_1_copy") },
    { kicker: t("home.proof_2_kicker"), title: t("home.proof_2_title"), copy: t("home.proof_2_copy") },
    { kicker: t("home.proof_3_kicker"), title: t("home.proof_3_title"), copy: t("home.proof_3_copy") },
  ];
  const credibility = [
    { label: t("home.credibility_award"), detail: t("home.credibility_award_detail") },
    { label: t("home.credibility_storage"), detail: t("home.credibility_storage_detail") },
    { label: t("home.credibility_member"), detail: t("home.credibility_member_detail") },
    { label: t("home.credibility_projects"), detail: t("home.credibility_projects_detail") },
  ];

  return (
    <SiteShell locale={locale} path="/">
      <section className="hero">
        {/* Illustrative photography. It is Nepal, not a KCPL facility or KCPL cargo,
          * so it carries no caption and is marked decorative. */}
        <Image src="/images/himalayan-hero.jpg" alt="" fill sizes="100vw" priority className="hero-image"/>
        <div className="hero-veil"/>
        <div className="hero-inner">
          <p className="eyebrow hero-eyebrow">{t("home.hero_eyebrow")}</p>
          <h1 className="hero-title">{t("home.hero_title")}</h1>
          <p className="hero-intro">{t("home.hero_intro")}</p>
          <div className="hero-actions">
            <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.hero_cta")}<ArrowRight size={17} strokeWidth={1.75} aria-hidden="true"/></Link>
            <Link href={sitePath(locale, "/services")} className="button-ghost">{t("home.hero_secondary")}</Link>
          </div>
          <p className="hero-since">{t("home.hero_since")}</p>
        </div>
      </section>

      <section className="section section-capability">
        <div className="section-head">
          <p className="eyebrow">{t("home.capability_eyebrow")}</p>
          <h2 className="section-title">{t("home.capability_title")}</h2>
          <p className="section-intro">{t("home.capability_intro")}</p>
        </div>
        <ol className="capability-list">
          {capabilities.map((item, index) => (
            <li key={item.title} className="capability-item">
              <span className="capability-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="capability-title">{item.title}</h3>
              <p className="capability-copy">{item.copy}</p>
            </li>
          ))}
        </ol>
        <Link href={sitePath(locale, "/services")} className="section-link">{t("home.capability_link")}<ArrowRight size={15} strokeWidth={1.75} aria-hidden="true"/></Link>
      </section>

      <section className="section section-corridor">
        <div className="section-head">
          <p className="eyebrow eyebrow-inverse">{t("home.corridor_eyebrow")}</p>
          <h2 className="section-title section-title-inverse">{t("home.corridor_title")}</h2>
          <p className="section-intro section-intro-inverse">{t("home.corridor_intro")}</p>
        </div>
        <div className="corridor-grid">
          <article className="corridor-card">
            <h3 className="corridor-title">{t("home.corridor_in_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_in_copy")}</p>
            <p className="corridor-label">{t("home.corridor_origins")}</p>
            <ul className="corridor-tags">{origins.map((place) => <li key={place} className="corridor-tag">{place}</li>)}</ul>
            <p className="corridor-label">{t("home.corridor_gateways")}</p>
            <ul className="corridor-tags">{gateways.map((place) => <li key={place} className="corridor-tag">{place}</li>)}</ul>
          </article>
          <article className="corridor-card">
            <h3 className="corridor-title">{t("home.corridor_out_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_out_copy")}</p>
            <p className="corridor-label">{t("home.corridor_destinations")}</p>
            <ul className="corridor-tags">{destinations.map((place) => <li key={place} className="corridor-tag">{place}</li>)}</ul>
          </article>
        </div>
        <Link href={sitePath(locale, "/network")} className="section-link section-link-inverse">{t("home.corridor_link")}<ArrowRight size={15} strokeWidth={1.75} aria-hidden="true"/></Link>
      </section>

      <section className="section section-proof">
        <div className="section-head">
          <p className="eyebrow">{t("home.proof_eyebrow")}</p>
          <h2 className="section-title">{t("home.proof_title")}</h2>
          <p className="section-intro">{t("home.proof_intro")}</p>
        </div>
        <div className="proof-grid">
          {proof.map((item) => (
            <article key={item.title} className="proof-card">
              <p className="proof-kicker">{item.kicker}</p>
              <h3 className="proof-title">{item.title}</h3>
              <p className="proof-copy">{item.copy}</p>
            </article>
          ))}
        </div>
        <Link href={sitePath(locale, "/sectors")} className="section-link">{t("home.proof_link")}<ArrowRight size={15} strokeWidth={1.75} aria-hidden="true"/></Link>
      </section>

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
