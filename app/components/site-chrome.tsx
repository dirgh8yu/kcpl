import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { company } from "../company-data";
import { siteAlternatePath, siteLocaleLabels, sitePath, siteTranslator, type SiteLocale } from "../site-i18n";

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
          {/* A plain link, not a client-side toggle: the other language is a different
            * URL, and search engines and a shared link should both land on it. */}
          <Link href={siteAlternatePath(locale, path)} className="site-lang" hrefLang={locale === "en" ? "ne" : "en"} lang={locale === "en" ? "ne" : "en"}>
            {siteLocaleLabels[locale === "en" ? "ne" : "en"]}
          </Link>
          <Link href={sitePath(locale, "/quote")} className="site-cta">{t("chrome.quote")}</Link>
        </div>
        {/* A native disclosure rather than a client component: it is keyboard
          * accessible on its own, ships no JavaScript, and a navigation renders
          * the header again already closed. */}
        <details className="site-menu">
          <summary className="site-menu-button">{t("chrome.menu")}</summary>
          <div className="site-menu-panel">
            {navigation.map((item) => (
              <Link key={item.path} href={sitePath(locale, item.path)} className="site-menu-link" aria-current={isCurrent(item.path, path) ? "page" : undefined}>{t(item.key)}</Link>
            ))}
            <Link href={sitePath(locale, "/track")} className="site-menu-link" aria-current={isCurrent("/track", path) ? "page" : undefined}>{t("chrome.track")}</Link>
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
        </div>
      </div>
      <div className="site-footer-base">
        <p>© {new Date().getFullYear()} {company.name}. {t("chrome.rights")}</p>
      </div>
    </footer>
  );
}

/** Every marketing page is this sandwich, so the chrome can never drift between them. */
export function SiteShell({ locale, path, children }: { locale: SiteLocale; path: string; children: ReactNode }) {
  return (
    <div className={`site-root${locale === "ne" ? " site-root-ne" : ""}`} lang={locale === "ne" ? "ne-NP" : undefined}>
      <SiteHeader locale={locale} path={path}/>
      <main id="main">{children}</main>
      <SiteFooter locale={locale} path={path}/>
    </div>
  );
}
