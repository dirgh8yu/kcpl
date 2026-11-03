"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Truck } from "lucide-react";

const links = [
  { href: "/partner", label: "Shipments", icon: <Truck size={15} strokeWidth={1.75} aria-hidden="true"/> },
  { href: "/partner/tenders", label: "Tender desk", icon: <ClipboardList size={15} strokeWidth={1.75} aria-hidden="true"/> },
];

function active(pathname: string, href: string) {
  return href === "/partner" ? pathname === "/partner" || pathname.startsWith("/partner/shipments") : pathname === href || pathname.startsWith(`${href}/`);
}

export function PartnerNav() {
  const pathname = usePathname() || "/partner";
  return (
    <nav className="portal-nav" aria-label="Partner portal">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="portal-nav-link" aria-current={active(pathname, link.href) ? "page" : undefined}>
          {link.icon}
          <span>{link.label}</span>
        </Link>
      ))}
    </nav>
  );
}
