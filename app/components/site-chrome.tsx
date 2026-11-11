import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CaretDown, Check, InstagramLogo, List, Phone, WhatsappLogo, X } from "@phosphor-icons/react/dist/ssr";
import { company } from "../company-data";
import { services } from "../services-data";
import { telHref, whatsappHref } from "../contact-links";
import { breadcrumbNode, graph } from "../structured-data";
import { StructuredData } from "./structured-data";
import { SiteMenus } from "./site-menus";
import { siteLocaleLabels, siteLocaleTags, siteLocales, sitePath, siteText, siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";

const home = { path: "/", key: "chrome.home" } as const;
const resources = { path: "/guides", key: "chrome.resources" } as const;

/** The header bar: five links. Everything else is in the menu and the footer. */
const primaryNavigation = [
  { path: "/services", key: "chrome.services" },
  { path: "/work", key: "chrome.work" },
  { path: "/network", key: "chrome.network" },
  { path: "/about", key: "chrome.about" },
  { path: "/contact", key: "chrome.contact" },
] as const;

/** The menu's large links, in the order a visitor reads the site. */
const menuNavigation = [home, primaryNavigation[0], primaryNavigation[1], primaryNavigation[2], resources, primaryNavigation[3], primaryNavigation[4]] as const;

/** Reached from the menu and the footer rather than the header bar. The gallery
 * keeps its address but stays out of navigation until it has more photographs. */
const moreNavigation = [
  { path: "/sectors", key: "chrome.sectors" },
  { path: "/awards", key: "chrome.awards" },
  { path: "/agents", key: "chrome.agents" },
  { path: "/faq", key: "chrome.faq" },
  { path: "/careers", key: "chrome.careers" },
  { path: "/track", key: "chrome.track" },
  { path: "/search", key: "chrome.search" },
] as const;

/**
 * The Gateway K exactly as the identity file records it: the crimson symbol,
 * the wordmark in Manrope, the legal descriptor beneath. Never recoloured or
 * redrawn here — the SVG is the master.
 */
export function SiteLogo({ locale }: { locale: SiteLocale }) {
  return (
    <Link href={sitePath(locale, "/")} className="site-lockup" aria-label={company.name}>
      <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={38} height={38} className="site-lockup-mark" loading="eager"/>
      <span className="site-lockup-text">
        <span className="site-lockup-name">Kapileshwor</span>
        <span className="site-lockup-meta">Cargo Pvt. Ltd.</span>
      </span>
    </Link>
  );
}

/** A nav item is current on its own page and on anything beneath it, so a
 * service detail page still lights Services. */
function isCurrent(itemPath: string, path: string) {
  return path === itemPath || path.startsWith(`${itemPath}/`);
}

export function SiteHeader({ locale, path }: { locale: SiteLocale; path: string }) {
  const t = siteTranslator(locale);
  return (
    <header className="site-header">
      <a href="#main" className="site-skip">{t("chrome.skip")}</a>
      <SiteLogo locale={locale}/>
      <nav className="site-nav" aria-label={t("chrome.nav_label")}>
        {primaryNavigation.map((item) => (
          <Link key={item.path} href={sitePath(locale, item.path)} className="site-nav-link" aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
        ))}
      </nav>
      <div className="site-header-actions">
        {/* Native disclosures: keyboard accessible on their own, and a navigation
          * renders the header again already closed. */}
        <details className="site-pop site-lang">
          <summary className="site-pop-button" aria-label={`${t("chrome.language")}: ${siteLocaleLabels[locale]}`}>
            <span>{locale.toUpperCase()}</span><CaretDown size={12} weight="bold" aria-hidden="true"/>
          </summary>
          <div className="site-pop-panel">
            {siteLocales.map((entry) => (
              entry === locale
                ? <span key={entry} className="site-pop-link" aria-current="true" lang={siteLocaleTags[entry]}>{siteLocaleLabels[entry]}<Check size={14} weight="bold" aria-hidden="true"/></span>
                : <Link key={entry} href={sitePath(entry, path)} className="site-pop-link" hrefLang={siteLocaleTags[entry]} lang={siteLocaleTags[entry]}>{siteLocaleLabels[entry]}</Link>
            ))}
          </div>
        </details>
        <Link href={sitePath(locale, "/quote")} className="btn btn-small site-cta" data-analytics-event="quote_tap">{t("chrome.quote")}</Link>
        <details className="site-pop site-menu">
          <summary className="site-pop-button" aria-label={t("chrome.menu")}>
            <List className="site-menu-open" size={22} aria-hidden="true"/><X className="site-menu-close" size={22} aria-hidden="true"/>
          </summary>
          <nav className="site-menu-panel" aria-label={t("chrome.menu")}>
            <ul className="site-menu-list">
              {menuNavigation.map((item, index) => (
                <li key={item.path} style={{ "--i": index } as CSSProperties}>
                  <Link href={sitePath(locale, item.path)} aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
                </li>
              ))}
            </ul>
            <div className="site-menu-foot">
              {moreNavigation.map((item) => (
                <Link key={item.path} href={sitePath(locale, item.path)} aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
              ))}
              <Link href="/portal">{t("chrome.portal")}</Link>
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter({ locale, path }: { locale: SiteLocale; path: string }) {
  const t = siteTranslator(locale);
  const address = company.addressLines.join(", ");
  const current = (itemPath: string) => (isCurrent(itemPath, path) ? "page" as const : undefined);
  return (
    <footer className="site-footer">
      <div className="site-footer-cols">
        <div>
          <h2 className="label">{t("chrome.footer_contact")}</h2>
          <address>
          <p>{company.addressLines.map((line) => <span key={line}>{line}<br/></span>)}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">{t("chrome.maps")}</a></p>
          <p><a href={telHref(company.phones[0])} data-analytics-event="call_tap">{company.phones[0]}</a><br/>
            <a href={`mailto:${company.email}`}>{company.email}</a></p>
          <p>{t("contact.hours_value")}</p>
          {/* The one social profile KCPL runs, so the schema graph's claim and the page agree. */}
          <p><a href={company.instagram} rel="me noreferrer" target="_blank"><InstagramLogo size={15} aria-hidden="true"/> Instagram</a></p>
          </address>
        </div>
        <nav className="site-footer-pages" aria-label={t("chrome.footer_company")}>
          <div>
            <h2 className="label">{t("chrome.footer_services")}</h2>
            <ul>
              {services.map((service) => (
                <li key={service.slug}><Link href={sitePath(locale, `/services/${service.slug}`)} aria-current={current(`/services/${service.slug}`)}>{siteText(locale, `svc.${service.key}.title` as SiteTextKey)}</Link></li>
              ))}
              <li><Link href={sitePath(locale, resources.path)} aria-current={current(resources.path)}>{t(resources.key)}</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="label">{t("chrome.footer_company")}</h2>
            <ul>
              {[...primaryNavigation.slice(1), ...moreNavigation].map((item) => (
                <li key={item.path}><Link href={sitePath(locale, item.path)} aria-current={current(item.path)}>{t(item.key)}</Link></li>
              ))}
              <li><Link href="/portal">{t("chrome.portal")}</Link></li>
            </ul>
          </div>
        </nav>
        <div>
          <h2 className="label">{t("about.credentials_title")}</h2>
          <ul>
            <li>{t("home.credibility_award")}, {t("home.credibility_award_detail")}</li>
            <li>{t("home.credibility_member_detail")}</li>
            <li>{t("company.established")}</li>
          </ul>
        </div>
      </div>
      <div className="site-footer-base">
        <p>© {new Date().getFullYear()} {company.name} {t("chrome.rights")} {t("chrome.photo_note")}</p>
        <nav aria-label={t("chrome.language")}>
          {siteLocales.map((entry) => (
            <Link key={entry} href={sitePath(entry, path)} hrefLang={siteLocaleTags[entry]} lang={siteLocaleTags[entry]} aria-current={entry === locale ? "true" : undefined}>{siteLocaleLabels[entry]}</Link>
          ))}
        </nav>
        <span>
          <Link href={sitePath(locale, "/privacy")} aria-current={current("/privacy")}>{t("chrome.privacy")}</Link>
          <Link href={sitePath(locale, "/terms")} aria-current={current("/terms")}>{t("chrome.terms")}</Link>
        </span>
      </div>
    </footer>
  );
}

/**
 * On a phone the ways to reach KCPL sit under the thumb: call, WhatsApp once
 * KCPL has a number for it, and the quote form (left out on the quote page
 * itself). Plain links, no JavaScript; hidden on wider screens, where the
 * header carries the quote button and the footer the number.
 */
export function SiteActionBar({ locale, path }: { locale: SiteLocale; path: string }) {
  const t = siteTranslator(locale);
  const whatsapp = whatsappHref(company.whatsapp, t("chrome.whatsapp_prefill"));
  return (
    <nav className="site-action-bar" aria-label={t("chrome.actions_label")}>
      <a href={telHref(company.phones[0])} className="site-action" aria-label={`${t("chrome.call_label")} ${company.phones[0]}`} data-analytics-event="call_tap">
        <Phone size={18} weight="bold" aria-hidden="true"/>{t("chrome.call")}
      </a>
      {whatsapp ? (
        <a href={whatsapp} className="site-action" aria-label={t("chrome.whatsapp_label")} target="_blank" rel="noopener noreferrer" data-analytics-event="whatsapp_tap">
          <WhatsappLogo size={18} weight="bold" aria-hidden="true"/>{t("chrome.whatsapp")}
        </a>
      ) : null}
      {path === "/quote" ? null : (
        <Link href={sitePath(locale, "/quote")} className="site-action site-action-primary" data-analytics-event="quote_tap">{t("chrome.quote")}</Link>
      )}
    </nav>
  );
}

/* Written out rather than interpolated: the dead-CSS audit reads class literals
 * from source, and a built-up name is invisible to it. */
const localeClass: Record<SiteLocale, string> = { en: "", ne: "site-root-deva", zh: "site-root-zh", hi: "site-root-deva" };

/** Every marketing page is this sandwich, so the chrome can never drift between them. */
export function SiteShell({ locale, path, children }: { locale: SiteLocale; path: string; children: ReactNode }) {
  const crumbs = breadcrumbNode(locale, path);
  const breadcrumb = crumbs ? graph([crumbs]) : null;
  return (
    <div className={`site-root ${localeClass[locale]}`.trim()} lang={locale === "en" ? undefined : siteLocaleTags[locale]}>
      {/* Every public page is a page in a trail, and the shell is the one place
        * that knows both which page and which language. */}
      {breadcrumb ? <StructuredData data={breadcrumb}/> : null}
      <SiteHeader locale={locale} path={path}/>
      <SiteMenus/>
      <main id="main">{children}</main>
      <SiteFooter locale={locale} path={path}/>
      <SiteActionBar locale={locale} path={path}/>
    </div>
  );
}
