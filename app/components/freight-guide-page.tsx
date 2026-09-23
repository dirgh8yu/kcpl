import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { guides, type GuideSlug } from "../guide-data";
import { sitePath, type SiteLocale } from "../site-i18n";
import { SiteShell } from "./site-chrome";

export function FreightGuidePage({ locale, slug }: { locale: SiteLocale; slug: GuideSlug }) {
  const guide = guides[locale][slug];
  const otherSlug = slug === "importing-to-nepal" ? "exporting-from-nepal" : "importing-to-nepal";
  const servicePath = slug === "importing-to-nepal" ? "/services/customs-clearance" : "/services";

  return (
    <SiteShell locale={locale} path={`/guides/${slug}`}>
      <section className="section page-head freight-guide-head">
        <p className="freight-guide-eyebrow">KCPL / {locale === "en" ? "Freight guides" : locale === "ne" ? "ढुवानी मार्गदर्शिका" : locale === "hi" ? "माल ढुलाई गाइड" : "货运指南"}</p>
        <h1 className="section-title">{guide.title}</h1>
        <p className="section-intro">{guide.intro}</p>
      </section>
      <section className="section freight-guide-body">
        <div className="freight-guide-section">
          <h2 className="service-block-title">{guide.routeTitle}</h2>
          <ol className="freight-guide-steps">
            {guide.stages.map((stage) => <li key={stage.title}><h3>{stage.title}</h3><p>{stage.copy}</p></li>)}
          </ol>
        </div>
        <div className="freight-guide-section freight-guide-documents">
          <div><h2 className="service-block-title">{guide.documentsTitle}</h2><p>{guide.documentsIntro}</p></div>
          <ul>{guide.documents.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className="freight-guide-section">
          <h2 className="service-block-title">{guide.questionsTitle}</h2>
          <dl className="freight-guide-questions">{guide.questions.map((item) => <div key={item.question}><dt>{item.question}</dt><dd>{item.answer}</dd></div>)}</dl>
        </div>
        <div className="freight-guide-actions">
          <Link href={sitePath(locale, "/quote")} className="button-primary">{guide.cta}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, servicePath)} className="section-link">{guide.related}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </div>
        <nav className="freight-guide-next" aria-label={locale === "en" ? "Related guide" : locale === "ne" ? "सम्बन्धित मार्गदर्शिका" : locale === "hi" ? "संबंधित गाइड" : "相关指南"}>
          <Link href={sitePath(locale, `/guides/${otherSlug}`)}>{guides[locale][otherSlug].title}<ArrowRight size={17} aria-hidden="true"/></Link>
        </nav>
      </section>
    </SiteShell>
  );
}
