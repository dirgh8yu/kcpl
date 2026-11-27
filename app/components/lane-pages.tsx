import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { absoluteUrl } from "../seo";
import { laneFor, laneIndex, laneSlugs, type Lane, type LaneSlug } from "../lane-data";
import { postsForLane } from "../blog-lane-links";
import { guides } from "../guide-data";
import { services } from "../services-data";
import { siteLocaleTags, sitePath, siteText, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { tools } from "../tool-data";
import { faqNodeLane, graph, laneServiceNode } from "../structured-data";
import { laneIndexItemListNode } from "../lane-index-schema";
import { SiteShell } from "./site-chrome";
import { StructuredData } from "./structured-data";
import { Breadcrumbs } from "./breadcrumbs";
import { Lined, PageHead, QaList, Stop } from "./route-parts";

/**
 * The closing CTA carries the corridor into the quote form: origin, destination
 * and mode prefill the route, and `from` records which lane page produced the
 * enquiry. Values come from the lane's own locale copy, so a Nepali reader is
 * not handed English city names.
 */
function laneQuoteHref(locale: SiteLocale, lane: Lane) {
  const params = new URLSearchParams({
    origin: lane.origin,
    destination: lane.destination,
    mode: lane.mode,
    source: "lane",
    from: sitePath(locale, `/lanes/${lane.slug}`),
  });
  return `${sitePath(locale, "/quote")}?${params.toString()}`;
}

/** The index sends the reader on with the locale and the page, without a corridor. */
function laneIndexQuoteHref(locale: SiteLocale) {
  const params = new URLSearchParams({ source: "lane", from: sitePath(locale, "/lanes") });
  return `${sitePath(locale, "/quote")}?${params.toString()}`;
}

const serviceLabel = (locale: SiteLocale, href: string) => {
  const slug = href.replace("/services/", "");
  const service = services.find((entry) => entry.slug === slug);
  return service ? siteText(locale, `svc.${service.key}.title` as SiteTextKey) : slug.replace(/-/g, " ");
};

export function LanePage({ locale, slug }: { locale: SiteLocale; slug: LaneSlug }) {
  const lane = laneFor(locale, slug);
  /* The blog's notes on this corridor, in the blog's own reading order. The notes
   * are written in English and have no translation, so the list is marked as
   * English inside a page that may be in any of the four languages. */
  const notes = postsForLane(slug);
  const confirmed = new Intl.DateTimeFormat(siteLocaleTags[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${lane.confirmed}T00:00:00Z`));

  return (
    <SiteShell locale={locale} path={`/lanes/${slug}`}>
      <StructuredData data={graph([laneServiceNode(locale, slug), faqNodeLane(locale, slug)])}/>
      <PageHead title={lane.title} intro={lane.intro} breadcrumb={<Breadcrumbs locale={locale} path={`/lanes/${slug}`}/>}>
        <p className="guide-review">{lane.confirmedPrefix}{" "}
          <time dateTime={lane.confirmed}>{confirmed}</time>.
        </p>
      </PageHead>
      <Lined reveal>
        {lane.sections.map((section) => (
          <Stop key={section.title} title={section.title}>
            <p>{section.copy}</p>
            {section.list ? <ul className="check-list">{section.list.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          </Stop>
        ))}
        <Stop title={lane.questionsTitle}>
          <QaList items={lane.questions}/>
        </Stop>
        <section className="stop page-actions">
          <Link href={laneQuoteHref(locale, lane)} className="btn" data-analytics-event="quote_tap">{lane.cta}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, lane.service)} className="text-link">{serviceLabel(locale, lane.service)}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, `/tools/${lane.tool}`)} className="text-link">{tools[locale][lane.tool].title}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </section>
        <Stop title={lane.otherTitle}>
          <ul className="link-list">
            {lane.next.map((next) => (
              <li key={next}><Link href={sitePath(locale, `/lanes/${next}`)}>{laneFor(locale, next).title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            ))}
            <li><Link href={sitePath(locale, "/guides/cargo-from-india-to-nepal")}>{guides[locale]["cargo-from-india-to-nepal"].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
          </ul>
        </Stop>
        {notes.length ? (
          <Stop title={siteText(locale, "chrome.blog")}>
            <ul className="link-list" lang={siteLocaleTags.en}>
              {notes.map((post) => (
                <li key={post.slug}><Link href={sitePath(locale, `/blog/${post.slug}`)}>{post.title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
              ))}
            </ul>
          </Stop>
        ) : null}
      </Lined>
    </SiteShell>
  );
}

export function LanesIndexPage({ locale }: { locale: SiteLocale }) {
  const index = laneIndex[locale];
  const reading = ["cargo-from-china-to-nepal", "cargo-from-india-to-nepal", "free-time-and-demurrage"] as const;

  return (
    <SiteShell locale={locale} path="/lanes">
      <StructuredData data={graph([laneIndexItemListNode(locale)])}/>
      <PageHead title={index.title} intro={index.intro} breadcrumb={<Breadcrumbs locale={locale} path="/lanes"/>}/>
      <Lined reveal>
        <Stop title={index.corridorsTitle}>
          <ol className="svc-list">
            {laneSlugs.map((slug) => {
              const lane = laneFor(locale, slug);
              return (
                <li key={slug}>
                  <Link href={sitePath(locale, `/lanes/${slug}`)}>
                    <b>{lane.title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></b>
                    <span>{lane.description}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Stop>
        <Stop title={index.readingTitle}>
          <ul className="link-list">
            {reading.map((slug) => (
              <li key={slug}><Link href={sitePath(locale, `/guides/${slug}`)}>{guides[locale][slug].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            ))}
          </ul>
        </Stop>
        <section className="stop page-actions">
          <Link href={laneIndexQuoteHref(locale)} className="btn" data-analytics-event="quote_tap">{index.cta}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
        </section>
      </Lined>
    </SiteShell>
  );
}

/** The lane's FAQ as schema, printed on the page as the same questions. */
export function laneFaqUrl(locale: SiteLocale, slug: LaneSlug) {
  return `${absoluteUrl(sitePath(locale, `/lanes/${slug}`))}#faq`;
}
