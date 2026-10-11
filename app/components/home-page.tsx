import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { affiliations } from "../company-data";
import { guideIndex } from "../guide-data";
import { photos, servicePhotos } from "../site-photos";
import { sitePath, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { tools } from "../tool-data";
import type { ServiceKey } from "../services-data";
import { ClientRail } from "./client-rail";
import { ClosingBand } from "./closing-band";
import { SiteShell } from "./site-chrome";

const tileServices: Array<{ key: ServiceKey; slug: string }> = [
  { key: "ocean", slug: "ocean-freight" },
  { key: "air", slug: "air-freight" },
  { key: "road", slug: "road-freight" },
  { key: "customs", slug: "customs-clearance" },
];

/** "Learn more ›": the one secondary action on every tile. */
function More({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-link">{children}<CaretRight size={13} weight="bold" aria-hidden="true"/></Link>;
}

export function HomePage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const svc = (key: ServiceKey, part: string) => t(`svc.${key}.${part}` as SiteTextKey);
  const figures = [
    { value: t("home.band_since_value"), label: t("home.band_since_label") },
    { value: t("stats.clients_value"), label: t("stats.clients_label") },
    { value: t("stats.projects_value"), label: t("stats.projects_label") },
    { value: t("home.storage_road_value"), label: t("home.storage_road_label") },
  ];
  const stories = ([1, 2, 3] as const).map((number) => ({
    number,
    tone: (["crimson", "dark", "light"] as const)[number - 1],
    anchor: ["", "infrastructure", "air-export", "western-nepal"][number],
    kicker: t(`home.proof_${number}_kicker`),
    title: t(`home.proof_${number}_title`),
    copy: t(`home.proof_${number}_copy`),
  }));
  const credentials = [
    { label: t("home.credibility_award"), detail: t("home.credibility_award_detail") },
    { label: t("home.credibility_member"), detail: t("home.credibility_member_detail") },
    { label: t("home.credibility_storage"), detail: t("home.credibility_storage_detail") },
    { label: t("home.credibility_projects"), detail: t("home.credibility_projects_detail") },
  ];

  return (
    <SiteShell locale={locale} path="/">
      <section className="intro">
        <h1 className="hero-title">{t("home.hero_title")}</h1>
        <p className="intro-copy">{t("home.hero_intro")}</p>
        <div className="intro-actions">
          <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.hero_cta")}</Link>
          <More href={sitePath(locale, "/services")}>{t("home.hero_secondary")}</More>
        </div>
        <figure className="intro-figure">
          <Image src={photos.roadDawn} alt="" priority placeholder="blur" sizes="(max-width: 1440px) 100vw, 1440px"/>
        </figure>
      </section>

      <section className="tiles">
        <dl className="tile tile-light figures">
          {figures.map((figure) => (
            <div key={figure.label} className="figure">
              <dt>{figure.label}</dt>
              <dd>{figure.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="tiles">
        <header className="tiles-head">
          <h2 className="section-title">{t("home.capability_title")}</h2>
          <p className="section-intro">{t("home.capability_intro")}</p>
        </header>
        <div className="tile-grid">
          {tileServices.map((service) => (
            <article key={service.key} className="tile tile-light">
              <h3 className="tile-title">{svc(service.key, "title")}</h3>
              <p className="tile-copy">{svc(service.key, "summary")}</p>
              <div className="tile-links">
                <More href={sitePath(locale, `/services/${service.slug}`)}>{t("chrome.learn_more")}</More>
                <More href={sitePath(locale, "/quote")}>{t("chrome.quote")}</More>
              </div>
              <figure className="tile-figure">
                <Image src={servicePhotos[service.key]} alt="" placeholder="blur" sizes="(max-width: 760px) 100vw, 50vw"/>
              </figure>
            </article>
          ))}
          <article className="tile tile-dark tile-wide">
            <div className="tile-text">
              <h3 className="tile-title">{svc("project", "title")}</h3>
              <p className="tile-copy">{svc("project", "summary")}</p>
              <div className="tile-links">
                <More href={sitePath(locale, "/services/project-cargo")}>{t("chrome.learn_more")}</More>
                <More href={sitePath(locale, "/sectors")}>{t("chrome.sectors")}</More>
              </div>
            </div>
            <figure className="tile-figure">
              <Image src={servicePhotos.project} alt="" placeholder="blur" sizes="(max-width: 760px) 100vw, 60vw"/>
            </figure>
          </article>
        </div>
        <p className="tiles-more"><More href={sitePath(locale, "/services")}>{t("home.capability_link")}</More></p>
      </section>

      <section className="tiles">
        <header className="tiles-head">
          <h2 className="section-title">{t("home.proof_title")}</h2>
          <p className="section-intro">{t("home.proof_intro")}</p>
        </header>
        <div className="story-grid">
          {stories.map((story) => (
            <article key={story.number} className={`tile story tile-${story.tone}`}>
              <p className="tile-eyebrow">{story.kicker}</p>
              <h3 className="tile-title"><Link href={sitePath(locale, `/work#${story.anchor}`)} className="tile-cover">{story.title}</Link></h3>
              <p className="tile-copy">{story.copy}</p>
            </article>
          ))}
        </div>
        <p className="tiles-more"><More href={sitePath(locale, "/work")}>{t("home.proof_link")}</More></p>
      </section>

      <section className="tiles">
        <div className="tile-grid">
          <article className="tile tile-crimson tile-feature">
            <h2 className="tile-title">{tools[locale].index.title}</h2>
            <p className="tile-copy">{tools[locale].index.description}</p>
            <div className="tile-links"><More href={sitePath(locale, "/tools")}>{t("chrome.learn_more")}</More></div>
          </article>
          <article className="tile tile-light tile-feature">
            <h2 className="tile-title">{guideIndex[locale].title}</h2>
            <p className="tile-copy">{guideIndex[locale].description}</p>
            <div className="tile-links"><More href={sitePath(locale, "/guides")}>{t("chrome.learn_more")}</More></div>
          </article>
        </div>
      </section>

      <ClientRail locale={locale}/>

      <section className="tiles credentials">
        <header className="tiles-head">
          <h2 className="section-title">{t("home.credibility_title")}</h2>
          <p className="section-intro">{t("home.credibility_copy")}</p>
        </header>
        <ul className="credential-marks">
          {affiliations.filter((mark) => mark.name !== "JCtrans").map((mark) => (
            <li key={mark.name}>
              <Image src={mark.image} alt={mark.detail} width={mark.width} height={mark.height} className="credential-mark"/>
            </li>
          ))}
        </ul>
        <dl className="credential-facts">
          {credentials.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ClosingBand locale={locale}/>
    </SiteShell>
  );
}
