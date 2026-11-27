import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { absoluteUrl } from "../seo";
import { lanes, laneIndex, laneSlugs, type LaneSlug } from "../lane-data";
import { services } from "../services-data";
import { siteText, type SiteTextKey } from "../site-i18n";
import { tools } from "../tool-data";
import { faqNodeLane } from "../structured-data";
import { SiteShell } from "./site-chrome";
import { StructuredData } from "./structured-data";
import { Breadcrumbs } from "./breadcrumbs";
import { Lined, PageHead, QaList, Stop } from "./route-parts";

const serviceLabel = (href: string) => {
  const slug = href.replace("/services/", "");
  const service = services.find((entry) => entry.slug === slug);
  return service ? siteText("en", `svc.${service.key}.title` as SiteTextKey) : slug.replace(/-/g, " ");
};

export function LanePage({ slug }: { slug: LaneSlug }) {
  const lane = lanes[slug];

  return (
    <SiteShell locale="en" path={`/lanes/${slug}`}>
      <StructuredData data={faqNodeLane(slug)}/>
      <PageHead title={lane.title} intro={lane.intro} breadcrumb={<Breadcrumbs locale="en" path={`/lanes/${slug}`}/>}>
        <p className="guide-review">Corridor details confirmed with KCPL operations on{" "}
          <time dateTime={lane.confirmed}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${lane.confirmed}T00:00:00Z`))}</time>.
        </p>
      </PageHead>
      <Lined reveal>
        {lane.sections.map((section) => (
          <Stop key={section.title} title={section.title}>
            <p>{section.copy}</p>
            {section.list ? <ul className="check-list">{section.list.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          </Stop>
        ))}
        <Stop title="Common questions">
          <QaList items={lane.questions}/>
        </Stop>
        <section className="stop page-actions">
          <Link href="/quote" className="btn" data-analytics-event="quote_tap">Send the cargo, route and date<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          <Link href={lane.service} className="text-link">{serviceLabel(lane.service)}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          <Link href={`/tools/${lane.tool}`} className="text-link">{tools.en[lane.tool].title}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </section>
        <Stop title="Other lanes">
          <ul className="link-list">
            {lane.next.map((next) => (
              <li key={next}><Link href={`/lanes/${next}`}>{lanes[next].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            ))}
            <li><Link href="/guides/cargo-from-india-to-nepal">Cargo from India to Nepal: the border points<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
          </ul>
        </Stop>
      </Lined>
    </SiteShell>
  );
}

export function LanesIndexPage() {
  return (
    <SiteShell locale="en" path="/lanes">
      <PageHead title={laneIndex.title} intro={laneIndex.intro} breadcrumb={<Breadcrumbs locale="en" path="/lanes"/>}/>
      <Lined reveal>
        <Stop title="Corridors">
          <ol className="svc-list">
            {laneSlugs.map((slug) => (
              <li key={slug}>
                <Link href={`/lanes/${slug}`}>
                  <b>{lanes[slug].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></b>
                  <span>{lanes[slug].description}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Stop>
        <Stop title="Related reading">
          <ul className="link-list">
            <li><Link href="/guides/cargo-from-china-to-nepal">Cargo from China to Nepal<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            <li><Link href="/guides/cargo-from-india-to-nepal">Cargo from India to Nepal<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            <li><Link href="/guides/free-time-and-demurrage">Free time and demurrage<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
          </ul>
        </Stop>
      </Lined>
    </SiteShell>
  );
}

/** The lane's FAQ as schema, printed on the page as the same questions. */
export function laneFaqUrl(slug: LaneSlug) {
  return `${absoluteUrl(`/lanes/${slug}`)}#faq`;
}
