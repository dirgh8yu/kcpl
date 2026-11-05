import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { sitePath, type SiteLocale } from "../site-i18n";
import { tools, toolSlugs, type ToolSlug } from "../tool-data";
import { DutyEstimator, StorageEstimator, VolumeEstimator } from "./importer-tool-forms";
import { ClosingBand } from "./closing-band";
import { Lined, PageHead } from "./route-parts";
import { SiteShell } from "./site-chrome";

export function ToolsIndexPage({ locale }: { locale: SiteLocale }) {
  const copy = tools[locale];
  return (
    <SiteShell locale={locale} path="/tools">
      <PageHead title={copy.index.title} intro={copy.index.intro}/>
      <Lined>
        <section className="stop">
          <ol className="svc-list">
            {toolSlugs.map((slug) => (
              <li key={slug}><Link href={sitePath(locale, `/tools/${slug}`)}><b>{copy[slug].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></b><span>{copy[slug].description}</span></Link></li>
            ))}
          </ol>
        </section>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}

export function ToolPage({ locale, slug }: { locale: SiteLocale; slug: ToolSlug }) {
  const copy = tools[locale];
  const page = copy[slug];
  const shared = { result: copy.result, optional: copy.optional, privacy: copy.privacy };
  const quotePath = `${sitePath(locale, "/quote")}?tool=${encodeURIComponent(slug)}`;
  return (
    <SiteShell locale={locale} path={`/tools/${slug}`}>
      <PageHead title={page.title} intro={page.intro}>
        <Link href={sitePath(locale, "/tools")} className="back-link"><ArrowLeft size={15} weight="bold" aria-hidden="true"/>{copy.index.title}</Link>
      </PageHead>
      <section className="tool-body">
        {slug === "duty-estimate" ? <DutyEstimator locale={locale} copy={copy[slug]} shared={shared}/> : null}
        {slug === "storage-charges" ? <StorageEstimator locale={locale} copy={copy[slug]} shared={shared}/> : null}
        {slug === "volume-weight" ? <VolumeEstimator locale={locale} copy={copy[slug]} shared={shared} quotePath={quotePath}/> : null}
        <div className="tool-explain">
          <div>
            <h2 className="block-title">{copy.howTitle}</h2>
            <ol className="tool-how">{page.how.map((line) => <li key={line}>{line}</li>)}</ol>
          </div>
          <p className="tool-caveat">{page.caveat}</p>
        </div>
        <div className="page-actions">
          <Link href={quotePath} className="btn" data-analytics-event="tool_quote_tap">{copy.quote}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, "/guides/importing-to-nepal")} className="text-link">{copy.guide}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </div>
        <nav aria-label={copy.others}>
          <ul className="link-list">
            {toolSlugs.filter((other) => other !== slug).map((other) => (
              <li key={other}><Link href={sitePath(locale, `/tools/${other}`)}>{copy[other].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>
            ))}
          </ul>
        </nav>
      </section>
    </SiteShell>
  );
}
