import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { affiliations } from "../company-data";
import { guideIndex, guides, guideSlugs } from "../guide-data";
import { services } from "../services-data";
import { sitePath, siteText, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { tools, toolSlugs } from "../tool-data";
import { ClientRail } from "./client-rail";
import { HomeRoutePlanner } from "./home-route-planner";
import { SiteShell } from "./site-chrome";

export function HomePage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const resourceGuides = guideSlugs.slice(0, 4);
  const credibility = [
    { label: t("home.credibility_award"), detail: t("home.credibility_award_detail") },
    { label: t("home.credibility_member"), detail: t("home.credibility_member_detail") },
    { label: t("home.credibility_storage"), detail: t("home.credibility_storage_detail") },
    { label: t("home.credibility_projects"), detail: t("home.credibility_projects_detail") },
  ];

  return (
    <SiteShell locale={locale} path="/">
      <section className="home-index-hero">
        <div className="home-index-head">
          <div>
            <div className="home-index-kicker">{t("home.hero_trust")}</div>
            <h1>{t("home.hero_title")}</h1>
          </div>
          <div>
            <p className="home-index-copy">{t("home.hero_intro")}</p>
            <Link href={sitePath(locale, "/services")} className="home-index-explore">{t("home.capability_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          </div>
        </div>
        <HomeRoutePlanner locale={locale} variant="bar"/>
      </section>

      <section className="home-index-columns">
        <div className="home-index-col">
          <h2>{t("chrome.services")}<span>01–07</span></h2>
          {services.map((service, index) => <Link key={service.slug} href={sitePath(locale, `/services/${service.slug}`)} className="home-index-link">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><h3>{siteText(locale, `svc.${service.key}.title` as SiteTextKey)}</h3><p>{siteText(locale, `svc.${service.key}.summary` as SiteTextKey)}</p></div>
            <ArrowRight size={15} weight="bold" aria-hidden="true"/>
          </Link>)}
        </div>
        <div className="home-index-col">
          <h2>{t("home.index_resources")}<span>G · T</span></h2>
          {resourceGuides.map((slug, index) => <Link key={slug} href={sitePath(locale, `/guides/${slug}`)} className="home-index-link">
            <span>G{index + 1}</span>
            <div><h3>{guides[locale][slug].title}</h3><p>{guides[locale][slug].description}</p></div>
            <ArrowRight size={15} weight="bold" aria-hidden="true"/>
          </Link>)}
          {toolSlugs.map((slug, index) => <Link key={slug} href={sitePath(locale, `/tools/${slug}`)} className="home-index-link">
            <span>T{index + 1}</span>
            <div><h3>{tools[locale][slug].title}</h3><p>{tools[locale][slug].description}</p></div>
            <ArrowRight size={15} weight="bold" aria-hidden="true"/>
          </Link>)}
          <Link href={sitePath(locale, "/guides")} className="home-index-link home-index-all"><span>→</span><div><h3>{guideIndex[locale].title}</h3><p>{guideIndex[locale].description}</p></div><ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </div>
      </section>

      <ClientRail locale={locale}/>

      <section className="section section-proof section-home-proof">
        <div className="section-head">
          <h2 className="section-title reveal">{t("home.proof_title")}</h2>
          <p className="section-intro">{t("home.proof_intro")}</p>
        </div>
        <div className="proof-stories">
          {([1, 2, 3] as const).map((number) => (
            <article className="proof-story reveal" key={number}>
              <div className="proof-story-body">
                <h3 className="proof-title"><Link href={sitePath(locale, `/work#${["", "infrastructure", "air-export", "western-nepal"][number]}`)}>{t(`home.proof_${number}_title`)}<ArrowRight size={22} weight="bold" aria-hidden="true"/></Link></h3>
                <div><p className="proof-copy">{t(`home.proof_${number}_copy`)}</p><p className="proof-meta"><span className="proof-kicker">{t(`home.proof_${number}_kicker`)}</span>{t(`home.proof_${number}_meta`)}</p></div>
              </div>
            </article>
          ))}
        </div>
        <Link href={sitePath(locale, "/work")} className="section-link">{t("home.proof_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
      </section>

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

      <section className="home-index-quote">
        <div className="home-index-quote-copy">
          <div>
            <div className="home-index-kicker">{t("home.hero_cta")}</div>
            <h2>{t("home.cta_title")}</h2>
          </div>
          <Link href={sitePath(locale, "/contact")} className="home-index-contact">{t("home.cta_secondary")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </div>
        <HomeRoutePlanner locale={locale} variant="panel"/>
      </section>
    </SiteShell>
  );
}
