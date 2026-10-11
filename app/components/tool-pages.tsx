import Link from "next/link";
import { ArrowRight, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { sitePath, type SiteLocale } from "../site-i18n";
import { tools, toolSlugs, type ToolSlug } from "../tool-data";
import { DutyEstimator, StorageEstimator, VolumeEstimator } from "./importer-tool-forms";
import { SiteShell } from "./site-chrome";

export function ToolsIndexPage({ locale }: { locale: SiteLocale }) {
  const copy = tools[locale];
  return (
    <SiteShell locale={locale} path="/tools">
      <section className="section page-head freight-guide-head">
        <h1 className="section-title">{copy.index.title}</h1>
        <p className="section-intro">{copy.index.intro}</p>
      </section>
      <section className="section reference-index">
        <ol className="reference-index-list">
          {toolSlugs.map((slug) => (
            <li key={slug}>
              <Link href={sitePath(locale, `/tools/${slug}`)} className="reference-index-link">
                <span className="reference-index-body">
                  <span className="reference-index-title">{copy[slug].title}</span>
                  <span className="reference-index-copy">{copy[slug].description}</span>
                </span>
                <span className="reference-index-open">{copy.index.open}<CaretRight size={13} weight="bold" aria-hidden="true"/></span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </SiteShell>
  );
}

export function ToolPage({ locale, slug }: { locale: SiteLocale; slug: ToolSlug }) {
  const copy = tools[locale];
  const page = copy[slug];
  const shared = { result: copy.result, optional: copy.optional, privacy: copy.privacy };
  const quotePath = sitePath(locale, "/quote");
  return (
    <SiteShell locale={locale} path={`/tools/${slug}`}>
      <section className="section page-head freight-guide-head">
        <p className="freight-guide-eyebrow"><Link href={sitePath(locale, "/tools")}>{copy.eyebrow}</Link></p>
        <h1 className="section-title">{page.title}</h1>
        <p className="section-intro">{page.intro}</p>
      </section>
      <section className="section tool-body">
        {slug === "duty-estimate" ? <DutyEstimator locale={locale} copy={copy[slug]} shared={shared}/> : null}
        {slug === "storage-charges" ? <StorageEstimator locale={locale} copy={copy[slug]} shared={shared}/> : null}
        {slug === "volume-weight" ? <VolumeEstimator locale={locale} copy={copy[slug]} shared={shared} quotePath={quotePath}/> : null}
        <div className="tool-explain">
          <div>
            <h2 className="service-block-title">{copy.howTitle}</h2>
            <ol className="tool-how">{page.how.map((line) => <li key={line}>{line}</li>)}</ol>
          </div>
          <p className="tool-caveat">{page.caveat}</p>
        </div>
        <div className="freight-guide-actions">
          <Link href={quotePath} className="button-primary" data-analytics-event="tool_quote_tap">{copy.quote}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          <Link href={sitePath(locale, "/guides/importing-to-nepal")} className="section-link">{copy.guide}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </div>
        <nav className="freight-guide-next" aria-label={copy.others}>
          <ul>
            {toolSlugs.filter((other) => other !== slug).map((other) => (
              <li key={other}><Link href={sitePath(locale, `/tools/${other}`)}>{copy[other].title}<ArrowRight size={17} aria-hidden="true"/></Link></li>
            ))}
          </ul>
        </nav>
      </section>
    </SiteShell>
  );
}
