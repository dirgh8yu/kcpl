import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { guideIndex, guideLinks, guides, guideSlugs, type GuideSlug } from "../guide-data";
import { faqNode, graph } from "../structured-data";
import { sitePath, type SiteLocale } from "../site-i18n";
import { tools, toolSlugs } from "../tool-data";
import { ClosingBand } from "./closing-band";
import { Lined, PageHead, QaList, Stop } from "./route-parts";
import { SiteShell } from "./site-chrome";
import { StructuredData } from "./structured-data";

export function FreightGuidePage({ locale, slug }: { locale: SiteLocale; slug: GuideSlug }) {
  const guide = guides[locale][slug];
  const links = guideLinks[slug];
  const index = guideIndex[locale];

  return (
    <SiteShell locale={locale} path={`/guides/${slug}`}>
      <StructuredData data={graph([faqNode(locale, slug)])}/>
      <PageHead title={guide.title} intro={guide.intro}>
        <Link href={sitePath(locale, "/guides")} className="back-link"><ArrowLeft size={15} weight="bold" aria-hidden="true"/>{index.title}</Link>
      </PageHead>
      <Lined reveal>
        <Stop title={guide.routeTitle}>
          <ol className="stages">
            {guide.stages.map((stage) => <li key={stage.title}><h3>{stage.title.replace(/^\d+\s*\/\s*/, "")}</h3><p>{stage.copy}</p></li>)}
          </ol>
        </Stop>
        <Stop title={guide.documentsTitle} intro={guide.documentsIntro}>
          <ul className="check-list">{guide.documents.map((item) => <li key={item}>{item}</li>)}</ul>
        </Stop>
        <Stop title={guide.questionsTitle}>
          <QaList items={guide.questions}/>
        </Stop>
        <section className="stop page-actions">
          <Link href={sitePath(locale, "/quote")} className="btn" data-analytics-event="quote_tap">{guide.cta}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, links.service)} className="text-link">{guide.related}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, `/tools/${links.tool}`)} className="text-link">{tools[locale][links.tool].title}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </section>
        <Stop title={index.related}>
          <ul className="link-list">
            {links.next.map((next) => (
              <li key={next}><Link href={sitePath(locale, `/guides/${next}`)}>{guides[locale][next].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            ))}
          </ul>
        </Stop>
      </Lined>
    </SiteShell>
  );
}

function IndexList({ items }: { items: { href: string; title: string; copy: string }[] }) {
  return (
    <ol className="svc-list">
      {items.map((item) => (
        <li key={item.href}><Link href={item.href}><b>{item.title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></b><span>{item.copy}</span></Link></li>
      ))}
    </ol>
  );
}

/** Resources: the guides and the tools together, so a reader sees both from one page. */
export function GuidesIndexPage({ locale }: { locale: SiteLocale }) {
  const index = guideIndex[locale];
  const toolCopy = tools[locale];
  return (
    <SiteShell locale={locale} path="/guides">
      <PageHead title={index.title} intro={index.intro}/>
      <Lined reveal>
        <Stop title={toolCopy.index.title} intro={toolCopy.index.intro}>
          <IndexList items={toolSlugs.map((slug) => ({ href: sitePath(locale, `/tools/${slug}`), title: toolCopy[slug].title, copy: toolCopy[slug].description }))}/>
        </Stop>
        <Stop title={index.title}>
          <IndexList items={guideSlugs.map((slug) => ({ href: sitePath(locale, `/guides/${slug}`), title: guides[locale][slug].title, copy: guides[locale][slug].description }))}/>
        </Stop>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}
