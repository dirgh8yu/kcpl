"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, Building2, FileText, LayoutDashboard, LogOut, Receipt, Send, Truck } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { PortalCapabilities } from "./portal-access-policy";
import type { PortalSession } from "./portal-auth";
import { portalLocaleTags, portalTranslator, type PortalTextKey } from "./portal-i18n";

type PortalNavItem = {
  href: string;
  label: PortalTextKey;
  icon: ReactNode;
  requires?: keyof PortalCapabilities;
};

const navigation: PortalNavItem[] = [
  { href: "/portal", label: "chrome.overview", icon: <LayoutDashboard size={15} strokeWidth={1.75} aria-hidden="true"/> },
  { href: "/portal/shipments", label: "chrome.shipments", icon: <Truck size={15} strokeWidth={1.75} aria-hidden="true"/> },
  { href: "/portal/documents", label: "chrome.documents", icon: <FileText size={15} strokeWidth={1.75} aria-hidden="true"/> },
  { href: "/portal/invoices", label: "chrome.invoices", icon: <Receipt size={15} strokeWidth={1.75} aria-hidden="true"/>, requires: "canViewFinance" },
  { href: "/portal/requests", label: "chrome.requests", icon: <Send size={15} strokeWidth={1.75} aria-hidden="true"/> },
  { href: "/portal/settings", label: "chrome.settings", icon: <BellRing size={15} strokeWidth={1.75} aria-hidden="true"/> },
];

function initialsFor(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";
}

function isActive(pathname: string, href: string) {
  return href === "/portal" ? pathname === "/portal" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The customer switcher for an agent buying under several KCPL records.
 *
 * Rendered only when there is something to switch between, so the ordinary
 * single-customer account sees no control it will never use.
 *
 * Switching returns to the overview rather than refreshing in place. The
 * current page is usually a record -- a shipment, an invoice -- that belongs
 * to the customer being switched away from, and reloading it under the new
 * scope would show a not-found where a document used to be.
 */
function CustomerSwitcher({ session }: { session: PortalSession }) {
  const t = portalTranslator(session.locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function switchTo(customerId: string) {
    if (customerId === session.customerId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/portal/customer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        setError(body.error || t("chrome.account_switch_failed"));
        return;
      }
      router.push("/portal");
      router.refresh();
    } catch {
      setError(t("chrome.account_switch_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-customer-switch">
      <Building2 size={15} strokeWidth={1.75} aria-hidden="true"/>
      <label className="portal-sr-only" htmlFor="portal-customer-switch">{t("chrome.account")}</label>
      <select
        id="portal-customer-switch"
        value={session.customerId}
        disabled={busy}
        onChange={(event) => switchTo(event.target.value)}
      >
        {session.customers.map((customer) => (
          <option key={customer.id} value={customer.id}>{customer.name}</option>
        ))}
      </select>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}

export function PortalShell({ children, session }: { children: ReactNode; session: PortalSession }) {
  const pathname = usePathname() ?? "/portal";
  const t = portalTranslator(session.locale);
  const items = navigation.filter((item) => !item.requires || session.capabilities[item.requires] === true);
  const multiCustomer = session.customers.length > 1;

  return (
    // `lang` carries to assistive technology and hyphenation; `data-locale` is
    // what switches the Devanagari face, which only the portal needs.
    <div className="kcpl-admin-shell portal-shell" lang={portalLocaleTags[session.locale]} data-locale={session.locale}>
      <a className="portal-skip-link" href="#portal-content">{t("chrome.skip")}</a>
      <header className="portal-topbar">
        <Link href="/portal" className="portal-brand" aria-label="KCPL customer portal overview">
          <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={26} height={26} priority/>
          <span className="portal-brand-text">
            <strong>KCPL</strong>
            <small>{t("chrome.brand_sub")}</small>
          </span>
        </Link>
        <nav className="portal-nav" aria-label={t("chrome.nav_label")}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="portal-nav-link"
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {item.icon}
              <span>{t(item.label)}</span>
            </Link>
          ))}
        </nav>
        <div className="portal-account">
          {multiCustomer ? <CustomerSwitcher session={session}/> : null}
          <span className="portal-account-initials" aria-hidden="true">{initialsFor(session.customerName)}</span>
          <span className="portal-account-meta">
            <strong>{session.customerName}</strong>
            <small>{session.email}</small>
          </span>
          <a href="/api/portal/session?logout=1" className="portal-signout" aria-label={t("chrome.sign_out")}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true"/>
          </a>
        </div>
      </header>
      <div id="portal-content" tabIndex={-1} className="kcpl-admin-content">{children}</div>
      <footer className="portal-footer">
        <span>{t("chrome.footer")}</span>
        <Link href="/">{t("chrome.public_site")}</Link>
      </footer>
    </div>
  );
}
