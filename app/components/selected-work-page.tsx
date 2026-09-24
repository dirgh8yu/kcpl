import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { SiteShell } from "./site-chrome";

const stories = [
  { number: 1, slug: "infrastructure" },
  { number: 2, slug: "air-export" },
  { number: 3, slug: "western-nepal" },
] as const;

export function SelectedWorkPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);

  return <SiteShell locale={locale} path="/work">
    <section className="section work-head">
      <p className="eyebrow">{t("work.eyebrow")}</p>
      <h1 className="section-title">{t("work.title")}</h1>
      <p className="section-intro">{t("work.intro")}</p>
      <nav className="work-jump" aria-label={t("work.jump_label")}>
        {stories.map(({ number, slug }) => <a key={slug} href={`#${slug}`}>{t(`home.proof_${number}_kicker`)}<ArrowRight size={15} aria-hidden="true"/></a>)}
      </nav>
    </section>

    <section className="work-records" aria-label={t("work.eyebrow")}>
      {stories.map(({ number, slug }) => <article key={slug} id={slug} className="work-record">
        <div className="work-record-heading">
          <div>
            <p className="proof-kicker">{t(`home.proof_${number}_kicker`)}</p>
            <h2>{t(`home.proof_${number}_title`)}</h2>
          </div>
          <p className="work-record-route">{t(`work.story_${number}_route`)}<span>{t(`work.story_${number}_date`)}</span></p>
        </div>
        <div className="work-record-detail">
          <div><h3>{t("work.brief")}</h3><p>{t(`work.story_${number}_brief`)}</p></div>
          <div><h3>{t("work.coordination")}</h3><p>{t(`work.story_${number}_coordination`)}</p></div>
          <div><h3>{t("work.outcome")}</h3><p>{t(`work.story_${number}_outcome`)}</p></div>
        </div>
      </article>)}
      <p className="work-disclosure">{t("work.disclosure")}</p>
    </section>

    <section className="section work-contact">
      <div><h2>{t("work.cta_title")}</h2><p>{t("work.cta_copy")}</p></div>
      <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.hero_cta")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
    </section>
  </SiteShell>;
}
