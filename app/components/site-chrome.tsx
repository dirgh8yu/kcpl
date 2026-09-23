import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Check, Globe, InstagramLogo, List, X } from "@phosphor-icons/react/dist/ssr";
import { company } from "../company-data";
import { breadcrumbNode, graph } from "../structured-data";
import { StructuredData } from "./structured-data";
import { siteLocaleLabels, siteLocaleTags, siteLocales, sitePath, siteTranslator, type SiteLocale } from "../site-i18n";

/** Nav is declared once: the header, the mobile disclosure and the footer all read it. */
const navigation = [
  { path: "/services", key: "chrome.services" },
  { path: "/sectors", key: "chrome.sectors" },
  { path: "/network", key: "chrome.network" },
  { path: "/about", key: "chrome.about" },
  { path: "/contact", key: "chrome.contact" },
] as const;

/**
 * The Gateway K exactly as the identity file records it: the crimson symbol,
 * the wordmark in Manrope, the legal descriptor beneath. Never recoloured or
 * redrawn here — the SVG is the master.
 */
export function SiteLogo({ locale }: { locale: SiteLocale }) {
  return (
    <Link href={sitePath(locale, "/")} className="site-lockup" aria-label={company.name}>
      <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={34} height={34} className="site-lockup-mark" priority/>
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
      <div className="site-header-inner">
        <SiteLogo locale={locale}/>
        <nav className="site-nav" aria-label={t("chrome.nav_label")}>
          {navigation.map((item) => (
            <Link key={item.path} href={sitePath(locale, item.path)} className="site-nav-link" aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
          ))}
        </nav>
        <div className="site-header-actions">
          <Link href="/portal" className="site-portal-link">{t("chrome.portal")}<ArrowUpRight size={15} aria-hidden="true"/></Link>
          {/* The trigger cycles the word for "language" through the scripts the
            * site speaks, so a reader who cannot read the others still
            * recognises the control. Nepali and Hindi share भाषा, so three
            * words cover four languages. The rotation is decoration: the
            * accessible name is fixed and the globe carries the meaning when
            * motion is switched off. */}
          <details className="site-lang">
            <summary className="site-lang-button" aria-label={t("chrome.language")}>
              <Globe size={16} aria-hidden="true"/>
              <span className="site-lang-rotator" aria-hidden="true">
                <span className="site-lang-word">Language</span>
                <span className="site-lang-word">भाषा</span>
                <span className="site-lang-word">语言</span>
              </span>
            </summary>
            <div className="site-lang-panel">
              {siteLocales.map((entry) => (
                entry === locale
                  ? <span key={entry} className="site-lang-option" aria-current="true" lang={siteLocaleTags[entry]}>{siteLocaleLabels[entry]}<Check size={14} weight="bold" aria-hidden="true"/></span>
                  : <Link key={entry} href={sitePath(entry, path)} className="site-lang-option" hrefLang={siteLocaleTags[entry]} lang={siteLocaleTags[entry]}>{siteLocaleLabels[entry]}</Link>
              ))}
            </div>
          </details>
          <Link href={sitePath(locale, "/quote")} className="site-cta">{t("chrome.quote")}</Link>
        </div>
        {/* A native disclosure rather than a client component: it is keyboard
          * accessible on its own, ships no JavaScript, and a navigation renders
          * the header again already closed. */}
        <details className="site-menu">
          <summary className="site-menu-button" aria-label={t("chrome.menu")}><List className="site-menu-open-icon" size={19} aria-hidden="true"/><X className="site-menu-close-icon" size={19} aria-hidden="true"/><span>{t("chrome.menu")}</span></summary>
          <div className="site-menu-panel">
            {navigation.map((item) => (
              <Link key={item.path} href={sitePath(locale, item.path)} className="site-menu-link" aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
            ))}
            <Link href={sitePath(locale, "/track")} className="site-menu-link" aria-current={isCurrent("/track", path) ? "page" : undefined}>{t("chrome.track")}</Link>
            <Link href="/portal" className="site-menu-link">{t("chrome.portal")}</Link>
            {/* The header's quote button is hidden on the narrowest screens, so the
              * menu carries it there instead of losing the primary action. */}
            <Link href={sitePath(locale, "/quote")} className="site-menu-link site-menu-quote">{t("chrome.quote")}</Link>
          </div>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter({ locale, path }: { locale: SiteLocale; path: string }) {
  const t = siteTranslator(locale);
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div className="site-footer-brand">
          <SiteLogo locale={locale}/>
          <p className="site-footer-tagline">{t("company.tagline")}</p>
          <p className="site-footer-note">{t("company.established")}</p>
        </div>
        <div className="site-footer-col">
          <h2 className="site-footer-heading">{t("chrome.footer_company")}</h2>
          {navigation.map((item) => (
            <Link key={item.path} href={sitePath(locale, item.path)} className="site-footer-link" aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
          ))}
        </div>
        <div className="site-footer-col">
          <h2 className="site-footer-heading">{t("chrome.footer_services")}</h2>
          <Link href={sitePath(locale, "/quote")} className="site-footer-link">{t("chrome.quote")}</Link>
          <Link href={sitePath(locale, "/track")} className="site-footer-link">{t("chrome.track")}</Link>
          <Link href="/portal" className="site-footer-link">{t("chrome.portal")}</Link>
        </div>
        <div className="site-footer-col">
          <h2 className="site-footer-heading">{t("chrome.footer_contact")}</h2>
          <p className="site-footer-address">{company.addressLines.join(", ")}</p>
          <a href={`tel:${company.phones[0].replace(/[^+\d]/g, "")}`} className="site-footer-link">{company.phones[0]}</a>
          <a href={`mailto:${company.email}`} className="site-footer-link">{company.email}</a>
          {/* The one social profile KCPL runs. It is linked here as well as
            * declared in the schema graph, so the machine-readable claim and
            * the page agree. */}
          <a href={company.instagram} className="site-footer-link site-footer-social" rel="me noreferrer" target="_blank"><InstagramLogo size={15} aria-hidden="true"/> Instagram</a>
        </div>
      </div>
      <div className="site-footer-base">
        <p>© {new Date().getFullYear()} {company.name} {t("chrome.rights")}</p>
        <p>{t("chrome.photo_note")}</p>
        <Link href={sitePath(locale, "/privacy")} className="site-footer-link" aria-current={isCurrent("/privacy", path) ? "page" : undefined}>{t("chrome.privacy")}</Link>
        <Link href={sitePath(locale, "/terms")} className="site-footer-link" aria-current={isCurrent("/terms", path) ? "page" : undefined}>{t("chrome.terms")}</Link>
      </div>
    </footer>
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
      <main id="main">{children}</main>
      <SiteFooter locale={locale} path={path}/>
    </div>
  );
}
