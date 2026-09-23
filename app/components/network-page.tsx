import { networkGroupNames } from "../network-data";
import { siteTranslator, type SiteLocale } from "../site-i18n";
import { ClosingBand } from "./closing-band";
import { NetworkMap } from "./network-map";
import { SiteShell } from "./site-chrome";

/* The map pulls in maplibre and its 81KB stylesheet. Kept in its own module so
 * that cost lands on /network alone, instead of on every page that happened to
 * share a file with it. */

export function NetworkPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const columns = [
    { title: t("network.gateways_title"), items: networkGroupNames("gateways") },
    { title: t("network.origins_title"), items: networkGroupNames("origins") },
    { title: t("network.destinations_title"), items: networkGroupNames("destinations") },
  ];
  return (
    <SiteShell locale={locale} path="/network">
      <section className="section page-head network-overview-head">
        <h1 className="section-title">{t("network.title")}</h1>
        <p className="section-intro">{t("network.intro")}</p>
      </section>
      <NetworkMap labels={{
        title: t("network.map_title"),
        all: t("network.map_all"),
        operations: t("network.map_operations"),
        gateways: t("network.gateways_title"),
        origins: t("network.origins_title"),
        destinations: t("network.destinations_title"),
        note: t("network.map_note"),
        unavailable: t("network.map_unavailable"),
        map: t("network.map_aria"),
      }}/>
      <section className="section section-corridor">
        <div className="lane-columns">
          {columns.map((column) => (
            <div key={column.title} className="lane-column">
              <h2 className="corridor-label">{column.title}</h2>
              <ul className="corridor-tags">{column.items.map((item) => <li key={item} className="corridor-tag">{item}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
      <section className="section network-notes">
        <article className="network-note">
          <h2 className="service-block-title">{t("network.agents_title")}</h2>
          <p className="section-intro">{t("network.agents_copy")}</p>
        </article>
        <article className="network-note">
          <h2 className="service-block-title">{t("network.storage_title")}</h2>
          <p className="section-intro">{t("home.credibility_storage_detail")}</p>
        </article>
      </section>
      <ClosingBand locale={locale}/>
    </SiteShell>
  );
}
