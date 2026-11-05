import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { guides } from "../guide-data";
import { networkGroupNames } from "../network-data";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { ClosingBand } from "./closing-band";
import { NetworkMap } from "./network-map";
import { quoteCopy } from "./quote-copy";
import { RouteDiagram, RouteFork } from "./route-diagram";
import { Lined, PageHead, Stop } from "./route-parts";
import { SiteShell } from "./site-chrome";

/* The map pulls in maplibre and its 81KB stylesheet. Kept in its own module so
 * that cost lands on /network alone, instead of on every page that happened to
 * share a file with it. */

export function NetworkPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const copy = quoteCopy[locale];
  const columns = [
    { title: t("network.gateways_title"), items: networkGroupNames("gateways") },
    { title: t("network.origins_title"), items: networkGroupNames("origins") },
    { title: t("network.destinations_title"), items: networkGroupNames("destinations") },
  ];
  const names = { kolkata: t("route.kolkata"), raxaul: t("route.raxaul"), birgunj: t("route.birgunj"), kathmandu: t("route.kathmandu"), nepalgunj: t("route.nepalgunj"), surkhet: t("route.surkhet") };
  return (
    <SiteShell locale={locale} path="/network">
      <PageHead title={t("network.title")} intro={t("network.intro")}/>
      <Lined reveal>
        <Stop title={t("network.staffed_title")} intro={t("network.staffed_copy")}>
          <RouteDiagram names={names} ends={{ from: copy.origin, to: copy.destination }}/>
          <RouteFork names={names}/>
        </Stop>
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
        <section className="stop stop-split">
          <div>
            <h2 className="block-title">{t("network.import_title")}</h2>
            <p>{t("network.import_copy")}</p>
            <Link className="text-link" href={sitePath(locale, "/guides/importing-to-nepal")}>{guides[locale]["importing-to-nepal"].title}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          </div>
          <div>
            <h2 className="block-title">{t("network.export_title")}</h2>
            <p>{t("network.export_copy")}</p>
            <Link className="text-link" href={sitePath(locale, "/guides/exporting-from-nepal")}>{guides[locale]["exporting-from-nepal"].title}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          </div>
        </section>
        <section className="stop lanes">
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="block-title">{column.title}</h2>
              <ul>{column.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </section>
        <section className="stop stop-split">
          <div>
            <h2 className="block-title">{t("network.agents_title")}</h2>
            <p>{t("network.agents_copy")}</p>
            <Link className="text-link" href={sitePath(locale, "/agents")}>{t("chrome.agents")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          </div>
          <div>
            <h2 className="block-title">{t("network.storage_title")}</h2>
            <p>{t("home.credibility_storage_detail")}</p>
          </div>
        </section>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}
