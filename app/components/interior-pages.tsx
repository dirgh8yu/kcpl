import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { affiliations, company } from "../company-data";
import { telHref, whatsappHref } from "../contact-links";
import { services } from "../services-data";
import { sitePath, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { ClosingBand } from "./closing-band";
import { Credentials } from "./credentials";
import { Lined, MiniRoute, PageHead, Stop } from "./route-parts";
import { SiteShell } from "./site-chrome";
import { TrackingLinkEntry } from "./tracking-link-entry";

export function SectorsPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const sectorImages = ["/images/unsplash/port-aerial.jpg", "/images/unsplash/warehouse-forklift.jpg", "/images/unsplash/ship-aerial.jpg"];
  const sectors = [1, 2, 3].map((n) => ({
    title: t(`sectors.s${n}_title` as "sectors.s1_title"),
    copy: t(`sectors.s${n}_copy` as "sectors.s1_copy"),
    list: t(`sectors.s${n}_list` as "sectors.s1_list"),
    image: sectorImages[n - 1],
  }));
  const cases = [1, 2, 3].map((n) => ({
    title: t(`home.proof_${n}_title` as "home.proof_1_title"),
    copy: t(`home.proof_${n}_copy` as "home.proof_1_copy"),
    stops: t(`home.proof_${n}_stops` as "home.proof_1_stops"),
    bend: n === 2 ? [1, 3] as const : undefined,
  }));
  return (
    <SiteShell locale={locale} path="/sectors">
      <PageHead title={t("sectors.title")} intro={t("sectors.intro")}/>
      <Lined>
        {sectors.map((sector) => (
          <section key={sector.title} className="stop sector">
            <div>
              <h2 className="stop-title">{sector.title}</h2>
              <p className="stop-intro">{sector.copy}</p>
              <p className="sector-list">{sector.list}</p>
            </div>
            <figure className="plate"><Image src={sector.image} alt="" width={1200} height={840} sizes="(max-width: 900px) 100vw, 34vw"/></figure>
          </section>
        ))}
        <Stop title={t("sectors.cases_title")} intro={t("sectors.cases_intro")}>
          <div className="stories">
            {cases.map((item) => (
              <div key={item.title} className="story">
                <MiniRoute stops={item.stops} bend={item.bend}/>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            ))}
          </div>
          <Link href={sitePath(locale, "/work")} className="text-link">{t("home.proof_link")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </Stop>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}

export function AboutPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const desks = [1, 2, 3, 4].map((n) => ({
    title: t(`about.desk_${n}` as "about.desk_1"),
    copy: t(`about.desk_${n}_copy` as "about.desk_1_copy"),
  }));
  return (
    <SiteShell locale={locale} path="/about">
      <PageHead title={t("about.title")} intro={t("about.intro")}/>
      <Lined>
        <section className="stop stop-split">
          <div><h2 className="block-title">{t("about.how_title")}</h2><p>{t("about.how_copy")}</p></div>
          <div><h2 className="block-title">{t("about.leadership_title")}</h2><p>{t("about.leadership_copy")}</p></div>
        </section>
        <Stop title={t("about.desks_title")}>
          <dl className="facts">
            {desks.map((desk) => <div key={desk.title}><dt>{desk.title}</dt><dd>{desk.copy}</dd></div>)}
          </dl>
        </Stop>
        <Stop title={t("about.credentials_title")}><Credentials locale={locale}/></Stop>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}

export function ContactPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const whatsapp = whatsappHref(company.whatsapp, t("chrome.whatsapp_prefill"));
  const address = company.addressLines.join(", ");
  return (
    <SiteShell locale={locale} path="/contact">
      <PageHead title={t("contact.title")} intro={t("contact.intro")}/>
      <Lined>
        <section className="stop contact-grid">
          <div>
            <h2 className="block-title">{t("contact.office_title")}</h2>
            <p>{address}</p>
            <a className="text-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">{t("chrome.maps")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></a>
          </div>
          <div>
            <h2 className="block-title">{t("contact.phone_label")}</h2>
            <a className="contact-value" href={telHref(company.phones[0])} data-analytics-event="call_tap">{company.phones[0]}</a>
            {whatsapp ? <>
              <h2 className="block-title">{t("chrome.whatsapp")}</h2>
              <a className="contact-value" href={whatsapp} target="_blank" rel="noopener noreferrer" data-analytics-event="whatsapp_tap">{company.whatsapp}</a>
            </> : null}
            <h2 className="block-title">{t("contact.email_label")}</h2>
            <a className="contact-value" href={`mailto:${company.email}`}>{company.email}</a>
          </div>
          <div>
            <h2 className="block-title">{t("contact.hours_label")}</h2>
            <p>{t("contact.hours_value")}</p>
          </div>
        </section>
        <section className="stop stop-split">
          <div>
            <h2 className="block-title">{t("contact.quote_title")}</h2>
            <p>{t("contact.quote_copy")}</p>
            <Link href={sitePath(locale, "/quote")} className="btn" data-analytics-event="quote_tap">{t("home.cta_primary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          </div>
          <div>
            <h2 className="block-title">{t("contact.existing_title")}</h2>
            <p>{t("contact.existing_copy")}</p>
            <Link href={sitePath(locale, "/track")} className="text-link">{t("chrome.track")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          </div>
        </section>
      </Lined>
    </SiteShell>
  );
}

export function TrackPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <SiteShell locale={locale} path="/track">
      <PageHead title={t("track.title")} intro={t("track.intro")}><TrackingLinkEntry locale={locale}/></PageHead>
      <Lined>
        <section className="stop stop-split">
          <div>
            <h2 className="block-title">{t("track.portal_title")}</h2>
            <p>{t("track.portal_copy")}</p>
            <Link href="/portal" className="text-link">{t("track.portal_cta")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          </div>
          <div>
            <h2 className="block-title">{t("track.ask_title")}</h2>
            <p>{t("track.ask_copy")}</p>
            <a href={`mailto:${company.email}`} className="text-link">{company.email}<ArrowRight size={15} weight="bold" aria-hidden="true"/></a>
          </div>
        </section>
      </Lined>
    </SiteShell>
  );
}

function LegalPage({ locale, path, title, intro, sections, note, children }: { locale: SiteLocale; path: string; title: string; intro: string; sections: { title: string; copy: string }[]; note: string; children?: React.ReactNode }) {
  return (
    <SiteShell locale={locale} path={path}>
      <PageHead title={title} intro={intro}/>
      <section className="legal">
        {sections.map((entry) => <article key={entry.title}><h2 className="block-title">{entry.title}</h2><p>{entry.copy}</p></article>)}
        {children}
        <p className="legal-note">{note}</p>
      </section>
    </SiteShell>
  );
}

export function PrivacyPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const sections = [1, 2, 3, 4, 5].map((n) => ({ title: t(`privacy.s${n}_title` as "privacy.s1_title"), copy: t(`privacy.s${n}_copy` as "privacy.s1_copy") }));
  return (
    <LegalPage locale={locale} path="/privacy" title={t("privacy.title")} intro={t("privacy.intro")} sections={sections} note={t("privacy.note")}>
      <article>
        <h2 className="block-title">{t("contact.office_title")}</h2>
        <p>{company.addressLines.join(", ")}</p>
        <a href={`mailto:${company.email}`}>{company.email}</a>
      </article>
    </LegalPage>
  );
}

export function TermsPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const sections = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ title: t(`terms.s${n}_title` as "terms.s1_title"), copy: t(`terms.s${n}_copy` as "terms.s1_copy") }));
  return <LegalPage locale={locale} path="/terms" title={t("terms.title")} intro={t("terms.intro")} sections={sections} note={t("terms.note")}/>;
}

export function AgentsPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <SiteShell locale={locale} path="/agents">
      <PageHead title={t("agents.title")} intro={t("agents.intro")}/>
      <Lined>
        <Stop title={t("agents.handle_title")}>
          <ul className="check-list">
            {([1, 2, 3, 4] as const).map((n) => <li key={n}>{t(`agents.handle_${n}`)}</li>)}
          </ul>
        </Stop>
        <Stop title={t("agents.networks_title")} intro={t("network.agents_copy")}>
          <ul className="marks">
            {affiliations.map((mark) => (
              <li key={mark.name}><a href={mark.href} target="_blank" rel="noopener noreferrer"><Image src={mark.image} alt={mark.detail} width={mark.width} height={mark.height} className={mark.tone === "dark" ? "mark-on-ink" : undefined}/></a></li>
            ))}
          </ul>
        </Stop>
        <Stop title={t("agents.start_title")} intro={t("agents.start_copy")}>
          <a href={`mailto:${company.email}`} className="btn">{company.email}<ArrowRight size={17} weight="bold" aria-hidden="true"/></a>
        </Stop>
      </Lined>
    </SiteShell>
  );
}

export function FaqPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const text = (key: string, part: string) => t(`svc.${key}.${part}` as SiteTextKey);
  return (
    <SiteShell locale={locale} path="/faq">
      <PageHead title={t("faq.title")} intro={t("faq.intro")}/>
      <Lined>
        {services.map((service) => (
          <Stop key={service.slug} title={text(service.key, "title")}>
            <dl className="qa">
              {[1, 2].map((number) => <div key={number}><dt>{text(service.key, `q${number}`)}</dt><dd>{text(service.key, `a${number}`)}</dd></div>)}
            </dl>
            <Link href={sitePath(locale, `/services/${service.slug}`)} className="text-link">{text(service.key, "title")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          </Stop>
        ))}
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}

export function CareersPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <SiteShell locale={locale} path="/careers">
      <PageHead title={t("careers.title")} intro={t("careers.intro")}/>
      <Lined>
        <Stop title={t("careers.write_title")} intro={t("careers.write_copy")}>
          <a href={`mailto:${company.email}`} className="btn">{company.email}<ArrowRight size={17} weight="bold" aria-hidden="true"/></a>
        </Stop>
      </Lined>
    </SiteShell>
  );
}
