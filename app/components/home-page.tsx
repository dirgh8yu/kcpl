import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { services } from "../services-data";
import { sitePath, siteText, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { ClientRail } from "./client-rail";
import { customsPoints } from "../customs-points";
import { ClosingBand } from "./closing-band";
import { Credentials } from "./credentials";
import { CustomsList } from "./customs-list";
import { quoteCopy } from "./quote-copy";
import { Lined, MiniRoute, Stop } from "./route-parts";
import { RoutePlanner } from "./route-planner";
import { SiteShell } from "./site-chrome";

export function ServiceList({ locale }: { locale: SiteLocale }) {
  return (
    <ul className="svc-list">
      {services.map((service) => (
        <li key={service.slug}>
          <Link href={sitePath(locale, `/services/${service.slug}`)}>
            <b>{siteText(locale, `svc.${service.key}.title` as SiteTextKey)}<ArrowRight size={16} weight="bold" aria-hidden="true"/></b>
            <span>{siteText(locale, `svc.${service.key}.summary` as SiteTextKey)}</span>
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
      <Lined reveal>
        <Stop title={t("home.customs_title")}>
          <CustomsList
            names={{ china: customsPoints.china.map(([en, ne]) => (locale === "ne" || locale === "hi" ? ne : en)), india: customsPoints.india.map(([en, ne]) => (locale === "ne" || locale === "hi" ? ne : en)) }}
            labels={{ china: t("home.customs_china"), india: t("home.customs_india"), more: t("home.customs_more") }}
          />
        </Stop>
        <ClientRail labels={{ title: t("home.clients_title"), pause: t("home.clients_pause"), play: t("home.clients_play") }}/>
        <Stop title={t("home.credibility_title")} intro={t("home.credibility_copy")}>
          <Credentials locale={locale}/>
        </Stop>
        <Stop title={t("home.proof_title")} intro={t("home.proof_intro")}/>
        <section className="feature-band">
          <MiniRoute stops={t("home.proof_2_stops")} bend={[1, 3]}/>
          <div className="feature-copy">
            <h3>{t("home.proof_2_title")}</h3>
            <div>
              <p>{t("home.proof_2_copy")}</p>
              <Link href={sitePath(locale, "/work#air-export")} className="text-link">{t("home.proof_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
            </div>
          </div>
        </section>
        <section className="stop stop-flush">
          <div className="stories">
            {([[1, "infrastructure"], [3, "western-nepal"]] as const).map(([number, slug]) => (
              <Link key={slug} href={sitePath(locale, `/work#${slug}`)} className="story">
                <MiniRoute stops={t(`home.proof_${number}_stops`)}/>
                <h3>{t(`home.proof_${number}_title`)}</h3>
                <p>{t(`home.proof_${number}_copy`)}</p>
              </Link>
            ))}
          </div>
        </section>
        <Stop title={t("home.capability_title")} intro={t("home.capability_intro")}>
          <ServiceList locale={locale}/>
        </Stop>
        <Stop title={t("home.corridor_title")} intro={t("home.corridor_intro")}>
          <div className="two-photos">
            <figure>
              <Image src="/images/unsplash/ghat-road.jpg" alt="" width={2000} height={1131} sizes="(max-width: 900px) 100vw, 44vw"/>
              <figcaption><b>{t("home.corridor_in_title")}</b>{t("home.corridor_in_copy")}</figcaption>
            </figure>
            <figure>
              <Image src="/images/unsplash/ship-aerial.jpg" alt="" width={2200} height={1585} sizes="(max-width: 900px) 100vw, 44vw"/>
              <figcaption><b>{t("home.corridor_out_title")}</b>{t("home.corridor_out_copy")}</figcaption>
            </figure>
          </div>
          <Link href={sitePath(locale, "/network")} className="text-link">{t("home.corridor_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </Stop>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}
