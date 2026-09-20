"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, FileText, LayoutDashboard, LogOut, Receipt, Send, Truck } from "lucide-react";
import type { ReactNode } from "react";
import type { PortalCapabilities } from "./portal-access-policy";

type PortalNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  requires?: keyof PortalCapabilities;
};

const navigation: PortalNavItem[] = [
  { href: "/portal", label: "Overview", icon: <LayoutDashboard size={15} strokeWidth={1.75} aria-hidden="true"/> },
  { href: "/portal/shipments", label: "Shipments", icon: <Truck size={15} strokeWidth={1.75} aria-hidden="true"/> },
  { href: "/portal/documents", label: "Documents", icon: <FileText size={15} strokeWidth={1.75} aria-hidden="true"/> },
  { href: "/portal/invoices", label: "Invoices", icon: <Receipt size={15} strokeWidth={1.75} aria-hidden="true"/>, requires: "canViewFinance" },
  { href: "/portal/requests", label: "Quotes & requests", icon: <Send size={15} strokeWidth={1.75} aria-hidden="true"/> },
  { href: "/portal/settings", label: "Settings", icon: <BellRing size={15} strokeWidth={1.75} aria-hidden="true"/> },
];

function initialsFor(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";
}

function isActive(pathname: string, href: string) {
  return href === "/portal" ? pathname === "/portal" : pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalShell({
  children,
  customerName,
  accountEmail,
  capabilities,
}: {
  children: ReactNode;
  customerName: string;
  accountEmail: string;
  capabilities: PortalCapabilities;
}) {
  const pathname = usePathname() ?? "/portal";
  const items = navigation.filter((item) => !item.requires || capabilities[item.requires] === true);

  return (
    <div className="kcpl-admin-shell portal-shell">
      <a className="portal-skip-link" href="#portal-content">Skip to content</a>
      <header className="portal-topbar">
        <Link href="/portal" className="portal-brand" aria-label="KCPL customer portal overview">
          <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={26} height={26} priority/>
          <span className="portal-brand-text">
            <strong>KCPL</strong>
            <small>Customer portal</small>
          </span>
        </Link>
        <nav className="portal-nav" aria-label="Customer portal">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="portal-nav-link"
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="portal-account">
          <span className="portal-account-initials" aria-hidden="true">{initialsFor(customerName)}</span>
          <span className="portal-account-meta">
            <strong>{customerName}</strong>
            <small>{accountEmail}</small>
          </span>
          <a href="/api/portal/session?logout=1" className="portal-signout" aria-label="Sign out of the KCPL customer portal">
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true"/>
          </a>
        </div>
      </header>
      <div id="portal-content" tabIndex={-1} className="kcpl-admin-content">{children}</div>
      <footer className="portal-footer">
        <span>Kapileshwor Cargo Pvt. Ltd. · Kathmandu, Nepal</span>
        <Link href="/">Public website</Link>
      </footer>
    </div>
  );
}
