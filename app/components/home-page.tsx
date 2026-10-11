import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { affiliations } from "../company-data";
import { guides } from "../guide-data";
import { photos } from "../site-photos";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { ClientRail } from "./client-rail";
import { RouteMap } from "./route-map";
import { SiteShell } from "./site-chrome";

export function HomePage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const capabilities = [
    { title: t("home.cap_1_title"), copy: t("home.cap_1_copy"), href: "/services" },
    { title: t("home.cap_2_title"), copy: t("home.cap_2_copy"), href: "/services/customs-clearance" },
    { title: t("home.cap_3_title"), copy: t("home.cap_3_copy"), href: "/services/project-cargo" },
    { title: t("home.cap_4_title"), copy: t("home.cap_4_copy"), href: "/services/delivery" },
  ];
  // The four numbers KCPL can stand behind, each already stated elsewhere on the site.
  const figures = [
    { value: t("home.band_since_value"), label: t("home.band_since_label") },
    { value: t("stats.clients_value"), label: t("stats.clients_label") },
    { value: t("stats.projects_value"), label: t("stats.projects_label") },
    { value: t("home.storage_road_value"), label: t("home.storage_road_label") },
  ];
  const credibility = [
    { label: t("home.credibility_award"), detail: t("home.credibility_award_detail") },
    { label: t("home.credibility_member"), detail: t("home.credibility_member_detail") },
    { label: t("home.credibility_storage"), detail: t("home.credibility_storage_detail") },
    { label: t("home.credibility_projects"), detail: t("home.credibility_projects_detail") },
  ];
  const stories = ([1, 2, 3] as const).map((number) => ({
    number,
    anchor: ["", "infrastructure", "air-export", "western-nepal"][number],
    kicker: t(`home.proof_${number}_kicker`),
    title: t(`home.proof_${number}_title`),
    copy: t(`home.proof_${number}_copy`),
    // The record line reads as stops on the way: origin, handover, proof.
    stops: t(`home.proof_${number}_meta`).split(" · "),
  }));

  return (
    <SiteShell locale={locale} path="/">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="kicker kicker-on-dark">{t("home.hero_overline")}</p>
          <h1 className="hero-title">{t("home.hero_title")}</h1>
          <p className="home-hero-intro">{t("home.hero_intro")}</p>
          <div className="hero-actions">
            <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.hero_cta")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
            <Link href={sitePath(locale, "/services")} className="button-ghost">{t("home.hero_secondary")}</Link>
          </div>
          <p className="home-hero-trust">{t("home.hero_trust")}</p>
        </div>
        <RouteMap locale={locale}/>
      </section>

      <div className="home-figures-band">
        <dl className="home-figures">
          {figures.map((figure) => (
            <div key={figure.label} className="home-figure">
              <dt>{figure.label}</dt>
              <dd>{figure.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ClientRail locale={locale}/>

      <section className="section section-capability">
        <div className="capability-layout">
          <div className="capability-aside">
            <h2 className="section-title">{t("home.capability_title")}</h2>
            <p className="section-intro">{t("home.capability_intro")}</p>
            <Link href={sitePath(locale, "/services")} className="section-link">{t("home.capability_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
            <figure className="capability-figure"><Image src={photos.roadDawn} alt="" placeholder="blur" sizes="(max-width: 1024px) 100vw, 46vw" className="capability-photo"/></figure>
          </div>
          <dl className="capability-list reveal-group">
            {capabilities.map((item) => (
              <div key={item.title} className="capability-item">
                <dt className="capability-title"><Link href={sitePath(locale, item.href)}>{item.title}<ArrowRight size={18} aria-hidden="true"/></Link></dt>
                <dd className="capability-copy">{item.copy}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section section-proof">
        <div className="section-split-head">
          <div className="section-head">
            <p className="kicker kicker-on-dark">{t("home.proof_eyebrow")}</p>
            <h2 className="section-title">{t("home.proof_title")}</h2>
            <p className="section-intro">{t("home.proof_intro")}</p>
          </div>
          <Link href={sitePath(locale, "/work")} className="section-link">{t("home.proof_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </div>
        <div className="proof-cards">
          {stories.map((story) => (
            <article className="proof-card" key={story.number}>
              <p className="kicker kicker-on-dark">{story.kicker}</p>
              <h3 className="proof-card-title"><Link href={sitePath(locale, `/work#${story.anchor}`)}>{story.title}</Link></h3>
              <p className="proof-card-copy">{story.copy}</p>
              <ol className="proof-route">
                {story.stops.map((stop) => <li key={stop}>{stop}</li>)}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-corridor">
        <div className="section-split-head">
          <div className="section-head">
            <h2 className="section-title">{t("home.corridor_title")}</h2>
            <p className="section-intro">{t("home.corridor_intro")}</p>
          </div>
          <Link href={sitePath(locale, "/network")} className="section-link">{t("home.corridor_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </div>
        <div className="corridor-band">
          <article className="corridor-leg">
            <figure className="corridor-figure"><Image src={photos.shipAerial} alt="" placeholder="blur" sizes="(max-width: 860px) 100vw, 50vw" className="corridor-photo"/></figure>
            <h3 className="corridor-title">{t("home.corridor_in_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_in_copy")}</p>
            <Link href={sitePath(locale, "/guides/importing-to-nepal")} className="section-link">{guides[locale]["importing-to-nepal"].title}<ArrowRight size={15} aria-hidden="true"/></Link>
          </article>
          <article className="corridor-leg">
            <figure className="corridor-figure"><Image src={photos.himalaya} alt="" placeholder="blur" sizes="(max-width: 860px) 100vw, 50vw" className="corridor-photo corridor-photo-himalaya"/></figure>
            <h3 className="corridor-title">{t("home.corridor_out_title")}</h3>
            <p className="corridor-copy">{t("home.corridor_out_copy")}</p>
            <Link href={sitePath(locale, "/guides/exporting-from-nepal")} className="section-link">{guides[locale]["exporting-from-nepal"].title}<ArrowRight size={15} aria-hidden="true"/></Link>
          </article>
        </div>
      </section>

      <section className="section section-credibility">
        <div className="credibility-layout">
          <div className="credibility-copy">
            <h2 className="section-title">{t("home.credibility_title")}</h2>
            <p className="section-intro">{t("home.credibility_copy")}</p>
          </div>
          <ul className="credibility-marks">
            {affiliations.filter((mark) => mark.name !== "JCtrans").map((mark) => (
              <li key={mark.name} className="credibility-mark">
                <Image src={mark.image} alt={mark.detail} width={mark.width} height={mark.height} className="credibility-mark-image"/>
              </li>
            ))}
          </ul>
        </div>
        <dl className="credibility-facts reveal-group">
          {credibility.map((fact) => (
            <div key={fact.label} className="credibility-fact">
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
