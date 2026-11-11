import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { services } from "../services-data";
import { sitePath, siteText, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { ClientRail } from "./client-rail";
import { ClosingBand } from "./closing-band";
import { quoteCopy } from "./quote-copy";
import { Lined, Stop } from "./route-parts";
import { RoutePlanner } from "./route-planner";
import { SiteShell } from "./site-chrome";

/** Every service in large type, each on its own thin branch of the page line. */
export function ServiceList({ locale }: { locale: SiteLocale }) {
  return (
    <ul className="svc">
      {services.map((service, index) => (
        <li key={service.slug} style={{ "--i": index } as CSSProperties}>
          <span className="br" aria-hidden="true"><i/></span><i className="dot" aria-hidden="true"/>
          <Link href={sitePath(locale, `/services/${service.slug}`)}>
            <b>{siteText(locale, `svc.${service.key}.title` as SiteTextKey)}</b>
            <span>{siteText(locale, `svc.${service.key}.summary` as SiteTextKey)}</span>
            <ArrowRight size={20} weight="bold" aria-hidden="true"/>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function HomePage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const copy = quoteCopy[locale];
  return (
    <SiteShell locale={locale} path="/">
      <section className="home-hero">
        <div className="home-hero-top">
          <h1>{t("home.hero_title")}</h1>
          <p>{t("home.hero_intro")}</p>
          <small>{t("home.hero_trust").split(" · ").map((part, index) => <span key={part}>{index ? " · " : ""}<span className="nowrap">{part}</span></span>)}</small>
        </div>
        <RoutePlanner action={sitePath(locale, "/quote")} labels={{
          origin: copy.origin,
          originHint: t("home.plan_origin_hint"),
          destination: copy.destination,
          destinationHint: t("home.plan_destination_hint"),
          mode: copy.mode,
          modes: { sea: t("home.mode_sea"), air: t("home.mode_air"), road: t("home.mode_road"), unsure: t("home.mode_unsure") },
          route: {
            stations: { inland: t("route.shigatse_lhasa"), kerung: t("route.kerung"), rasuwa: t("route.rasuwagadhi"), tatopani: t("route.tatopani"), kolkata: t("route.kolkata"), birgunj: t("route.raxaul_birgunj"), nepalgunj: t("route.nepalgunj"), surkhet: t("route.surkhet"), kathmandu: t("route.kathmandu") },
            info: { inland: t("route.info_inland"), kerung: t("route.info_kerung"), rasuwa: t("route.info_rasuwa"), tatopani: t("route.info_tatopani"), kolkata: t("route.info_kolkata"), birgunj: t("route.info_birgunj"), nepalgunj: t("route.info_nepalgunj"), surkhet: t("route.info_surkhet"), kathmandu: t("route.info_kathmandu") },
            arms: { china: t("route.china"), india: t("route.india") },
            summary: t("route.summary"),
          },
          notes: { sea: t("home.plan_note_sea"), air: t("home.plan_note_air"), road: t("home.plan_note_road"), unsure: t("home.plan_note_unsure"), out: t("home.plan_note_out") },
          submit: t("home.plan_cta"),
        }}/>
      </section>
      <Lined reveal tracks>
        <ClientRail title={t("home.clients_title")}/>
        <Stop title={t("home.credibility_title")} intro={t("home.credibility_copy")} line="a-b">
          {/* Only what KCPL can back with a document. The figures stay in Latin numerals in every language. */}
          <dl className="figures">
            <div><dt><b>2015</b>{t("home.fact_established")}</dt><dd>{t("company.established_where")}</dd></div>
            <div><dt><b>2022–25</b>{t("awards.label")}</dt><dd>{t("awards.issuer")}</dd></div>
            <div><dt><b>6</b>{t("home.credibility_staff")}</dt><dd>{t("network.staffed_places")}</dd></div>
            <div><dt><b>6,000+</b>{t("home.credibility_storage")}</dt><dd>{t("home.credibility_storage_detail")}</dd></div>
          </dl>
        </Stop>
        {/* The one crossing on this page: the line goes over the band as the movement's own route. */}
        <section className="band">
          <span className="band-cross" aria-hidden="true"><i/></span>
          <ol className="band-stops">
            {t("home.proof_2_stops").split("|").map((name) => <li key={name}><i aria-hidden="true"/><b>{name}</b></li>)}
          </ol>
          <div className="band-copy">
            <h2 className="band-title">{t("home.proof_2_title")}</h2>
            <div>
              <p>{t("home.proof_2_copy")}</p>
              <Link href={sitePath(locale, "/work#air-export")} className="text-link">{t("home.proof_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
            </div>
          </div>
        </section>
        <div className="ret" aria-hidden="true"><i/></div>
        <Stop title={t("home.capability_title")} intro={t("home.capability_intro")} line="a">
          <ServiceList locale={locale}/>
          <Link href={sitePath(locale, "/services")} className="text-link">{t("home.capability_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </Stop>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}
