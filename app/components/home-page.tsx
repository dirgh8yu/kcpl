import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { affiliations } from "../company-data";
import { guides } from "../guide-data";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { SiteShell } from "./site-chrome";
import { ClientRail } from "./client-rail";

export function HomePage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const capabilities = [
    { title: t("home.cap_1_title"), copy: t("home.cap_1_copy"), href: "/services" },
    { title: t("home.cap_2_title"), copy: t("home.cap_2_copy"), href: "/services/customs-clearance" },
    { title: t("home.cap_3_title"), copy: t("home.cap_3_copy"), href: "/services/project-cargo" },
    { title: t("home.cap_4_title"), copy: t("home.cap_4_copy"), href: "/services/delivery" },
  ];
  const credibility = [
    { label: t("home.credibility_award"), detail: t("home.credibility_award_detail") },
    { label: t("home.credibility_member"), detail: t("home.credibility_member_detail") },
    { label: t("home.credibility_storage"), detail: t("home.credibility_storage_detail") },
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
          </div>
          <p className="hero-trust">{t("home.hero_trust")}</p>
        </div>
      </section>

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

      <section className="section section-proof section-home-proof">
        <div className="section-head">
          <p className="eyebrow">{t("home.proof_eyebrow")}</p>
          <h2 className="section-title reveal">{t("home.proof_title")}</h2>
          <p className="section-intro">{t("home.proof_intro")}</p>
        </div>
        <div className="proof-stories">
          {([1, 2, 3] as const).map((number) => (
            <article className="proof-story reveal" key={number}>
              <p className="proof-kicker">{t(`home.proof_${number}_kicker`)}</p>
              <div className="proof-story-body">
                <h3 className="proof-title"><Link href={sitePath(locale, `/work#${["", "infrastructure", "air-export", "western-nepal"][number]}`)}>{t(`home.proof_${number}_title`)}<ArrowRight size={22} weight="bold" aria-hidden="true"/></Link></h3>
                <div><p className="proof-copy">{t(`home.proof_${number}_copy`)}</p><p className="proof-meta">{t(`home.proof_${number}_meta`)}</p></div>
              </div>
            </article>
          ))}
        </div>
        <Link href={sitePath(locale, "/work")} className="section-link">{t("home.proof_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
      </section>

      <ClientRail locale={locale}/>

      <section className="section section-corridor">
        <h2 className="section-title corridor-heading">{t("home.corridor_title")}</h2>
        <p className="section-intro">{t("home.corridor_intro")}</p>
        <div className="corridor-band">
          <article className="corridor-leg">
            <figure className="corridor-figure"><Image src="/images/unsplash/ship-aerial.jpg" alt="" width={900} height={600} sizes="(max-width: 900px) 100vw, 50vw" className="corridor-photo"/></figure>
            <h3 className="corridor-title">{t("home.corridor_in_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_in_copy")}</p>
            <Link href={sitePath(locale, "/guides/importing-to-nepal")} className="section-link">{guides[locale]["importing-to-nepal"].title}<ArrowRight size={15} aria-hidden="true"/></Link>
          </article>
          <article className="corridor-leg">
            <figure className="corridor-figure"><Image src="/images/unsplash/nepal-road.jpg" alt="" width={900} height={600} sizes="(max-width: 900px) 100vw, 50vw" className="corridor-photo"/></figure>
            <h3 className="corridor-title">{t("home.corridor_out_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_out_copy")}</p>
            <Link href={sitePath(locale, "/guides/exporting-from-nepal")} className="section-link">{guides[locale]["exporting-from-nepal"].title}<ArrowRight size={15} aria-hidden="true"/></Link>
          </article>
        </div>
        <Link href={sitePath(locale, "/network")} className="section-link">{t("home.corridor_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
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
