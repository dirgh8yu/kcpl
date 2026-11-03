import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { publicSearchIndex, searchKindLabel, searchPublicSite } from "../public-search";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { SiteShell } from "./site-chrome";

export function SearchPage({ locale, query }: { locale: SiteLocale; query: string }) {
  const t = siteTranslator(locale);
  const results = searchPublicSite(locale, query);
  const total = publicSearchIndex(locale).length;
  return <SiteShell locale={locale} path="/search">
    <section className="section page-head search-head">
      <h1 className="section-title">{t("search.title")}</h1>
      <p className="section-intro">{t("search.intro")}</p>
      <form className="site-search-form" action={sitePath(locale, "/search")} method="get" role="search">
        <label>
          <span className="sr-only">{t("search.title")}</span>
          <input name="q" defaultValue={query} placeholder={t("search.placeholder")} autoComplete="off" spellCheck={false}/>
        </label>
        <button type="submit"><MagnifyingGlass size={17} weight="bold" aria-hidden="true"/>{t("search.action")}</button>
      </form>
    </section>
    <section className="section search-results" aria-live="polite">
      {query.trim() ? <>
        <p className="search-count">{t("search.results")} · {results.length} / {total}</p>
        {results.length ? <ol className="search-result-list">
          {results.map((result) => <li key={`${result.kind}:${result.href}`}>
            <Link href={result.href} className="search-result">
              <span className="search-result-kind">{searchKindLabel(locale, result.kind)}</span>
              <span className="search-result-body">
                <strong>{result.title}</strong>
                <span>{result.description}</span>
              </span>
              <ArrowRight size={17} weight="bold" aria-hidden="true"/>
            </Link>
          </li>)}
        </ol> : <p className="search-empty">{t("search.empty")}</p>}
      </> : <p className="search-empty">{t("search.placeholder")}</p>}
    </section>
  </SiteShell>;
}
