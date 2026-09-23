import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { affiliations, company, locations } from "../company-data";
import { sitePath, siteTranslator, type SiteLocale } from "../site-i18n";
import { SiteShell } from "./site-chrome";

/* Places and corridors are records, so they are written once and not translated. */
const origins = ["Shanghai", "Ningbo", "Qingdao", "Shekou", "Hong Kong", "Bangkok", "Port Klang", "Singapore"];
const gateways = ["Kolkata", "Visakhapatnam", "Haldia", "Raxaul", "Birgunj"];
const destinations = ["United States", "Canada", "United Kingdom", "Germany", "Netherlands", "Switzerland", "Australia", "South Korea", "Brazil"];

export function SectorsPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const sectorImages = ["/images/services/specialist-open-top.jpg", "/images/services/packaging-storage.jpg", "/images/ocean-freight.jpg"];
  const sectors = [1, 2, 3].map((n) => ({
    title: t(`sectors.s${n}_title` as "sectors.s1_title"),
    copy: t(`sectors.s${n}_copy` as "sectors.s1_copy"),
    list: t(`sectors.s${n}_list` as "sectors.s1_list"),
    image: sectorImages[n - 1],
  }));
  const cases = [1, 2, 3].map((n) => ({
    kicker: t(`home.proof_${n}_kicker` as "home.proof_1_kicker"),
    title: t(`home.proof_${n}_title` as "home.proof_1_title"),
    copy: t(`home.proof_${n}_copy` as "home.proof_1_copy"),
    meta: t(`home.proof_${n}_meta` as "home.proof_1_meta"),
    client: n === 1 ? t("home.proof_1_client") : "",
  }));
  return (
    <SiteShell locale={locale} path="/sectors">
      <section className="section page-head">
        <h1 className="section-title">{t("sectors.title")}</h1>
        <p className="section-intro">{t("sectors.intro")}</p>
      </section>
      <section className="section sector-list reveal-group">
        {sectors.map((sector) => (
          <article key={sector.title} className="sector-row reveal">
            <div className="sector-lead">
              <figure className="sector-figure"><Image src={sector.image} alt="" width={800} height={560} sizes="(max-width: 1024px) 100vw, 34vw" className="sector-photo"/></figure>
              <h2 className="sector-title">{sector.title}</h2>
            </div>
            <div className="sector-body">
              <p className="sector-copy">{sector.copy}</p>
              <p className="sector-list-line">{sector.list}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="section section-proof">
        <div className="section-head">
          <p className="eyebrow">{t("home.proof_eyebrow")}</p>
          <h2 className="section-title">{t("sectors.cases_title")}</h2>
          <p className="section-intro">{t("sectors.cases_intro")}</p>
        </div>
        <div className="record-list">
          {cases.map((item) => (
            <article key={item.title} className="record">
              <p className="proof-kicker">{item.kicker}</p>
              <div>
                <h3 className="proof-title">{item.title}</h3>
                <p className="proof-copy">{item.copy}{item.client ? ` ${item.client}` : ""}</p>
                <p className="proof-meta">{item.meta}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ClosingBand locale={locale}/>
    </SiteShell>
  );
}

export function NetworkPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const columns = [
    { title: t("network.gateways_title"), items: gateways },
    { title: t("network.origins_title"), items: origins },
    { title: t("network.destinations_title"), items: destinations },
  ];
  return (
    <SiteShell locale={locale} path="/network">
      <section className="section page-head">
        <h1 className="section-title">{t("network.title")}</h1>
        <p className="section-intro">{t("network.intro")}</p>
      </section>
      <section className="network-banner">
        <Image src="/images/nepal-satellite-nasa-regional.jpg" alt="" fill sizes="100vw" className="network-banner-image"/>
      </section>
      <section className="section">
        <h2 className="service-block-title">{t("network.places_title")}</h2>
        <ul className="place-grid">
          {locations.map((place) => <li key={place} className="place-cell">{place}</li>)}
        </ul>
        <p className="place-note">{t("network.places_note")}</p>
      </section>
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

export function AboutPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const desks = [1, 2, 3, 4].map((n) => ({
    title: t(`about.desk_${n}` as "about.desk_1"),
    copy: t(`about.desk_${n}_copy` as "about.desk_1_copy"),
  }));
  const credentials = [
    { label: t("stats.clients_value"), detail: t("stats.clients_label") },
    { label: t("stats.projects_value"), detail: t("stats.projects_label") },
    { label: t("home.credibility_award"), detail: t("home.credibility_award_detail") },
    { label: t("home.credibility_member"), detail: t("home.credibility_member_detail") },
    { label: t("home.credibility_storage"), detail: t("home.credibility_storage_detail") },
    { label: t("home.credibility_projects"), detail: t("home.credibility_projects_detail") },
  ];
  return (
    <SiteShell locale={locale} path="/about">
      <section className="section page-head">
        <h1 className="section-title">{t("about.title")}</h1>
        <p className="section-intro">{t("about.intro")}</p>
      </section>
      <section className="about-banner">
        <Image src="/images/services/warehousing.jpg" alt="" fill sizes="100vw" className="about-banner-image"/>
      </section>
      <section className="section about-split">
        <div>
          <h2 className="service-block-title">{t("about.how_title")}</h2>
          <p className="about-copy">{t("about.how_copy")}</p>
        </div>
        <div>
          <h2 className="service-block-title">{t("about.leadership_title")}</h2>
          <p className="about-copy">{t("about.leadership_copy")}</p>
        </div>
      </section>
      <section className="section section-capability">
        <h2 className="service-block-title">{t("about.desks_title")}</h2>
        <dl className="capability-list reveal-group">
          {desks.map((desk) => (
            <div key={desk.title} className="capability-item reveal">
              <dt className="capability-title">{desk.title}</dt>
              <dd className="capability-copy">{desk.copy}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="section section-credibility">
        <div className="credibility-layout">
          <div className="credibility-copy">
            <h2 className="section-title">{t("about.credentials_title")}</h2>
            <ul className="credibility-marks">
              {affiliations.filter((mark) => mark.name !== "JCtrans").map((mark) => (
                <li key={mark.name} className="credibility-mark">
                  <Image src={mark.image} alt={mark.detail} width={mark.width} height={mark.height} className="credibility-mark-image"/>
                </li>
              ))}
            </ul>
          </div>
          <dl className="credibility-facts">
            {credentials.map((fact) => (
              <div key={fact.label} className="credibility-fact">
                <dt className="credibility-label">{fact.label}</dt>
                <dd className="credibility-detail">{fact.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <ClosingBand locale={locale}/>
    </SiteShell>
  );
}

export function ContactPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <SiteShell locale={locale} path="/contact">
      <section className="section page-head">
        <h1 className="section-title">{t("contact.title")}</h1>
        <p className="section-intro">{t("contact.intro")}</p>
      </section>
      <section className="section contact-grid">
        <div className="contact-cell">
          <h2 className="service-block-title">{t("contact.office_title")}</h2>
          <p className="contact-value">{company.addressLines.join(", ")}</p>
        </div>
        <div className="contact-cell">
          <h2 className="service-block-title">{t("contact.phone_label")}</h2>
          <a className="contact-value contact-link" href={`tel:${company.phones[0].replace(/[^+\d]/g, "")}`}>{company.phones[0]}</a>
          <h2 className="service-block-title contact-second">{t("contact.email_label")}</h2>
          <a className="contact-value contact-link" href={`mailto:${company.email}`}>{company.email}</a>
        </div>
        <div className="contact-cell">
          <h2 className="service-block-title">{t("contact.hours_label")}</h2>
          <p className="contact-value">{t("contact.hours_value")}</p>
        </div>
      </section>
      <section className="section about-split">
        <div>
          <h2 className="service-block-title">{t("contact.quote_title")}</h2>
          <p className="about-copy">{t("contact.quote_copy")}</p>
          <Link href={sitePath(locale, "/quote")} className="button-primary contact-action">{t("home.cta_primary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
        </div>
        <div>
          <h2 className="service-block-title">{t("contact.existing_title")}</h2>
          <p className="about-copy">{t("contact.existing_copy")}</p>
          <Link href={sitePath(locale, "/track")} className="section-link contact-action">{t("chrome.track")}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
        </div>
      </section>
    </SiteShell>
  );
}

export function TrackPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <SiteShell locale={locale} path="/track">
      <section className="section page-head">
        <h1 className="section-title">{t("track.title")}</h1>
        <p className="section-intro">{t("track.intro")}</p>
      </section>
      <section className="section about-split">
        <div>
          <h2 className="service-block-title">{t("track.portal_title")}</h2>
          <p className="about-copy">{t("track.portal_copy")}</p>
          <Link href="/portal" className="button-primary contact-action">{t("track.portal_cta")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
        </div>
        <div>
          <h2 className="service-block-title">{t("track.ask_title")}</h2>
          <p className="about-copy">{t("track.ask_copy")}</p>
          <a href={`mailto:${company.email}`} className="section-link contact-action">{company.email}<ArrowRight size={15} weight="bold" aria-hidden="true"/></a>
        </div>
      </section>
    </SiteShell>
  );
}

/* The closing band repeats on interior pages: it is the page's exit, and the
 * home page's version is the same component's markup. */
function ClosingBand({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  return (
    <section className="section section-cta">
      <h2 className="cta-title">{t("home.cta_title")}</h2>
      <p className="cta-copy">{t("home.cta_copy")}</p>
      <div className="hero-actions">
        <Link href={sitePath(locale, "/quote")} className="button-primary">{t("home.cta_primary")}<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
        <Link href={sitePath(locale, "/contact")} className="button-ghost">{t("home.cta_secondary")}</Link>
      </div>
    </section>
  );
}

export function PrivacyPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const sections = [1, 2, 3, 4, 5].map((n) => ({
    title: t(`privacy.s${n}_title` as "privacy.s1_title"),
    copy: t(`privacy.s${n}_copy` as "privacy.s1_copy"),
  }));
  return (
    <SiteShell locale={locale} path="/privacy">
      <section className="section page-head">
        <h1 className="section-title">{t("privacy.title")}</h1>
        <p className="section-intro">{t("privacy.intro")}</p>
      </section>
      <section className="section legal-body">
        {sections.map((entry) => (
          <article key={entry.title} className="legal-block">
            <h2 className="service-block-title">{entry.title}</h2>
            <p className="about-copy">{entry.copy}</p>
          </article>
        ))}
        <article className="legal-block">
          <h2 className="service-block-title">{t("contact.office_title")}</h2>
          <p className="about-copy">{company.addressLines.join(", ")}</p>
          <a className="contact-link about-copy" href={`mailto:${company.email}`}>{company.email}</a>
        </article>
        <p className="legal-note">{t("privacy.note")}</p>
      </section>
    </SiteShell>
  );
}

export function TermsPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const sections = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    title: t(`terms.s${n}_title` as "terms.s1_title"),
    copy: t(`terms.s${n}_copy` as "terms.s1_copy"),
  }));
  return (
    <SiteShell locale={locale} path="/terms">
      <section className="section page-head">
        <h1 className="section-title">{t("terms.title")}</h1>
        <p className="section-intro">{t("terms.intro")}</p>
      </section>
      <section className="section legal-body">
        {sections.map((entry) => (
          <article key={entry.title} className="legal-block">
            <h2 className="service-block-title">{entry.title}</h2>
            <p className="about-copy">{entry.copy}</p>
          </article>
        ))}
        <p className="legal-note">{t("terms.note")}</p>
      </section>
    </SiteShell>
  );
}
