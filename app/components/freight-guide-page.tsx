import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { guideIndex, guideLinks, guides, guideSlugs, type GuideSlug } from "../guide-data";
import { laneFor, laneIndex, type LaneSlug } from "../lane-data";
import { guideDepth } from "../content-depth";
import { guidePhotos } from "../guide-photos";
import { faqNode, graph, guideArticleNodes } from "../structured-data";
import { guideReview, reviewedGuideSlugs } from "../guide-review";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { tools, toolSlugs } from "../tool-data";
import { ClosingBand } from "./closing-band";
import { ContentDepth } from "./content-depth";
import { Lined, PageHead, Plate, QaList, Stop } from "./route-parts";
import { SiteShell } from "./site-chrome";
import { StructuredData } from "./structured-data";
import { Breadcrumbs } from "./breadcrumbs";


/* Which lane each guide should point at. English keeps the editorial phrasing;
 * a translated guide uses the lane's own title in its own language, because the
 * lanes exist in all four languages. */
const guideLanes: Partial<Record<GuideSlug, { slug: LaneSlug; label?: string }[]>> = {
  "cargo-from-india-to-nepal": [{ slug: "kolkata-to-birgunj", label: "Kolkata to Birgunj, stage by stage" }],
  "sea-freight-through-india": [{ slug: "kolkata-to-birgunj" }, { slug: "haldia-to-kathmandu" }],
  "cargo-from-china-to-nepal": [{ slug: "nepal-to-tibet", label: "The same crossings, northbound: Nepal to Tibet" }],
  "exporting-from-nepal": [{ slug: "nepal-to-tibet" }],
};

export function FreightGuidePage({ locale, slug }: { locale: SiteLocale; slug: GuideSlug }) {
  const guide = guides[locale][slug];
  const links = guideLinks[slug];
  const index = guideIndex[locale];

  return (
    <SiteShell locale={locale} path={`/guides/${slug}`}>
      <StructuredData data={graph([faqNode(locale, slug), ...(locale === "en" ? guideArticleNodes(slug, guidePhotos[slug].src) : [])])}/>
      <PageHead title={guide.title} intro={guide.intro} breadcrumb={<Breadcrumbs locale={locale} path={`/guides/${slug}`}/>}>
        {locale === "en" ? <p className="guide-review">
          {guideReview.labels.author} {guideReview.organization}
          {reviewedGuideSlugs.includes(slug) ? <><br/>{guideReview.labels.reviewer} <Link href="/about#leadership">{guideReview.reviewer}, {guideReview.role}</Link>. {guideReview.labels.reviewedAt}{" "}
          <time dateTime={guideReview.reviewedAt}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${guideReview.reviewedAt}T00:00:00Z`))}</time>.</> : null}
        </p> : null}
      </PageHead>
      <Lined reveal>
        <Stop title={guide.routeTitle}>
          <ol className="stages">
            {guide.stages.map((stage) => <li key={stage.title}><h3>{stage.title.replace(/^\d+\s*\/\s*/, "")}</h3><p>{stage.copy}</p></li>)}
          </ol>
        </Stop>
        <section className="stop sector">
          <div>
            <h2 className="stop-title">{guide.documentsTitle}</h2>
            <p className="stop-intro">{guide.documentsIntro}</p>
            <ul className="check-list">{guide.documents.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <Plate {...guidePhotos[slug]}/>
        </section>
        {locale === "en" ? <ContentDepth content={guideDepth[slug]}/> : null}
        <Stop title={guide.questionsTitle}>
          <QaList items={guide.questions}/>
        </Stop>
        <section className="stop page-actions">
          <Link href={sitePath(locale, "/quote")} className="btn" data-analytics-event="quote_tap">{guide.cta}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, links.service)} className="text-link">{guide.related}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, `/tools/${links.tool}`)} className="text-link">{tools[locale][links.tool].title}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </section>
        {guideLanes[slug] ? <Stop title={laneIndex[locale].lanesTitle}>
          <ul className="link-list">
            {guideLanes[slug]!.map((lane) => (
              <li key={lane.slug}><Link href={sitePath(locale, `/lanes/${lane.slug}`)}>{(locale === "en" ? lane.label : undefined) ?? laneFor(locale, lane.slug).title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            ))}
          </ul>
        </Stop> : null}
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
  const t = siteTranslator(locale);
  const index = guideIndex[locale];
  const toolCopy = tools[locale];
  return (
    <SiteShell locale={locale} path="/guides">
      <PageHead title={index.title} intro={index.intro} breadcrumb={<Breadcrumbs locale={locale} path="/guides"/>}/>
      <Lined reveal>
        <Stop title={toolCopy.index.title} intro={toolCopy.index.intro}>
          <IndexList items={toolSlugs.map((slug) => ({ href: sitePath(locale, `/tools/${slug}`), title: toolCopy[slug].title, copy: toolCopy[slug].description }))}/>
        </Stop>
        <Stop title={index.title}>
          <IndexList items={guideSlugs.map((slug) => ({ href: sitePath(locale, `/guides/${slug}`), title: guides[locale][slug].title, copy: guides[locale][slug].description }))}/>
        </Stop>
        <section className="stop page-actions">
          <Link href={sitePath(locale, "/services")} className="text-link">{t("home.capability_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, "/network")} className="text-link">{t("home.corridor_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, "/sectors")} className="text-link">{t("services.sectors_title")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </section>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}
