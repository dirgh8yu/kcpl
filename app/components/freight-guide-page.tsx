import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { guideIndex, guideLinks, guides, guideSlugs, type GuideSlug } from "../guide-data";
import { faqNode, graph } from "../structured-data";
import { sitePath, type SiteLocale } from "../site-i18n";
import { tools } from "../tool-data";
import { SiteShell } from "./site-chrome";
import { StructuredData } from "./structured-data";

export function FreightGuidePage({ locale, slug }: { locale: SiteLocale; slug: GuideSlug }) {
  const guide = guides[locale][slug];
  const links = guideLinks[slug];
  const index = guideIndex[locale];

  return (
    <SiteShell locale={locale} path={`/guides/${slug}`}>
      <StructuredData data={graph([faqNode(locale, slug)])}/>
      <section className="section page-head freight-guide-head">
        <p className="freight-guide-eyebrow"><Link href={sitePath(locale, "/guides")}>KCPL / {index.title}</Link></p>
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
          <Link href={sitePath(locale, links.service)} className="section-link">{guide.related}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, `/tools/${links.tool}`)} className="section-link">{tools[locale][links.tool].title}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </div>
        <nav className="freight-guide-next" aria-label={index.related}>
          <ul>
            {links.next.map((next) => (
              <li key={next}><Link href={sitePath(locale, `/guides/${next}`)}>{guides[locale][next].title}<ArrowRight size={17} aria-hidden="true"/></Link></li>
            ))}
          </ul>
        </nav>
      </section>
    </SiteShell>
  );
}

export function GuidesIndexPage({ locale }: { locale: SiteLocale }) {
  const index = guideIndex[locale];
  return (
    <SiteShell locale={locale} path="/guides">
      <section className="section page-head freight-guide-head">
        <p className="freight-guide-eyebrow">KCPL / {index.title}</p>
        <h1 className="section-title">{index.title}</h1>
        <p className="section-intro">{index.intro}</p>
      </section>
      <section className="section reference-index">
        <ol className="reference-index-list">
          {guideSlugs.map((slug, position) => (
            <li key={slug}>
              <Link href={sitePath(locale, `/guides/${slug}`)} className="reference-index-link">
                <span className="reference-index-number" aria-hidden="true">{String(position + 1).padStart(2, "0")}</span>
                <span className="reference-index-body">
                  <span className="reference-index-title">{guides[locale][slug].title}</span>
                  <span className="reference-index-copy">{guides[locale][slug].description}</span>
                </span>
                <span className="reference-index-open">{index.open}<ArrowRight size={15} weight="bold" aria-hidden="true"/></span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </SiteShell>
  );
}
