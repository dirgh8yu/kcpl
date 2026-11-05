import { siteTranslator, type SiteLocale } from "../site-i18n";
import { ClosingBand } from "./closing-band";
import { Lined, MiniRoute, PageHead } from "./route-parts";
import { SiteShell } from "./site-chrome";

const stories = [
  { number: 1, slug: "infrastructure" },
  { number: 2, slug: "air-export", bend: [1, 3] },
  { number: 3, slug: "western-nepal" },
] as const;

export function SelectedWorkPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <SiteShell locale={locale} path="/work">
      <PageHead title={t("work.title")} intro={t("work.intro")}/>
      <Lined>
        {stories.map((story) => (
          <article key={story.slug} id={story.slug} className="stop work-record">
            <h2 className="stop-title">{t(`home.proof_${story.number}_title`)}</h2>
            <p className="work-date">{t(`work.story_${story.number}_route`)} · {t(`work.story_${story.number}_date`)}</p>
            <MiniRoute stops={t(`home.proof_${story.number}_stops`)} bend={"bend" in story ? story.bend : undefined}/>
            <div className="work-detail">
              <div><h3>{t("work.brief")}</h3><p>{t(`work.story_${story.number}_brief`)}</p></div>
              <div><h3>{t("work.coordination")}</h3><p>{t(`work.story_${story.number}_coordination`)}</p></div>
              <div><h3>{t("work.outcome")}</h3><p>{t(`work.story_${story.number}_outcome`)}</p></div>
            </div>
          </article>
        ))}
        <section className="stop"><p className="stop-intro">{t("work.disclosure")}</p></section>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}
