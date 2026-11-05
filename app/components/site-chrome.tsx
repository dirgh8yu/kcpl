import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CaretDown, Check, InstagramLogo, List, Phone, WhatsappLogo, X } from "@phosphor-icons/react/dist/ssr";
import { company } from "../company-data";
import { telHref, whatsappHref } from "../contact-links";
import { breadcrumbNode, graph } from "../structured-data";
import { StructuredData } from "./structured-data";
import { SiteMenus } from "./site-menus";
import { siteLocaleLabels, siteLocaleTags, siteLocales, sitePath, siteTranslator, type SiteLocale } from "../site-i18n";

const primaryNavigation = [
  { path: "/services", key: "chrome.services" },
  { path: "/work", key: "chrome.work" },
  { path: "/network", key: "chrome.network" },
  { path: "/guides", key: "chrome.resources" },
  { path: "/about", key: "chrome.about" },
  { path: "/contact", key: "chrome.contact" },
] as const;

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
          <div className="site-pop-panel site-menu-panel">
            <div className="site-menu-primary">
              {primaryNavigation.map((item) => (
                <Link key={item.path} href={sitePath(locale, item.path)} className="site-pop-link" aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
              ))}
            </div>
            {moreNavigation.map((item) => (
              <Link key={item.path} href={sitePath(locale, item.path)} className="site-pop-link" aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
            ))}
            <Link href="/portal" className="site-pop-link">{t("chrome.portal")}</Link>
          </div>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter({ locale, path }: { locale: SiteLocale; path: string }) {
  const t = siteTranslator(locale);
  const address = company.addressLines.join(", ");
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <SiteLogo locale={locale}/>
        <p>{t("company.tagline")}</p>
      </div>
      <address className="site-footer-contact">
        <p>{address}</p>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">{t("chrome.maps")}</a>
      </address>
      <div className="site-footer-contact">
        <a href={telHref(company.phones[0])} data-analytics-event="call_tap">{company.phones[0]}</a>
        <a href={`mailto:${company.email}`}>{company.email}</a>
        {/* The one social profile KCPL runs, so the schema graph's claim and the page agree. */}
        <a href={company.instagram} rel="me noreferrer" target="_blank"><InstagramLogo size={15} aria-hidden="true"/> Instagram</a>
      </div>
      <nav className="site-footer-links" aria-label={t("chrome.footer_company")}>
        {moreNavigation.map((item) => (
          <Link key={item.path} href={sitePath(locale, item.path)} aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
        ))}
        <Link href="/portal">{t("chrome.portal")}</Link>
        <Link href={sitePath(locale, "/privacy")} aria-current={isCurrent("/privacy", path) ? "page" : undefined}>{t("chrome.privacy")}</Link>
        <Link href={sitePath(locale, "/terms")} aria-current={isCurrent("/terms", path) ? "page" : undefined}>{t("chrome.terms")}</Link>
      </nav>
      <div className="site-footer-base">
        <p>© {new Date().getFullYear()} {company.name} {t("chrome.rights")}</p>
        <p>{t("chrome.photo_note")}</p>
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
